const CACHE_VERSION = '3.3.10.2'
const CACHE_NAME = `lt-v3-${CACHE_VERSION}`
// 用于在 Cache 中标记 SPA shell (index.html) 的固定 key
const INDEX_KEY = new Request('/?__sw_index=1')

// ===== 强制更新机制：检测从 3.0 以下版本（v2）升级，展示遮罩引导更新 =====
// 使用持久化标记（Cache 条目）而非内存变量，确保 SW 重启/崩溃后仍能恢复
const FORCE_UPDATE_CACHE = 'lt-force-update'
const FORCE_UPDATE_KEY = '/__sw_force_update'
// 内存缓存：本次 SW 生命周期内是否已完成启动检测，避免每次导航都读 Cache
let _forceUpdateChecked = false

// ===== 静态资源长期缓存：不随版本更新删除 =====
const STATIC_CACHE_NAME = 'lt-static'
const STATIC_CACHE_PATHS = ['/logos/', '/fonts/', '/img/', '/sprites/']

// ===== 二级版本缓存：仅在 minor 版本变更时清除（如 3.3.x → 3.4.x） =====
const MINOR_VERSION = CACHE_VERSION.split('.').slice(0, 2).join('.')
const MINOR_CACHE_NAME = `lt-v3-minor-${MINOR_VERSION}`
const MINOR_CACHE_PATHS = ['/app-icon/', '/assets/']

// ===== 激活时保留的缓存白名单 =====
const PROTECTED_CACHES = [CACHE_NAME, STATIC_CACHE_NAME, MINOR_CACHE_NAME, FORCE_UPDATE_CACHE]

// ===== Install: 预缓存 SPA shell (index.html) + v2→v3 升级检测 =====
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      let shouldSkip = !self.registration.active

      // 检测是否从 3.0 以下版本升级：存在活跃旧 SW 但无 lt-v3- 前缀缓存 → 旧版本 < 3.0
      if (self.registration.active) {
        const cacheNames = await caches.keys()
        const hasV3Cache = cacheNames.some((n) => n.startsWith('lt-v3-'))
        if (!hasV3Cache) {
          console.log('[SW] Detected upgrade from version below 3.0, force updating')
          shouldSkip = true
          // 写入持久化标记：即使 SW 在激活前崩溃，下次 fetch 也能恢复
          const fc = await caches.open(FORCE_UPDATE_CACHE)
          await fc.put(FORCE_UPDATE_KEY, new Response('1'))
        }
      }

      // 预缓存 SPA shell
      try {
        const response = await fetch(new Request('/'))
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME)
          await cache.put(INDEX_KEY, response)
          console.log('[SW] Pre-cached index.html to INDEX_KEY')
        }
      } catch {
        console.warn('[SW] Pre-cache failed, will fallback on first navigation')
      }

      // 首次安装或 v2→v3 升级时立即激活
      if (shouldSkip) {
        console.log('[SW] skipWaiting')
        self.skipWaiting()
      }
    })()
  )
})

// ===== Activate: 清理旧缓存 + 接管客户端 =====
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => !PROTECTED_CACHES.includes(n))
          .map((n) => {
            console.log('[SW] Deleting old cache:', n)
            return caches.delete(n)
          })
      )
    ).then(() => {
      console.log(`[SW] v${CACHE_VERSION} activated, claiming clients`)
      return self.clients.claim()
    }).then(() => {
      // 通知所有已打开的标签页 SW 已更新
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_ACTIVATED', version: CACHE_VERSION })
        })
      })
    })
  )
})

// ===== Fetch: 缓存优先策略 =====
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const { request } = event
  const url = new URL(request.url)

  // 仅处理同源请求
  if (url.origin !== self.location.origin) return

  // 导航请求: 强制更新遮罩 > StaleWhileRevalidate > 离线兜底
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        // —— 启动时检测一次：是否存在持久化标记或 v2 环境 ——
        if (!_forceUpdateChecked) {
          _forceUpdateChecked = true
          const fc = await caches.open(FORCE_UPDATE_CACHE)
          const marker = await fc.match(FORCE_UPDATE_KEY)

          if (!marker && self.registration.active) {
            // 无标记但存在活跃 SW：检查是否为 v2 环境（install 事件未触发的情况，如测试/SW 重启）
            const cacheNames = await caches.keys()
            const hasV3Cache = cacheNames.some((n) => n.startsWith('lt-v3-'))
            if (!hasV3Cache) {
              console.log('[SW] Detected version below 3.0 at runtime, force updating')
              await fc.put(FORCE_UPDATE_KEY, new Response('1'))
            }
          }
        }

        // —— 强制更新标记存在，且不是遮罩页的回跳 ——
        const fc = await caches.open(FORCE_UPDATE_CACHE)
        const marker = await fc.match(FORCE_UPDATE_KEY)

        if (marker && !url.searchParams.has('__sw_updated')) {
          // 先清理所有旧版本缓存（v2 残留），确保升级后不留垃圾
          const cacheNames = await caches.keys()
          await Promise.all(
            cacheNames
              .filter((n) => !PROTECTED_CACHES.includes(n))
              .map((n) => caches.delete(n))
          )

          // 返回遮罩页：4 秒后携带 __sw_updated 参数自动刷新
          return new Response(
            '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>更新中</title>'
            + '<style>*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}'
            + 'body{background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;-webkit-font-smoothing:antialiased}'
            + '.overlay{text-align:center;padding:40px}'
            + '.overlay .title{color:#fff;font-size:18px;letter-spacing:2px;animation:pulse 2s ease-in-out infinite;user-select:none}'
            + '.overlay .hint{color:rgba(255,255,255,.35);font-size:13px;margin-top:16px;user-select:none}'
            + '@keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}'
            + '</style></head><body><div class="overlay">'
            + '<p class="title">版本过低，正在强制更新…</p>'
            + '<p class="hint">请不要刷新网页</p>'
            + '</div><script>setTimeout(function(){location.href=location.origin+location.pathname+"?__sw_updated=1"},4000)</script></body></html>',
            { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          )
        }

        // —— 遮罩页回跳：删除强制更新标记，302 重定向到干净 URL ——
        if (url.searchParams.has('__sw_updated')) {
          await caches.delete(FORCE_UPDATE_CACHE)
          return Response.redirect(url.origin + url.pathname, 302)
        }

        // —— 正常导航逻辑 ——
        const cached = await caches.match(request)

        // 有缓存：立即返回 + 后台更新
        if (cached) {
          fetch(request)
            .then((response) => {
              if (response.ok) {
                caches.open(CACHE_NAME).then((cache) => cache.put(request, response))
              }
            })
            .catch(() => { })
          return cached
        }

        // 无缓存：尝试网络
        try {
          const response = await fetch(request)
          if (response.ok) {
            // 同时缓存：原始 key + 固定 INDEX_KEY（确保离线时总能找到 SPA shell）
            const clone1 = response.clone()
            const clone2 = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone1)
              cache.put(INDEX_KEY, clone2)
            })
          }
          return response
        } catch {
          // 网络失败：用固定 key 查找 SPA shell，注入 __SW_OFFLINE 标记
          const indexCached = await caches.match(INDEX_KEY)
          if (indexCached) {
            const body = await indexCached.text()
            const injected = body.replace(
              '</body>',
              '<script>window.__SW_OFFLINE=true;</script></body>'
            )
            return new Response(injected, {
              status: 200,
              headers: { 'Content-Type': 'text/html' },
            })
          }
          // SPA shell 完全没缓存（首次访问就离线）：返回内联极简页
          return new Response(
            '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>连接失败</title>'
            + '<style>body{display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#000;color:#fff;font-family:-apple-system,sans-serif}'
            + 'c{text-align:center;padding:40px}</style></head><body><c>'
            + '<div style="width:48px;height:48px;border-radius:50%;border:4px solid #E46962;border-right-color:transparent;display:inline-block"></div>'
            + '<h2 style="margin:24px 0 12px;color:#E46962">无法连接至服务器</h2>'
            + '<p style="color:#888;font-size:14px">请检查网络后重试</p>'
            + '</c></body></html>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          )
        }
      })()
    )
    return
  }

  // 静态资源长期缓存路径: CacheFirst（独立于版本缓存，更新时不删除）
  if (STATIC_CACHE_PATHS.some((p) => url.pathname.startsWith(p))) {
    event.respondWith(staticCacheFirst(request))
    return
  }

  // 二级版本缓存路径: CacheFirst（仅在 minor 版本升级时清除）
  if (MINOR_CACHE_PATHS.some((p) => url.pathname.startsWith(p))) {
    event.respondWith(minorCacheFirst(request))
    return
  }

  // 带 hash 的 JS/CSS: CacheFirst (内容不变，长期缓存)
  if (url.pathname.startsWith('/assets/') && /\.(js|css)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request))
    return
  }

  // 图片/字体: CacheFirst
  if (request.destination === 'image' || request.destination === 'font') {
    event.respondWith(cacheFirst(request))
    return
  }

  // changelog.md: 始终走网络，不缓存
  if (url.pathname === '/changelog.md') {
    event.respondWith(fetch(request))
    return
  }

  // 其他同源: StaleWhileRevalidate
  event.respondWith(staleWhileRevalidate(request))
})

/** CacheFirst: 优先缓存，未命中则网络请求并缓存 */
async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const clone = response.clone()
    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
  }
  return response
}

/** minorCacheFirst: 使用二级版本缓存（仅在 minor 版本升级时清除） */
async function minorCacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const clone = response.clone()
    caches.open(MINOR_CACHE_NAME).then((cache) => cache.put(request, clone))
  }
  return response
}

/** staticCacheFirst: 使用静态长期缓存（不随版本更新删除） */
async function staticCacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const clone = response.clone()
    caches.open(STATIC_CACHE_NAME).then((cache) => cache.put(request, clone))
  }
  return response
}

/** StaleWhileRevalidate: 优先缓存，同时后台更新 */
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request)
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
      }
      return response
    })
    .catch(() => cached)
  return cached || fetchPromise
}

// ===== 消息处理 =====
self.addEventListener('message', (event) => {
  if (!event.data) return

  if (event.data === 'SKIP_WAITING' || event.data?.type === 'SKIP_WAITING') {
    console.log('[SW] skipWaiting')
    self.skipWaiting()
  }

  if (event.data?.type === 'GET_VERSION') {
    event.ports[0]?.postMessage({ type: 'VERSION_RESPONSE', version: CACHE_VERSION })
  }

  if (event.data?.type === 'GET_POPUP_DATA') {
    const currentVersion = event.data.currentVersion || 'v0.0.0'
    const port = event.ports[0]
    if (!port) return

    event.waitUntil(
      (async () => {
        try {
          const response = await fetch('/changelog.md')
          if (!response.ok) throw new Error('Failed to fetch changelog')
          const md = await response.text()
          const content = extractChangelog(md, currentVersion, CACHE_VERSION)
          port.postMessage({
            type: 'POPUP_DATA_RESPONSE',
            popupData: {
              title: '发现新版本',
              content,
              buttons: [
                { text: '暂不更新', style: 'outline', action: 'close' },
                { text: '立即更新', style: 'fill', action: 'update_sw' },
              ],
            },
            version: CACHE_VERSION,
          })
        } catch (e) {
          console.warn('[SW] Failed to load changelog:', e)
          port.postMessage({
            type: 'POPUP_DATA_RESPONSE',
            popupData: {
              title: '发现新版本',
              content: '',
              buttons: [
                { text: '暂不更新', style: 'outline', action: 'close' },
                { text: '立即更新', style: 'fill', action: 'update_sw' },
              ],
            },
            version: CACHE_VERSION,
          })
        }
      })()
    )
  }
})

// ===== 更新日志解析 =====

/** 解析版本字符串为数字数组 */
function parseVersion(v) {
  return v.replace(/^v/, '').split('.').map(Number)
}

/** 比较两个版本数组：a > b 返回 1，a < b 返回 -1，相等返回 0 */
function cmpVersion(a, b) {
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const aa = a[i] || 0
    const bb = b[i] || 0
    if (aa > bb) return 1
    if (aa < bb) return -1
  }
  return 0
}

/**
 * 从 changelog markdown 中提取版本范围内的更新内容
 * @param {string} md - markdown 原文
 * @param {string} currentVersion - 当前版本号
 * @param {string} targetVersion - 目标版本号
 * @returns {string} 筛选后的 markdown 片段
 */
function extractChangelog(md, currentVersion, targetVersion) {
  const cur = parseVersion(currentVersion)
  const tgt = parseVersion(targetVersion)

  const sections = []
  const re = /^###\s+v?(\d+\.\d+\.\d+)\s*$/gm
  let match
  let lastEnd = 0

  while ((match = re.exec(md)) !== null) {
    if (sections.length > 0) {
      sections[sections.length - 1].raw = md.slice(lastEnd, match.index).trim()
    }
    sections.push({ version: match[1], raw: '' })
    lastEnd = match.index + match[0].length
  }
  if (sections.length > 0) {
    sections[sections.length - 1].raw = md.slice(lastEnd).trim()
  }

  const filtered = sections.filter((s) => {
    const v = parseVersion(s.version)
    return cmpVersion(v, cur) > 0 && cmpVersion(v, tgt) <= 0
  })

  return filtered.map((s) => `### v${s.version}\n\n${s.raw}`).join('\n\n')
}

const CACHE_VERSION = '3.1.0'
const CACHE_NAME = `lt-v3-${CACHE_VERSION}`
// 用于在 Cache 中标记 SPA shell (index.html) 的固定 key
const INDEX_KEY = new Request('/?__sw_index=1')

// ===== Install: 预缓存 SPA shell (index.html) =====
// 确保首次安装后 INDEX_KEY 就有值，离线时总能找到 SPA shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    fetch(new Request('/'))
      .then((response) => {
        if (response.ok) {
          return caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Pre-cached index.html to INDEX_KEY')
            return cache.put(INDEX_KEY, response)
          })
        }
      })
      .catch(() => console.warn('[SW] Pre-cache failed, will fallback on first navigation'))
  )
  // 首次安装时跳过等待立即激活；后续更新由客户端根据版本号决定是否 skipWaiting
  if (!self.registration.active) {
    console.log('[SW] First install, skipWaiting')
    self.skipWaiting()
  }
})

// ===== Activate: 清理旧缓存 + 接管客户端 =====
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n !== CACHE_NAME)
          .map((n) => {
            console.log('[SW] Deleting old cache:', n)
            return caches.delete(n)
          })
      )
    ).then(() => {
      console.log(`[SW] v${CACHE_VERSION} activated, claiming clients`)
      return self.clients.claim()
    })
  )
})

// ===== Fetch: 缓存优先策略（始终先让用户用上） =====
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const { request } = event
  const url = new URL(request.url)

  // 仅处理同源请求
  if (url.origin !== self.location.origin) return

  // 导航请求: StaleWhileRevalidate + 离线兜底到 SPA 诊断页
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
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

// ===== V2 消息协议兼容 =====
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
    event.ports[0]?.postMessage({
      type: 'POPUP_DATA_RESPONSE',
      popupData: {
        title: '有新版本可用',
        content: `
        <h3>宣传视频已发布，还请多多三连呀~😭👊<br>⚠️ 本次更新前请务必导出您的T显编辑器的数据，更新不保证100%不造成损坏！</h3><br>
        <h4>👾 更新日志：</h4>
        <p>[+] 重构T显可视化编辑器<br>[+] 特殊符号页添加预览验证功能<br>[+] 新卡片：Paul指令社区、MC指令音乐站<br>[+] 下载页支持选择历史版本<br>[~] 修复下载页密码复制失败<br>[↑] 指令音符盒同步v2.0</p>
        `,
        buttons: [
          { text: '立即更新', style: 'fill', action: 'update_sw' },
          { text: '查看视频', style: 'outline', link: 'https://www.bilibili.com/video/BV1i6Ga6EELe/' },
        ],
      },
      version: CACHE_VERSION,
    })
  }
})

const CACHE_VERSION = '3.0.1'
const CACHE_NAME = `lt-v3-${CACHE_VERSION}`
const PRECACHE_URLS = ['/offline.html']

// ===== Install: 预缓存离线页 =====
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precaching offline page')
      return cache.addAll(PRECACHE_URLS)
    })
  )
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

// ===== Fetch: 缓存策略 =====
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const { request } = event
  const url = new URL(request.url)

  // 仅处理同源请求
  if (url.origin !== self.location.origin) return

  // 导航请求: NetworkFirst + 离线兜底
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(async () => {
          const cached = await caches.match(request)
          if (cached) return cached
          const offline = await caches.match('/offline.html')
          if (offline) return offline
          return new Response('Offline', { status: 503 })
        })
    )
    return
  }

  // 带 hash 的 JS/CSS: CacheFirst
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
        title: 'V3 重磅来袭',
        content: `
        <h3>🚀 小舟工具箱 v${CACHE_VERSION} 已就绪！</h3>
        <h4><br>全新重构v3版本震撼来袭！<br></h4>
        <p>✨ 全新界面：焕然一新的设计，清爽简洁！<br>🐌 极速性能：全新架构，加载更慢，不如原生:(<br>🗂️ 分类清晰: 将工具分为两大类，方便快速定位<br>🔎 智能搜索: 支持多种搜索引擎，满足不同需求<br>🔒 强化隐私：隐私政策透明披露，Cookie 同意自主管理！</p>
        `,
        buttons: [
          { text: '立即更新', style: 'blue', action: 'update_sw' },
          { text: '暂不更新', style: 'red', action: 'close' },
        ],
      },
      version: CACHE_VERSION,
    })
  }
})

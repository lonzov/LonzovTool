const CACHE_VERSION = 'v2.2.7';
const CACHE_NAME = `lonzovtool-cache-${CACHE_VERSION}`;

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/index.js',
  '/c/conver.css',
  '/c/execute/index.html',
  '/c/execute/script.js',
  '/c/fuhao/index.html',
  '/c/fuhao/iconList.js',
  '/c/qjzh/index.html',
  '/c/qjzh/script.js',
  '/c/raw-json/index.html',
  '/c/raw-json/script.js',
  '/c/raw-json/style.css',
  '/c/tr/index.html',
  '/c/tr/script.js',
  '/404.html',
  '/modal.js',
  '/manifest.json',
  '/offline.html' // 离线回退页面
];

self.addEventListener('install', event => {
  // 预缓存核心资源（不强制 skipWaiting，等待用户触发更新以避免激活时破坏正在使用的页面）
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)).then(() => {
      console.log('SW install: precache complete', CACHE_NAME);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name.startsWith('lonzovtool-cache-') && name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
    .then(() => {
      console.log('SW activate: claimed clients, current cache:', CACHE_NAME);
    })
  );
});

// 核心策略：对 navigation 使用网络优先并回退到 offline.html；对静态资源使用 cache-first + stale-while-revalidate
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const request = event.request;

  // 导航请求（HTML 页面）
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(networkResponse => {
        // 只缓存有效响应（200）或 opaque（跨域允许）响应
        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
          // 仅缓存同源请求，避免将第三方脚本或分析脚本写入缓存
          try {
            const reqOrigin = new URL(request.url).origin;
            if (reqOrigin === self.location.origin) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, responseClone).catch(err => console.warn('Cache put failed for navigation:', err));
              });
            }
          } catch (e) {
            console.warn('Caching skipped (bad url):', e);
          }
        }
        return networkResponse;
      }).catch(() => caches.match(request).then(cached => cached || caches.match('/offline.html')))
    );
    return;
  }

  // 其他静态资源：cache-first, 同时后台尝试更新缓存
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      const networkFetch = fetch(request).then(networkResponse => {
        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
          try {
            const reqOrigin = new URL(request.url).origin;
            if (reqOrigin === self.location.origin) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, clone).catch(err => console.warn('Cache put failed:', err));
              });
            }
          } catch (e) {
            console.warn('Caching skipped (bad url):', e);
          }
        }
        return networkResponse;
      }).catch(() => {
        // 如果网络失败且已有缓存则返回缓存，否则抛出以让上游处理
        return cachedResponse || Promise.reject('network-failed');
      });

      return cachedResponse || networkFetch;
    })
  );
});

// 客户端可以发送消息触发 skipWaiting（建议在用户确认后发送）
self.addEventListener('message', event => {
  if (!event.data) return;
  console.log('SW message received:', event.data);

  if (event.data === 'SKIP_WAITING' || (event.data && event.data.type === 'SKIP_WAITING')) {
    console.log('SW will skipWaiting() now');
    self.skipWaiting();
  }

  // 响应版本查询请求
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      type: 'VERSION_RESPONSE',
      version: CACHE_VERSION
    });
  }
});

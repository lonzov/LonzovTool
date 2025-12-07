const CACHE_VERSION = 'v2.0.1';
const CACHE_NAME = `my-app-cache-${CACHE_VERSION}`;

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/index.js',
  '/c/conver.css',
  '/404.html',
  '/modal.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CORE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name.startsWith('my-app-cache-') && name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// 核心策略：网络优先 + 自动缓存新资源
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  // 1. 尝试网络请求
  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // 2. 网络成功：克隆响应存入缓存
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return networkResponse;
      })
      .catch(() => {
        // 3. 网络失败：从缓存加载
        return caches.match(event.request).then(cachedResponse => {
          return cachedResponse || caches.match('/'); // 回退到首页
        });
      })
  );
});

// 静默更新检测（用户下次打开时生效）
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
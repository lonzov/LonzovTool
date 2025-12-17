const CACHE_VERSION = 'v2.3.7';
const CACHE_NAME = `lonzovtool-cache-${CACHE_VERSION}`;

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/index.js',
  '/style.css',
  '/c/conver.css',
  '/c/execute/',
  '/c/execute/index.html',
  '/c/execute/script.js',
  '/c/fuhao/',
  '/c/fuhao/index.html',
  '/c/fuhao/iconList.js',
  '/c/qjzh/',
  '/c/qjzh/index.html',
  '/c/qjzh/script.js',
  '/c/raw-json/',
  '/c/raw-json/index.html',
  '/c/raw-json/script.js',
  '/c/raw-json/style.css',
  '/c/tr/',
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
    }).then(() => {
      // 激活后立即强制所有客户端使用新的SW
      return self.clients.claim();
    }).then(() => {
      console.log('SW activate: claimed clients, current cache:', CACHE_NAME);
      // 通知所有客户端刷新页面以获取最新内容
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          // 发送消息让页面刷新
          client.postMessage({ type: 'UPDATE_AVAILABLE' });
        });
      });
    })
  );
});

// 核心策略：对 navigation 使用网络优先并回退到 offline.html；对静态资源使用 cache-first + stale-while-revalidate
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const request = event.request;

  // 对所有请求使用网络优先策略，失败时回退到缓存
  event.respondWith(
    fetch(request).then(networkResponse => {
      // 网络请求成功则更新缓存
      if (networkResponse && networkResponse.status === 200) {
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
      // 网络请求失败时返回缓存
      return caches.match(request).then(cached => {
        if (cached) return cached;
        // 如果是导航请求且没有缓存，则返回离线页面
        if (request.mode === 'navigate') {
          return caches.match('/offline.html');
        }
        // 其他请求在无缓存时返回错误
        throw new Error('Network request failed and no cached resource available.');
      });
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

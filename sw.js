// 2026-02-07T05:03:00+08:00
const CACHE_VERSION = 'v2.4.9.1';
const CACHE_NAME = `lonzovtool-cache-${CACHE_VERSION}`;

const CORE_ASSETS = [
  '/',
  '/index.html',
  `/index.js`,
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
  '/modal.js',
  `/update-handler.js`,
  '/alert-checker.js',
  '/manifest.json',
  '/offline.html',
  '/icon/8-bit/eat.mp3',
  '/icon/8-bit/death.mp3',
  '/icon/8-bit/move.mp3',
  '/icon/8-bit/konami.mp3',
  '/detect/sw/',
  '/detect/sw/index.html',
  '/detect/sw/script.js',
  '/detect/sw/style.css'
];

self.addEventListener('install', event => {
  // 预缓存核心资源
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CORE_ASSETS);
    }).then(() => {
      console.log('SW install: precache complete', CACHE_NAME);
      // 在安装阶段立即清除旧的my-app-cache缓存
      return caches.keys().then(cacheNames => {
        const oldAppCaches = cacheNames.filter(name => name.startsWith('my-app-cache-'));
        return Promise.all(
          oldAppCaches.map(name => {
            console.log('Deleting old cache:', name);
            return caches.delete(name);
          })
        );
      });
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
    })
  );
});

// 辅助函数：检查多个可能的路径
function checkPossiblePaths(paths) {
  if (paths.length === 0) {
    return Promise.resolve(null);
  }

  const currentPath = paths[0];
  return caches.match(currentPath).then(response => {
    if (response) {
      return response;
    } else {
      return checkPossiblePaths(paths.slice(1));
    }
  });
}

// 辅助函数：移除URL查询参数以进行缓存匹配
function stripQueryParameters(urlString) {
  const url = new URL(urlString, self.location.origin);
  return url.pathname;
}


// 核心策略：缓存优先 + 后台更新检查
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const request = event.request;

  // 处理导航请求（页面跳转）
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) {
          return cached;
        }

        return fetch(request).then(networkResponse => {
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
          return caches.match(request).then(cachedFallback => {
            if (cachedFallback) return cachedFallback;

            const url = new URL(request.url);
            const pathname = url.pathname;

            const possiblePaths = [pathname];

            // 尝试匹配可能的路径变体
            if (pathname.endsWith('/')) {
              possiblePaths.push(pathname + 'index.html');
            } else if (!pathname.includes('.')) {
              possiblePaths.push(pathname + '/index.html');
            }

            return checkPossiblePaths(possiblePaths).then(response => {
              if (response) return response;
              return caches.match('/offline.html');
            });
          });
        });
      })
    );

  }
  // 处理非导航请求
  else {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) {
          // 后台更新缓存
          event.waitUntil(
            fetch(request).then(networkResponse => {
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
            }).catch(error => {
              console.warn('后台缓存更新失败:', error);
            })
          );

          // 确保JS请求的Content-Type正确
          if (request.destination === 'script' && request.url.endsWith('.js')) {
            const contentType = cached.headers.get('content-type') || 'application/javascript';
            if (!contentType.includes('javascript')) {
              const newHeaders = new Headers(cached.headers);
              newHeaders.set('Content-Type', 'application/javascript');
              return new Response(cached.body, {
                status: cached.status,
                statusText: cached.statusText,
                headers: newHeaders
              });
            }
          }

          return cached;
        }

        return fetch(request).then(networkResponse => {
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
          // 处理JS请求失败的情况
          if (request.destination === 'script' && request.url.endsWith('.js')) {
            const url = new URL(request.url);
            const pathname = url.pathname;

            const possiblePaths = [pathname];

            return checkPossiblePaths(possiblePaths).then(response => {
              if (response) {
                // 确保JS文件的Content-Type正确
                const contentType = response.headers.get('content-type') || 'application/javascript';
                if (!contentType.includes('javascript')) {
                  const newHeaders = new Headers(response.headers);
                  newHeaders.set('Content-Type', 'application/javascript');
                  return new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: newHeaders
                  });
                }
                return response;
              }
              throw new Error('Network request failed and no cached resource available.');
            });
          }

          throw new Error('Network request failed and no cached resource available.');
        });
      })
    );
  }
});

// 客户端可以发送消息触发 skipWaiting
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

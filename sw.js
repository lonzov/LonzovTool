const CACHE_VERSION = 'v2.4.0';
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
  '/modal.js',
  '/update-handler.js',
  '/manifest.json',
  '/offline.html',
  '/icon/8-bit/eat.mp3',
  '/icon/8-bit/death.mp3',
  '/icon/8-bit/move.mp3',
  '/icon/8-bit/konami.mp3'
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
      // 继续尝试下一个路径
      return checkPossiblePaths(paths.slice(1));
    }
  });
}

// 核心策略：缓存优先 + 后台更新检查
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const request = event.request;

  // 对导航请求使用缓存优先策略
  if (request.mode === 'navigate') {
    event.respondWith(
      // 首先尝试从缓存获取
      caches.match(request).then(cached => {
        if (cached) {
          // 如果缓存中有，则立即返回缓存内容
          return cached;
        }

        // 如果缓存中没有，尝试网络请求
        return fetch(request).then(networkResponse => {
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
          // 网络请求失败时返回缓存变体或离线页面
          return caches.match(request).then(cachedFallback => {
            if (cachedFallback) return cachedFallback;

            // 尝试匹配可能的变体路径
            const url = new URL(request.url);
            const pathname = url.pathname;

            // 创建可能的路径变体数组
            const possiblePaths = [pathname];

            if (pathname.endsWith('/')) {
              // 目录路径，尝试匹配 index.html
              possiblePaths.push(pathname + 'index.html');
            } else if (!pathname.includes('.')) {
              // 没有扩展名的路径，尝试匹配 /index.html
              possiblePaths.push(pathname + '/index.html');
            }

            // 检查每个可能的路径
            return checkPossiblePaths(possiblePaths).then(response => {
              if (response) return response;
              return caches.match('/offline.html');
            });
          });
        });
      })
    );

  }
  // 对于非导航请求（如JS、CSS、图片等），使用缓存优先策略
  else {
    event.respondWith(
      caches.match(request).then(cached => {
        // 如果缓存中有，则立即返回缓存内容
        if (cached) {
          // 在后台更新缓存
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

          // 如果是 JS 请求，确保设置正确的 Content-Type 头部
          if (request.destination === 'script' && request.url.endsWith('.js')) {
            const contentType = cached.headers.get('content-type') || 'application/javascript';
            if (!contentType.includes('javascript')) {
              // 克隆响应并添加正确的 Content-Type 头部
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

        // 如果缓存中没有，尝试网络请求
        return fetch(request).then(networkResponse => {
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
          // 网络请求失败，尝试匹配 JS 请求的可能路径变体
          if (request.destination === 'script' && request.url.endsWith('.js')) {
            const url = new URL(request.url);
            const pathname = url.pathname;

            // 对于 JS 请求，尝试匹配可能的路径变体
            const possiblePaths = [pathname];

            // 检查每个可能的路径
            return checkPossiblePaths(possiblePaths).then(response => {
              if (response) {
                // 对于 JS 文件，确保设置正确的 Content-Type 头部
                const contentType = response.headers.get('content-type') || 'application/javascript';
                if (!contentType.includes('javascript')) {
                  // 克隆响应并添加正确的 Content-Type 头部
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
              // 如果找不到匹配项，抛出错误
              throw new Error('Network request failed and no cached resource available.');
            });
          }

          // 其他情况抛出错误
          throw new Error('Network request failed and no cached resource available.');
        });
      })
    );
  }
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

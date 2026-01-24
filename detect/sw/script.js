document.addEventListener('DOMContentLoaded', () => {
    const currentVersionEl = document.getElementById('current-version');
    const updateTimeEl = document.getElementById('update-time');
    const swCountEl = document.getElementById('sw-count');
    const activeSwEl = document.getElementById('active-sw');
    const waitingSwEl = document.getElementById('waiting-sw');
    const installingSwEl = document.getElementById('installing-sw');
    const cacheVersionsEl = document.getElementById('cache-versions');
    const serverConnectivityEl = document.getElementById('server-connectivity');
    const cacheSizeEl = document.getElementById('cache-size');
    const storageQuotaEl = document.getElementById('storage-quota');
    const swStatusEl = document.getElementById('sw-status');
    const clearCacheBtn = document.getElementById('clear-cache-btn');
    const debugToggle = document.getElementById('debug-toggle');
    const debugLog = document.getElementById('debug-log');

    // 深浅色模式
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    window.addEventListener('storage', (e) => {
        if (e.key === 'theme') {
            document.documentElement.setAttribute('data-theme', e.newValue || 'light');
        }
    });

    // 从localStorage获取版本信息
    let VERSION = '未知版本';

    // 优先使用localStorage中保存的SW版本
    if ('localStorage' in window) {
        const savedVersion = localStorage.getItem('current_sw_version');
        if (savedVersion && savedVersion !== '未知') {
            VERSION = savedVersion;
        }
    }
    
    // 检测函数
    async function detectCurrentVersion() {
        try {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('版本检测超时')), 10000);
            });

            // 首先尝试获取SW中的版本信息
            const swVersionPromise = getSWVersion();
            const swVersion = await Promise.race([swVersionPromise, timeoutPromise]);

            if (swVersion && swVersion !== 'SW未激活' && swVersion !== '未知版本') {
                currentVersionEl.textContent = swVersion;
            } else {
                // 如果SW版本不可用，则使用页面版本
                currentVersionEl.textContent = VERSION;
            }
        } catch (error) {
            if (error.message === '版本检测超时') {
                console.warn('版本检测超时:', error);
                currentVersionEl.textContent = '获取超时';
            } else {
                console.error('版本检测失败:', error);
                currentVersionEl.textContent = '获取失败';
            }
        }
    }

    async function detectUpdateTime() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            // 尝试获取页面或资源的最后修改时间
            const response = await fetch(window.location.href, {
                method: 'HEAD',
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            const lastModified = response.headers.get('Last-Modified');

            if (lastModified) {
                updateTimeEl.textContent = new Date(lastModified).toLocaleString();
            } else {
                updateTimeEl.textContent = '无法获取';
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn('获取更新时间超时:', error);
                updateTimeEl.textContent = '获取超时';
            } else {
                console.warn('无法获取更新时间:', error);
                updateTimeEl.textContent = '无法获取';
            }
        }
    }

    async function detectSWRegistrations() {
        if ('serviceWorker' in navigator) {
            // 设置5秒超时
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('SW注册检测超时')), 5000);
            });

            try {
                const registrationsPromise = navigator.serviceWorker.getRegistrations();
                const registrations = await Promise.race([registrationsPromise, timeoutPromise]);

                swCountEl.textContent = registrations.length;

                activeSwEl.textContent = '无';
                waitingSwEl.textContent = '无';
                installingSwEl.textContent = '无';

                for (const registration of registrations) {
                    if (registration.active) {
                        activeSwEl.textContent = registration.active.scriptURL.split('/').pop() || registration.active.scriptURL;
                    }
                    if (registration.waiting) {
                        waitingSwEl.textContent = registration.waiting.scriptURL.split('/').pop() || registration.waiting.scriptURL;
                    }
                    if (registration.installing) {
                        installingSwEl.textContent = registration.installing.scriptURL.split('/').pop() || registration.installing.scriptURL;
                    }
                }
            } catch (error) {
                // 超时或其他错误情况下，设置为"检测失败"
                if (error.message === 'SW注册检测超时') {
                    console.warn('获取SW注册信息超时:', error);
                    swCountEl.textContent = '检测失败';
                    activeSwEl.textContent = '检测失败';
                    waitingSwEl.textContent = '检测失败';
                    installingSwEl.textContent = '检测失败';
                } else {
                    console.error('获取SW注册信息失败:', error);
                    swCountEl.textContent = '检测失败';
                    activeSwEl.textContent = '检测失败';
                    waitingSwEl.textContent = '检测失败';
                    installingSwEl.textContent = '检测失败';
                }
            }
        } else {
            swCountEl.textContent = '不支持';
            activeSwEl.textContent = '无';
            waitingSwEl.textContent = '无';
            installingSwEl.textContent = '无';
        }
    }

    async function detectCacheVersions() {
        if ('caches' in window) {
            try {
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('缓存版本检测超时')), 10000);
                });

                const cacheNamesPromise = caches.keys();

                const cacheNames = await Promise.race([cacheNamesPromise, timeoutPromise]);
                if (cacheNames.length > 0) {
                    // 显示缓存名称和其中的资源数量
                    const cacheDetails = [];
                    for (const cacheName of cacheNames) {
                        const cache = await caches.open(cacheName);
                        const requests = await cache.keys();
                        cacheDetails.push(`${cacheName} (${requests.length}个资源)`);
                    }
                    cacheVersionsEl.textContent = cacheDetails.join(', ');

                    // 详细信息按钮，展开调试日志
                    if (!document.getElementById('view-cache-details')) {
                        const button = document.createElement('button');
                        button.id = 'view-cache-details';
                        button.textContent = '查看详细';
                        button.className = 'debug-button';
                        button.style.marginLeft = '10px';
                        button.onclick = showCacheDetails;

                        const parent = cacheVersionsEl.parentElement;
                        parent.appendChild(button);
                    }
                } else {
                    cacheVersionsEl.textContent = '无缓存';
                }
            } catch (error) {
                if (error.message === '缓存版本检测超时') {
                    console.warn('获取缓存名称超时:', error);
                    cacheVersionsEl.textContent = '获取超时';
                } else {
                    console.error('获取缓存名称失败:', error);
                    cacheVersionsEl.textContent = '获取失败';
                }
            }
        } else {
            cacheVersionsEl.textContent = '不支持Cache API';
        }
    }

    async function testServerConnectivity() {
        const pingBalls = serverConnectivityEl.querySelectorAll('.ping-ball');
        const results = [];
        const MAX_TESTS = 5;
        const SINGLE_TIMEOUT = 10000;

        pingBalls.forEach(ball => {
            ball.className = 'ping-ball';
        });

        for (let i = 0; i < MAX_TESTS; i++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), SINGLE_TIMEOUT);

                const startTime = Date.now();
                const response = await fetch('https://tool.lonzov.top/', {
                    method: 'HEAD',
                    signal: controller.signal
                });
                const endTime = Date.now();
                const responseTime = endTime - startTime;

                clearTimeout(timeoutId);

                if (!controller.signal.aborted) {
                    results.push(responseTime);
                    updatePingBall(pingBalls[i], responseTime);
                    addDebugLog(`第${i + 1}次服务器连通性测试成功: ${responseTime}ms`);
                } else {
                    // 超时
                    results.push(SINGLE_TIMEOUT);
                    updatePingBall(pingBalls[i], SINGLE_TIMEOUT);
                    addDebugLog(`第${i + 1}次服务器连通性测试超时 (>=${SINGLE_TIMEOUT}ms)`);
                }
            } catch (error) {
                // 网络错误
                results.push(SINGLE_TIMEOUT);
                updatePingBall(pingBalls[i], SINGLE_TIMEOUT);
                addDebugLog(`第${i + 1}次服务器连通性测试失败: ${error.message}`);
            }
        }
    }

    // 获取ping球的CSS类
    function getPingBallClass(latency) {
        if (typeof latency === 'undefined' || latency === null) {
            return ''; // 返回空类，保持灰色
        }
        if (latency >= 10000) {
            // 超时或错误
            return 'error';
        } else if (latency < 1000) {
            // 快速响应
            return 'normal';
        } else if (latency < 2500) {
            // 较慢
            return 'warning';
        } else if (latency < 4500) {
            // 慢
            return 'warning2';
        } else {
            // 极慢
            return 'error';
        }
    }

    // 更新ping球的颜色
    function updatePingBall(ballElement, latency) {
        ballElement.className = 'ping-ball ' + getPingBallClass(latency);
    }

    async function getCacheSize() {
        if ('caches' in window) {
            try {
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('缓存大小检测超时')), 15000); // 较长的超时时间，因为可能需要处理大量缓存
                });

                const sizeCalculationPromise = (async () => {
                    let totalSize = 0;
                    const cacheNames = await caches.keys();

                    for (const cacheName of cacheNames) {
                        const cache = await caches.open(cacheName);
                        const requests = await cache.keys();

                        // 对每个请求进行处理以估算大小
                        for (const request of requests) {
                            const response = await cache.match(request);
                            if (response) {
                                // 这是一个粗略的估算方法
                                const responseText = await response.text();
                                totalSize += new Blob([responseText]).size;
                            }
                        }
                    }

                    return formatBytes(totalSize);
                })();

                const formattedSize = await Promise.race([sizeCalculationPromise, timeoutPromise]);
                cacheSizeEl.textContent = formattedSize;
            } catch (error) {
                if (error.message === '缓存大小检测超时') {
                    console.warn('获取缓存大小超时:', error);
                    cacheSizeEl.textContent = '获取超时';
                } else {
                    console.error('获取缓存大小失败:', error);
                    cacheSizeEl.textContent = '获取失败';
                }
            }
        } else {
            cacheSizeEl.textContent = '不支持';
        }
    }

    async function getStorageQuota() {
        if ('storage' in navigator && navigator.storage.estimate) {
            try {
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('存储配额检测超时')), 10000);
                });

                const quotaPromise = navigator.storage.estimate();

                const quota = await Promise.race([quotaPromise, timeoutPromise]);
                const used = quota.usage ? formatBytes(quota.usage) : '未知';
                const total = quota.quota ? formatBytes(quota.quota) : '未知';

                storageQuotaEl.textContent = `${used} / ${total}`;
            } catch (error) {
                if (error.message === '存储配额检测超时') {
                    console.warn('获取存储配额超时:', error);
                    storageQuotaEl.textContent = '获取超时';
                } else {
                    console.error('获取存储配额失败:', error);
                    storageQuotaEl.textContent = '获取失败';
                }
            }
        } else {
            storageQuotaEl.textContent = '不支持';
        }
    }

    async function detectSWStatus() {
        if ('serviceWorker' in navigator) {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('SW状态检测超时')), 5000);
            });

            try {
                const readyStatePromise = navigator.serviceWorker.ready.then(() => '就绪').catch(() => '错误');
                const controllerState = navigator.serviceWorker.controller ? '有控制器' : '无控制器';

                // 等待ready状态，但不超过超时时间
                const ready = await Promise.race([
                    readyStatePromise.catch(() => '错误'),
                    timeoutPromise
                ]);

                swStatusEl.textContent = `${ready}, ${controllerState}`;
            } catch (error) {
                if (error.message === 'SW状态检测超时') {
                    console.warn('获取SW状态超时:', error);
                    swStatusEl.textContent = '检测失败';
                } else {
                    console.error('获取SW状态失败:', error);
                    swStatusEl.textContent = '检测失败';
                }
            }
        } else {
            swStatusEl.textContent = '不支持';
        }
    }

    // 检测页面加载性能
    async function detectPageLoadPerformance() {
        if ('performance' in window) {
            try {
                const perfData = performance.getEntriesByType('navigation')[0];
                if (perfData) {
                    const loadTime = Math.round(perfData.loadEventEnd - perfData.fetchStart);
                    const domReadyTime = Math.round(perfData.domContentLoadedEventEnd - perfData.fetchStart);
                    const firstPaintTime = Math.round(perfData.responseStart - perfData.fetchStart);
                    // 添加性能信息到调试日志
                    addDebugLog(`页面加载性能: 总耗时 ${loadTime}ms, DOM准备就绪 ${domReadyTime}ms, 首次绘制 ${firstPaintTime}ms`);
                }
            } catch (error) {
                console.warn('无法获取页面加载性能信息:', error);
            }
        }
    }

    // 格式化字节大小的辅助函数
    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 获取SW版本信息
    async function getSWVersion() {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('SW版本获取超时')), 5000);
            });

            const versionPromise = new Promise((resolve) => {
                const messageChannel = new MessageChannel();
                messageChannel.port1.onmessage = (event) => {
                    if (event.data.type === 'VERSION_RESPONSE') {
                        resolve(event.data.version);
                    } else {
                        resolve('未知版本');
                    }
                };

                navigator.serviceWorker.controller.postMessage({
                    type: 'GET_VERSION'
                }, [messageChannel.port2]);
            });

            try {
                return await Promise.race([versionPromise, timeoutPromise]);
            } catch (error) {
                if (error.message === 'SW版本获取超时') {
                    console.warn('SW版本获取超时:', error);
                    return '检测失败';
                } else {
                    console.error('SW版本获取失败:', error);
                    return '检测失败';
                }
            }
        }
        return 'SW未激活';
    }

    // 清除SW缓存并强制刷新
    async function clearSWCacheAndRefresh() {
        return new Promise((resolve) => {
            showModal({
                id: 'clear-sw-cache-confirm',
                version: '1.0',
                title: '确认清除',
                forceShow: true,
                content: '<p>确定要清除所有Service Worker缓存并强制刷新页面吗？</p><p>这将导致页面重新加载且所有通过缓存保存的设置将重置，如T显可视化编辑器的编辑记录。</p>',
                buttons: [
                    { text: '取消', action: 'close', style: 'gray' },
                    { text: '确定', action: 'custom', style: 'red', customAction: { type: 'confirm_clear_cache' } }
                ]
            });

            // 监听自定义事件来处理确认操作
            const handleConfirm = (event) => {
                if (event.detail && event.detail.type === 'confirm_clear_cache') {
                    window.removeEventListener('sw_modal_action', handleConfirm);

                    performClearCacheOperation()
                        .then(resolve)
                        .catch(error => {
                            console.error('清除SW缓存失败:', error);
                            addDebugLog(`清除SW缓存失败: ${error.message}`);
                            alert('清除SW缓存时发生错误，请查看控制台了解详情。');
                            resolve();
                        });
                }
            };

            window.addEventListener('sw_modal_action', handleConfirm);
        });
    }

    async function performClearCacheOperation() {
        try {
            addDebugLog('开始清除SW缓存...');

            // 发送SKIP_WAITING消息给当前活跃的SW
            if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({type: 'SKIP_WAITING'});
                addDebugLog('已发送SKIP_WAITING消息给当前SW');
            }

            // 获取所有注册的SW
            const registrations = await navigator.serviceWorker.getRegistrations();

            // 注销所有SW
            for (const registration of registrations) {
                await registration.unregister();
                addDebugLog(`已注销SW: ${registration.scope}`);
            }

            // 清除所有缓存
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                for (const cacheName of cacheNames) {
                    await caches.delete(cacheName);
                    addDebugLog(`已删除缓存: ${cacheName}`);
                }
            }

            localStorage.clear();
            sessionStorage.clear();
            addDebugLog('已清除本地存储');

            // 强制刷新页面
            addDebugLog('正在刷新页面...');
            window.location.reload(true);
        } catch (error) {
            throw error; // 抛出错误以便上层处理
        }
    }

    
    // 显示缓存详细信息
    async function showCacheDetails() {
        if ('caches' in window) {
            try {
                const cacheNames = await caches.keys();
                addDebugLog('=== 缓存详细信息 ===');

                for (const cacheName of cacheNames) {
                    addDebugLog(`缓存名称: ${cacheName}`);
                    const cache = await caches.open(cacheName);
                    const requests = await cache.keys();

                    for (const request of requests) {
                        addDebugLog(`  - ${request.url}`);
                    }

                    addDebugLog('');
                }

                // 展开调试日志
                debugLog.style.display = 'block';
                debugToggle.textContent = '隐藏详细信息';
            } catch (error) {
                console.error('获取缓存详细信息失败:', error);
                addDebugLog(`获取缓存详细信息失败: ${error.message}`);
            }
        } else {
            addDebugLog('浏览器不支持Cache API');
        }
    }

    function addDebugLog(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.textContent = `[${timestamp}] ${message}`;
        debugLog.appendChild(logEntry);
        debugLog.scrollTop = debugLog.scrollHeight;
    }

    clearCacheBtn.addEventListener('click', clearSWCacheAndRefresh);
    debugToggle.addEventListener('click', () => {
        const isVisible = debugLog.style.display !== 'none';
        debugLog.style.display = isVisible ? 'none' : 'block';
        debugToggle.textContent = isVisible ? '显示详细信息' : '隐藏详细信息';
    });

    async function init() {
        addDebugLog('SW缓存诊断工具初始化...');

        await detectCurrentVersion();
        await detectUpdateTime();
        await detectSWRegistrations();
        await detectCacheVersions();
        await testServerConnectivity();
        await getCacheSize();
        await getStorageQuota();
        await detectSWStatus();
        await detectPageLoadPerformance();

        addDebugLog('初始化完成');
    }

    init();
});
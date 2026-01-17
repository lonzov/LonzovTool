// Service Worker 更新检查和处理 - 使用与首页相同的逻辑
if ('serviceWorker' in navigator) {
    let updateDialogShown = false; // 防止重复显示更新对话框

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
            .then(reg => {
                console.log('SW registered:', reg.scope);
                console.debug('SW registration:', reg);

                // 监听安装中状态
                reg.addEventListener('updatefound', () => {
                    const newSW = reg.installing;
                    if (!newSW) return;
                    newSW.addEventListener('statechange', () => {
                        if (newSW.state === 'installed' && navigator.serviceWorker.controller && !updateDialogShown) {
                            updateDialogShown = true;
                            openSWUpdateDialog(reg);
                        }
                    });
                });

                // 如果已有 waiting worker，立即提示用户
                if (reg.waiting && navigator.serviceWorker.controller && !updateDialogShown) {
                    console.log('SW has waiting worker - showing update banner');
                    updateDialogShown = true;
                    openSWUpdateDialog(reg);
                }
            })
            .catch(err => console.warn('SW registration failed', err));
    });

    // 当新的 service worker 接管页面时刷新页面
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('navigator.serviceWorker controllerchange -> reloading');
        window.location.reload();
    });

    // 监听来自 Service Worker 的消息
    navigator.serviceWorker.addEventListener('message', event => {
        if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
            console.log('Update available, reloading page to get fresh content...');
            // 只刷新页面，因为 updatefound 事件已经会处理更新提示
            window.location.reload();
        }
    });
}

// Service Worker 更新通知 - 与首页相同
(function () {
    function showSWUpdateModal(reg) {
        // 获取当前活动的SW版本
        let currentSWVersion = '未知';
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            currentSWVersion = localStorage.getItem('current_sw_version') || '未知';
        }

        // 获取等待安装的SW版本
        const messageChannel = new MessageChannel();
        messageChannel.port1.onmessage = function(event) {
            const newSWVersion = event.data.version;
            showUpdateDialog(currentSWVersion, newSWVersion, reg);
        };
        reg.waiting.postMessage({type: 'GET_VERSION'}, [messageChannel.port2]);
    }

    // 显示更新对话框
    function showUpdateDialog(currentVersion, newVersion, reg) {
        const updateModal = {
            title: "发现新版本",
            id: "sw_update_notification",
            version: newVersion,
            forceShow: true,
            content: `
                <p>[+] 关于页加入在线反馈和收录申请表单<br>[~] 下载页逻辑优化</p>
                <p><strong>·</strong> 新卡片：雪球T显生成器</p>
                <p><strong>·</strong> 建议/反馈请加Q群: <a href="https://qm.qq.com/q/dgYFOtx4Qg" target="_blank" style="color:var(--text-color);">587984701</a></p>
                <p style="font-size:14px;color:#666;margin-top:10px;">当前版本: ${currentVersion} → 最新版本: ${newVersion}</p>
            `,
            buttons: [
                { text: "了解更多", style: "gray", action: "open_link", url: "https://blog.lonzov.top/posts/tool-update/"},
                {
                    text: "立即更新",
                    style: "blue",
                    action: "custom",
                    customAction: {
                        type: "update_sw",
                        registration: reg
                    }
                },
                { text: "暂不更新", style: "red", action: "close" },
            ]
        };

        showModal(updateModal);
    }

    function openSWUpdateDialog(reg) {
        console.log('Service Worker 更新可用:', reg);
        showSWUpdateModal(reg);
    }

    // 挂载到全局
    window.openSWUpdateDialog = openSWUpdateDialog;

    // 监听自定义事件，处理模态框中的更新操作
    window.addEventListener('sw_modal_action', function(e) {
        if (e.detail && e.detail.type === 'update_sw') {
            const reg = e.detail.registration;

            // 创建一个临时的更新状态提示
            const updateStatusModal = {
                title: "正在更新...",
                id: "sw_update_progress",
                version: Date.now().toString(),
                forceShow: true,
                content: `<p>正在下载最新版本，请稍候...</p><div class="loading-indicator"><div class="spinner"></div></div>`,
                buttons: []
            };

            // 临时显示进度
            showModal(updateStatusModal);

            // 发送 SKIP_WAITING 消息给 Service Worker
            if (reg && reg.waiting) {
                // 监听控制器变化以刷新页面
                let controllerChangeListener = function() {
                    console.log('Service Worker 控制器已变更，刷新页面...');
                    navigator.serviceWorker.removeEventListener('controllerchange', controllerChangeListener);
                    window.location.reload();
                };

                navigator.serviceWorker.addEventListener('controllerchange', controllerChangeListener);

                reg.waiting.postMessage('SKIP_WAITING');

                // 设置超时处理
                setTimeout(() => {
                    navigator.serviceWorker.removeEventListener('controllerchange', controllerChangeListener);
                    closeModalById("sw_update_progress");

                    // 如果还没刷新，直接刷新页面
                    window.location.reload();
                }, 10000); // 10秒超时
            } else if (reg && reg.active) {
                // 如果没有waiting状态的worker但有active的，则直接刷新
                window.location.reload();
            }
        }
    });

    // 添加更新检查功能
    window.checkForUpdates = function() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(registrations) {
                for(let registration of registrations) {
                    registration.update();
                }
            });
        }
    };

    // 保存当前Service Worker版本到localStorage
    function saveCurrentSWVersion() {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            const messageChannel = new MessageChannel();
            messageChannel.port1.onmessage = function(event) {
                const swVersion = event.data.version;
                localStorage.setItem('current_sw_version', swVersion);
            };
            navigator.serviceWorker.controller.postMessage({type: 'GET_VERSION'}, [messageChannel.port2]);
        }
    }

    // 页面加载完成后获取并保存当前SW版本
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            // 等待Service Worker控制器可用后保存版本
            if (navigator.serviceWorker.controller) {
                // 如果已经有控制器，直接获取并保存版本
                saveCurrentSWVersion();
            } else {
                // 如果没有控制器，等待控制器变更事件
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    saveCurrentSWVersion();
                });
            }
        });
    }
})();
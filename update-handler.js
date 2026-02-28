// 版本号比较函数
// 返回更新类型：popup(弹窗更新)、auto(自动更新)、none(无更新)
function compareVersions(currentVersion, newVersion) {
    currentVersion = currentVersion.replace(/^v/, '');
    newVersion = newVersion.replace(/^v/, '');

    const currentParts = currentVersion.split('.').map(Number);
    const newParts = newVersion.split('.').map(Number);

    const maxLevel = Math.max(currentParts.length, newParts.length);

    for (let i = 0; i < maxLevel; i++) {
        const currentPart = i < currentParts.length ? currentParts[i] : 0;
        const newPart = i < newParts.length ? newParts[i] : 0;

        if (newPart > currentPart) {
            const level = i + 1; // 版本号级别

            // 三级版本号及以上需要弹窗，四级及以下自动更新
            if (level <= 3) {
                return { updateType: 'popup', level: level };
            } else {
                return { updateType: 'auto', level: level };
            }
        } else if (newPart < currentPart) {
            return { updateType: 'none', level: level };
        }
    }

    return { updateType: 'none', level: 0 };
}

// Service Worker 更新检查和处理
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

                            const messageChannel = new MessageChannel();
                            messageChannel.port1.onmessage = function(event) {
                                const newSWVersion = event.data.version;
                                let currentSWVersion = localStorage.getItem('current_sw_version') || '未知';

                                const versionComparison = compareVersions(currentSWVersion, newSWVersion);

                                if (versionComparison.updateType === 'popup') {
                                    openSWUpdateDialog(reg);
                                } else if (versionComparison.updateType === 'auto') {
                                    console.log(`检测到${versionComparison.level}级版本更新，将在下次加载时自动更新...`);

                                    // 标记有更新可用，下次加载时自动更新
                                    sessionStorage.setItem('sw-update-available', 'true');
                                }
                            };

                            newSW.postMessage({type: 'GET_VERSION'}, [messageChannel.port2]);
                        }
                    });
                });

                // 如果已有 waiting worker，立即提示用户
                if (reg.waiting && navigator.serviceWorker.controller && !updateDialogShown) {
                    console.log('SW has waiting worker - checking update type');

                    const messageChannel = new MessageChannel();
                    messageChannel.port1.onmessage = function(event) {
                        const newSWVersion = event.data.version;
                        let currentSWVersion = localStorage.getItem('current_sw_version') || '未知';

                        const versionComparison = compareVersions(currentSWVersion, newSWVersion);

                        if (versionComparison.updateType === 'popup') {
                            updateDialogShown = true;
                            openSWUpdateDialog(reg);
                        } else if (versionComparison.updateType === 'auto') {
                            console.log(`检测到${versionComparison.level}级版本更新，将在下次加载时自动更新...`);

                            // 标记有更新可用，下次加载时自动更新
                            sessionStorage.setItem('sw-update-available', 'true');
                        }
                    };

                    reg.waiting.postMessage({type: 'GET_VERSION'}, [messageChannel.port2]);
                }
            })
            .catch(err => console.warn('SW registration failed', err));
    });

    // 当新的 service worker 接管页面时，根据版本级别决定是否刷新页面
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        // 检查是否有标记为自动更新的版本
        const isAutoUpdate = sessionStorage.getItem('sw-update-available');
        if (isAutoUpdate) {
            console.log('Service Worker 自动更新完成，不强制刷新页面');
            sessionStorage.removeItem('sw-update-available');
        } else {
            console.log('navigator.serviceWorker controllerchange -> reloading');
            window.location.reload();
        }
    });

    // 监听来自 Service Worker 的消息
    navigator.serviceWorker.addEventListener('message', event => {
        if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
            console.log('Update available, reloading page to get fresh content...');
            window.location.reload();
        }
    });
}

// Service Worker 更新通知
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

            // 比较版本号以确定更新类型
            const versionComparison = compareVersions(currentSWVersion, newSWVersion);

            if (versionComparison.updateType === 'popup') {
                showUpdateDialog(currentSWVersion, newSWVersion, reg);
            } else if (versionComparison.updateType === 'auto') {
                console.log(`检测到${versionComparison.level}级版本更新，执行自动更新...`);

                // 直接跳过等待并激活新版本
                if (reg && reg.waiting) {
                    reg.waiting.postMessage('SKIP_WAITING');
                }
            }
            // 如果 updateType 是 'none'，则不执行任何操作
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
                <p>[~] 首页页脚样式优化<br>[+] 下拉菜单添加社交按钮栏</p>
                <p><strong>·</strong> 新卡片：Vault(原McIcon改名)</p>
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

            // 获取当前版本和新版本，以确定更新类型
            const messageChannel = new MessageChannel();
            messageChannel.port1.onmessage = function(event) {
                const newSWVersion = event.data.version;
                let currentSWVersion = localStorage.getItem('current_sw_version') || '未知';

                // 比较版本号以确定更新类型
                const versionComparison = compareVersions(currentSWVersion, newSWVersion);

                // 创建一个临时的更新状态提示
                const updateStatusModal = {
                    title: "正在更新...",
                    id: "sw_update_progress",
                    version: Date.now().toString(),
                    forceShow: true,
                    content: `<p>正在下载最新版本，请稍候...</p><div class="loading-indicator"><div class="spinner"></div></div>`,
                    buttons: []
                };
                showModal(updateStatusModal);

                // 发送 SKIP_WAITING 消息给 Service Worker
                if (reg && reg.waiting) {
                    let controllerChangeListener = function() {
                        console.log('Service Worker 控制器已变更，刷新页面...');
                        navigator.serviceWorker.removeEventListener('controllerchange', controllerChangeListener);

                        // 根据版本类型决定是否刷新
                        if (versionComparison.updateType === 'popup') {
                            window.location.reload();
                        } else {
                            closeModalById("sw_update_progress");
                        }
                    };

                    navigator.serviceWorker.addEventListener('controllerchange', controllerChangeListener);

                    reg.waiting.postMessage('SKIP_WAITING');

                    // 设置超时处理
                    setTimeout(() => {
                        navigator.serviceWorker.removeEventListener('controllerchange', controllerChangeListener);
                        closeModalById("sw_update_progress");

                        // 如果还没刷新，根据版本类型决定是否刷新页面
                        if (versionComparison.updateType === 'popup') {
                            window.location.reload();
                        }
                    }, 10000);
                } else if (reg && reg.active) {
                    // 如果没有waiting状态的worker但有active的，则根据版本类型决定是否刷新
                    if (versionComparison.updateType === 'popup') {
                        window.location.reload();
                    } else {
                        closeModalById("sw_update_progress");
                    }
                }
            };

            // 获取新版本信息
            if (reg && reg.waiting) {
                reg.waiting.postMessage({type: 'GET_VERSION'}, [messageChannel.port2]);
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
            if (navigator.serviceWorker.controller) {
                saveCurrentSWVersion();
            } else {
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    saveCurrentSWVersion();
                });
            }
        });
    }
})();
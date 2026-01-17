document.addEventListener('DOMContentLoaded', () => {
    // 读取配置数据
    let config = {};
    const configScript = document.getElementById('downloadConfig');
    if (configScript) {
        try {
            config = JSON.parse(configScript.textContent);
        } catch (e) {
            console.error("解析下载配置失败:", e);
        }
    }
    const downloadPassword = document.getElementById('downloadPassword');
    const manualDownloadLink = document.getElementById('manualDownloadLink');
    const quickDownloadBtn1 = document.getElementById('quickDownloadBtn1');
    const quickDownloadBtn2 = document.getElementById('quickDownloadBtn2');
    const copyPasswordBtn = document.getElementById('copyPasswordBtn');
    const message = document.getElementById('message');
    const quickDownloadCard = document.getElementById('quickDownloadCard');
    const manualDownloadCard = document.getElementById('manualDownloadCard');


    // 根据配置初始化值和控制显示
    let isQuickCardNeeded = false;
    let isManualCardNeeded = false;

    // 初始化密码
    if (config.lanzou?.password) {
        downloadPassword.value = config.lanzou.password;
    }

    // 初始化手动下载链接和卡片
    if (config.lanzou?.url) {
        manualDownloadLink.href = config.lanzou.url;
        isManualCardNeeded = true;
    }

    // 初始化快捷下载按钮和卡片
    // 确保两个解析按钮始终可用（因为现在都使用lanzou配置）
    if (config.lanzou?.url && config.lanzou?.password) {
        isQuickCardNeeded = true;
    }

    // 控制卡片显示
    quickDownloadCard.style.display = isQuickCardNeeded ? 'block' : 'none';
    manualDownloadCard.style.display = isManualCardNeeded ? 'block' : 'none';


    // 主题
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    window.addEventListener('storage', (e) => {
        if (e.key === 'theme') {
            document.documentElement.setAttribute('data-theme', e.newValue || 'light');
        }
    });

    // 密码复制
    copyPasswordBtn.addEventListener('click', (e) => {
        if (!downloadPassword.value) {
            showMessage('无密码可复制', false, e);
            return;
        }
        downloadPassword.select();
        try {
            const successful = document.execCommand('copy');
            showMessage(successful ? '密码已复制' : '复制失败', successful, e);
        } catch (err) {
            navigator.clipboard.writeText(downloadPassword.value)
                .then(() => showMessage('密码已复制', true, e))
                .catch(() => showMessage('复制失败', false, e));
        }
    });

    // 下载逻辑
    // 直链解析1按钮点击事件
    quickDownloadBtn1.addEventListener('click', function(e) {
        // 构建第一个API的URL - 公共解析服务
        const apiUrl1 = `https://lz.qaiu.top/parser?url=${encodeURIComponent(config.lanzou.url)}&pwd=${encodeURIComponent(config.lanzou.password)}`;
        console.log("直链解析1 (lz.qaiu.top):", apiUrl1);
        window.location.href = apiUrl1;
    });

    // 直链解析2按钮点击事件
    quickDownloadBtn2.addEventListener('click', function(e) {
        // 构建第二个API的URL - 自用api，有严格速率限制，如需使用直链解析请自行搭建服务，可参考此篇博文：https://blog.lonzov.top/posts/1/#%E7%BD%91%E7%9B%98
        const apiUrl2 = `https://api.lonzov.top/lanzou/index.php?url=${encodeURIComponent(config.lanzou.url)}&pwd=${encodeURIComponent(config.lanzou.password)}&type=down`;
        console.log("直链解析2 (api.lonzov.top):", apiUrl2);
        window.location.href = apiUrl2;
    });


    // 消息提示
    function showMessage(text, isSuccess, eventOrPosition) {
        message.textContent = text;
        message.className = 'toast show';
        message.classList.add(isSuccess ? 'success' : 'error');
        setTimeout(() => {
            message.classList.remove('show');
        }, 3000);
    }
});
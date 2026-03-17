// 白名单配置
const WHITELIST_DOMAINS = [
    'minecraft.wiki',
    'zh.minecraft.wiki',
    'wiki.bedrock.dev',
    'wiki.mcbe-dev.net',
    'bedrock.dev',
    'klpbbs.com',
    'www.minebbs.com',
    'minebbs.com',
    'cbergit.com',
    'chunkbase.com',
    'www.chunkbase.com',
    'mcpixelart.com',
    'ccvaults.com',
    'jannisx11.github.io',
    'dislink.github.io',
    'szea-ll14.github.io',
    'space.bilibili.com',
    'bilibili.com',
    'afdian.com',
    'github.com',
    'blog.lonzov.top',
    'www.yanceymc.cn',
    'projectxero.top',
    'idlist.projectxero.top',
    'www.viqu.com',
    'ca.nycx.top',
    'bsc.meteormc.cn',
    'teshuzifu.cn',
    'mcnav.net',
    'www.mcnav.net',
    'jzfk.wuaze.com',
    '3dt.easecation.net',
    'o.xbottle.top',
    'mcapks.net',
    'mt2.cn',
    'pcnk2disyt2p.feishu.cn',
    'doubao.com',
    'www.coze.cn',
    'commandsimulator.great-site.net',
    'blockcolors.app',
];

(function () {
    'use strict';

    // 动画不立即显示
    setTimeout(function () {
        var loadingContainer = document.querySelector('.loading-container');
        if (loadingContainer) {
            loadingContainer.classList.add('visible');
        }
    }, 1500);

    // 长时间未跳转提示
    const loadingText = document.querySelector('.loading-text');
    if (loadingText) {
        setTimeout(function () {
            if (loadingText) {
                loadingText.style.opacity = '0';
                setTimeout(function () {
                    loadingText.textContent = '网站延迟可能较高，请耐心等待';
                    loadingText.style.opacity = '1';
                }, 250);
            }
        }, 5500);

        setTimeout(function () {
            if (loadingText) {
                loadingText.style.opacity = '0';
                setTimeout(function () {
                    loadingText.textContent = '卡住了？尝试更换网络或代理';
                    loadingText.style.opacity = '1';
                }, 250);
            }
        }, 11000);
    }

    // 获取目标 URL 参数
    const params = new URLSearchParams(window.location.search);
    const targetUrl = params.get('url');

    // 如果没有 url 参数，或参数为空，跳转到首页
    if (!targetUrl) {
        window.location.replace('/');
        return;
    }

    // 解码 URL
    let decodedUrl = targetUrl;
    try {
        // 最多解码 3 次，防止嵌套编码
        for (let i = 0; i < 3; i++) {
            const newDecoded = decodeURIComponent(decodedUrl);
            if (newDecoded === decodedUrl) break;
            decodedUrl = newDecoded;
        }
    } catch (e) {
        // 解码失败，使用原始值
    }

    // 检查是否在白名单中
    function isInWhitelist(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            const protocol = urlObj.protocol;

            if (protocol !== 'http:' && protocol !== 'https:') {
                return false;
            }

            // 检查域名白名单
            for (const domain of WHITELIST_DOMAINS) {
                if (hostname === domain || hostname.endsWith('.' + domain)) {
                    return true;
                }
            }

            return false;
        } catch (e) {
            // 解析失败视为不安全
            return false;
        }
    }

    // 执行重定向检查
    if (isInWhitelist(decodedUrl)) {
        window.location.replace(decodedUrl);
    } else {
        window.location.replace('/?error=unauthorized');
    }
})();
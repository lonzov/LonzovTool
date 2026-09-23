import { onMounted } from 'vue'
import { getDiscreteMessage } from '../utils/discreteMessage'

// 荣耀浏览器内核会注入第三方广告容器且无法屏蔽，且不支持标准的 PWA 安装，
// 故进站即提示更换浏览器，不等广告出现。
const HONOR_BROWSER_RE = /HonorBrowser\//

// 用户关掉提示后本次会话不再重复弹，避免刷新页面反复骚扰
const DISMISS_KEY = 'honor_browser_notice_dismissed'

export function useHonorBrowserCheck() {
  onMounted(() => {
    // 构建期 vite-ssg 在 jsdom 中运行，SSR 守卫不能用 typeof window
    if (import.meta.env.SSR) return
    if (!HONOR_BROWSER_RE.test(navigator.userAgent)) return

    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') return
    } catch { /* 隐私模式下不可用，照常提示 */ }

    getDiscreteMessage()?.warning(
      '检测到正在使用荣耀浏览器，强烈建议更换为标准浏览器，例如 Edge、Chrome 等',
      {
        duration: 0,
        closable: true,
        onClose: () => {
          try {
            sessionStorage.setItem(DISMISS_KEY, '1')
          } catch { /* noop */ }
        },
      },
    )
  })
}

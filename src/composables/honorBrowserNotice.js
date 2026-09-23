import { getDiscreteMessage } from '../utils/discreteMessage'

// 用户关掉提示后本次会话不再重复弹，避免刷新页面反复骚扰
const DISMISS_KEY = 'honor_browser_notice_dismissed'

// 荣耀浏览器内核会注入第三方广告容器且无法屏蔽，且不支持标准的 PWA 安装，
// 故进站即提示更换浏览器，不等广告出现。
// UA 判断已由 useHonorGuard 完成，本模块只在确认是荣耀浏览器后被调用。
export function showHonorBrowserNotice() {
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
}

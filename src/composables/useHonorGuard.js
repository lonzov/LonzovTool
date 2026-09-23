import { onMounted, onUnmounted } from 'vue'

// 常驻主包的最小判断，只有它必须一直带着。
// 荣耀浏览器在页面渲染完成后会往 DOM 塞侧边悬浮广告，且不支持标准 PWA 安装；
// 但拦截要挂全局 MutationObserver 并全量扫一遍 DOM，对绝大多数非荣耀访客是纯开销，
// 故两个处理模块拆成独立 chunk，命中 UA 后才加载。
// UA 特征来自回放日志：HonorBrowser/3.8.1.305。
const HONOR_BROWSER_RE = /HonorBrowser\//

export function useHonorGuard() {
  let stopAdGuard = null

  onMounted(async () => {
    // 构建期 vite-ssg 在 jsdom 中运行，SSR 守卫不能用 typeof window
    if (import.meta.env.SSR) return
    if (!HONOR_BROWSER_RE.test(navigator.userAgent)) return

    try {
      const [{ useFuckHonorAdGuard }, { showHonorBrowserNotice }] = await Promise.all([
        import('./useFuckHonorAdGuard'),
        import('./honorBrowserNotice'),
      ])
      stopAdGuard = useFuckHonorAdGuard()
      showHonorBrowserNotice()
    } catch (e) {
      // 分包加载失败只损失拦截能力，不能影响主流程
      console.warn('[荣耀守卫] 按需模块加载失败，本次不做拦截', e)
    }
  })

  onUnmounted(() => {
    if (stopAdGuard) stopAdGuard()
  })
}

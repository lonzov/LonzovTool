import { computed } from 'vue'

// 非官方站点检测：当前 URL 域名不是官方域名 tool.lonzov.top 时返回 true，
// 用于在页面顶部注入"非官方站点"红色警告横幅。
// 若页面被 iframe 嵌入且顶层为跨域站点（读取 window.top 抛 SecurityError），
// 同样判定为非官方站点（被第三方套壳）。
export function useOfficialDomainCheck() {
  const isUnofficial = computed(() => {
    // SSR 预渲染阶段无 window，无需检测
    if (typeof window === 'undefined') return false

    // 若页面被 iframe 嵌入（window.top !== window.self），尝试读取顶层 URL：
    // 同源时可正常读到，跨域时会抛 SecurityError → 判定为非官方站点（被套壳）
    if (window.top !== window.self) {
      try {
        const topHost = window.top.location.hostname
        // 同源嵌入，按顶层域名判断是否为官方域名
        return topHost !== 'tool.lonzov.top'
      } catch {
        // 跨域，读取顶层 URL 抛出 SecurityError，判定为非官方
        return true
      }
    }

    const host = window.location.hostname

    // 排除本地开发环境
    const isLocal = ['localhost', '127.0.0.1', '::1'].includes(host)
    if (isLocal) return false

    // 官方域名
    return host !== 'tool.lonzov.top'
  })

  return { isUnofficial }
}

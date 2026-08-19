import { computed } from 'vue'

// 非官方站点检测：当前 URL 域名不是官方域名 tool.lonzov.top 时返回 true，
// 用于在页面顶部注入"非官方站点"红色警告横幅。本地开发环境（localhost/127.0.0.1）不触发。
export function useOfficialDomainCheck() {
  const isUnofficial = computed(() => {
    // SSR 预渲染阶段无 window，无需检测
    if (typeof window === 'undefined') return false

    const host = window.location.hostname

    // 排除本地开发环境
    const isLocal = ['localhost', '127.0.0.1', '::1'].includes(host)
    if (isLocal) return false

    // 官方域名
    return host !== 'tool.lonzov.top'
  })

  return { isUnofficial }
}

import { watch, nextTick } from 'vue'

/**
 * 工具页 localStorage 持久化组合式函数
 * @param {string} key - localStorage 密钥
 * @param {Record<string, import('vue').Ref>} refs - 需要持久化的 ref 对象集合
 * @param {{ debounce?: number, onRestored?: () => void }} options - 配置项
 *   - debounce: 写入防抖毫秒数（默认 300ms）
 *   - onRestored: 从 localStorage 恢复数据后的回调（在 nextTick 中执行）
 */
export function useToolStorage(key, refs, options = {}) {
  const { debounce = 300, onRestored } = options

  let hasRestored = false

  // 从 localStorage 恢复（SSR 安全）
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const data = JSON.parse(raw)
        for (const [name, ref] of Object.entries(refs)) {
          if (data[name] !== undefined && data[name] !== null) {
            ref.value = data[name]
          }
        }
        hasRestored = true
      }
    } catch {
      // 解析失败则忽略
    }
  }

  // 恢复成功后，在 nextTick 中触发回调（确保响应式数据已更新）
  if (hasRestored && onRestored) {
    nextTick(onRestored)
  }

  // 防抖写入
  let timer = null

  function save() {
    const data = {}
    for (const [name, ref] of Object.entries(refs)) {
      data[name] = ref.value
    }
    try {
      localStorage.setItem(key, JSON.stringify(data))
    } catch {
      // 存储满或不可用时忽略
    }
  }

  function debouncedSave() {
    clearTimeout(timer)
    timer = setTimeout(save, debounce)
  }

  // 监听所有 ref 变化，触发防抖写入
  for (const ref of Object.values(refs)) {
    watch(ref, debouncedSave, { deep: true })
  }

  // 页面隐藏/离开前立即保存一次（防止防抖未落地的数据丢失）
  // 用 pagehide + visibilitychange(hidden) 而非 beforeunload/unload：
  // 注册 beforeunload/unload 会把页面排除出往返缓存(bfcache)；pagehide/visibilitychange
  // 不阻断 bfcache，且能覆盖移动端切后台时 pagehide 不触发、最后时刻数据易丢的情况
  let onPageHide = null
  let onVisibilityChange = null
  if (typeof window !== 'undefined') {
    onPageHide = () => save()
    onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') save()
    }
    window.addEventListener('pagehide', onPageHide)
    document.addEventListener('visibilitychange', onVisibilityChange)
  }

  // 返回清理函数（组件一般不需要调用，因为 composable 生命周期与页面一致）
  return function cleanup() {
    clearTimeout(timer)
    if (typeof window !== 'undefined' && onPageHide) {
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }
}

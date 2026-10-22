import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * 是否为窄屏（与 App 的外壳断点一致，771px）。
 *
 * 用 matchMedia 而不是监听 resize：断点跨越时才需要变，滚动/拖动窗口宽度不该触发重渲染。
 */
export function useIsMobile(query = '(max-width: 770px)') {
  const isMobile = ref(false)
  let media = null

  function sync(event) {
    isMobile.value = event.matches
  }

  onMounted(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    media = window.matchMedia(query)
    isMobile.value = media.matches
    media.addEventListener('change', sync)
  })

  onBeforeUnmount(() => {
    media?.removeEventListener('change', sync)
    media = null
  })

  return { isMobile }
}

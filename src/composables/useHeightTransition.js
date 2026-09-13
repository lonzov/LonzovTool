import { nextTick, onBeforeUnmount, watch } from 'vue'

/**
 * 内容高度变化时给容器做高度过渡。
 *
 * 用 ResizeObserver 监听内层内容而不是逐个事件手动触发，凡是会导致高度变化的
 * 情况（折叠展开、增删条目、报错信息出现、文案换行、窗口缩放等）都会被覆盖，
 * 不需要每加一个交互就再挂一次动画。
 *
 * 用法：外层容器负责动画（高度由本函数接管），内层内容高度自适应。
 *   <div ref="animWrap" class="modal-anim">
 *     <div ref="animInner"> ...内容... </div>
 *   </div>
 *
 * @param {object} options
 * @param {import('vue').Ref<boolean>} options.show 显示状态；隐藏时停止监听
 * @param {import('vue').Ref<HTMLElement|null>} options.inner 内容元素（高度自适应）
 * @param {import('vue').Ref<HTMLElement|null>} options.wrap 外层容器（被动画的就是它）
 */
export function useHeightTransition({ show, inner, wrap }) {
  let observer = null
  let timer = 0
  let prev = 0

  function stop() {
    clearTimeout(timer)
    if (observer) {
      observer.disconnect()
      observer = null
    }
  }

  /** 立即把容器钉到指定高度，不产生过渡 */
  function snap(height) {
    const el = wrap.value
    if (!el) return
    el.style.transition = 'none'
    el.style.height = `${height}px`
    void el.offsetHeight // 强制重排，让下面的过渡从这一刻的高度开始
    el.style.transition = ''
  }

  function start() {
    const innerEl = inner.value
    if (!innerEl || !wrap.value || observer) return

    prev = innerEl.offsetHeight
    snap(prev)

    observer = new ResizeObserver(() => {
      const next = innerEl.offsetHeight
      if (next === prev) return
      const from = prev
      prev = next
      const el = wrap.value
      if (!el) return
      el.style.transition = 'none'
      el.style.height = `${from}px`
      void el.offsetHeight
      el.style.transition = '' // 恢复样式表里的过渡，再改高度即产生动画
      el.style.height = `${next}px`
    })
    observer.observe(innerEl)
  }

  watch(show, async (visible) => {
    if (!visible) {
      stop()
      return
    }
    await nextTick()
    // NModal 的内容是显示时才挂载的，再等一拍确保拿得到 DOM
    clearTimeout(timer)
    timer = setTimeout(start, 0)
  })

  onBeforeUnmount(stop)
}

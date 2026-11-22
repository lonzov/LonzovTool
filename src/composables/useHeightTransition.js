import { nextTick, onBeforeUnmount, watch } from 'vue'

/**
 * 内容高度变化时给容器做高度过渡。
 *
 * 用 ResizeObserver 监听内层内容而不是逐个事件手动触发，凡是会导致高度变化的
 * 情况（折叠展开、增删条目、报错信息出现、文案换行、窗口缩放等）都会被覆盖，
 * 不需要每加一个交互就再挂一次动画。
 *
 * 动画目标会夹在内容区的可用高度以内：外层卡片的 max-height 只封住卡片自身，
 * 内容区是 flex 项、默认不吸收溢出，动画照自然高度跑的话，卡片到顶后剩下的内容
 * 会直接顶出卡片边框。可用高度按卡片 max-height 扣掉标题栏、页脚和内边距实测，
 * 不写死常量 —— 这些值会随标题折行、按钮换行、紧凑断点和 max-height-offset 变化。
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
 *   实测的可用高度会以 --app-modal-content-max-height 写在它上面，供内部滚动容器收口，
 *   否则容器被夹住后滚动容器仍可能更高，底部一段会滚不到
 */
export function useHeightTransition({ show, inner, wrap }) {
  let observer = null
  let timer = 0
  let resizeFrame = 0
  let prev = 0
  let available = Infinity

  function stop() {
    clearTimeout(timer)
    if (resizeFrame) cancelAnimationFrame(resizeFrame)
    resizeFrame = 0
    window.removeEventListener('resize', handleResize)
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

  /** 内容区最多能有多高；拿不到卡片高度上限时视为不限 */
  function measureAvailable() {
    const wrapEl = wrap.value
    const contentEl = wrapEl && wrapEl.parentElement
    const cardEl = contentEl && contentEl.parentElement
    if (!cardEl) return Infinity
    const cardStyle = getComputedStyle(cardEl)
    const maxHeight = parseFloat(cardStyle.maxHeight)
    if (!Number.isFinite(maxHeight)) return Infinity
    let occupied = 0
    for (const child of cardEl.children) {
      if (child !== contentEl) occupied += child.offsetHeight
    }
    const contentStyle = getComputedStyle(contentEl)
    occupied +=
      (parseFloat(cardStyle.paddingTop) || 0) +
      (parseFloat(cardStyle.paddingBottom) || 0) +
      (parseFloat(cardStyle.borderTopWidth) || 0) +
      (parseFloat(cardStyle.borderBottomWidth) || 0) +
      (parseFloat(contentStyle.paddingTop) || 0) +
      (parseFloat(contentStyle.paddingBottom) || 0) +
      (parseFloat(contentStyle.borderTopWidth) || 0) +
      (parseFloat(contentStyle.borderBottomWidth) || 0)
    return Math.max(0, maxHeight - occupied)
  }

  /** 同步可用高度，并让内部滚动容器跟着收口 */
  function syncAvailable() {
    available = measureAvailable()
    const wrapEl = wrap.value
    if (!wrapEl) return
    if (Number.isFinite(available)) {
      wrapEl.style.setProperty('--app-modal-content-max-height', `${available}px`)
    } else {
      wrapEl.style.removeProperty('--app-modal-content-max-height')
    }
  }

  function targetHeight() {
    const innerEl = inner.value
    if (!innerEl) return 0
    return Math.min(innerEl.offsetHeight, available)
  }

  function handleResize() {
    if (!observer || resizeFrame) return
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0
      if (!observer) return
      syncAvailable()
      const next = targetHeight()
      if (Math.abs(next - prev) < 1) return
      prev = next
      snap(next)
    })
  }

  function start() {
    const innerEl = inner.value
    if (!innerEl || !wrap.value || observer) return

    syncAvailable()
    prev = targetHeight()
    snap(prev)

    observer = new ResizeObserver(() => {
      syncAvailable()
      const next = targetHeight()
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
    window.addEventListener('resize', handleResize)
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

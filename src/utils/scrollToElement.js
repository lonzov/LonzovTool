/**
 * 把元素滚动到最近滚动容器的顶部对齐位置。
 *
 * 移动端 Chrome 的 scrollIntoView({ behavior: 'smooth' }) 存在 Bug：首次调用后浏览器
 * 内部会标记元素「已滚动到」，后续对同一/相邻元素的滚动被忽略。focusReset 用于先给元素
 * 临时 tabindex 并 focus({ preventScroll: true }) 重置该状态机。
 *
 * @param {Element} el 目标元素
 * @param {object} [options]
 * @param {number|string} [options.marginTop] 顶部留白，写入元素的 scroll-margin-top
 * @param {ScrollBehavior} [options.behavior] 滚动行为
 * @param {boolean} [options.focusReset] 是否执行上面的状态机重置（移动端需要）
 */
export function scrollToElement(el, options = {}) {
  if (!el) return
  const { marginTop, behavior = 'smooth', focusReset = false } = options

  if (marginTop !== undefined && marginTop !== null) {
    el.style.scrollMarginTop = typeof marginTop === 'number' ? `${marginTop}px` : marginTop
  }

  if (!focusReset) {
    el.scrollIntoView({ behavior, block: 'start' })
    return
  }

  const prevTabIndex = el.getAttribute('tabindex')
  el.setAttribute('tabindex', '-1')
  el.focus({ preventScroll: true })
  el.scrollIntoView({ behavior, block: 'start' })
  if (prevTabIndex === null) {
    el.removeAttribute('tabindex')
  } else {
    el.setAttribute('tabindex', prevTabIndex)
  }
}

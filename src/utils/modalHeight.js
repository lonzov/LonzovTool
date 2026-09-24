/**
 * 模态框内容高度过渡用到的两个测量工具。
 *
 * 背景：RawJsonEditModal / HasitemModal 在切换编辑模式、增删条目时会给内容容器
 * 做高度过渡，目标高度取 `min(内容完整高度, 可用高度上限)`。这个「上限」必须准 ——
 * 取大了，可见区域被父级裁掉，高度值的变化体现不出来，动画等于白做。
 *
 * 这个上限曾经写成常量（卡片总高 − 标题栏 68 − 按钮栏 83 − 内容内边距 40 = 191），
 * 但那把「随标题文案、字体、按钮数量变化的值」固化了：标题折行或页脚多一个按钮，
 * 它就会静默失准。现在改成向上找滚动容器 —— 它的高度由 flex 约束、与内容无关，
 * 减掉内容容器的内边距就是可用高度，且整条链路不依赖任何 Naive 的类名。
 */

/** 向上找第一个纵向可滚动的祖先 */
export function findScrollParent(el) {
  let node = el && el.parentElement
  while (node) {
    const s = getComputedStyle(node)
    if (s.overflowY === 'auto' || s.overflowY === 'scroll') return node
    node = node.parentElement
  }
  return null
}

/**
 * 内容区「最多能有多高」。
 * @param {HTMLElement} el 内容元素（插槽内容的根）
 * @param {number} [fallback] 拿不到时返回的值（默认不限高）
 */
export function getModalContentHeight(el, fallback = Infinity) {
  if (!el) return fallback
  const scroller = findScrollParent(el)
  if (!scroller) return fallback
  const box = el.parentElement
  if (!box) return scroller.clientHeight
  const cs = getComputedStyle(box)
  const padding = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0)
  return scroller.clientHeight - padding
}

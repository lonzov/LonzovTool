import { reduceMotion } from '../composables/useMotion.js'

/**
 * 列表行的过渡节奏：外层元素条与翻译键里的 with 列表/对象共用同一套参数。
 * 高度类动画走「慢—快—慢」；交换位移用长缓出，透明度只做层次提示，起落都快。
 */
export const HEIGHT_MS = 240
export const HEIGHT_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'
export const REMOVE_MS = 220
export const SWAP_MS = 300
export const SWAP_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const SWAP_DIM_MS = 90
const SWAP_DIM_OPACITY = '0.62'
const SWAP_RESTORE_DELAY = 120
const SWAP_RESTORE_MS = 120

export function nextFrames(count) {
  return new Promise((resolve) => {
    const tick = (left) => (left <= 0 ? resolve() : requestAnimationFrame(() => tick(left - 1)))
    tick(count)
  })
}

/** 盒子的内边距与描边会把 0 高度抬到十几像素，收起时必须一起归零才真的收得干净 */
export function boxMetrics(node) {
  const cs = getComputedStyle(node)
  return {
    padTop: Number.parseFloat(cs.paddingTop) || 0,
    padBottom: Number.parseFloat(cs.paddingBottom) || 0,
    borderTop: Number.parseFloat(cs.borderTopWidth) || 0,
    borderBottom: Number.parseFloat(cs.borderBottomWidth) || 0,
  }
}

export function collapseBox(node) {
  node.style.overflow = 'hidden'
  node.style.height = '0px'
  node.style.paddingTop = '0px'
  node.style.paddingBottom = '0px'
  node.style.borderTopWidth = '0px'
  node.style.borderBottomWidth = '0px'
}

export function restoreBox(node) {
  node.style.overflow = ''
  node.style.height = ''
  node.style.paddingTop = ''
  node.style.paddingBottom = ''
  node.style.borderTopWidth = ''
  node.style.borderBottomWidth = ''
}

export function expandBoxKeyframe(height, box, opacity) {
  return {
    height: `${height}px`,
    paddingTop: `${box.padTop}px`,
    paddingBottom: `${box.padBottom}px`,
    borderTopWidth: `${box.borderTop}px`,
    borderBottomWidth: `${box.borderBottom}px`,
    opacity,
  }
}

/** 新增行：先收起，等内部内容（文本域自动高度）稳定两帧再量，从 0 展开到位 */
export async function animateRowIn(node) {
  if (!node || reduceMotion.value) return
  const box = boxMetrics(node)
  collapseBox(node)
  void node.offsetHeight
  await nextFrames(2)
  const contentHeight = node.isConnected ? node.scrollHeight : 0
  const height = contentHeight + box.padTop + box.padBottom + box.borderTop + box.borderBottom
  if (height <= 0) {
    restoreBox(node)
    return
  }
  const anim = node.animate(
    [
      {
        height: '0px',
        paddingTop: '0px',
        paddingBottom: '0px',
        borderTopWidth: '0px',
        borderBottomWidth: '0px',
        opacity: 0,
      },
      expandBoxKeyframe(height, box, 1),
    ],
    { duration: HEIGHT_MS, easing: HEIGHT_EASE },
  )
  await anim.finished.catch(() => {})
  restoreBox(node)
  // 输入框一类控件要到动画期间才把自身高度定下来，量早了结束时就会硬跳一截；有差额补一段短动画
  const natural = node.offsetHeight
  if (Math.abs(natural - height) > 1) {
    node.style.overflow = 'hidden'
    node.style.height = `${height}px`
    void node.offsetHeight
    const fix = node.animate(
      [{ height: `${height}px` }, { height: `${natural}px` }],
      { duration: 140, easing: HEIGHT_EASE },
    )
    await fix.finished.catch(() => {})
    restoreBox(node)
  }
}

/** 删除行：高度收起到 0 并渐隐，动画结束再动数据 */
export async function animateRowOut(node) {
  if (!node || reduceMotion.value) return
  const height = node.offsetHeight
  if (height <= 0) return
  const box = boxMetrics(node)
  node.style.overflow = 'hidden'
  const anim = node.animate(
    [
      {
        height: `${height}px`,
        paddingTop: `${box.padTop}px`,
        paddingBottom: `${box.padBottom}px`,
        borderTopWidth: `${box.borderTop}px`,
        borderBottomWidth: `${box.borderBottom}px`,
        opacity: 1,
        transform: 'translateY(0)',
      },
      {
        height: '0px',
        paddingTop: '0px',
        paddingBottom: '0px',
        borderTopWidth: '0px',
        borderBottomWidth: '0px',
        opacity: 0,
        transform: 'translateY(-6px)',
      },
    ],
    { duration: REMOVE_MS, easing: HEIGHT_EASE },
  )
  await anim.finished.catch(() => {})
}

/**
 * 上下交换：主动行压在上层并短暂变淡，两条用位移互换。
 * 每个列表各自持有一份实例，避免同一页里的两处列表互相取消动画。
 */
export function createRowSwap() {
  let nodes = []
  let timers = []
  let token = 0

  const reset = (node) => {
    node.style.transition = ''
    node.style.transform = ''
    node.style.opacity = ''
    node.style.zIndex = ''
  }

  const cancel = () => {
    token++
    for (const timer of timers) clearTimeout(timer)
    timers = []
    for (const node of nodes) reset(node)
    nodes = []
  }

  const play = (fromNode, toNode, fromTopBefore, toTopBefore) => {
    cancel()
    if (!fromNode || !toNode) return
    const mine = token
    const fromDelta = fromTopBefore - fromNode.getBoundingClientRect().top
    const toDelta = toTopBefore - toNode.getBoundingClientRect().top
    nodes = [fromNode, toNode]
    // 先按交换前的位置把两条摆回原位，再过渡到 0
    fromNode.style.transition = `opacity ${SWAP_DIM_MS}ms ease-out`
    toNode.style.transition = 'none'
    fromNode.style.transform = `translateY(${fromDelta}px)`
    toNode.style.transform = `translateY(${toDelta}px)`
    fromNode.style.zIndex = '3'
    toNode.style.zIndex = '2'
    // 上层让出透明度，下面那一条才能透出来，形成「谁在动」的层次
    fromNode.style.opacity = SWAP_DIM_OPACITY
    void fromNode.offsetHeight

    timers.push(setTimeout(() => {
      if (mine !== token) return
      fromNode.style.transition = `transform ${SWAP_MS}ms ${SWAP_EASE}, opacity ${SWAP_RESTORE_MS}ms ease-out`
      toNode.style.transition = `transform ${SWAP_MS}ms ${SWAP_EASE}`
      fromNode.style.transform = ''
      toNode.style.transform = ''
      // 位移还没走完就先恢复透明度：透明度只负责交代层次，不该比位移慢
      timers.push(setTimeout(() => {
        if (mine !== token) return
        fromNode.style.opacity = ''
      }, SWAP_RESTORE_DELAY))
      timers.push(setTimeout(() => {
        if (mine !== token) return
        cancel()
      }, SWAP_MS + 20))
    }, 0))
  }

  return { play, cancel }
}

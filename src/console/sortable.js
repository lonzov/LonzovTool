import Sortable from 'sortablejs'

/**
 * 控制台列表的拖拽实例：在 Sortable 之上补一套自己的边缘自动滚动。
 *
 * 站点外壳在桌面端用 NScrollbar 内部容器滚动，Sortable 能自己找到它；移动端没有
 * NScrollbar，滚动落在 body / 文档上，而 Sortable 的原生自动滚动只处理 window，
 * 触屏拖动到屏幕边缘时不会滚。这里按指针位置自己滚，桌面端仍沿用 Sortable 的行为。
 */

const EDGE_MIN = 72
const EDGE_RATIO = 0.18
const MAX_STEP = 22

function isTouchish() {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(hover: none)').matches) return true
  return window.innerWidth < 771
}

function isScrollable(el) {
  if (!el || el.scrollHeight <= el.clientHeight + 1) return false
  const overflowY = getComputedStyle(el).overflowY
  return overflowY === 'auto' || overflowY === 'scroll'
}

function findScrollableAncestor(node) {
  let el = node?.parentElement || null
  while (el) {
    if (isScrollable(el)) return el
    el = el.parentElement
  }
  return null
}

function resolveScroller(item) {
  if (typeof document === 'undefined') return null
  // 桌面布局的滚动发生在 NScrollbar 内部容器里，先沿被拖元素的祖先找
  const ancestor = findScrollableAncestor(item)
  if (ancestor) return ancestor
  const candidates = [document.body, document.scrollingElement || document.documentElement]
  for (const el of candidates) {
    if (!el) continue
    if (el.scrollHeight <= el.clientHeight + 1) continue
    if (getComputedStyle(el).overflowY !== 'hidden') return el
  }
  return null
}

function pointerPoint(event) {
  const touch = event?.touches?.[0] || event?.changedTouches?.[0] || event
  if (typeof touch?.clientX !== 'number' || typeof touch?.clientY !== 'number') return null
  return { x: touch.clientX, y: touch.clientY }
}

function createAutoScroll() {
  let timer = null
  let scroller = null
  let lastPoint = null
  let detach = null

  function tick() {
    if (!lastPoint) return
    const viewport = window.innerHeight
    const edge = Math.max(EDGE_MIN, Math.round(viewport * EDGE_RATIO))
    let delta = 0
    if (lastPoint.y < edge) delta = -Math.ceil((edge - lastPoint.y) / 4)
    else if (lastPoint.y > viewport - edge) delta = Math.ceil((lastPoint.y - (viewport - edge)) / 4)
    if (!delta) return

    const step = Math.max(-MAX_STEP, Math.min(MAX_STEP, delta))
    if (scroller) {
      const before = scroller.scrollTop
      scroller.scrollTop = before + step
      // 选中的元素不可滚时退回文档滚动
      if (scroller.scrollTop === before) {
        const doc = document.scrollingElement || document.documentElement
        doc.scrollTop += step
      }
      syncDragPosition()
      return
    }
    const doc = document.scrollingElement || document.documentElement
    doc.scrollTop += step
    syncDragPosition()
  }

  /**
   * 页面自己滚了之后，触点相对内容的位置变了：用「当前坐标」让 Sortable 重算一次
   * ghost 偏移。必须用当前坐标——重放旧事件会把 ghost 拽回滚动前的位置，来回闪。
   */
  function syncDragPosition() {
    if (!lastPoint || !Sortable.active) return
    if (typeof Sortable.active._onTouchMove !== 'function') return
    const synthetic = {
      touches: [{ clientX: lastPoint.x, clientY: lastPoint.y }],
      cancelable: false,
    }
    try {
      Sortable.active._onTouchMove(synthetic)
    } catch {
      // 内部接口的异常不该影响滚动本身
    }
  }

  return {
    start(sortableEvent) {
      if (!isTouchish()) return
      lastPoint = pointerPoint(sortableEvent?.originalEvent)
      scroller = resolveScroller(sortableEvent?.item)

      const onMove = (event) => {
        const point = pointerPoint(event)
        if (point) lastPoint = point
      }
      document.addEventListener('touchmove', onMove, { passive: true })
      document.addEventListener('pointermove', onMove, { passive: true })
      detach = () => {
        document.removeEventListener('touchmove', onMove)
        document.removeEventListener('pointermove', onMove)
      }

      if (timer) clearInterval(timer)
      timer = setInterval(tick, 16)
    },
    track(event) {
      const point = pointerPoint(event)
      if (point) lastPoint = point
    },
    stop() {
      if (timer) clearInterval(timer)
      timer = null
      scroller = null
      lastPoint = null
      detach?.()
      detach = null
    },
  }
}

/**
 * 创建带边缘自动滚动的 Sortable 实例。
 * 触屏/窄屏时关掉 Sortable 自带的滚动，避免两套逻辑同时滚；桌面端保持原样。
 */
export function createConsoleSortable(el, options = {}) {
  const { onStart, onMove, onEnd, ...rest } = options
  const autoScroll = createAutoScroll()
  const disableNativeScroll = isTouchish()

  return Sortable.create(el, {
    ...rest,
    ...(disableNativeScroll ? { scroll: false } : {}),
    onStart(event) {
      autoScroll.start(event)
      onStart?.(event)
    },
    onMove(event) {
      autoScroll.track(event?.originalEvent)
      return onMove?.(event)
    },
    onEnd(event) {
      autoScroll.stop()
      onEnd?.(event)
    },
    onUnchoose(event) {
      autoScroll.stop()
      rest.onUnchoose?.(event)
    },
  })
}

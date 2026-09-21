/**
 * 回顶的物理缓动，移植自 @swup/scroll-plugin 依赖的 scrl。
 * 每帧 velocity += delta * acceleration; velocity *= (1 - friction); position += velocity，
 * 起步极快、尾巴拖得很长，总时长对距离不敏感（400px ≈ 700ms，6000px ≈ 917ms），
 * 比原生 behavior: 'smooth' 的匀减速更有"吸附"感。
 */
const FRICTION = 0.3
const ACCELERATION = 0.04

let rafId = 0
let detachInterrupt = null

export function cancelScrollToTop() {
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }
  if (detachInterrupt) {
    detachInterrupt()
    detachInterrupt = null
  }
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  )
}

// 动画期间用户滚动即以用户为准：不取消的话每帧覆盖滚动位置，近 1 秒内滚不动
function listenInterrupt(node) {
  const onInterrupt = () => cancelScrollToTop()
  node.addEventListener('wheel', onInterrupt, { passive: true })
  node.addEventListener('touchstart', onInterrupt, { passive: true })
  detachInterrupt = () => {
    node.removeEventListener('wheel', onInterrupt)
    node.removeEventListener('touchstart', onInterrupt)
  }
}

/**
 * @param {{ node: HTMLElement | null, getTop: () => number, setTop: (top: number) => void }} target
 *   滚动容器读写适配器
 */
export function scrollToTop(target) {
  cancelScrollToTop()

  const start = target.getTop()
  if (start <= 0) return

  if (prefersReducedMotion()) {
    target.setTop(0)
    return
  }

  // 终点取 -1 而非 0，与 scrl 一致：让速度在贴近顶部时仍有方向，避免浮点误差提前停住
  const end = -1
  let position = start
  let velocity = 0

  const step = () => {
    velocity += (end - position) * ACCELERATION
    velocity *= 1 - FRICTION
    position += velocity
    if (position <= 0) {
      target.setTop(0)
      rafId = 0
      detachInterrupt?.()
      detachInterrupt = null
      return
    }
    target.setTop(position)
    rafId = requestAnimationFrame(step)
  }

  if (target.node) listenInterrupt(target.node)
  rafId = requestAnimationFrame(step)
}

// 全局单例：仅 1 个 document mousemove 监听器 + RAF 平滑广播（lerp 差值跟随）
let targetX = 0
let targetY = 0
let currentX = 0
let currentY = 0
let rafId = null
const subscribers = new Set()
let listenerCount = 0

// 平滑系数：越小越丝滑但越迟钝，越大越跟手但越生硬
const LERP_FACTOR = 0.15

function tick() {
  // 每帧向目标位置差值靠近
  const dx = targetX - currentX
  const dy = targetY - currentY

  // 当距离小于 0.5px 时直接吸附，避免无限抖动
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
    currentX = targetX
    currentY = targetY
    // 无运动时停止循环，等下次 mousemove 再启动
    rafId = null
  } else {
    currentX += dx * LERP_FACTOR
    currentY += dy * LERP_FACTOR
    rafId = requestAnimationFrame(tick)
  }

  for (const cb of subscribers) {
    cb(currentX, currentY)
  }
}

function onMouseMove(e) {
  targetX = e.clientX
  targetY = e.clientY
  // 首次或静止后重启动画循环
  if (!rafId) {
    rafId = requestAnimationFrame(tick)
  }
}

export function useMouseGlow() {
  function subscribe(callback) {
    if (subscribers.has(callback)) return
    subscribers.add(callback)
    listenerCount++
    if (listenerCount === 1) {
      document.addEventListener('mousemove', onMouseMove, { passive: true })
    }
  }

  function unsubscribe(callback) {
    if (!subscribers.has(callback)) return
    subscribers.delete(callback)
    listenerCount--
    if (listenerCount === 0) {
      document.removeEventListener('mousemove', onMouseMove)
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
    }
  }

  return { subscribe, unsubscribe }
}

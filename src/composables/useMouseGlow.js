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

/**
 * 对单个元素应用鼠标跟随边框高光
 * @param {HTMLElement} el - 目标元素（需 position: relative，并挂载 .glow-border 类）
 * @param {number} mouseX - 鼠标 clientX
 * @param {number} mouseY - 鼠标 clientY
 * @param {Object} [options]
 * @param {number} [options.thresholdMultiplier=1.8] - 距离阈值倍数（元素对角线长度 * 此值）
 */
export function applyGlow(el, mouseX, mouseY, options = {}) {
  const { thresholdMultiplier = 1.8 } = options
  const rect = el.getBoundingClientRect()
  const x = mouseX - rect.left
  const y = mouseY - rect.top
  const centerX = rect.width / 2
  const centerY = rect.height / 2
  const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2)
  const threshold = Math.sqrt(rect.width ** 2 + rect.height ** 2) * thresholdMultiplier

  if (dist < threshold) {
    el.style.setProperty('--mouse-x', `${x}px`)
    el.style.setProperty('--mouse-y', `${y}px`)
    el.classList.add('glow-active')
  } else {
    el.classList.remove('glow-active')
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

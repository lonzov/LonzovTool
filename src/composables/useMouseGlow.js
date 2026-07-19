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

// 触控状态：区分鼠标（一直跟随）与移动端触控（手指离开即消失）
let touchActive = false
let touchJustEnded = false
let touchEndTimer = null

function tick() {
  const dx = targetX - currentX
  const dy = targetY - currentY

  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
    currentX = targetX
    currentY = targetY
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
  if (touchJustEnded) return // 忽略触控结束后的模拟 mousemove
  touchActive = false
  targetX = e.clientX
  targetY = e.clientY
  if (!rafId) {
    rafId = requestAnimationFrame(tick)
  }
}

function onTouchStart(e) {
  touchActive = true
  touchJustEnded = false
  clearTimeout(touchEndTimer)
  const touch = e.touches[0]
  // 直接从触点位置出现，不做从旧位置平滑过渡
  currentX = targetX = touch.clientX
  currentY = targetY = touch.clientY
  if (!rafId) {
    rafId = requestAnimationFrame(tick)
  }
}

function onTouchMove(e) {
  if (!touchActive) return
  const touch = e.touches[0]
  targetX = touch.clientX
  targetY = touch.clientY
  if (!rafId) {
    rafId = requestAnimationFrame(tick)
  }
}

function onTouchEnd() {
  touchActive = false
  touchJustEnded = true
  // 停止 RAF 循环
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  // 重置位置到当前触点，避免下次触控从旧位置过渡
  currentX = targetX
  currentY = targetY
  // 通知订阅者隐藏高光（(-1, -1) 为清除信号）
  for (const cb of subscribers) {
    cb(-1, -1)
  }
  // 延迟重置标记以忽略触控后的模拟 mousemove
  touchEndTimer = setTimeout(() => { touchJustEnded = false }, 500)
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
  if (!el || typeof window === 'undefined') return
  // 负值信号：触控结束，隐藏高光
  if (mouseX < 0) {
    el.classList.remove('glow-active')
    return
  }
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

// 是否启用高光效果（localStorage 开关，默认开）
function isGlowEnabled() {
  try {
    const v = localStorage.getItem('mouse_glow_enabled')
    return v === null ? true : v === 'true'
  } catch { return true }
}

export function useMouseGlow() {
  if (typeof window === 'undefined') {
    return {
      subscribe: () => {},
      unsubscribe: () => {},
    }
  }

  let listenersActive = false

  function subscribe(callback) {
    if (subscribers.has(callback)) return
    subscribers.add(callback)
    if (!isGlowEnabled()) return
    listenerCount++
    if (listenerCount === 1) {
      listenersActive = true
      document.addEventListener('mousemove', onMouseMove, { passive: true })
      document.addEventListener('touchstart', onTouchStart, { passive: true })
      document.addEventListener('touchmove', onTouchMove, { passive: true })
      document.addEventListener('touchend', onTouchEnd, { passive: true })
    }
  }

  function unsubscribe(callback) {
    if (!subscribers.has(callback)) return
    subscribers.delete(callback)
    if (!listenersActive) return
    listenerCount--
    if (listenerCount === 0) {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      clearTimeout(touchEndTimer)
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
    }
  }

  return { subscribe, unsubscribe }
}

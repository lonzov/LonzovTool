import { ref } from 'vue'

const STORAGE_KEY = 'reduce_motion'

function readStored() {
  if (import.meta.env.SSR) return false
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch { return false }
}

/**
 * 减少动态效果。模块级单例 —— 无组件上下文的模块（scrollToTop 等）与设置页读的是同一份状态。
 *
 * 定位是省性能，不是把动效抹平：只拿掉大面积或持续占用的那几类，悬停、聚焦、边框、阴影
 * 这类小面积过渡按原时长保留。data-motion="reduced" 只是给 CSS 的抓手，具体在哪几处生效
 * 分散在各自最合适的地方 —— 切页在 App.vue，滚动在 scrollToTop.js，入场动画在 AboutView，
 * 弹窗抽屉在 main.css。
 */
const reduceMotion = ref(readStored())

function applyAttr(value) {
  const root = document.documentElement
  if (value) root.setAttribute('data-motion', 'reduced')
  else root.removeAttribute('data-motion')
}

export function setReduceMotion(value) {
  reduceMotion.value = value
  try {
    localStorage.setItem(STORAGE_KEY, String(value))
  } catch { /* 隐私模式下写不进去，本次会话仍然生效 */ }
  applyAttr(value)
}

// 首屏那一笔属性由 index.html 的内联脚本先落（必须先于 CSS 生效，否则刷新瞬间会先跑一遍
// 切页与入场动画）。这里再对齐一次，保证 ref 与 DOM 不会因为内联脚本未执行而分叉。
if (!import.meta.env.SSR) applyAttr(reduceMotion.value)

export function useMotion() {
  return { reduceMotion, setReduceMotion }
}

export { reduceMotion }

import { onBeforeUnmount, onMounted } from 'vue'

/** 位移小于此值时看不出方向，不下判断 */
const AXIS_SLOP = 10
/** 触发距离占视口宽度的比例。按屏宽取而非固定像素，否则大屏轻滑即中、小屏要滑很久 */
const TRIGGER_RATIO = 0.25
/** 允许与水平方向偏离的最大角度，超出即视为斜向或纵向手势 */
const MAX_ANGLE_TAN = Math.tan((30 * Math.PI) / 180)

function scrollsHorizontally(el) {
  const overflowX = getComputedStyle(el).overflowX
  if (overflowX !== 'auto' && overflowX !== 'scroll' && overflowX !== 'overlay') return false
  return el.scrollWidth > el.clientWidth
}

function claimsHorizontalPan(el) {
  const tokens = getComputedStyle(el).touchAction.split(/\s+/)
  if (tokens.includes('none')) return true
  return tokens.includes('pan-y') && !tokens.includes('pan-x')
}

/**
 * 起手点是否已归别人管：可横向滚动的容器交给浏览器原生滚动，声明了 touch-action 的区域
 * 说明横向已被 JS 接管。两者都只看元素自身的结构与计算样式，不需要维护组件名单，
 * 后续新增的横向滚动区自动纳入判断。
 */
function isHorizontalClaimed(target) {
  for (let el = target; el && el !== document.documentElement; el = el.parentElement) {
    if (scrollsHorizontally(el) || claimsHorizontalPan(el)) return true
  }
  return false
}

/**
 * 抽屉的横向滑动手势：全屏任意位置起手，向右滑打开、向左滑关闭，行程约四分之一屏宽。
 * 手势优先级最低——监听全程 passive 且从不 preventDefault，原生滚动永远优先；
 * 起手点落在横向滚动区或 JS 手势区时直接放弃，因此可以无条件挂在 document 上。
 *
 * @param enabled  手势是否生效
 * @param canStart 起手点是否接受，由调用方按抽屉状态决定
 * @param onSwipe  方向与行程均达标时回调，参数 1 为向右、-1 为向左
 */
export function useMenuSwipe({ enabled, canStart, onSwipe }) {
  let startX = 0
  let startY = 0
  let tracking = false

  function abort() {
    tracking = false
  }

  function onTouchStart(e) {
    // 多指是捏合缩放，不参与本手势
    if (e.touches.length !== 1 || !enabled() || !(e.target instanceof Element)) {
      abort()
      return
    }
    startX = e.touches[0].clientX
    startY = e.touches[0].clientY
    tracking = canStart(e.target) && !isHorizontalClaimed(e.target)
  }

  function onTouchMove(e) {
    if (!tracking || e.touches.length !== 1) return
    const dx = e.touches[0].clientX - startX
    const dy = e.touches[0].clientY - startY

    if (Math.hypot(dx, dy) < AXIS_SLOP) return
    // 角度锁：方向须落在水平 ±30° 的锥形内，斜向与纵向一律作废
    if (Math.abs(dy) > Math.abs(dx) * MAX_ANGLE_TAN) {
      abort()
      return
    }

    if (Math.abs(dx) >= window.innerWidth * TRIGGER_RATIO) {
      abort()
      onSwipe(dx > 0 ? 1 : -1)
    }
  }

  onMounted(() => {
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', abort, { passive: true })
    document.addEventListener('touchcancel', abort, { passive: true })
  })

  onBeforeUnmount(() => {
    document.removeEventListener('touchstart', onTouchStart)
    document.removeEventListener('touchmove', onTouchMove)
    document.removeEventListener('touchend', abort)
    document.removeEventListener('touchcancel', abort)
  })
}

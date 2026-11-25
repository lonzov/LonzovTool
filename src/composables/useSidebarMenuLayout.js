import { ref } from 'vue'
import { SIDEBAR_FIXED_ITEMS } from '../config/sidebarFixedItems.js'

/**
 * 常驻侧边栏的布局偏好：入口的先后顺序，以及哪些入口折叠进「更多」。
 *
 * 结构固定为 { level1: [key...], more: [key...] }，两段合起来恰好覆盖
 * SIDEBAR_FIXED_ITEMS 的全部 key —— 菜单渲染顺序只认这一份数据。
 */

export const SIDEBAR_MENU_LAYOUT_KEY = 'sidebar_fixed_layout'

// 一级菜单的默认入口，其余（低频入口）默认收在「更多」里
const DEFAULT_LEVEL1_KEYS = ['home', 'workspace', 'about', 'settings']

const ALL_KEYS = SIDEBAR_FIXED_ITEMS.map((item) => item.key)

function defaultLayout() {
  return {
    level1: [...DEFAULT_LEVEL1_KEYS],
    more: ALL_KEYS.filter((key) => !DEFAULT_LEVEL1_KEYS.includes(key)),
  }
}

/**
 * 收口成一份可用布局：丢弃未知与重复的 key，未记录的 key（旧存储里没有的新入口）
 * 按默认归属补齐，免得升级后某个入口从侧边栏整体消失。
 */
function normalizeLayout(input) {
  const seen = new Set()
  const level1 = []
  const more = []

  const collect = (list, target) => {
    for (const key of Array.isArray(list) ? list : []) {
      if (!ALL_KEYS.includes(key) || seen.has(key)) continue
      seen.add(key)
      target.push(key)
    }
  }
  collect(input?.level1, level1)
  collect(input?.more, more)

  for (const key of ALL_KEYS) {
    if (seen.has(key)) continue
    if (DEFAULT_LEVEL1_KEYS.includes(key)) level1.push(key)
    else more.push(key)
  }

  return { level1, more }
}

function loadLayout() {
  try {
    if (typeof localStorage === 'undefined') return defaultLayout()
    const raw = localStorage.getItem(SIDEBAR_MENU_LAYOUT_KEY)
    if (!raw) return defaultLayout()
    return normalizeLayout(JSON.parse(raw))
  } catch {
    return defaultLayout()
  }
}

const sidebarMenuLayout = ref(loadLayout())

export function setSidebarMenuLayout(next) {
  sidebarMenuLayout.value = normalizeLayout(next)
  try {
    localStorage.setItem(SIDEBAR_MENU_LAYOUT_KEY, JSON.stringify(sidebarMenuLayout.value))
  } catch {
    // storage unavailable
  }
}

export function resetSidebarMenuLayout() {
  setSidebarMenuLayout(defaultLayout())
}

export function useSidebarMenuLayout() {
  return { sidebarMenuLayout, setSidebarMenuLayout, resetSidebarMenuLayout }
}

// 具名导出供无需组件上下文的消费方（如 AppMenu）直接读取实时值
export { sidebarMenuLayout }

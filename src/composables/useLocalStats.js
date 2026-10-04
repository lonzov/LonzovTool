import { ref } from 'vue'

// 本地使用统计：只写在浏览器 localStorage，不对外上报
const STORAGE_KEY = 'local_stats'

const stats = ref({ firstOpenAt: '', toolOpens: 0, navClicks: 0 })
let loaded = false

function load() {
  if (loaded) return
  loaded = true
  try {
    if (typeof localStorage === 'undefined') return
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) Object.assign(stats.value, JSON.parse(raw))
  } catch {
    // 无痕模式或数据损坏时按空数据起算
  }
}

function save() {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats.value))
  } catch {
    // 写不进去时只保留内存里的数据
  }
}

function bump(field) {
  load()
  stats.value[field] += 1
  save()
}

// 首次打开时间：没有记录时把这次打开记为首次，之后不再改动
export function recordFirstOpen() {
  load()
  if (stats.value.firstOpenAt) return
  stats.value.firstOpenAt = new Date().toISOString()
  save()
}

export function useLocalStats() {
  load()
  return {
    stats,
    // 工具使用次数：打开工作站页面（含工作站内切换标签）
    countToolOpen: () => bump('toolOpens'),
    // 导航次数：点击首页卡片
    countNavClick: () => bump('navClicks'),
  }
}

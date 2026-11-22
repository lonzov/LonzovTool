import { ref } from 'vue'

// 首页卡片收藏的唯一状态源：卡片角标、收藏筛选与右键菜单读写同一份数据，
// 避免各处独立解析 localStorage 导致状态不同步。
const STORAGE_KEY = 'favorite_cards'

const favorites = ref([])
let loaded = false

// 卡片没有 id 时按链接、标题兜底，与历史收藏数据保持同一套键
export function favoriteKeyOf(card) {
  return card?.toolId || card?.link || card?.title || ''
}

function load() {
  if (loaded) return
  loaded = true
  try {
    if (typeof localStorage === 'undefined') return
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (Array.isArray(parsed)) favorites.value = parsed
  } catch {
    // 无痕模式或数据损坏时按空列表处理
  }
}

function save() {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites.value))
  } catch {
    // 写不进去时只保留内存里的状态
  }
}

export function useFavorites() {
  load()

  const isFavorite = (key) => !!key && favorites.value.includes(key)

  // 返回切换后的状态：true 表示这次收藏，false 表示这次取消
  const toggleFavorite = (key) => {
    if (!key) return false
    const next = favorites.value.slice()
    const index = next.indexOf(key)
    if (index > -1) next.splice(index, 1)
    else next.push(key)
    favorites.value = next
    save()
    return index === -1
  }

  return { favorites, isFavorite, toggleFavorite }
}

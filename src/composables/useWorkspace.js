import { ref, watch } from 'vue'
import toolsData from '../data/tools.json'

const TABS_KEY = 'workspace-tabs'
const ACTIVE_KEY = 'workspace-active-tab'

function loadFromStorage(key, fallback) {
  try {
    if (typeof localStorage === 'undefined') return fallback
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function saveToStorage(key, value) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage full or unavailable
  }
}

// 从 tools.json 获取标题
function getTitleFromPath(path) {
  for (const category of toolsData.categories) {
    for (const tool of category.tools) {
      const linkPath = tool.link.replace(/^https?:\/\/[^/]+/, '').replace(/\/+$/, '')
      const normalizedPath = path.replace(/\/+$/, '')
      if (linkPath === normalizedPath) {
        return tool.title
      }
    }
  }
  return ''
}

let tabsRef = null
let activeTabRef = null
let initialized = false
let restored = false
let _skipPersist = false

export function useWorkspace() {
  if (!initialized) {
    const savedPaths = loadFromStorage(TABS_KEY, [])
    const savedActive = loadFromStorage(ACTIVE_KEY, null)

    const savedTabs = savedPaths.map(path => ({
      path,
      title: getTitleFromPath(path)
    }))

    tabsRef = ref(savedTabs)
    activeTabRef = ref(savedActive || (savedTabs.length > 0 ? savedTabs[0].path : null))
    initialized = true
    restored = savedTabs.length > 0

    // sync 确保 openTab/push/splice 后立即写入 localStorage，避免竞态
    watch(tabsRef, (val) => {
      if (_skipPersist) return
      const paths = val.map(t => t.path)
      saveToStorage(TABS_KEY, paths)
    }, { deep: true, flush: 'sync' })

    watch(activeTabRef, (val) => {
      if (_skipPersist) return
      saveToStorage(ACTIVE_KEY, val)
    }, { flush: 'sync' })
  }

  const tabs = tabsRef
  const activeTab = activeTabRef

  function findTabIndexByPath(path) {
    return tabs.value.findIndex((t) => t.path === path)
  }

  function openTab(path, title) {
    const existingIndex = findTabIndexByPath(path)
    if (existingIndex !== -1) {
      activeTab.value = path
      return false
    }
    tabs.value.push({ path, title })
    activeTab.value = path
    return true
  }

  function closeTab(path) {
    if (tabs.value.length <= 1) {
      return 'last'
    }
    const index = findTabIndexByPath(path)
    if (index === -1) return 'not_found'

    const wasActive = activeTab.value === path
    tabs.value.splice(index, 1)

    clearTabData(path)

    if (wasActive) {
      const newIndex = Math.min(index, tabs.value.length - 1)
      activeTab.value = tabs.value[newIndex]?.path || null
    }
    return 'closed'
  }

  function getTabData(path) {
    return loadFromStorage(`workspace-tab-data-${path}`, null)
  }

  function saveTabData(path, data) {
    saveToStorage(`workspace-tab-data-${path}`, data)
  }

  function clearTabData(path) {
    try {
      localStorage.removeItem(`workspace-tab-data-${path}`)
    } catch {
      // ignore
    }
  }

  function clearAllTabs() {
    tabs.value.forEach((t) => clearTabData(t.path))
    tabs.value.length = 0
    activeTab.value = null
    restored = false
    saveToStorage(TABS_KEY, [])
    saveToStorage(ACTIVE_KEY, null)
  }

  function hasTabs() {
    return tabs.value.length > 0
  }

  // 幂等恢复：只在 tabs 为空时才从 localStorage 重建
  function restoreTabs() {
    if (tabs.value.length > 0 || restored) {
      // 已有数据（可能是 openTab 先写入的）或已恢复过，跳过
      return tabs.value.length > 0
    }
    const savedPaths = loadFromStorage(TABS_KEY, [])
    const savedActive = loadFromStorage(ACTIVE_KEY, null)

    if (savedPaths.length > 0) {
      tabs.value = savedPaths.map(path => ({
        path,
        title: getTitleFromPath(path)
      }))
      activeTab.value = savedActive || savedPaths[0]
      restored = true
      return true
    }
    return false
  }

  // 将指定路径加入 tabs（用于路由同步场景）
  function ensureTabForPath(path) {
    const exists = tabs.value.find((t) => t.path === path)
    if (!exists) {
      const title = getTitleFromPath(path)
      tabs.value.push({ path, title })
    }
    activeTab.value = path
  }

  // 仅设置活跃标签但不持久化（用于无效工具页：UI 显示"暂无内容"但不写入 localStorage）
  function setActiveTabWithoutPersist(path) {
    _skipPersist = true
    activeTab.value = path
    setTimeout(() => { _skipPersist = false }, 0)
  }

  return {
    tabs,
    activeTab,
    openTab,
    closeTab,
    getTabData,
    saveTabData,
    clearAllTabs,
    hasTabs,
    restoreTabs,
    ensureTabForPath,
    setActiveTabWithoutPersist,
  }
}

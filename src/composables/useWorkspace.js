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

// ===== 站外链接标签（iframe 嵌入工作站）=====
// 站外链接统一挂载到独立的 /embed/ 目录（不使用 /c/，并在 robots.txt 中屏蔽不参与收录）
// 路径段使用 tools.json 中的工具 id（如 /embed/mcbe-id-table），URL 通过 id 反查
const EXTERNAL_PATH_PREFIX = '/embed/'

// 按 id 查 tools.json 工具
function findToolById(id) {
  if (!id) return null
  for (const category of toolsData.categories) {
    for (const tool of category.tools) {
      if (tool.id === id) return tool
    }
  }
  return null
}

// 域名白名单：tools.json 中所有站外链接的域名，不在白名单内的站外链接直接转交 404
const EXTERNAL_HOSTS = new Set()
for (const category of toolsData.categories) {
  for (const tool of category.tools) {
    if (/^https?:/i.test(tool.link)) {
      try {
        EXTERNAL_HOSTS.add(new URL(tool.link).hostname)
      } catch {
        // ignore invalid urls
      }
    }
  }
}

// 站外标签 path：/embed/ + tools.json 工具 id
function externalTabPath(toolId) {
  if (!toolId) return ''
  return EXTERNAL_PATH_PREFIX + toolId
}

// 是否为站外（iframe 嵌入）标签
function isExternalPath(path) {
  return typeof path === 'string' && path.startsWith(EXTERNAL_PATH_PREFIX)
}

// 由标签 path 反查原始站外 URL（id 未收录或非外链则返回 null，转交 404）
function getExternalUrl(path) {
  if (!isExternalPath(path)) return null
  // 剥掉可能存在的尾斜杠（如直接访问/复制的 /embed/<id>/），避免反查为未知 id
  const id = path.slice(EXTERNAL_PATH_PREFIX.length).replace(/\/+$/, '')
  const tool = findToolById(id)
  return tool && /^https?:/i.test(tool.link) ? tool.link : null
}

// 域名白名单校验：返回 true 才允许嵌入渲染，否则转交 404
function isExternalUrlAllowed(url) {
  if (!url) return false
  try {
    return EXTERNAL_HOSTS.has(new URL(url).hostname)
  } catch {
    return false
  }
}

// 根据站外 URL 从 tools.json 匹配卡片 logo（与标题同源，供嵌入条复用卡片图标）
function getExternalLogo(url) {
  if (!url) return ''
  const normalized = url.replace(/\/+$/, '')
  for (const category of toolsData.categories) {
    for (const tool of category.tools) {
      if (/^https?:/i.test(tool.link) && tool.link.replace(/\/+$/, '') === normalized) {
        return tool.logo || ''
      }
    }
  }
  return ''
}

// 根据站外 URL 从 tools.json 获取嵌入页的 SEO meta（标题/简介），供 meta 与分享模态框使用
function getExternalToolMeta(url) {
  if (!url) return null
  const normalized = url.replace(/\/+$/, '')
  for (const category of toolsData.categories) {
    for (const tool of category.tools) {
      if (/^https?:/i.test(tool.link) && tool.link.replace(/\/+$/, '') === normalized) {
        return {
          title: tool.title,
          description: tool.description || '',
        }
      }
    }
  }
  return null
}

// 根据站外 URL 从 tools.json 匹配工具标题，兜底使用域名
function getTitleFromExternalUrl(url) {
  if (!url) return ''
  const normalized = url.replace(/\/+$/, '')
  for (const category of toolsData.categories) {
    for (const tool of category.tools) {
      if (/^https?:/i.test(tool.link) && tool.link.replace(/\/+$/, '') === normalized) {
        return tool.title
      }
    }
  }
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

// 从 tools.json 获取标题
function getTitleFromPath(path) {
  if (isExternalPath(path)) {
    // tools.json 中 id 已被移除时反查不到标题，兜底用 id 本身，避免标签栏空白
    return (
      getTitleFromExternalUrl(getExternalUrl(path)) ||
      path.slice(EXTERNAL_PATH_PREFIX.length).replace(/\/+$/, '')
    )
  }
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

  // 关闭"站外嵌入工作站"开关时调用：删除所有站外 iframe 标签的记录
  // （数组过滤后编号天然连续，如 1,2,5,6 → 1,2,3,4），并处理活跃标签回到剩余标签
  function removeExternalTabs() {
    let removedCount = 0
    tabs.value = tabs.value.filter((t) => {
      if (isExternalPath(t.path)) {
        removedCount++
        clearTabData(t.path)
        return false
      }
      return true
    })

    // 活跃标签是被删除的站外标签时，回到剩余的第一个标签
    if (activeTab.value && isExternalPath(activeTab.value)) {
      activeTab.value = tabs.value[0]?.path || null
    }
    // 全部被删除时清空活跃标签存储
    if (tabs.value.length === 0) {
      saveToStorage(TABS_KEY, [])
      saveToStorage(ACTIVE_KEY, null)
    }
    return removedCount
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
    const normalized = path.replace(/\/+$/, '')
    const exists = findTabIndexByPath(normalized)
    if (exists === -1) {
      const title = getTitleFromPath(normalized)
      tabs.value.push({ path: normalized, title })
    }
    activeTab.value = normalized
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
    removeExternalTabs,
    hasTabs,
    restoreTabs,
    ensureTabForPath,
    setActiveTabWithoutPersist,
  }
}

export { externalTabPath, isExternalPath, getExternalUrl, isExternalUrlAllowed, getExternalLogo, getExternalToolMeta }

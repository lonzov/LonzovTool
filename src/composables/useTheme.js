import { ref, onMounted, onUnmounted } from 'vue'

const STORAGE_KEY = 'theme_mode'

// 主题模式：'auto' | 'light' | 'dark'
const themeMode = ref('auto')

// 当前实际主题（用于应用样式）
const actualTheme = ref('dark')

// 是否深色模式
const isDark = ref(true)

// 检测系统主题（预渲染安全）
function getSystemTheme() {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// 更新实际主题
function updateActualTheme() {
  if (themeMode.value === 'auto') {
    actualTheme.value = getSystemTheme()
  } else {
    actualTheme.value = themeMode.value
  }
  isDark.value = actualTheme.value === 'dark'
  applyTheme(actualTheme.value)
}

// 应用主题到 document（预渲染安全）
function applyTheme(theme) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme)
  }
}

// 监听系统主题变化（仅客户端）
let mediaQuery = null
function setupSystemThemeListener() {
  if (typeof window === 'undefined') return () => {}
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const handleChange = () => {
    if (themeMode.value === 'auto') {
      updateActualTheme()
    }
  }
  mediaQuery.addEventListener('change', handleChange)
  return () => {
    mediaQuery.removeEventListener('change', handleChange)
  }
}

// 初始化主题（预渲染安全）
function initTheme() {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && ['auto', 'light', 'dark'].includes(saved)) {
      themeMode.value = saved
    }
  }
  updateActualTheme()
  return setupSystemThemeListener()
}

// 切换主题模式（预渲染安全）
function setThemeMode(mode) {
  themeMode.value = mode
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, mode)
  }
  updateActualTheme()
}

// 切换到下一个模式
function cycleTheme() {
  const modes = ['auto', 'light', 'dark']
  const currentIndex = modes.indexOf(themeMode.value)
  const nextIndex = (currentIndex + 1) % modes.length
  setThemeMode(modes[nextIndex])
}

export function useTheme() {
  onMounted(() => {
    const cleanupListener = initTheme()
    onUnmounted(cleanupListener)
  })

  return {
    themeMode,
    actualTheme,
    isDark,
    setThemeMode,
    cycleTheme
  }
}

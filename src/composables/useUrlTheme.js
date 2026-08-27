import { themeMode, actualTheme } from './useTheme.js'
import { urlThemeMode } from './useWorkspaceSettings.js'

// 依据当前主题与设置计算要附加的 theme / colorScheme 参数：
// - off：不附加
// - explicit：跟随系统（auto）时不附加，其余按实际明暗
// - always：始终按实际明暗附加
function computeThemeParams() {
  const mode = urlThemeMode.value
  if (mode === 'off') return null
  if (mode === 'explicit' && themeMode.value === 'auto') return null
  const scheme = actualTheme.value // 'dark' | 'light'
  return { theme: scheme, colorScheme: scheme }
}

// 将主题参数附加到站外网址（设置关闭或不满足条件时原样返回）
export function attachThemeParams(url) {
  if (!url) return url
  const params = computeThemeParams()
  if (!params) return url
  try {
    const u = new URL(url)
    u.searchParams.set('theme', params.theme)
    u.searchParams.set('colorScheme', params.colorScheme)
    return u.toString()
  } catch {
    return url
  }
}
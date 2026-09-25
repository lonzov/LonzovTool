import { computed } from 'vue'
import { createDiscreteApi, darkTheme, lightTheme } from 'naive-ui'
import { lightThemeOverrides, darkThemeOverrides } from '../theme'
import { isDark } from '../composables/useTheme'

/**
 * 全局加载进度条（页面顶部那条）。
 *
 * 路由守卫里没有组件上下文，拿不到 useLoadingBar()，所以走 createDiscreteApi。
 * 它同样是独立 app，不继承根级 NConfigProvider —— 必须自带主题，
 * 且整个 configProviderProps 要包成 computed（naive 只 unref 最外层，
 * 内部嵌套的 ref 不会解包，详见 utils/discreteMessage.js 的说明）。
 */
let _loadingBar = null

export function getLoadingBar() {
  if (!_loadingBar && typeof window !== 'undefined') {
    try {
      _loadingBar = createDiscreteApi(['loadingBar'], {
        configProviderProps: computed(() => ({
          theme: isDark.value ? darkTheme : lightTheme,
          themeOverrides: isDark.value ? darkThemeOverrides : lightThemeOverrides,
        })),
      }).loadingBar
    } catch { /* noop */ }
  }
  return _loadingBar
}

export function startLoading() {
  const bar = getLoadingBar()
  if (bar) bar.start()
}

export function finishLoading() {
  const bar = getLoadingBar()
  if (bar) bar.finish()
}

export function errorLoading() {
  const bar = getLoadingBar()
  if (bar) bar.error()
}

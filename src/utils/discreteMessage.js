import { computed } from 'vue'
import { createDiscreteApi, darkTheme, lightTheme } from 'naive-ui'
import { lightThemeOverrides, darkThemeOverrides } from '../theme'
import { isDark } from '../composables/useTheme'

// App.vue setup 位于 NMessageProvider 之外，拿不到 useMessage，需要消息的场景统一走这里。
// 全局共用一个实例：createDiscreteApi 每次调用都会往 body 挂一个新容器，
// 多个实例会导致消息叠在同一位置互相遮挡。
let _message = null

export function getDiscreteMessage() {
  if (!_message && typeof window !== 'undefined') {
    try {
      // discrete API 是独立 app，不继承根级 NConfigProvider，必须自带主题。
      // theme 传 computed 才能跟随深浅色切换，否则创建时是什么色就永远是那个色。
      _message = createDiscreteApi(['message'], {
        configProviderProps: {
          theme: computed(() => (isDark.value ? darkTheme : lightTheme)),
          themeOverrides: computed(() =>
            isDark.value ? darkThemeOverrides : lightThemeOverrides,
          ),
        },
      }).message
    } catch { /* noop */ }
  }
  return _message
}

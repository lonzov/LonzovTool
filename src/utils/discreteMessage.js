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
      //
      // 整个对象必须是 computed：naive 只对 configProviderProps 做一次 unref
      // （discreteApp.mjs 里 `h(NConfigProvider, unref(configProviderProps))`），
      // 里面的嵌套 ref 不会被解包，写成 { theme: computed(...) } 会被当成普通对象
      // 传给 ConfigProvider，两条配置全部静默失效、message 永远停在 Naive 亮色主题。
      _message = createDiscreteApi(['message'], {
        configProviderProps: computed(() => ({
          theme: isDark.value ? darkTheme : lightTheme,
          themeOverrides: isDark.value ? darkThemeOverrides : lightThemeOverrides,
        })),
      }).message
    } catch { /* noop */ }
  }
  return _message
}

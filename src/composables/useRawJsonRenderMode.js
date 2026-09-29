import { ref, watch } from 'vue'

/**
 * T显编辑器 · 渲染模式（模块级单例）
 *
 * 只作用于紧凑布局：大预览区与设置面板里的输出卡按模式对调内容。
 * 桌面端两块内容同屏可见，没有对调的意义，不读这个状态。
 *
 * 属于视图偏好而非文档内容：单独占一个 key，不进文档的 localStorage，也不进撤销栈。
 */

const STORAGE_KEY = 'lonzovtool-rawjson-jzfk-render'

export const RENDER_MODE_OPTIONS = [
  { value: 'game', label: '游戏' },
  { value: 'json', label: 'JSON' },
]

export const renderMode = ref('game')

export function loadRenderMode() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (RENDER_MODE_OPTIONS.some(o => o.value === saved)) renderMode.value = saved
  } catch { /* ignore */ }
}

watch(renderMode, (value) => {
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch { /* ignore */ }
})

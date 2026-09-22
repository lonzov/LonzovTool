// 全局确认弹窗状态，供任意模块（含无法渲染组件的 composable）以 Promise 形式调用
import { reactive } from 'vue'

const state = reactive({
  show: false,
  title: '',
  message: '',
  confirmText: '确定',
  cancelText: '取消',
  danger: false,
  showCancel: true,
  resolve: null,
})

function settle(confirmed) {
  const resolve = state.resolve
  state.resolve = null
  state.show = false
  if (resolve) resolve(confirmed)
}

/**
 * 打开确认弹窗，resolve(true) 为用户确认，resolve(false) 为取消/关闭
 * message 中的 \n 会保留换行；showCancel 为 false 时只留确认按钮（纯提示）
 */
export function confirmDialog(options = {}) {
  // 已有弹窗时先把旧的按取消收尾，否则它的 Promise 会一直悬着
  settle(false)
  state.title = options.title || '提示'
  state.message = options.message || ''
  state.confirmText = options.confirmText || '确定'
  state.cancelText = options.cancelText || '取消'
  state.danger = options.danger === true
  state.showCancel = options.showCancel !== false
  state.show = true
  return new Promise((resolve) => {
    state.resolve = resolve
  })
}

export function resolveConfirm(confirmed) {
  settle(confirmed)
}

export { state as confirmState }

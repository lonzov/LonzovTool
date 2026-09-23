import { createDiscreteApi } from 'naive-ui'

// App.vue setup 位于 NMessageProvider 之外，拿不到 useMessage，需要消息的场景统一走这里。
// 全局共用一个实例：createDiscreteApi 每次调用都会往 body 挂一个新容器，
// 多个实例会导致消息叠在同一位置互相遮挡。
let _message = null

export function getDiscreteMessage() {
  if (!_message && typeof window !== 'undefined') {
    try {
      _message = createDiscreteApi(['message']).message
    } catch { /* noop */ }
  }
  return _message
}

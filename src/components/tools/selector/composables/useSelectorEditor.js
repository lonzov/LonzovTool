import { onMounted, onBeforeUnmount } from 'vue'
import { useMessage } from 'naive-ui'
import { internals, editingId, addingParam } from './useState.js'
import { loadFromStorage, persistNow } from './usePersistence.js'
import { commitCurrentState } from './useParams.js'

// Naive 的弹层（下拉、选择菜单、模态框）teleport 到 body，落在其中的按下属于弹层自身交互
const OVERLAY_SELECTOR = '.v-binder-follower-container, .n-modal-container, .n-drawer-container'

// ========== 组合式函数入口 ==========

export function useSelectorEditor() {
  internals.msg = useMessage()

  /**
   * 编辑条 / 添加条处于焦点时，点击空白处提交当前状态。
   *
   * 监听 mousedown 而非 click：在输入框内按下后拖到框外松开时，浏览器会在两者的
   * 公共祖先上补发 click，用 click 判断会把选区操作误判成点击空白处而提前提交。
   */
  function handleDocumentMousedown(e) {
    if (!editingId.value && !addingParam.value) return
    const target = e.target
    if (!(target instanceof Element)) return
    if (target.closest(OVERLAY_SELECTOR) || target.closest('.code-line--editing')) return
    commitCurrentState()
  }

  onMounted(() => {
    loadFromStorage()
    document.addEventListener('mousedown', handleDocumentMousedown)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('mousedown', handleDocumentMousedown)
    persistNow()
    clearTimeout(internals.saveTimer)
  })

  return {}
}

import { ref, watch } from 'vue'

/**
 * 模态框内容延迟销毁 Hook
 *
 * 解决关闭模态框时内容瞬间消失、只剩壳子在动画的问题。
 * 在模态框 @after-leave 动画完成后再移除内容 DOM 并执行清理回调。
 *
 * @param {import('vue').Ref} editIdRef - 控制模态框显示/隐藏的 ref（如 hasitemEditId）
 * @param {() => void} [onCleanup] - 动画完成后的清理回调，用于重置编辑状态
 * @returns {{ contentVisible: Ref<boolean>, onAfterLeave: () => void }}
 */
export function useModalContent(editIdRef, onCleanup) {
  const contentVisible = ref(false)
  let pendingClose = false

  watch(editIdRef, (id) => {
    if (id) {
      contentVisible.value = true
      pendingClose = false
    } else {
      pendingClose = true
    }
  })

  function onAfterLeave() {
    if (pendingClose && !editIdRef.value) {
      contentVisible.value = false
      pendingClose = false
      if (onCleanup) onCleanup()
    }
  }

  return { contentVisible, onAfterLeave }
}

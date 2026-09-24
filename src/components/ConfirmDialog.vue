<script setup>
import { computed } from 'vue'
import AppModal from './ui/AppModal.vue'
import { confirmState, resolveConfirm } from '../composables/useConfirm'

// 点遮罩/Esc/关闭按钮都会走这里，否则调用方的 Promise 收不到结果
function onShowChange(show) {
  if (!show) resolveConfirm(false)
}

const actions = computed(() => {
  const list = []
  if (confirmState.showCancel) {
    list.push({
      text: confirmState.cancelText,
      variant: 'outline',
      onClick: () => resolveConfirm(false),
    })
  }
  list.push({
    text: confirmState.confirmText,
    variant: confirmState.danger ? 'danger' : 'fill',
    onClick: () => resolveConfirm(true),
  })
  return list
})
</script>

<template>
  <AppModal
    :segmented="false"
    :show="confirmState.show"
    :title="confirmState.title"
    :max-width="420"
    :closable="confirmState.showCancel"
    content-scrollable
    blur-mask
    :actions="actions"
    @update:show="onShowChange"
    @close="onShowChange(false)"
  >
    <div class="confirm-modal-body">{{ confirmState.message }}</div>
  </AppModal>
</template>

<style scoped>
.confirm-modal-body {
  font-size: 15px;
  line-height: 1.75;
  color: var(--muted-foreground);
  padding: 4px 2px;
  /* 调用方用 \n 传多行内容，需要保留换行 */
  white-space: pre-line;
}
</style>

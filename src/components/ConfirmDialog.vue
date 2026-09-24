<script setup>
import { NModal } from 'naive-ui'
import { confirmState, resolveConfirm } from '../composables/useConfirm'

// 点遮罩/Esc/关闭按钮都会走这里，否则调用方的 Promise 收不到结果
function onShowChange(show) {
  if (!show) resolveConfirm(false)
}
</script>

<template>
  <!-- 模糊遮罩：挂到 body 上，层级才稳定低于 NModal -->
  <Teleport to="body">
    <Transition name="confirm-blur">
      <div v-if="confirmState.show" class="confirm-blur-overlay"></div>
    </Transition>
  </Teleport>

  <NModal
    :show="confirmState.show"
    preset="card"
    :style="{
      maxWidth: '420px',
      width: 'calc(100% - 32px)',
      borderRadius: 'var(--radius-xl)',
    }"
    :title="confirmState.title"
    :bordered="false"
    :closable="confirmState.showCancel"
    :auto-focus="false"
    @update:show="onShowChange"
    @close="onShowChange(false)"
  >
    <div class="confirm-modal-body">{{ confirmState.message }}</div>
    <template #footer>
      <div class="confirm-modal-actions">
        <button
          v-if="confirmState.showCancel"
          class="confirm-btn confirm-btn--outline"
          @click="resolveConfirm(false)"
        >
          {{ confirmState.cancelText }}
        </button>
        <button
          class="confirm-btn"
          :class="confirmState.danger ? 'confirm-btn--danger' : 'confirm-btn--fill'"
          @click="resolveConfirm(true)"
        >
          {{ confirmState.confirmText }}
        </button>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.confirm-blur-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  /* 盖住移动端汉堡(1950)/菜单抽屉(1900)，仍低于 NModal(≥2000) */
  z-index: 1990;
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  background: rgba(0, 0, 0, 0.1);
  pointer-events: none;
}

.confirm-blur-enter-active,
.confirm-blur-leave-active {
  transition: opacity 0.3s ease;
}

.confirm-blur-enter-from,
.confirm-blur-leave-to {
  opacity: 0;
}

.confirm-modal-body {
  font-size: 15px;
  line-height: 1.75;
  color: var(--n-text-color-2);
  padding: 4px 2px;
  /* 调用方用 \n 传多行内容，需要保留换行 */
  white-space: pre-line;
}

.confirm-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 8px;
}

.confirm-btn {
  height: 34px;
  padding: 0 20px;
  border-radius: 17px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  border: none;
}

[data-theme="light"] .confirm-btn--fill {
  background: #1A1A1A;
  color: #fff;
}

[data-theme="dark"] .confirm-btn--fill {
  background: #fff;
  color: #1A1A1A;
}

.confirm-btn--fill:hover {
  opacity: 0.85;
}

/* 危险操作：红底白字，与站内其他二次确认删除一致 */
.confirm-btn--danger {
  background: #dc2626;
  color: #fff;
}

.confirm-btn--danger:hover {
  background: #dc2626;
  color: #fff;
  opacity: 0.85;
}

.confirm-btn--outline {
  border: 1.5px solid currentColor;
}

[data-theme="light"] .confirm-btn--outline {
  background: #fff;
  color: #1A1A1A;
}

[data-theme="light"] .confirm-btn--outline:hover {
  background: #E8E8E8;
}

[data-theme="dark"] .confirm-btn--outline {
  background: transparent;
  color: rgba(255, 255, 255, 0.68);
}

[data-theme="dark"] .confirm-btn--outline:hover {
  background: rgba(255, 255, 255, 0.08);
}
</style>

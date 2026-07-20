<template>
  <NConfigProvider :theme="isDark ? darkTheme : null" :theme-overrides="isDark ? darkOverrides : undefined">
    <NModal
      v-model:show="showHaspermissionModal"
      preset="card"
      :title="modalTitle"
      :style="modalStyle"
      :segmented="{ content: true, footer: 'soft' }"
      content-scrollable
      :mask-closable="false"
      @after-leave="onAfterLeave"
    >
      <div v-if="contentVisible" @click.stop class="perm-modal-body">
        <div class="perm-field">
          <label class="perm-label">camera</label>
          <NSelect
            v-model:value="haspermissionEditCamera"
            :options="PERM_VALUE_OPTIONS"
            size="small"
            class="perm-select"
            :clearable="true"
            placeholder="未设置"
          />
        </div>
        <div class="perm-field">
          <label class="perm-label">movement</label>
          <NSelect
            v-model:value="haspermissionEditMovement"
            :options="PERM_VALUE_OPTIONS"
            size="small"
            class="perm-select"
            :clearable="true"
            placeholder="未设置"
          />
        </div>
      </div>

      <template #footer>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="onCancel">取消</button>
          <button class="btn btn-fill" @click="onSave">保存</button>
        </div>
      </template>
    </NModal>
  </NConfigProvider>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { NModal, NConfigProvider, NSelect, darkTheme } from 'naive-ui'
import { useTheme } from '../../../../composables/useTheme.js'
import { PERM_VALUE_OPTIONS } from '../constants.js'
import {
  haspermissionEditId,
  haspermissionEditIsAdd,
  haspermissionEditCamera,
  haspermissionEditMovement,
} from '../composables/useState.js'
import {
  closeHaspermissionEditor,
  saveHaspermissionEditor,
  closeHaspermissionAddModal,
  saveHaspermissionAddModal,
  cleanupHaspermissionModal,
} from '../composables/useParams.js'
import { useModalContent } from '../composables/useModalContent.js'

const { isDark } = useTheme()

const darkOverrides = {
  common: { neutralModal: '#191919' },
  Card: { colorModal: '#191919' },
}

const { contentVisible, onAfterLeave } = useModalContent(haspermissionEditId, cleanupHaspermissionModal)

const isCompact = ref(false)
let _mq
function _onMqChange(e) { isCompact.value = e.matches }
onMounted(() => {
  _mq = window.matchMedia('(max-width: 640px)')
  isCompact.value = _mq.matches
  _mq.addEventListener('change', _onMqChange)
})
onUnmounted(() => {
  if (_mq) _mq.removeEventListener('change', _onMqChange)
})

const modalStyle = computed(() => ({
  maxWidth: '480px',
  width: 'calc(100% - 32px)',
  maxHeight: isCompact.value ? 'calc(100vh - 120px)' : 'calc(100vh - 48px)',
  borderRadius: '16px',
  cornerShape: 'squircle',
}))

const showHaspermissionModal = computed({
  get: () => !!haspermissionEditId.value,
  set: (v) => {
    if (!v) {
      if (haspermissionEditIsAdd.value) closeHaspermissionAddModal()
      else closeHaspermissionEditor()
    }
  },
})

const modalTitle = computed(() => haspermissionEditIsAdd.value ? '添加 haspermission 权限项' : '编辑 haspermission 权限项')

function onCancel() {
  if (haspermissionEditIsAdd.value) closeHaspermissionAddModal()
  else closeHaspermissionEditor()
}

function onSave() {
  if (haspermissionEditIsAdd.value) saveHaspermissionAddModal()
  else saveHaspermissionEditor()
}
</script>

<style scoped>
.perm-modal-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.perm-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.perm-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  transition: color 0.4s ease;
}

.perm-select {
  width: 100%;
}

/* 页脚操作按钮 */
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 8px;
}

.btn {
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

/* fill - 全填充主按钮 */
[data-theme="light"] .btn-fill {
  background: #1A1A1A;
  color: #fff;
}

[data-theme="dark"] .btn-fill {
  background: #fff;
  color: #1A1A1A;
}

.btn-fill:hover { opacity: 0.85; }

/* outline - 描边次要按钮 */
.btn-outline {
  border: 1.5px solid currentColor;
}

[data-theme="light"] .btn-outline {
  background: #fff;
  color: #1A1A1A;
}

[data-theme="light"] .btn-outline:hover {
  background: #E8E8E8;
}

[data-theme="dark"] .btn-outline {
  background: transparent;
  color: rgba(255, 255, 255, 0.87);
}

[data-theme="dark"] .btn-outline:hover {
  background: rgba(255, 255, 255, 0.08);
}
</style>

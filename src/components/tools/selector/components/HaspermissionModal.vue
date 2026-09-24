<template>
  <AppModal
    v-model:show="showHaspermissionModal"
    :title="modalTitle"
    :max-width="480"
    content-scrollable
    :mask-closable="false"
    :actions="[
      { text: '取消', variant: 'outline', onClick: onCancel },
      { text: '保存', variant: 'fill', onClick: onSave },
    ]"
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

  </AppModal>
</template>

<script setup>
import { computed } from 'vue'
import { NSelect } from 'naive-ui'
import AppModal from '../../../ui/AppModal.vue'
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

const { contentVisible, onAfterLeave } = useModalContent(haspermissionEditId, cleanupHaspermissionModal)

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
  color: var(--muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  transition: color 0.4s ease;
}

.perm-select {
  width: 100%;
}
</style>

<template>
  <AppModal
    v-model:show="showCoordCalcModal"
    title="坐标自动计算"
    :max-width="500"
    content-scrollable
    :mask-closable="false"
    :actions="[
      { text: '取消', variant: 'outline', onClick: onCancel },
      { text: '确定', variant: 'fill', onClick: onConfirm },
    ]"
    @after-leave="onAfterLeave"
  >
    <div v-if="contentVisible" class="coord-calc-body">
      <!-- 起始坐标 -->
      <div class="coord-row">
        <label class="coord-row-label">起始坐标</label>
        <div class="coord-inputs">
          <div class="coord-field">
            <span class="coord-label">X</span>
            <NInput v-model:value="coordCalcStart.x" size="small" placeholder="0" />
          </div>
          <div class="coord-field">
            <span class="coord-label">Y</span>
            <NInput v-model:value="coordCalcStart.y" size="small" placeholder="0" />
          </div>
          <div class="coord-field">
            <span class="coord-label">Z</span>
            <NInput v-model:value="coordCalcStart.z" size="small" placeholder="0" />
          </div>
        </div>
      </div>

      <!-- 终点坐标 -->
      <div class="coord-row">
        <label class="coord-row-label">终点坐标</label>
        <div class="coord-inputs">
          <div class="coord-field">
            <span class="coord-label">X</span>
            <NInput v-model:value="coordCalcEnd.x" size="small" placeholder="0" />
          </div>
          <div class="coord-field">
            <span class="coord-label">Y</span>
            <NInput v-model:value="coordCalcEnd.y" size="small" placeholder="0" />
          </div>
          <div class="coord-field">
            <span class="coord-label">Z</span>
            <NInput v-model:value="coordCalcEnd.z" size="small" placeholder="0" />
          </div>
        </div>
      </div>
    </div>

  </AppModal>
</template>

<script setup>
import { computed } from 'vue'
import { NInput } from 'naive-ui'
import AppModal from '../../../ui/AppModal.vue'
import {
  coordCalcModalOpen,
  coordCalcStart,
  coordCalcEnd,
} from '../composables/useState.js'
import {
  closeCoordCalcModal,
  confirmCoordCalc,
} from '../composables/useParams.js'
import { useModalContent } from '../composables/useModalContent.js'

const { contentVisible, onAfterLeave } = useModalContent(coordCalcModalOpen)

const showCoordCalcModal = computed({
  get: () => coordCalcModalOpen.value,
  set: (v) => {
    if (!v) closeCoordCalcModal()
  },
})

function onCancel() {
  closeCoordCalcModal()
}

function onConfirm() {
  confirmCoordCalc()
}
</script>

<style scoped>
.coord-calc-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.coord-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.coord-row-label {
  font-size: 15px;
  font-weight: 500;
  color: var(--foreground);
  white-space: nowrap;
  min-width: 64px;
  transition: color 0.4s ease;
}

.coord-inputs {
  display: flex;
  flex: 1;
  gap: 12px;
  align-items: center;
}

.coord-field {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.coord-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--muted-foreground);
  white-space: nowrap;
  transition: color 0.4s ease;
}

/* 移动端适配 */
@media (max-width: 480px) {
  .coord-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .coord-row-label {
    min-width: auto;
  }
  .coord-inputs {
    width: 100%;
  }
}
</style>

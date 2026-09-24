<template>
  <NModal
    v-model:show="showCoordCalcModal"
    preset="card"
    title="坐标自动计算"
    :style="modalStyle"
    :segmented="{ content: true, footer: 'soft' }"
    content-scrollable
    :mask-closable="false"
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

    <template #footer>
      <div class="modal-actions">
        <button class="btn btn-outline" @click="onCancel">取消</button>
        <button class="btn btn-fill" @click="onConfirm">确定</button>
      </div>
    </template>
  </NModal>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { NModal, NInput } from 'naive-ui'
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
  maxWidth: '500px',
  width: 'calc(100% - 32px)',
  maxHeight: isCompact.value ? 'calc(100vh - 120px)' : 'calc(100vh - 48px)',
  borderRadius: 'var(--radius-xl)',
}))

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
  corner-shape: round;
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
.btn-fill {
  background: var(--primary);
  color: var(--primary-foreground);
}

.btn-fill:hover { opacity: 0.85; }

/* outline - 描边次要按钮 */
.btn-outline {
  border: 1.5px solid currentColor;
}

.btn-outline {
  background: var(--card);
  color: var(--foreground);
}

.btn-outline:hover {
  background: var(--muted);
}
</style>

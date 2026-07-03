<template>
  <NConfigProvider :theme="isDark ? darkTheme : null" :theme-overrides="isDark ? darkOverrides : undefined">
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
        <div class="coord-card">
          <div class="coord-card-title">起始坐标</div>
          <div class="coord-row">
            <div class="coord-field">
              <label class="coord-label">X</label>
              <NInput v-model:value="coordCalcStart.x" size="small" placeholder="0" />
            </div>
            <div class="coord-divider"></div>
            <div class="coord-field">
              <label class="coord-label">Y</label>
              <NInput v-model:value="coordCalcStart.y" size="small" placeholder="0" />
            </div>
            <div class="coord-divider"></div>
            <div class="coord-field">
              <label class="coord-label">Z</label>
              <NInput v-model:value="coordCalcStart.z" size="small" placeholder="0" />
            </div>
          </div>
        </div>

        <!-- 终点坐标 -->
        <div class="coord-card">
          <div class="coord-card-title">终点坐标</div>
          <div class="coord-row">
            <div class="coord-field">
              <label class="coord-label">X</label>
              <NInput v-model:value="coordCalcEnd.x" size="small" placeholder="0" />
            </div>
            <div class="coord-divider"></div>
            <div class="coord-field">
              <label class="coord-label">Y</label>
              <NInput v-model:value="coordCalcEnd.y" size="small" placeholder="0" />
            </div>
            <div class="coord-divider"></div>
            <div class="coord-field">
              <label class="coord-label">Z</label>
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
  </NConfigProvider>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { NModal, NConfigProvider, NInput, darkTheme } from 'naive-ui'
import { useTheme } from '../../../../composables/useTheme.js'
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

const { isDark } = useTheme()

const darkOverrides = {
  common: { neutralModal: '#191919' },
  Card: { colorModal: '#191919' },
}

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
  maxHeight: isCompact.value ? '670px' : 'calc(100vh - 48px)',
  borderRadius: '16px',
  cornerShape: 'squircle',
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
  gap: 14px;
}

.coord-card {
  padding: 14px 16px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-sub);
  transition:
    background-color 0.4s ease,
    border-color 0.4s ease;
}

.coord-card-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-bottom: 10px;
  transition: color 0.4s ease;
}

.coord-row {
  display: flex;
  align-items: flex-end;
  gap: 0;
}

.coord-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.coord-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-align: center;
  transition: color 0.4s ease;
}

.coord-divider {
  width: 1px;
  height: 28px;
  background: var(--border-color);
  margin: 0 10px;
  align-self: center;
  transition: background-color 0.4s ease;
  flex-shrink: 0;
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

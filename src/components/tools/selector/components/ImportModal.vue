<template>
  <NConfigProvider :theme="isDark ? darkTheme : null" :theme-overrides="isDark ? darkOverrides : undefined">
    <NModal
      v-model:show="showImportModal"
      preset="card"
      title="导入选择器"
      :style="modalStyle"
      :segmented="{ content: true, footer: 'soft' }"
      content-scrollable
    >
      <p class="import-hint">粘贴选择器参数文本，自动解析并导入</p>
      <textarea
        v-model="importText"
        class="import-textarea"
        placeholder='粘贴选择器参数文本，例如：&#10;@a[name="Steve",tag=admin,scores={money=1..}]'
        rows="5"
        spellcheck="false"
      />
      <div v-if="importError" class="import-error">{{ importError }}</div>

      <template #footer>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="closeImport">取消</button>
          <button class="btn btn-fill" @click="parseImport">确定导入</button>
        </div>
      </template>
    </NModal>
  </NConfigProvider>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { NModal, NConfigProvider, darkTheme } from 'naive-ui'
import { useTheme } from '../../../../composables/useTheme.js'
import { importText, importError, showImportModal } from '../composables/useState.js'
import { closeImport, parseImport } from '../composables/useImport.js'

const { isDark } = useTheme()

const darkOverrides = {
  common: { neutralModal: '#191919' },
  Card: { colorModal: '#191919' },
}

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
  maxWidth: '520px',
  width: 'calc(100% - 32px)',
  maxHeight: isCompact.value ? '670px' : 'calc(100vh - 48px)',
  borderRadius: '16px',
  cornerShape: 'squircle',
}))
</script>

<style scoped>
.import-hint {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 10px;
  line-height: 1.5;
  transition: color 0.4s ease;
}
.import-textarea {
  width: 100%;
  min-height: 120px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-sub);
  color: var(--text-primary);
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  resize: vertical;
  outline: none;
  box-sizing: border-box;
  transition:
    border-color 0.3s ease,
    background-color 0.4s ease,
    color 0.4s ease;
}
.import-textarea:focus {
  border-color: var(--text-secondary);
}
.import-error {
  margin-top: 8px;
  font-size: 12px;
  color: #dc2626;
  transition: color 0.4s ease;
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

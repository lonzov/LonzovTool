<template>
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
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { NModal } from 'naive-ui'
import { importText, importError, showImportModal } from '../composables/useState.js'
import { closeImport, parseImport } from '../composables/useImport.js'

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
  maxHeight: isCompact.value ? 'calc(100vh - 120px)' : 'calc(100vh - 48px)',
  borderRadius: 'var(--radius-xl)',
}))
</script>

<style scoped>
.import-hint {
  font-size: 13px;
  color: var(--muted-foreground);
  margin-bottom: 10px;
  line-height: 1.5;
  transition: color 0.4s ease;
}
.import-textarea {
  width: 100%;
  min-height: 120px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--muted);
  color: var(--foreground);
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
  border-color: var(--muted-foreground);
}
.import-error {
  margin-top: 8px;
  font-size: 12px;
  color: var(--destructive);
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

<template>
  <AppModal
    v-model:show="showImportModal"
    title="导入选择器"
    :max-width="520"
    content-scrollable
    :actions="[
      { text: '取消', variant: 'outline', onClick: closeImport },
      { text: '确定导入', variant: 'fill', onClick: parseImport },
    ]"
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
  </AppModal>
</template>

<script setup>
import AppModal from '../../../ui/AppModal.vue'
import { importText, importError, showImportModal } from '../composables/useState.js'
import { closeImport, parseImport } from '../composables/useImport.js'
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
  border-radius: var(--radius-md);
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
</style>

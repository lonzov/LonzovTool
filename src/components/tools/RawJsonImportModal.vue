<script setup>
import AppModal from '../ui/AppModal.vue'
import { showImportModal, importText, importError, closeImport, parseImport } from '../../composables/useRawJsonEditor.js'
</script>

<template>
  <AppModal
    v-model:show="showImportModal"
    title="导入指令"
    :max-width="520"
    content-scrollable
    :actions="[
      { text: '取消', variant: 'outline', onClick: closeImport },
      { text: '解析', variant: 'fill', onClick: parseImport },
    ]"
  >
    <p class="import-hint">粘贴 tellraw 或 titleraw 指令（开头可加 / 或不加），自动解析 JSON 部分</p>
    <textarea
      v-model="importText"
      class="import-textarea"
      rows="8"
      placeholder='tellraw @a {"rawtext":[...]} 或 /tellraw @a {...}'
      spellcheck="false"
    />
    <div v-if="importError" class="import-error">{{ importError }}</div>
  </AppModal>
</template>

<style scoped>
.import-hint {
  font-size: 12px; color: var(--muted-foreground);
  margin-bottom: 10px; line-height: 1.5;
  transition: color 0.4s ease;
}
.import-textarea {
  width: 100%; min-height: 160px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--muted);
  color: var(--foreground);
  font-size: 13px; resize: vertical;
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  outline: none; box-sizing: border-box;
  transition: border-color 0.3s ease, background-color 0.4s ease, color 0.4s ease;
}
.import-textarea:focus { border-color: var(--muted-foreground); }
.import-error {
  margin-top: 10px; padding: 8px 12px;
  background: var(--muted); border: 1px solid var(--border);
  border-radius: var(--radius-sm); font-size: 12px; color: var(--muted-foreground);
  /* JSON 报错是「诊断 + 位置」两行，靠换行断句 */
  white-space: pre-line; word-break: break-all;
  transition: background-color 0.4s ease, border-color 0.4s ease, color 0.4s ease;
}
</style>

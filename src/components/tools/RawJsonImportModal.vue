<script setup>
import { NModal, NConfigProvider } from 'naive-ui'
import { darkTheme } from 'naive-ui'
import { useTheme } from '../../composables/useTheme'
import { showImportModal, importText, importError, closeImport, parseImport } from '../../composables/useRawJsonEditor.js'

const { isDark } = useTheme()

const darkOverrides = {
  common: { neutralModal: '#191919' },
  Card: { colorModal: '#191919' },
}
</script>

<template>
  <NConfigProvider :theme="isDark ? darkTheme : null" :theme-overrides="isDark ? darkOverrides : undefined">
    <NModal
      v-model:show="showImportModal"
      preset="card"
      title="导入指令"
      :style="{ maxWidth: '520px', width: 'calc(100% - 32px)', maxHeight: 'calc(100vh - 48px)', borderRadius: '16px' }"
      :segmented="{ content: true, footer: 'soft' }"
      content-scrollable
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
      <template #footer>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="closeImport">取消</button>
          <button class="btn btn-fill" @click="parseImport">解析</button>
        </div>
      </template>
    </NModal>
  </NConfigProvider>
</template>

<style scoped>
.import-hint {
  font-size: 12px; color: var(--text-secondary);
  margin-bottom: 10px; line-height: 1.5;
  transition: color 0.4s ease;
}
.import-textarea {
  width: 100%; min-height: 160px;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-sub);
  color: var(--text-primary);
  font-size: 13px; resize: vertical;
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  outline: none; box-sizing: border-box;
  transition: border-color 0.3s ease, background-color 0.4s ease, color 0.4s ease;
}
.import-textarea:focus { border-color: var(--text-secondary); }
.import-error {
  margin-top: 10px; padding: 8px 12px;
  background: #f2f2f2; border: 1px solid #ddd;
  border-radius: 6px; font-size: 12px; color: #555;
  transition: background-color 0.4s ease, border-color 0.4s ease;
}
[data-theme="dark"] .import-error {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
}

/* 页脚操作按钮 (与 UpdateDialog 一致) */
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

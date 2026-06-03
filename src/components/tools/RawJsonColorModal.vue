<script setup>
import { NModal, NConfigProvider } from 'naive-ui'
import { darkTheme } from 'naive-ui'
import { useTheme } from '../../composables/useTheme'
import {
  showColorModal, colorsStandard, colorsMaterial,
  closeColorTable, copyColorCode,
} from '../../composables/useRawJsonEditor.js'

const { isDark } = useTheme()

const darkOverrides = {
  common: { neutralModal: '#191919' },
  Card: { colorModal: '#191919' },
}
</script>

<template>
  <NConfigProvider :theme="isDark ? darkTheme : null" :theme-overrides="isDark ? darkOverrides : undefined">
    <NModal
      v-model:show="showColorModal"
      preset="card"
      title="颜色代码参考表"
      :style="{ maxWidth: '640px', width: 'calc(100% - 32px)', maxHeight: 'calc(100vh - 110px)', borderRadius: '16px', cornerShape: 'squircle' }"
      :segmented="{ content: true, footer: 'soft' }"
      content-scrollable
    >
      <div class="color-section">
        <div class="color-section-header">
          <span class="color-section-title">标准颜色</span>
          <span class="color-section-hint">点击复制</span>
        </div>
        <div class="color-grid">
          <div
            v-for="c in colorsStandard" :key="c.code"
            class="color-item" @click="copyColorCode(c.code)"
          >
            <div class="color-box" :style="{ backgroundColor: c.color }" />
            <div class="color-info">
              <span class="color-code">§{{ c.code }}</span>
              <span class="color-name">{{ c.name }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="color-section">
        <div class="color-section-header">
          <span class="color-section-title">材料颜色 (1.16.0+)</span>
        </div>
        <div class="color-grid">
          <div
            v-for="c in colorsMaterial" :key="c.code"
            class="color-item" @click="copyColorCode(c.code)"
          >
            <div class="color-box" :style="{ backgroundColor: c.color }" />
            <div class="color-info">
              <span class="color-code">§{{ c.code }}</span>
              <span class="color-name">{{ c.name }}</span>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="modal-actions">
          <span class="color-footer-hint">点击颜色项可复制 § 代码</span>
          <button class="btn btn-fill" @click="closeColorTable">关闭</button>
        </div>
      </template>
    </NModal>
  </NConfigProvider>
</template>

<style scoped>
.color-section { margin-bottom: 16px; }
.color-section:last-child { margin-bottom: 0; }
.color-section-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px;
}
.color-section-title {
  font-size: 11px; font-weight: 600; color: var(--text-tertiary);
  text-transform: uppercase; letter-spacing: 0.5px;
  transition: color 0.4s ease;
}
.color-section-hint { font-size: 10px; color: var(--text-tertiary); transition: color 0.4s ease; }
.color-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
@media (min-width: 480px) { .color-grid { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 640px) { .color-grid { grid-template-columns: repeat(4, 1fr); } }
.color-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px;
  background: var(--bg-sub);
  border-radius: 6px; border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 0.15s ease, background-color 0.4s ease, border-color 0.4s ease;
}
.color-item:hover {
  border-color: var(--text-secondary); background: var(--bg-card);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}
.color-item:active { transform: scale(0.98); }
.color-box {
  width: 24px; height: 24px; border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.1); flex-shrink: 0;
}
.color-info { flex: 1; min-width: 0; }
.color-code {
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: 12px; font-weight: 600; color: var(--text-primary);
  transition: color 0.4s ease;
}
.color-name { font-size: 10px; color: var(--text-tertiary); display: block; transition: color 0.4s ease; }
.color-footer-hint { font-size: 11px; color: var(--text-tertiary); transition: color 0.4s ease; }

/* 页脚操作按钮 (与 UpdateDialog 一致) */
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  align-items: center;
  width: 100%;
  padding-top: 8px;
}
.modal-actions > :first-child:not(span) { margin-right: auto; }

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
</style>

<script setup>
import AppModal from '../ui/AppModal.vue'
import {
  showColorModal, colorsStandard, colorsMaterial,
  closeColorTable, copyColorCode,
} from '../../composables/useRawJsonEditor.js'
</script>

<template>
  <AppModal
    v-model:show="showColorModal"
    title="颜色代码参考表"
    :max-width="640"
    :max-height-offset="110"
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
        <button class="app-modal-btn app-modal-btn--fill" @click="closeColorTable">关闭</button>
      </div>
    </template>
  </AppModal>
</template>

<style scoped>
.color-section { margin-bottom: 16px; }
.color-section:last-child { margin-bottom: 0; }
.color-section-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px;
}
.color-section-title {
  font-size: 11px; font-weight: 600; color: var(--subtle-foreground);
  text-transform: uppercase; letter-spacing: 0.5px;
  transition: color 0.4s ease;
}
.color-section-hint { font-size: 10px; color: var(--subtle-foreground); transition: color 0.4s ease; }
.color-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
@media (min-width: 480px) { .color-grid { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 640px) { .color-grid { grid-template-columns: repeat(4, 1fr); } }
.color-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px;
  background: var(--muted);
  border-radius: var(--radius-sm); border: 1px solid var(--border);
  cursor: pointer;
  transition: all 0.15s ease, background-color 0.4s ease, border-color 0.4s ease;
}
.color-item:hover {
  border-color: var(--muted-foreground); background: var(--card);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}
.color-item:active { transform: scale(0.98); }
.color-box {
  width: 24px; height: 24px; border-radius: var(--radius-xs);
  border: 1px solid var(--border); flex-shrink: 0;
}
.color-info { flex: 1; min-width: 0; }
.color-code {
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: 12px; font-weight: 600; color: var(--foreground);
  transition: color 0.4s ease;
}
.color-name { font-size: 10px; color: var(--subtle-foreground); display: block; transition: color 0.4s ease; }
.color-footer-hint { font-size: 11px; color: var(--subtle-foreground); transition: color 0.4s ease; }

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
</style>

<script setup>
import { NIcon } from 'naive-ui'
import { Code20Filled, ArrowMinimize16Filled } from '@vicons/fluent'
import { jsonFormatted, formatJson, minifyJson } from '../../composables/useRawJsonEditor.js'
</script>

<template>
  <div class="format-toggle">
    <button class="qh-btn" :class="{ 'qh-btn--active': jsonFormatted }" @click="formatJson">
      <NIcon :component="Code20Filled" :size="14" />
      <span>格式化</span>
    </button>
    <button class="qh-btn" :class="{ 'qh-btn--active': !jsonFormatted }" @click="minifyJson">
      <NIcon :component="ArrowMinimize16Filled" :size="14" />
      <span>压缩</span>
    </button>
  </div>
</template>

<style scoped>
.format-toggle { display: flex; gap: 2px; }
.qh-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 8px;
  border: none; background: transparent;
  color: var(--muted-foreground);
  font-size: 11px; font-weight: 500;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: inherit;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.qh-btn:hover { background: var(--muted); }
.qh-btn:active { transform: scale(0.97); }
.qh-btn--active { color: var(--foreground); }
.qh-btn--active:hover { background: var(--muted); }
</style>

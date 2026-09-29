<script setup>
import { NButton, NIcon } from 'naive-ui'
import { Add16Filled, Delete24Regular } from '@vicons/fluent'
import { addElement, clearAll } from '../../composables/useRawJsonEditor.js'

defineProps({
  /** 紧凑布局：卡片头部整条让位，添加与清空分别由追加栏和设置面板接管 */
  compact: { type: Boolean, default: false },
})
</script>

<template>
  <div class="list-card">
    <div v-if="!compact" class="list-header">
      <button class="add-btn" @click="addElement(null)">
        <NIcon :component="Add16Filled" :size="14" />
        <span>添加元素</span>
      </button>
      <NButton size="tiny" quaternary @click="clearAll">
        <template #icon><NIcon :component="Delete24Regular" :size="14" /></template>
        清空
      </NButton>
    </div>

    <slot />
  </div>
</template>

<style scoped>
.list-card {
  background: var(--card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  padding: 16px;
  transition: background-color 0.4s ease, border-color 0.4s ease;
}
.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

/* 自定义添加按钮 */
.add-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  padding: 4px 12px;
  border: none;
  background: var(--primary);
  color: var(--primary-foreground);
  font-size: 12px; font-weight: 500;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: inherit;
  transition: background-color 0.4s ease, opacity 0.15s ease, transform 0.1s ease;
}
.add-btn:hover { opacity: 0.85; }
.add-btn:active { transform: scale(0.97); }
</style>

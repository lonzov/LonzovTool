<template>
  <div class="toolbar">
    <button class="qh-btn" @click="openImport">
      <NIcon :component="ArrowImport24Regular" :size="14" />
      <span>导入</span>
    </button>
    <button class="qh-btn" @click="copyOutput">
      <NIcon :component="Copy24Regular" :size="14" />
      <span>导出</span>
    </button>
    <button class="qh-btn" @click="loadExample">
      <NIcon :component="ArrowImport24Regular" :size="14" />
      <span>加载示例</span>
    </button>
    <button class="qh-btn" @click="clearAll">
      <NIcon :component="Delete24Regular" :size="14" />
      <span>清空</span>
    </button>
  </div>
</template>

<script setup>
defineOptions({ name: 'SelectorToolbar' })
import { NIcon } from 'naive-ui'
import { ArrowImport24Regular, Copy24Regular, Delete24Regular } from '@vicons/fluent'
import { openImport } from '../composables/useImport.js'
import { copyOutput, clearAll, loadExample } from '../composables/useOutput.js'
</script>

<style scoped>
.toolbar {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
}
.qh-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  border-radius: 7px;
  cursor: pointer;
  font-family: inherit;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}
.qh-btn:hover {
  background: var(--bg-sub);
  color: var(--text-primary);
}
.qh-btn:active {
  transform: scale(0.97);
}
</style>

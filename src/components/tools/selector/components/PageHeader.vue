<template>
  <div class="page-header">
    <div class="page-title-row">
      <NIcon :component="Mention20Filled" class="page-title-icon" />
      <h1 class="page-title">选择器参数编辑器</h1>
    </div>
    <p class="page-desc">可视化编辑 Minecraft 目标选择器参数，支持嵌套结构</p>
  </div>
</template>

<script setup>
import { NIcon } from 'naive-ui'
import { Mention20Filled } from '@vicons/fluent'
</script>

<style scoped>
.page-header {
  margin-bottom: 0;
}
.page-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.page-title-icon {
  font-size: 26px;
  color: var(--text-primary);
  flex-shrink: 0;
  transition: color 0.4s ease;
}
.page-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.3;
  margin: 0;
  transition: color 0.4s ease;
}
.page-desc {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-top: 6px;
  transition: color 0.4s ease;
}
</style>

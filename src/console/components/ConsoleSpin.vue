<script setup>
import { NSpin } from 'naive-ui'

/**
 * 浮层加载占位：打开后才请求内容的弹窗/抽屉用它撑住高度，
 * 避免加载完成前浮层只有标题和页脚、内容区塌成一条。
 */
defineProps({
  minHeight: { type: [String, Number], default: 160 },
  description: { type: String, default: '' },
})

const toSize = (value) => (typeof value === 'number' ? `${value}px` : value)
</script>

<template>
  <div class="console-spin" :style="{ minHeight: toSize(minHeight) }">
    <NSpin size="small" stroke="var(--muted-foreground)" :description="description" />
  </div>
</template>

<style scoped>
.console-spin {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}
</style>

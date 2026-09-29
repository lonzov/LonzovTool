<script setup>
/**
 * T显编辑器的卡片外壳：底色、描边、圆角、标题行一次定义，
 * 预览 / JSON 输出 / 命令三张卡只负责各自的内容与右上角动作。
 */
defineProps({
  /** 传空串则不渲染标题行（紧凑布局的游戏渲染卡让高度全给内容） */
  title: { type: String, default: '' },
  /** 卡片被拉满容器高度：内容区按剩余高度分配（紧凑布局的大预览区） */
  stretch: { type: Boolean, default: false },
})
</script>

<template>
  <div class="output-card" :class="{ 'output-card--stretch': stretch }">
    <div v-if="title" class="output-card-header">
      <span class="output-card-title">{{ title }}</span>
      <slot name="actions" />
    </div>
    <slot />
  </div>
</template>

<style scoped>
.output-card {
  background: var(--card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  padding: 16px;
  transition: background-color 0.4s ease, border-color 0.4s ease;
}
.output-card--stretch {
  display: flex; flex-direction: column;
  min-height: 0;
}
.output-card-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px;
}
.output-card-title {
  font-size: 11px; font-weight: 700; color: var(--foreground);
  text-transform: uppercase; letter-spacing: 0.5px;
  transition: color 0.4s ease;
}
</style>

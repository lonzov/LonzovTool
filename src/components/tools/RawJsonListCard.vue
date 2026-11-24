<script setup>
import { ref } from 'vue'
import AppScrollbar from '../ui/AppScrollbar.vue'

defineProps({
  /** 桌面端：卡片自己吃满整列高度，列表区内部滚动 */
  inline: { type: Boolean, default: false },
})

const scroller = ref(null)
</script>

<template>
  <div class="list-card" :class="{ 'list-card--inline': inline }">
    <div class="list-body">
      <div ref="scroller" class="list-view">
        <slot />
      </div>
      <AppScrollbar v-if="inline" :target="scroller" />
    </div>
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
/* 桌面端右侧不留内边距：这段留白属于滚动区，浮层拇指画在里面，不会压到行 */
.list-card--inline {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding: 12px 0 0 12px;
}
.list-card--inline .list-body {
  position: relative;
  flex: 1;
  min-height: 0;
}
.list-card--inline .list-view {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  /* 行右侧留 12px，浮层拇指落在这段留白里 */
  padding: 0 12px 12px 0;
  scrollbar-width: none;
}
.list-card--inline .list-view::-webkit-scrollbar {
  display: none;
}
</style>

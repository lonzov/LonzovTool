<script setup>
import { NIcon } from 'naive-ui'

defineProps({
  icon: {
    type: Object,
    default: null,
  },
  title: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <section class="console-panel">
    <div class="panel-head">
      <div class="panel-head-main">
        <div class="panel-title-row">
          <NIcon v-if="icon" :component="icon" :size="16" class="panel-icon" />
          <h2 class="panel-title">{{ title }}</h2>
        </div>
        <p v-if="description" class="panel-desc">{{ description }}</p>
      </div>
      <div class="panel-head-extra">
        <slot name="extra" />
      </div>
    </div>
    <div class="panel-body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.console-panel {
  display: flex;
  flex-direction: column;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 16px 18px 18px;
  transition: background-color 0.4s ease, border-color 0.4s ease;
}

/* 标题区与右上角操作区在窄屏改为上下两行：操作区不参与收缩（按钮不能压扁），
   若不给它换行的机会，标题与说明会被挤成每行一个字的竖条 */
.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.panel-head-main {
  flex: 1 1 auto;
  min-width: 0;
}

.panel-title-row {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.panel-icon {
  flex-shrink: 0;
  color: var(--muted-foreground);
  transition: color 0.4s ease;
}

.panel-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--foreground);
  margin: 0;
  line-height: 1.4;
  transition: color 0.4s ease;
}

.panel-desc {
  font-size: 0.78rem;
  color: var(--subtle-foreground);
  line-height: 1.45;
  margin: 3px 0 0;
  transition: color 0.4s ease;
}

.panel-head-extra {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  min-height: 20px;
}

/* 内容超过卡片可分配高度时在卡片内部滚动，标题行保持不动。
   min-height: 0 是滚动生效的前提（flex 子项默认不会缩到内容高度以下） */
.panel-body {
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
}
</style>

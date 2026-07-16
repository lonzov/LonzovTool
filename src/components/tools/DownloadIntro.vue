<script setup>
import { useDownloadIntro } from '../../composables/useDownloadIntro'
import MarkdownRenderer from '../MarkdownRenderer.vue'
import ToolLoading from '../ToolLoading.vue'

const props = defineProps({
  config: { type: Object, default: null },
})

const { introRaw, introMdLoading, introError } = useDownloadIntro(() => props.config)
</script>

<template>
  <div class="download-intro">
    <h2 class="intro-title">功能介绍</h2>
    <!-- Markdown 加载中 -->
    <div v-if="config.introMd && introMdLoading" class="intro-loading-wrap">
      <ToolLoading />
    </div>
    <!-- Markdown 加载失败 -->
    <p v-else-if="config.introMd && introError" class="intro-error">
      加载功能介绍失败：{{ introError }}
    </p>
    <!-- Markdown 渲染 -->
    <MarkdownRenderer v-else-if="config.introMd" :raw="introRaw" />
    <!-- 字符串形式（兼容旧配置） -->
    <p v-else class="intro-text" v-html="config.intro.replace(/\n/g, '<br>')" />
  </div>
</template>

<style scoped>
/* ===== 加载/错误包装 ===== */
.intro-loading-wrap {
  padding: 70px 0 120px 0;
}

.intro-loading-wrap :deep(.tool-loading) {
  padding: 0;
}

.intro-error {
  color: var(--text-tertiary);
  font-size: 14px;
  margin: 0;
}

/* ===== 功能介绍布局 ===== */
.download-intro {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.intro-title {
  font-size: 21px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.5px;
  margin: 0;
}

.intro-text {
  font-size: 15px;
  color: color-mix(in srgb, var(--text-primary) 87%, transparent);
  line-height: 1.75;
  margin: 0;
}

.intro-text :deep(a) {
  color: var(--text-primary);
  text-decoration: none;
  position: relative;
  padding-bottom: 2px;
  cursor: pointer;
  display: inline-block;
  vertical-align: baseline;
  background: none;
}

.intro-text :deep(a)::before {
  content: '';
  display: block;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 5px;
  height: 1px;
  background-image: repeating-linear-gradient(to right,
      color-mix(in srgb, var(--text-primary), transparent 30%) 0 4px,
      transparent 4px 8px);
  background-repeat: repeat-x;
  background-size: 8px 1px;
  opacity: 1;
  transition: opacity 0.3s;
  pointer-events: none;
  z-index: 2;
}

.intro-text :deep(a)::after {
  content: '';
  display: block;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 5px;
  height: 1px;
  background-color: var(--text-primary);
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
  z-index: 3;
}

.intro-text :deep(a:hover::before) {
  opacity: 0;
}

.intro-text :deep(a:hover::after) {
  opacity: 1;
}

/* ===== 响应式 ===== */
@media (max-width: 640px) {
  .intro-title {
    font-size: 16px;
  }

  .intro-text {
    font-size: 14px;
  }
}
</style>

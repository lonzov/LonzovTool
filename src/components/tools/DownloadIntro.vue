<script setup>
import { useDownloadIntro } from '../../composables/useDownloadIntro'
import ToolLoading from '../ToolLoading.vue'

const props = defineProps({
  config: { type: Object, default: null },
})

const { introHtml, introMdLoading } = useDownloadIntro(() => props.config)
</script>

<template>
  <div class="download-intro">
    <h2 class="intro-title">功能介绍</h2>
    <!-- Markdown 加载中 -->
    <div v-if="config.introMd && introMdLoading" class="intro-loading-wrap">
      <ToolLoading />
    </div>
    <!-- Markdown 渲染 -->
    <div v-else-if="config.introMd" class="dl-intro-md" v-html="introHtml"></div>
    <!-- 字符串形式（兼容旧配置） -->
    <p v-else class="intro-text" v-html="config.intro.replace(/\n/g, '<br>')"></p>
  </div>
</template>

<style scoped>
/* ===== 加载动画包装 ===== */
.intro-loading-wrap {
  padding: 70px 0 120px 0;
}

.intro-loading-wrap :deep(.tool-loading) {
  padding: 0;
}

/* ===== 功能介绍 ===== */
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

/* ===== Markdown 渲染样式（照抄文档页） ===== */
.dl-intro-md {
  color: var(--text-primary);
  line-height: 1.8;
}

.dl-intro-md :deep(h1) {
  font-size: 1.875rem;
  line-height: 1.2;
  margin: 0.67em 0;
}

.dl-intro-md :deep(h2) {
  font-size: 1.5em;
  line-height: 1.333;
  font-weight: 700;
  margin: 1em 0 0.5em;
}

.dl-intro-md :deep(h3) {
  font-size: 1.25em;
  line-height: 1.6;
  font-weight: 600;
  margin: 1.6em 0 0.6em;
}

.dl-intro-md :deep(p) {
  margin: 0.8em 0;
}

.dl-intro-md :deep(ul),
.dl-intro-md :deep(ol) {
  padding-left: 2em;
}

.dl-intro-md :deep(code) {
  background: var(--bg-sub);
  padding: 0.25rem 0.375rem;
  border-radius: 0.375rem;
  font-size: 0.875em;
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-weight: 400;
  overflow: hidden;
  transition: background-color 0.4s ease;
}

.dl-intro-md :deep(pre) {
  background: var(--bg-sub);
  padding: 16px;
  border-radius: 0.75rem;
  overflow-x: auto;
  margin: 1.5em 0;
  transition: background-color 0.4s ease;
}

.dl-intro-md :deep(pre code) {
  background: transparent;
  padding: 0;
  border-radius: 0;
  font-size: 0.875em;
  line-height: 1.7142857;
}

.dl-intro-md :deep(blockquote) {
  position: relative;
  padding-left: 20px;
  margin: 16px 0;
  color: var(--text-secondary);
  border-left: none !important;
}

.dl-intro-md :deep(blockquote)::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  width: 3.5px;
  height: 100%;
  background: color-mix(in srgb, var(--primary-color) 22%, transparent);
  border-radius: 3px;
  z-index: 1;
  transition: background 0.4s;
}

.dl-intro-md :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 0.75rem;
}

.dl-intro-md :deep(table) {
  border-collapse: separate;
  border-spacing: 0;
  width: 100%;
  margin: 16px 0;
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  corner-shape: squircle;
  overflow: hidden;
}

.dl-intro-md :deep(th),
.dl-intro-md :deep(td) {
  border-bottom: 1px solid var(--border-color);
  border-right: 1px solid var(--border-color);
  padding: 8px 12px;
  text-align: left;
}

.dl-intro-md :deep(tr:last-child td) {
  border-bottom: none;
}

.dl-intro-md :deep(th:last-child),
.dl-intro-md :deep(td:last-child) {
  border-right: none;
}

.dl-intro-md :deep(th) {
  background: var(--bg-sub);
  font-weight: 600;
}

.dl-intro-md :deep(hr) {
  border: none;
  height: 0;
  border-top: 1px dashed var(--border-color);
  margin: 2em 0;
  transition: border-color 0.4s ease;
}

.dl-intro-md :deep(a) {
  color: var(--text-primary);
  text-decoration: none;
  position: relative;
  padding-bottom: 2px;
  cursor: pointer;
  display: inline-block;
  vertical-align: baseline;
  background: none;
}

.dl-intro-md :deep(a)::before {
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

.dl-intro-md :deep(a)::after {
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

.dl-intro-md :deep(a:hover::before) {
  opacity: 0;
}

.dl-intro-md :deep(a:hover::after) {
  opacity: 1;
}

@supports (corner-shape: squircle) {
  .dl-intro-md :deep(table) {
    border-radius: 1.275rem;
  }
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

<style>
.dl-intro-md iframe {
  border-radius: 18px;
  corner-shape: squircle;
  margin-left: auto;
  margin-right: auto;
  max-width: 100%;
}

@supports (corner-shape: squircle) {
  .dl-intro-md iframe {
    border-radius: 30px;
  }
}

[data-theme='dark'] .dl-intro-md iframe {
  filter: brightness(0.6);
}
</style>

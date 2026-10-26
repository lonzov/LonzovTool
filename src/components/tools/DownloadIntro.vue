<script setup>
import MarkdownRenderer from '../MarkdownRenderer.vue'

defineProps({
  config: { type: Object, default: null },
})
</script>

<template>
  <div class="download-intro">
    <h2 class="intro-title">功能介绍</h2>
    <MarkdownRenderer v-if="config.intro" :raw="config.intro" />
    <p v-else class="intro-empty">作者还没写功能介绍。</p>
  </div>
</template>

<style scoped>
.download-intro {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.intro-title {
  font-size: 21px;
  font-weight: 700;
  color: var(--foreground);
  letter-spacing: 0.5px;
  margin: 0;
}

.intro-empty {
  margin: 0;
  color: var(--subtle-foreground);
  font-size: 14px;
}

@media (max-width: 640px) {
  .intro-title {
    font-size: 16px;
  }
}
</style>

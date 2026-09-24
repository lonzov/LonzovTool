<script setup>
defineProps({
  error: {
    type: Error,
    default: null,
  },
})
</script>

<template>
  <div class="tool-loading" :class="{ 'tool-loading--error': error }">
    <div class="tool-loader-wrapper">
      <div class="tool-loader"></div>
    </div>
    <div class="tool-loading-text">{{ error ? ('加载失败：' + error.message) : '加载中...' }}</div>
  </div>
</template>

<style scoped>
.tool-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.6em;
  padding: 14em 0;
}

.tool-loader-wrapper {
  font-size: clamp(7px, 1.75vw, 12px);
  line-height: 0;
}

.tool-loader {
  width: 50px;
  aspect-ratio: 1;
  border-radius: 50%;
  corner-shape: round;
  border: 8px solid;
  border-color: var(--foreground) transparent;
  animation: tool-loader-spin 1s infinite;
  filter: drop-shadow(0 0 8px rgba(128, 140, 160, 0.4));
}

.tool-loading--error .tool-loader {
  animation: none;
  border-color: var(--destructive) transparent;
}

@keyframes tool-loader-spin {
  to { transform: rotate(0.5turn); }
}

.tool-loading-text {
  color: var(--muted-foreground);
  font-size: 1em;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-align: center;
  position: relative;
}
</style>

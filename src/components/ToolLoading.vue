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
  border: 8px solid;
  animation: tool-loader-spin 1s infinite;
  filter: drop-shadow(0 0 8px rgba(128, 140, 160, 0.4));
}

[data-theme='dark'] .tool-loader {
  border-color: #e7e7e7 #ffffff00;
}

[data-theme='light'] .tool-loader {
  border-color: #000000 #ffffff00;
}

.tool-loading--error .tool-loader {
  animation: none;
  border-color: #E46962 #ffffff00;
}

@keyframes tool-loader-spin {
  to { transform: rotate(0.5turn); }
}

.tool-loading-text {
  color: var(--text-secondary);
  font-size: 1em;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-align: center;
  position: relative;
}
</style>

<template>
  <div class="tool-card">
    <div class="card-body">
      <slot />
    </div>
    <div v-if="$slots.footer" class="card-footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<style scoped>
/* 内容区与底部操作栏分段，两者之间的分割线贯穿整卡 */
.tool-card {
  background: var(--card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: background-color 0.4s ease, border-color 0.4s ease;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 16px;
}

.card-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid var(--border);
  background: var(--accent);
  transition: background-color 0.4s ease, border-color 0.4s ease;
}

@media (max-width: 640px) {
  .card-body {
    padding: 12px;
    gap: 16px;
  }

  .card-footer {
    justify-content: center;
    flex-wrap: wrap;
    padding: 12px;
  }
}
</style>

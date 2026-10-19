<script setup>
import { NIcon } from 'naive-ui'

defineProps({
  label: {
    type: String,
    default: '',
  },
  value: {
    type: [Number, String],
    default: '—',
  },
  icon: {
    type: Object,
    default: null,
  },
  hint: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <div class="stat-card">
    <div class="stat-head">
      <NIcon v-if="icon" :component="icon" :size="16" class="stat-icon" />
      <span class="stat-label">{{ label }}</span>
    </div>
    <div class="stat-value">{{ value }}</div>
    <div v-if="hint" class="stat-hint">{{ hint }}</div>
  </div>
</template>

<style scoped>
.stat-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 16px 18px;
  transition: background-color 0.4s ease, border-color 0.4s ease;
}

.stat-head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.stat-icon {
  color: var(--muted-foreground);
  flex-shrink: 0;
  transition: color 0.4s ease;
}

.stat-label {
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--muted-foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.4s ease;
}

.stat-value {
  font-size: 1.6rem;
  font-weight: 700;
  line-height: 1.25;
  color: var(--foreground);
  margin-top: 10px;
  font-variant-numeric: tabular-nums;
  transition: color 0.4s ease;
}

.stat-hint {
  font-size: 0.75rem;
  color: var(--subtle-foreground);
  line-height: 1.45;
  margin-top: 4px;
  transition: color 0.4s ease;
}
</style>

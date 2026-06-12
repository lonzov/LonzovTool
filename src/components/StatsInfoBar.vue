<script setup>
import { onMounted } from 'vue'
import { useStats } from '../composables/useStats'

const { lastUpdate, isMocked, fetchStats } = useStats()

onMounted(() => {
  fetchStats()
})
</script>

<template>
  <div class="stats-info-bar">
    <span class="stats-info-label">统计自 2026/5/1</span>
    <span class="stats-info-sep">|</span>
    <span class="stats-info-label">更新时间：</span>
    <span class="stats-info-value">{{ lastUpdate || '加载中...' }}</span>
    <span class="stats-info-sep">|</span>
    <span class="stats-info-label">数据来源：</span>
    <span class="stats-info-value">{{ isMocked === null ? '加载中...' : isMocked ? '惯性估算' : 'Umami真实数据' }}</span>
  </div>
</template>

<style>
.stats-info-bar {
  position: relative;
  padding-left: 20px;
  margin: 16px 0;
  color: var(--text-secondary);
  font-size: inherit;
  line-height: 1.8;
}

.stats-info-bar::before {
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

.stats-info-sep {
  margin: 0 0.35em;
}
</style>

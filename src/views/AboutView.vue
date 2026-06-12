<script setup>
import { onMounted, computed } from 'vue'
import { NSkeleton, NNumberAnimation, NConfigProvider, darkTheme } from 'naive-ui'
import { useTheme } from '../composables/useTheme'
import { useStats } from '../composables/useStats'

const { isDark } = useTheme()
const { stats, loading, fetchStats } = useStats()

const naiveTheme = computed(() => isDark.value ? darkTheme : null)

onMounted(() => {
  fetchStats()
})
</script>

<template>
  <NConfigProvider :theme="naiveTheme">
    <div class="about-stats">
      <div class="stats-container">
        <div class="stats-grid">
          <!-- 今日浏览 -->
          <div class="stat-card">
            <div class="stat-label">今日浏览</div>
            <div class="stat-value">
              <n-skeleton v-if="loading" :width="80" :height="36" :sharp="false" />
              <n-number-animation v-else-if="stats.todayPV !== null" :from="0" :to="stats.todayPV" :duration="1500" />
              <span v-else class="stat-null">-</span>
            </div>
          </div>
          <!-- 今日访客 -->
          <div class="stat-card">
            <div class="stat-label">今日访客</div>
            <div class="stat-value">
              <n-skeleton v-if="loading" :width="80" :height="36" :sharp="false" />
              <n-number-animation v-else-if="stats.todayUV !== null" :from="0" :to="stats.todayUV" :duration="1500" />
              <span v-else class="stat-null">-</span>
            </div>
          </div>
          <!-- 昨日访客 -->
          <div class="stat-card">
            <div class="stat-label">昨日访客</div>
            <div class="stat-value">
              <n-skeleton v-if="loading" :width="80" :height="36" :sharp="false" />
              <n-number-animation v-else-if="stats.yesterdayUV !== null" :from="0" :to="stats.yesterdayUV" :duration="1500" />
              <span v-else class="stat-null">-</span>
            </div>
          </div>
          <!-- 本月访客 -->
          <div class="stat-card">
            <div class="stat-label">本月访客</div>
            <div class="stat-value">
              <n-skeleton v-if="loading" :width="100" :height="36" :sharp="false" />
              <n-number-animation v-else-if="stats.monthUV !== null" :from="0" :to="stats.monthUV" :duration="1500" />
              <span v-else class="stat-null">-</span>
            </div>
          </div>
          <!-- 本年访客 -->
          <div class="stat-card">
            <div class="stat-label">本年访客</div>
            <div class="stat-value">
              <n-skeleton v-if="loading" :width="100" :height="36" :sharp="false" />
              <n-number-animation v-else-if="stats.yearUV !== null" :from="0" :to="stats.yearUV" :duration="1500" />
              <span v-else class="stat-null">-</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </NConfigProvider>
</template>

<style scoped>
.about-stats {
  margin-bottom: 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
}

.stat-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px 20px;
  min-width: 0;
  transition: background-color .3s ease, border-color .3s ease;
}

.stat-label {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  user-select: none;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  min-height: 36px;
  display: flex;
  align-items: center;
  line-height: 36px;
}

.stat-null {
  font-size: 28px;
  font-weight: bold;
  color: var(--text-secondary);
  line-height: 36px;
}

@media (max-width: 1000px) {
  .stats-grid {
    grid-template-columns: repeat(6, 1fr);
    gap: 14px;
  }

  .stat-card:nth-child(1),
  .stat-card:nth-child(2),
  .stat-card:nth-child(3) {
    grid-column: span 2;
  }

  .stat-card:nth-child(4),
  .stat-card:nth-child(5) {
    grid-column: span 3;
  }
}

@media (max-width: 375px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .stat-card:nth-child(n) {
    grid-column: auto;
  }

  .stat-card:last-child {
    grid-column: span 2;
  }

  .stat-card {
    padding: 12px 14px;
  }

  .stat-value {
    font-size: 22px;
  }

  .stat-label {
    font-size: 12px;
  }
}

@media (max-width: 240px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .stat-card:last-child {
    grid-column: auto;
  }
}
</style>

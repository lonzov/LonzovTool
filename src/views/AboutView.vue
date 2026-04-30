<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { NSkeleton, NNumberAnimation, NConfigProvider, darkTheme } from 'naive-ui'
import { useTheme } from '../composables/useTheme'

const { isDark } = useTheme()

// 检查用户是否同意了分析Cookie（51.la）
function isAnalyticsAllowed() {
  if (typeof localStorage === 'undefined') return false
  const raw = localStorage.getItem('privacy_consent')
  if (!raw) return false // 尚未选择
  if (raw === 'agreed') return true
  try {
    const parts = raw.split(',')
    return Number(parts[1]) === 1 // 分析Cookie是否为1
  } catch {
    return false
  }
}

// 是否显示统计卡片：仅当用户同意分析Cookie时才展示
const showStatsCards = ref(isAnalyticsAllowed())

// 计算 naive 主题
const naiveTheme = computed(() => isDark.value ? darkTheme : null)

// 统计数据（初始值为null表示未加载）
const stats = ref({
  total: null,           // 总访问量
  todayVisitors: null,  // 今日访客
  yesterdayVisitors: null, // 昨日访客
  activeVisitors: null,   // 最近15分钟访客
  monthVisits: null       // 本月访问量
})

// 加载状态
const loading = ref(true)
const error = ref(null)

// 51.la 观察器
let observer = null
// 加载超时计时器
let timeoutTimer = null

// 加载51.la脚本
function load51LaScript() {
  // 检查是否已加载
  if (document.getElementById('LA-DATA-WIDGET') || document.querySelector('.la-data-widget__container')) {
    extractData()
    return
  }

  const script = document.createElement('script')
  script.id = 'LA-DATA-WIDGET'
  script.crossorigin = 'anonymous'
  script.src = 'https://v6-widget.51.la/v6/3Ltl0yXYWQcgbDgB/quote.js?theme=#1690FF,#333333,#777773,#777777,#FFFFFF,#1690FF,11&f=12&display=1,1,1,1,1,1,1,1'
  document.head.appendChild(script)
}

// 从51.la注入的元素中提取数据
function extractData() {
  const container = document.querySelector('.la-data-widget__container')
  if (!container) {
    console.log('[统计数据提取] 未找到数据挂件')
    return false
  }

  console.log('[统计数据提取] 已发现数据挂件，HTML长度：', container.innerHTML.length)

  const mapping = {
    '最近活跃访客': 'activeVisitors',
    '今日访问人数': 'todayVisitors',
    '昨日访问人数': 'yesterdayVisitors',
    '本月访问量': 'monthVisits',
    '总访问量': 'total'
  }

  // 遍历所有span，按文本内容匹配
  const spans = container.querySelectorAll('span')
  let extractedCount = 0

  // 临时存储提取结果
  const extracted = {}

  spans.forEach(span => {
    const text = span.textContent?.trim()
    if (mapping[text]) {
      // 找到对应的数值span（父元素的最后一个span）
      const parent = span.parentElement
      const valueSpan = parent.querySelector('span:last-child')
      if (valueSpan && valueSpan !== span) {
        const value = valueSpan.textContent.trim()
        extracted[mapping[text]] = value
        stats.value[mapping[text]] = parseInt(value.replace(/,/g, '')) || null
        extractedCount++
        console.log(`[统计数据提取] 已提取${text}：`, value)
      } else {
        console.log(`[统计数据提取] 未找到${text}的数值`)
      }
    }
  })

  if (extractedCount === 0) {
    console.log('[统计数据提取] 未提取到任何数据，container内容：', container.innerHTML.substring(0, 500))
  }

  return extractedCount > 0
}

// 处理数据加载完成
function onDataLoaded() {
  const success = extractData()
  if (success) {
    loading.value = false
  }
}

// 初始化51.la数据监听
function init51LaListener() {
  // 先检查是否已存在
  const existing = document.querySelector('.la-data-widget__container')
  if (existing) {
    onDataLoaded()
    return
  }

  // 监听DOM变化
  observer = new MutationObserver((mutations, obs) => {
    const target = document.querySelector('.la-data-widget__container')
    if (target) {
      onDataLoaded()
      obs.disconnect()
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true
  })

  // 加载51.la脚本
  load51LaScript()

  // 超时保护：15秒后还没加载成功则结束loading
  timeoutTimer = setTimeout(() => {
    if (loading.value) {
      loading.value = false
      error.value = '数据加载超时'
    }
  }, 15000)
}

onMounted(() => {
  if (showStatsCards.value) {
    init51LaListener()
  }
})

onUnmounted(() => {
  if (observer) {
    observer.disconnect()
  }
  if (timeoutTimer) {
    clearTimeout(timeoutTimer)
  }
})
</script>

<template>
  <NConfigProvider :theme="naiveTheme">
    <div class="about-stats">
      <!-- 统计卡片区域（仅当用户同意分析Cookie时显示） -->
      <div v-if="showStatsCards" class="stats-container">
        <div class="stats-grid">
          <!-- 最近15分钟访客 -->
          <div class="stat-card">
            <div class="stat-label">最近访客</div>
            <div class="stat-value">
              <n-skeleton v-if="loading" :width="80" :height="36" :sharp="false" />
              <n-number-animation v-else-if="stats.activeVisitors !== null" :from="0" :to="stats.activeVisitors" :duration="1500" />
              <span v-else class="stat-null">-</span>
            </div>
          </div>
          <!-- 今日访客 -->
          <div class="stat-card">
            <div class="stat-label">今日访客</div>
            <div class="stat-value">
              <n-skeleton v-if="loading" :width="100" :height="36" :sharp="false" />
              <n-number-animation v-else-if="stats.todayVisitors !== null" :from="0" :to="stats.todayVisitors" :duration="1500" />
              <span v-else class="stat-null">-</span>
            </div>
          </div>
          <!-- 昨日访客 -->
          <div class="stat-card">
            <div class="stat-label">昨日访客</div>
            <div class="stat-value">
              <n-skeleton v-if="loading" :width="100" :height="36" :sharp="false" />
              <n-number-animation v-else-if="stats.yesterdayVisitors !== null" :from="0" :to="stats.yesterdayVisitors" :duration="1500" />
              <span v-else class="stat-null">-</span>
            </div>
          </div>
          <!-- 本月访问量 -->
          <div class="stat-card">
            <div class="stat-label">本月访问量</div>
            <div class="stat-value">
              <n-skeleton v-if="loading" :width="100" :height="36" :sharp="false" />
              <n-number-animation v-else-if="stats.monthVisits !== null" :from="0" :to="stats.monthVisits" :duration="1500" />
              <span v-else class="stat-null">-</span>
            </div>
          </div>
          <!-- 总访问量 -->
          <div class="stat-card">
            <div class="stat-label">总访问量</div>
            <div class="stat-value">
              <n-skeleton v-if="loading" :width="120" :height="36" :sharp="false" />
              <n-number-animation v-else-if="stats.total !== null" :from="0" :to="stats.total" :duration="1500" />
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

@media (max-width: 373px) {
  .stats-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .stat-card:nth-child(n) {
    grid-column: auto;
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
</style>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import {
  Alert24Regular,
  Apps24Regular,
  ArrowDownload24Regular,
  Code24Regular,
  DataTrending24Regular,
  Globe24Regular,
  Heart24Regular,
  Send24Regular,
  TopSpeed24Regular,
} from '@vicons/fluent'
import {
  cardsData,
  donateRecordsData,
  loadDonateRecords,
} from '../../composables/useSiteData.js'
import { useStats } from '../../composables/useStats.js'
import ConsolePanel from '../components/ConsolePanel.vue'
import StatCard from '../components/StatCard.vue'

/* ===========================================================================
   占位数据：以下常量覆盖控制台里尚无后端支撑的部分，接口就绪后逐个替换，
   对应的面板在 extra 槽里挂「示例数据」标记，避免看起来像真数据。
   =========================================================================== */

const TODO_ITEMS = [
  { label: '网址提交待审核', count: 1 },
  { label: '建议反馈待处理', count: 0 },
  { label: '卡片维护提醒', count: 0 },
]

const SUBMISSION_STATUS = {
  pending: { label: '待审核', tone: 'warning' },
  reviewing: { label: '审核中', tone: 'muted' },
  approved: { label: '已通过', tone: 'success' },
  rejected: { label: '已拒绝', tone: 'destructive' },
}

const SUBMISSIONS = [
  { title: '官方首页 - 站点建设与服务', url: 'https://www.example.com', time: '2026-05-24 14:32', status: 'pending' },
  { title: '全新产品发布页面', url: 'https://product.example.com', time: '2026-05-23 16:20', status: 'reviewing' },
  { title: '关于我们 - 公司介绍', url: 'https://about.example.com', time: '2026-05-22 11:08', status: 'approved' },
  { title: '合作伙伴 - 生态合作', url: 'https://partner.example.com', time: '2026-05-20 09:45', status: 'rejected' },
  { title: '博客 - 行业资讯', url: 'https://blog.example.com', time: '2026-05-19 15:12', status: 'approved' },
]

const UPTIME_ROWS = [
  { host: 'www.example.com', up: true, ms: '112 ms', checked: '2026-05-24 14:32' },
  { host: 'api.example.com', up: true, ms: '236 ms', checked: '2026-05-24 14:29' },
  { host: 'cdn.example.com', up: true, ms: '89 ms', checked: '2026-05-24 14:27' },
  { host: 'www.google.com', up: true, ms: '142 ms', checked: '2026-05-24 14:25' },
  { host: 'partner.example.com', up: false, ms: '523 ms', checked: '2026-05-24 14:23' },
  { host: 'static.example.com', up: true, ms: '96 ms', checked: '2026-05-24 14:20' },
]

const TERMINAL_LOGS = [
  { time: '2026-05-24 14:32:10', level: 'INFO', ip: '192.168.1.10', text: '用户 admin 登录成功' },
  { time: '2026-05-24 14:29:45', level: 'WARN', ip: '10.10.1.45', text: '检测到可疑请求：尝试访问未授权路径 /admin' },
  { time: '2026-05-24 14:23:17', level: 'INFO', ip: '192.168.1.10', text: '审核网址提交：https://partner.example.com 状态：待审核' },
  { time: '2026-05-24 14:17:03', level: 'INFO', ip: '10.10.1.32', text: '更新配置：站点防护策略' },
  { time: '2026-05-24 14:12:56', level: 'INFO', ip: '192.168.1.10', text: '删除域名 old.example.com' },
  { time: '2026-05-24 14:08:21', level: 'ERROR', ip: '10.10.1.45', text: '外部网站检测失败：www.partner.com 超时（523ms）' },
  { time: '2026-05-24 14:02:17', level: 'INFO', ip: '10.10.1.32', text: '访问控制台：查看监控数据' },
]

/* ===== 站点数据（构建期快照 + 接口刷新，见 useSiteData） ===== */

// 下载页以配置目录为准，只取键名，不把配置内容拉进控制台 chunks
const downloadPages = import.meta.glob('../../data/downloads/*.json')

const allTools = computed(() => cardsData.value.categories.flatMap((category) => category.tools))
const externalTools = computed(() =>
  allTools.value.filter((tool) => /^https?:/i.test(tool.link || '')),
)
const internalCount = computed(() => allTools.value.length - externalTools.value.length)

const externalHosts = computed(() => {
  const counter = new Map()
  for (const tool of externalTools.value) {
    try {
      const host = new URL(tool.link).hostname.replace(/^www\./, '')
      counter.set(host, (counter.get(host) || 0) + 1)
    } catch {
      // 非法 URL 不进分布统计
    }
  }
  return [...counter.entries()]
})

const donateRecords = ref(null)

onMounted(async () => {
  donateRecords.value = await loadDonateRecords().catch(() => [])
})

watch(donateRecordsData, (list) => {
  if (list) donateRecords.value = list
})

const stats = computed(() => [
  {
    label: '工具卡片',
    value: allTools.value.length,
    icon: Apps24Regular,
    hint: `${externalTools.value.length} 站外 · ${internalCount.value} 站内`,
  },
  {
    label: '站外链接',
    value: externalTools.value.length,
    icon: Globe24Regular,
    hint: `${externalHosts.value.length} 个域名`,
  },
  {
    label: '下载页',
    value: Object.keys(downloadPages).length,
    icon: ArrowDownload24Regular,
    hint: '下载配置目录',
  },
  {
    label: '打赏记录',
    value: donateRecords.value ? donateRecords.value.length : '—',
    icon: Heart24Regular,
    hint: '打赏流水',
  },
])

/* ===== 待办事项：数量即入账的待处理条数，目前无后端，恒为占位值 ===== */
const pendingCount = computed(() => TODO_ITEMS.filter((item) => item.count > 0).length)

/* ===== 访问统计（Umami 分享接口，模块级缓存 30 分钟） ===== */
const { stats: siteStats, loading: statsLoading, lastUpdate, isMocked, fetchStats } = useStats()

onMounted(fetchStats)

function formatCount(value) {
  return value == null ? '—' : String(value).toLocaleString('zh-CN')
}

// 昨日没有单独的浏览量口径，故只有独立访客一项能算环比
const uvDelta = computed(() => {
  const today = siteStats.value.todayUV
  const yesterday = siteStats.value.yesterdayUV
  if (!today || !yesterday) return null
  return Math.round(((today - yesterday) / yesterday) * 100)
})

const trafficRows = computed(() => [
  { label: '今日访问量', value: formatCount(siteStats.value.todayPV), delta: null },
  { label: '今日独立访客', value: formatCount(siteStats.value.todayUV), delta: uvDelta.value },
  { label: '昨日独立访客', value: formatCount(siteStats.value.yesterdayUV), delta: null },
  { label: '本月独立访客', value: formatCount(siteStats.value.monthUV), delta: null },
  { label: '本年访问量', value: formatCount(siteStats.value.yearPV), delta: null },
])

const statsNote = computed(() => {
  if (statsLoading.value) return '读取中…'
  if (!lastUpdate.value) return '暂无数据'
  // 接口可能回估算值，必须让管理侧一眼看出这不是真实口径
  return `更新于 ${lastUpdate.value}${isMocked.value ? '（估算）' : ''}`
})

const todoTitle = computed(() => `待办事项 (${pendingCount.value}/${TODO_ITEMS.length})`)
</script>

<template>
  <div class="console-overview">
    <div class="overview-top">
      <div class="overview-main">
        <ConsolePanel
          :icon="Alert24Regular"
          :title="todoTitle"
          description="包含 网址提交、建议反馈、卡片维护 等需要处理的事项"
        >
          <template #extra>
            <span class="sample-tag">示例数据</span>
          </template>
          <ul class="row-list">
            <li v-for="item in TODO_ITEMS" :key="item.label" class="row">
              <span class="row-main">{{ item.label }}</span>
              <span class="todo-count" :class="{ 'todo-count--active': item.count > 0 }">
                {{ item.count }}
              </span>
            </li>
          </ul>
        </ConsolePanel>

        <div class="stat-grid">
          <StatCard v-for="item in stats" :key="item.label" v-bind="item" />
        </div>
      </div>

      <ConsolePanel
        :icon="DataTrending24Regular"
        title="最近网站数据"
        description="数据来自站点访问统计"
      >
        <template #extra>
          <span class="panel-note">{{ statsNote }}</span>
        </template>
        <ul class="row-list">
          <li v-for="row in trafficRows" :key="row.label" class="row">
            <span class="row-main">{{ row.label }}</span>
            <span class="traffic-value">{{ row.value }}</span>
            <span
              v-if="row.delta !== null"
              class="traffic-delta"
              :class="row.delta >= 0 ? 'traffic-delta--up' : 'traffic-delta--down'"
            >
              {{ row.delta >= 0 ? '↑' : '↓' }}{{ Math.abs(row.delta) }}%
            </span>
          </li>
        </ul>
      </ConsolePanel>
    </div>

    <div class="panel-columns">
      <ConsolePanel :icon="Send24Regular" title="网址提交">
        <template #extra>
          <span class="sample-tag">示例数据</span>
        </template>
        <div class="data-table submission-table">
          <div class="data-row data-row--head">
            <span>标题 / 网址</span>
            <span>提交时间</span>
            <span>状态</span>
            <span>操作</span>
          </div>
          <div v-for="item in SUBMISSIONS" :key="item.url" class="data-row">
            <span class="cell-main">
              <span class="cell-title">{{ item.title }}</span>
              <span class="cell-sub">{{ item.url }}</span>
            </span>
            <span class="cell-meta">{{ item.time }}</span>
            <span>
              <span class="status-pill" :class="`status-pill--${SUBMISSION_STATUS[item.status].tone}`">
                {{ SUBMISSION_STATUS[item.status].label }}
              </span>
            </span>
            <span>
              <button class="cell-btn" type="button" disabled>查看</button>
            </span>
          </div>
        </div>
      </ConsolePanel>

      <ConsolePanel :icon="TopSpeed24Regular" title="Uptime">
        <template #extra>
          <span class="sample-tag">示例数据</span>
        </template>
        <div class="data-table uptime-table">
          <div class="data-row data-row--head">
            <span>域名 / 地址</span>
            <span>状态</span>
            <span>响应时间</span>
            <span>检测时间</span>
          </div>
          <div v-for="item in UPTIME_ROWS" :key="item.host" class="data-row">
            <span class="cell-title cell-title--mono">{{ item.host }}</span>
            <span class="uptime-state" :class="item.up ? 'uptime-state--up' : 'uptime-state--down'">
              <i class="uptime-dot"></i>{{ item.up ? '正常' : '异常' }}
            </span>
            <span class="cell-meta">{{ item.ms }}</span>
            <span class="cell-meta">{{ item.checked }}</span>
          </div>
        </div>
      </ConsolePanel>
    </div>

    <ConsolePanel
      class="terminal-panel"
      :icon="Code24Regular"
      title="终端日志"
      description="系统运行与安全事件的实时记录"
    >
      <template #extra>
        <span class="sample-tag">示例数据</span>
      </template>
      <div class="terminal">
        <div v-for="line in TERMINAL_LOGS" :key="line.time + line.text" class="terminal-line">
          <span class="terminal-time">{{ line.time }}</span>
          <span class="terminal-level" :class="`terminal-level--${line.level.toLowerCase()}`">
            [{{ line.level }}]
          </span>
          <span class="terminal-ip">{{ line.ip }}</span>
          <span class="terminal-text">{{ line.text }}</span>
        </div>
      </div>
    </ConsolePanel>
  </div>
</template>

<style scoped>
/* ===== 上区：主区（待办 + 指标卡）与右侧统计栏 ===== */
.overview-top {
  display: grid;
  grid-template-columns: minmax(0, 2.35fr) minmax(0, 1fr);
  align-items: start;
  gap: 16px;
}

.overview-main {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

/* ===== 中区：同行两张卡等高 =====
   与首页卡片同一套做法：grid 默认 stretch，矮的那张被拉齐到行高（内容顶部对齐、下方留白）；
   同时给高度上限，内容再多也不会把整行撑开，超出部分在卡片内部滚动。 */
.panel-columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  align-items: stretch;
  gap: 16px;
  margin-top: 16px;
}

.panel-columns :deep(.console-panel) {
  height: 100%;
  max-height: var(--console-panel-max-height, 420px);
}

.terminal-panel {
  margin-top: 16px;
}

/* ===== 通用行列表 ===== */
.row-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  position: relative;
}

.row + .row::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--border);
  transition: background-color 0.4s ease;
}

.row-main {
  flex: 1;
  min-width: 0;
  font-size: 0.84rem;
  color: var(--foreground);
  line-height: 1.5;
  transition: color 0.4s ease;
}

.todo-count {
  flex-shrink: 0;
  min-width: 20px;
  text-align: center;
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  color: var(--subtle-foreground);
  transition: color 0.4s ease;
}

.todo-count--active {
  color: var(--warning);
  font-weight: 600;
}

/* ===== 访问统计 ===== */
.traffic-value {
  flex-shrink: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--foreground);
  font-variant-numeric: tabular-nums;
  transition: color 0.4s ease;
}

.traffic-delta {
  flex-shrink: 0;
  min-width: 46px;
  text-align: right;
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  transition: color 0.4s ease;
}

.traffic-delta--up {
  color: var(--success);
}

.traffic-delta--down {
  color: var(--destructive);
}

/* ===== 数据表 ===== */
.data-table {
  display: flex;
  flex-direction: column;
}

.data-row {
  display: grid;
  align-items: center;
  gap: 10px;
  padding: 9px 0;
  position: relative;
  font-size: 0.82rem;
}

.data-row + .data-row::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--border);
  transition: background-color 0.4s ease;
}

.data-row--head {
  padding-top: 0;
  font-size: 0.75rem;
  color: var(--subtle-foreground);
  transition: color 0.4s ease;
}

.data-row--head::before {
  display: none;
}

.submission-table .data-row {
  grid-template-columns: minmax(0, 1fr) auto auto auto;
}

.uptime-table .data-row {
  grid-template-columns: minmax(0, 1fr) auto auto auto;
}

.cell-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.cell-title {
  color: var(--foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.4s ease;
}

.cell-title--mono {
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  font-size: 0.78rem;
}

.cell-sub {
  font-size: 0.74rem;
  color: var(--subtle-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.4s ease;
}

.cell-meta {
  color: var(--muted-foreground);
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  transition: color 0.4s ease;
}

/* 状态胶囊：底色由语义色按透明度派生 */
.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 9px;
  border-radius: var(--radius-full);
  corner-shape: round;
  font-size: 0.73rem;
  white-space: nowrap;
  border: 1px solid transparent;
  transition: color 0.4s ease, background-color 0.4s ease, border-color 0.4s ease;
}

.status-pill--warning {
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 14%, transparent);
  border-color: color-mix(in srgb, var(--warning) 28%, transparent);
}

.status-pill--success {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 14%, transparent);
  border-color: color-mix(in srgb, var(--success) 28%, transparent);
}

.status-pill--destructive {
  color: var(--destructive);
  background: color-mix(in srgb, var(--destructive) 14%, transparent);
  border-color: color-mix(in srgb, var(--destructive) 28%, transparent);
}

.status-pill--muted {
  color: var(--muted-foreground);
  background: var(--accent);
  border-color: var(--border);
}

.cell-btn {
  padding: 3px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  corner-shape: round;
  background: transparent;
  color: var(--muted-foreground);
  font-size: 0.75rem;
  font-family: inherit;
  white-space: nowrap;
  transition: color 0.4s ease, border-color 0.4s ease;
}

.cell-btn:disabled {
  color: var(--disabled-foreground);
  cursor: not-allowed;
}

/* ===== Uptime 状态 ===== */
.uptime-state {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.78rem;
  white-space: nowrap;
  transition: color 0.4s ease;
}

.uptime-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  corner-shape: round;
  background: currentColor;
  flex-shrink: 0;
}

.uptime-state--up {
  color: var(--success);
}

.uptime-state--down {
  color: var(--destructive);
}

/* ===== 终端日志 ===== */
.terminal {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 12px 14px;
  border-radius: var(--radius-lg);
  background: var(--muted);
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  font-size: 0.76rem;
  line-height: 1.6;
  overflow-x: auto;
  transition: background-color 0.4s ease;
}

.terminal-line {
  display: flex;
  gap: 10px;
  white-space: nowrap;
}

.terminal-time,
.terminal-ip {
  color: var(--subtle-foreground);
  flex-shrink: 0;
  transition: color 0.4s ease;
}

.terminal-level {
  flex-shrink: 0;
  transition: color 0.4s ease;
}

.terminal-level--info {
  color: var(--muted-foreground);
}

.terminal-level--warn {
  color: var(--warning);
}

.terminal-level--error {
  color: var(--destructive);
}

.terminal-text {
  color: var(--muted-foreground);
  transition: color 0.4s ease;
}

/* ===== 标记与提示 ===== */
.sample-tag {
  padding: 2px 9px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  corner-shape: round;
  font-size: 0.72rem;
  color: var(--subtle-foreground);
  white-space: nowrap;
  transition: color 0.4s ease, border-color 0.4s ease;
}

.panel-note {
  font-size: 0.75rem;
  color: var(--subtle-foreground);
  white-space: nowrap;
  transition: color 0.4s ease;
}

@media (max-width: 1100px) {
  .overview-top {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 720px) {
  .stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  /* 窄屏只保留「标题 + 状态」，时间与操作列让位 */
  .submission-table .data-row,
  .uptime-table .data-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .submission-table .data-row > *:nth-child(2),
  .submission-table .data-row > *:nth-child(4),
  .uptime-table .data-row > *:nth-child(3),
  .uptime-table .data-row > *:nth-child(4) {
    display: none;
  }
}
</style>

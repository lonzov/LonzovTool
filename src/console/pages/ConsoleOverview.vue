<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NIcon } from 'naive-ui'
import {
  Alert24Regular,
  Apps24Regular,
  ArrowDown28Filled,
  ArrowDownload24Regular,
  ArrowUp28Filled,
  ChevronRight24Regular,
  DataTrending24Regular,
  FullScreenMaximize24Regular,
  FullScreenMinimize24Regular,
  Globe24Regular,
  Heart24Regular,
  History24Regular,
  Open24Regular,
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
import TodoDrawer from '../components/TodoDrawer.vue'
import { consoleFetch } from '../consoleRequest.js'
import { usePermissions } from '../usePermissions.js'

const router = useRouter()

// 页面挂在控制台外壳下，权限清单在校验通过后才有，这里读到的已经是最终结果
const { can } = usePermissions()
const canReviewSubmissions = computed(() => can('cards.review'))
const canReadLogs = computed(() => can('logs.read'))

const SUBMISSION_STATUS = {
  pending: { label: '待审核', tone: 'warning' },
  approved: { label: '已通过', tone: 'success' },
  rejected: { label: '已拒绝', tone: 'destructive' },
}

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

/* ===== 待办事项 =====
   卡片上只留总数，点开抽屉才看具体条目；合并与排序都在服务端做，
   这里拿到的 items 已经是「紧急优先、同档等得最久的在前」。 */
const overview = ref(null)
const overviewLoading = ref(true)
const overviewError = ref('')
const todoOpen = ref(false)

const todoCounts = computed(() => overview.value?.counts || {})
const todoItems = computed(() => overview.value?.items || [])
const todoBreakdown = computed(() => {
  const parts = []
  if ('submissions_pending' in todoCounts.value) {
    parts.push(`网址提交 ${todoCounts.value.submissions_pending}`)
  }
  if ('feedback_pending' in todoCounts.value) {
    parts.push(`建议反馈 ${todoCounts.value.feedback_pending}`)
  }
  return parts.join(' · ')
})
// 读取失败时也留着这张卡：直接隐藏会让人以为"没有待办"，与真的 0 条分不开
const hasTodoQueue = computed(
  () => Object.keys(todoCounts.value).length > 0 || Boolean(overviewError.value),
)
const todoTotal = computed(() =>
  Object.values(todoCounts.value).reduce((sum, value) => sum + (Number(value) || 0), 0),
)
const todoValue = computed(() => {
  if (overviewError.value) return '—'
  return overviewLoading.value ? '—' : todoTotal.value
})
const todoHint = computed(() => {
  if (overviewError.value) return '读取失败，点击查看原因'
  return todoBreakdown.value || '暂无待处理事项'
})

async function loadOverview() {
  overviewLoading.value = true
  overviewError.value = ''
  try {
    overview.value = await consoleFetch('/api/v1/console/overview')
  } catch (e) {
    if (e?.code === 'unauthorized') {
      router.replace({ path: '/console/login', query: { redirect: '/console' } })
      return
    }
    overviewError.value = e?.message || '待办读取失败，请稍后重试'
  } finally {
    overviewLoading.value = false
  }
}

/* ===== Uptime（服务端代取 Uptime Kuma 状态页） ===== */
const UPTIME_LIMIT = 6
const UPTIME_TONE = { 0: 'down', 1: 'up', 2: 'pending', 3: 'maintenance' }
const UPTIME_STATUS_TEXT = { 0: '异常', 1: '正常', 2: '待确认', 3: '维护中' }

const uptime = ref(null)
const uptimeLoading = ref(true)
const uptimeError = ref('')

const statusPageUrl = computed(() => uptime.value?.status_page_url || '')

const uptimeRows = computed(() =>
  (uptime.value?.items || []).map((item) => {
    const ratio = typeof item.uptime_24h === 'number' ? item.uptime_24h : null
    return {
      id: item.id,
      name: item.name,
      tone: UPTIME_TONE[item.status] ?? 'unknown',
      beats: (item.beats || []).map((status) => UPTIME_TONE[status] ?? 'unknown'),
      pctText: ratio === null ? '—' : `${(ratio * 100).toFixed(ratio >= 0.9995 ? 0 : 1)}%`,
      pctTone:
        ratio === null ? 'muted' : ratio >= 0.99 ? 'ok' : ratio >= 0.9 ? 'warn' : 'bad',
      tip: uptimeTip(item),
    }
  }),
)

function uptimeTip(item) {
  const parts = [item.name, UPTIME_STATUS_TEXT[item.status] || '未知状态']
  if (typeof item.ping_ms === 'number') parts.push(`响应 ${item.ping_ms} ms`)
  if (item.checked_at) {
    parts.push(`检测于 ${new Date(item.checked_at * 1000).toLocaleTimeString('zh-CN', { hour12: false })}`)
  }
  return parts.join(' · ')
}

// 卡片上只显示更新时间，读取失败时不再显示上一次的时间戳，免得看起来像刚更新过
const uptimeNote = computed(() => {
  if (uptimeLoading.value) return '读取中…'
  if (uptimeError.value) return '读取失败'
  const updated = uptime.value?.updated_at
  if (!updated) return ''
  return `更新于 ${new Date(updated * 1000).toLocaleTimeString('zh-CN', { hour12: false })}`
})

async function loadUptime() {
  uptimeLoading.value = true
  uptimeError.value = ''
  try {
    uptime.value = await consoleFetch(`/api/v1/console/uptime?limit=${UPTIME_LIMIT}`)
  } catch (e) {
    if (e?.code === 'unauthorized') {
      router.replace({ path: '/console/login', query: { redirect: '/console' } })
      return
    }
    uptimeError.value = e?.message || '监控数据读取失败'
  } finally {
    uptimeLoading.value = false
  }
}

/* ===== 访问统计（后端代理 Umami，模块级缓存 30 分钟） ===== */
const { stats: siteStats, loading: statsLoading, lastUpdate, isMocked, fetchStats } = useStats()

function formatCount(value) {
  return value == null ? '—' : String(value).toLocaleString('zh-CN')
}

// Umami 的公开分享页：口径与接口下发的一致，点进去能看到图表与明细
const STATS_SHARE_URL = 'https://imamu.lonzov.top/share/FmUyTde668rZaCXX'

/* 环比标记按「红涨绿跌」上色：数据看板沿用看盘习惯，涨用红、跌用绿。
   持平不给箭头，只写 0%，免得读成一格涨跌。 */
function deltaBadge(delta) {
  if (delta === null || delta === undefined) return null
  if (delta > 0) return { text: `${delta}%`, tone: 'up', icon: ArrowUp28Filled }
  if (delta < 0) return { text: `${Math.abs(delta)}%`, tone: 'down', icon: ArrowDown28Filled }
  return { text: '0%', tone: 'flat', icon: null }
}

const trafficRows = computed(() => [
  {
    label: '今日访问量',
    value: formatCount(siteStats.value.todayPV),
    delta: deltaBadge(siteStats.value.todayPvDelta),
  },
  {
    label: '今日独立访客',
    value: formatCount(siteStats.value.todayUV),
    delta: deltaBadge(siteStats.value.todayUvDelta),
  },
  {
    label: '昨日独立访客',
    value: formatCount(siteStats.value.yesterdayUV),
    delta: deltaBadge(siteStats.value.yesterdayUvDelta),
  },
  {
    label: '本月独立访客',
    value: formatCount(siteStats.value.monthUV),
    delta: deltaBadge(siteStats.value.monthUvDelta),
  },
  {
    label: '本年独立访客',
    value: formatCount(siteStats.value.yearUV),
    delta: null,
  },
])

const statsNote = computed(() => {
  if (statsLoading.value) return '读取中…'
  if (!lastUpdate.value) return '暂无数据'
  // 接口可能回估算值，必须让管理侧一眼看出这不是真实口径
  return `更新于 ${lastUpdate.value}${isMocked.value ? '（估算）' : ''}`
})

/* ===== 网址提交预览 =====
   这里只读最新 5 条待审核（接口按 id 倒序，即时间从新到旧）；
   真正的审核动作在独立页面，查看按钮带 id 跳过去定位。 */
const submissionPreview = ref([])

function formatSubmissionTime(timestamp) {
  const date = new Date(timestamp * 1000)
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function openSubmission(id) {
  router.push({ path: '/console/submissions', query: { id: String(id) } })
}

async function loadSubmissionPreview() {
  try {
    const payload = await consoleFetch('/api/v1/console/submissions?status=pending&limit=5')
    submissionPreview.value = payload?.items || []
  } catch (e) {
    if (e?.code === 'unauthorized') {
      router.replace({ path: '/console/login', query: { redirect: '/console' } })
    }
  }
}

/* ===== 管理日志 =====
   读后端 console_audit_log（GET /api/v1/console/logs）：登录、内容增删改等操作。
   用 after=last_id 增量拉取，只把新行追加到尾部；其余筛选在前端做，省一次往返。 */
const LEVEL_FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'info', label: '信息' },
  { value: 'warn', label: '警告' },
  { value: 'error', label: '错误' },
]
const LEVEL_LABELS = { info: 'INFO', warn: 'WARN', error: 'ERROR' }

const LOG_POLL_MS = 5000
const LOG_PAGE_SIZE = 100
const LOG_MAX_ROWS = 300

const logRows = ref([])
const logLevel = ref('all')
const logError = ref('')
const autoScroll = ref(true)
const fullscreen = ref(false)
const logBox = ref(null)
let logTimer = null

const visibleRows = computed(() =>
  logLevel.value === 'all'
    ? logRows.value
    : logRows.value.filter((row) => row.level === logLevel.value),
)

function formatLogTime(timestamp) {
  const date = new Date(timestamp * 1000)
  const pad = (value) => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function levelLabel(level) {
  return LEVEL_LABELS[level] || level
}

function scrollLogToBottom() {
  nextTick(() => {
    if (logBox.value) logBox.value.scrollTop = logBox.value.scrollHeight
  })
}

async function fetchLogs({ initial = false } = {}) {
  try {
    const last = logRows.value[logRows.value.length - 1]
    const params = new URLSearchParams({ limit: String(LOG_PAGE_SIZE) })
    if (!initial && last) params.set('after', String(last.id))

    const payload = await consoleFetch(`/api/v1/console/logs?${params.toString()}`)
    logError.value = ''

    const incoming = payload?.items || []
    if (!incoming.length) return

    const merged = initial ? incoming : [...logRows.value, ...incoming]
    logRows.value = merged.slice(-LOG_MAX_ROWS)
    if (autoScroll.value) scrollLogToBottom()
  } catch (e) {
    // 会话失效回登录页；其余错误只落在面板里，不能让整页变成错误态
    if (e?.code === 'unauthorized') {
      router.replace({ path: '/console/login', query: { redirect: '/console' } })
      return
    }
    logError.value = e?.message || '日志读取失败，请稍后重试'
  }
}

function toggleAutoScroll() {
  autoScroll.value = !autoScroll.value
  if (autoScroll.value) scrollLogToBottom()
}

function onLogScroll() {
  const box = logBox.value
  if (!box) return
  // 往上翻即暂停自动滚动，回到底部再恢复
  autoScroll.value = box.scrollHeight - box.scrollTop - box.clientHeight < 24
}

function onKeydown(event) {
  if (event.key === 'Escape' && fullscreen.value) fullscreen.value = false
}

onMounted(() => {
  fetchStats()
  loadOverview()
  loadUptime()
  if (canReviewSubmissions.value) loadSubmissionPreview()

  // 日志读取需要 logs.read，没有权限时连轮询都不起来
  if (canReadLogs.value) {
    fetchLogs({ initial: true })
    logTimer = setInterval(() => fetchLogs(), LOG_POLL_MS)
  }
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  if (logTimer) clearInterval(logTimer)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="console-overview">
    <div class="metric-row">
      <button
        v-if="hasTodoQueue"
        class="todo-card"
        type="button"
        title="查看待处理的具体条目"
        @click="todoOpen = true"
      >
        <span class="todo-card-head">
          <NIcon :component="Alert24Regular" :size="15" class="todo-card-icon" />
          <span class="todo-card-label">待办事项</span>
        </span>
        <span class="todo-card-value">{{ todoValue }}</span>
        <span class="todo-card-hint">{{ todoHint }}</span>
        <NIcon class="todo-card-arrow" :component="ChevronRight24Regular" :size="14" />
      </button>

      <StatCard v-for="item in stats" :key="item.label" v-bind="item" />
    </div>

    <div class="panel-columns">
      <ConsolePanel v-if="canReviewSubmissions" :icon="Send24Regular" title="网址提交">
        <template #extra>
          <span class="panel-note">最新 5 条待审核</span>
        </template>
        <div class="data-table submission-table">
          <div class="data-row data-row--head">
            <span>标题 / 网址</span>
            <span>提交时间</span>
            <span>状态</span>
            <span>操作</span>
          </div>
          <p v-if="!submissionPreview.length" class="inline-empty">暂无待审核提交</p>
          <div v-for="item in submissionPreview" :key="item.id" class="data-row">
            <span class="cell-main">
              <span class="cell-title">{{ item.title }}</span>
              <span class="cell-sub">{{ item.link }}</span>
            </span>
            <span class="cell-meta">{{ formatSubmissionTime(item.created_at) }}</span>
            <span>
              <span class="status-pill" :class="`status-pill--${SUBMISSION_STATUS[item.status].tone}`">
                {{ SUBMISSION_STATUS[item.status].label }}
              </span>
            </span>
            <span>
              <button class="cell-btn" type="button" @click="openSubmission(item.id)">查看</button>
            </span>
          </div>
        </div>
      </ConsolePanel>

      <ConsolePanel :icon="TopSpeed24Regular" title="Uptime">
        <template #extra>
          <div class="uptime-extra">
            <span v-if="uptimeNote" class="panel-note">{{ uptimeNote }}</span>
            <a
              v-if="statusPageUrl"
              class="icon-link"
              :href="statusPageUrl"
              target="_blank"
              rel="noopener noreferrer"
              title="前往状态页"
            >
              <NIcon :component="Open24Regular" :size="14" />
            </a>
          </div>
        </template>

        <p v-if="uptimeError" class="inline-empty">{{ uptimeError }}</p>
        <p v-else-if="!uptimeRows.length" class="inline-empty">
          {{ uptimeLoading ? '读取中…' : '暂无监控数据' }}
        </p>
        <ul v-else class="uptime-list">
          <li v-for="row in uptimeRows" :key="row.id" class="uptime-row" :title="row.tip">
            <span class="uptime-name">
              <i class="uptime-dot" :class="`uptime-dot--${row.tone}`"></i>
              <span class="uptime-name-text">{{ row.name }}</span>
            </span>
            <span class="uptime-beats" aria-hidden="true">
              <i
                v-for="(tone, index) in row.beats"
                :key="index"
                class="uptime-beat"
                :class="`uptime-beat--${tone}`"
              ></i>
            </span>
            <span class="uptime-pct" :class="`uptime-pct--${row.pctTone}`">{{ row.pctText }}</span>
          </li>
        </ul>
      </ConsolePanel>
    </div>

    <ConsolePanel
      :icon="DataTrending24Regular"
      title="最近网站数据"
      description="数据来自站点访问统计"
    >
      <template #extra>
        <div class="traffic-extra">
          <span class="panel-note">{{ statsNote }}</span>
          <a
            class="icon-link"
            :href="STATS_SHARE_URL"
            target="_blank"
            rel="noopener noreferrer"
            title="打开访问统计"
          >
            <NIcon :component="Open24Regular" :size="14" />
          </a>
        </div>
      </template>
      <div class="traffic-grid">
        <div v-for="row in trafficRows" :key="row.label" class="traffic-cell">
          <span class="traffic-label">{{ row.label }}</span>
          <span class="traffic-cell-value">
            {{ row.value }}
            <span
              v-if="row.delta"
              class="traffic-delta"
              :class="`traffic-delta--${row.delta.tone}`"
            >
              <NIcon v-if="row.delta.icon" :component="row.delta.icon" :size="12" />
              {{ row.delta.text }}
            </span>
          </span>
        </div>
      </div>
    </ConsolePanel>

    <ConsolePanel
      v-if="canReadLogs"
      class="log-panel"
      :class="{ 'log-panel--full': fullscreen }"
      :icon="History24Regular"
      title="管理日志"
      description="登录、内容增删改等管理操作，按时间正序"
    >
      <template #extra>
        <div class="log-toolbar">
          <button
            v-for="option in LEVEL_FILTERS"
            :key="option.value"
            class="log-pill"
            :class="{ 'log-pill--on': logLevel === option.value }"
            type="button"
            @click="logLevel = option.value"
          >
            {{ option.label }}
          </button>
          <button
            class="log-pill"
            :class="{ 'log-pill--on': autoScroll }"
            type="button"
            :title="autoScroll ? '暂停自动滚动' : '恢复自动滚动'"
            @click="toggleAutoScroll"
          >
            自动滚动
          </button>
          <button
            class="log-icon-btn"
            type="button"
            :title="fullscreen ? '退出全屏（Esc）' : '全屏查看'"
            @click="fullscreen = !fullscreen"
          >
            <NIcon
              :component="fullscreen ? FullScreenMinimize24Regular : FullScreenMaximize24Regular"
              :size="14"
            />
          </button>
        </div>
      </template>

      <div ref="logBox" class="log-box" @scroll="onLogScroll">
        <p v-if="logError" class="log-hint">{{ logError }}</p>
        <p v-else-if="!visibleRows.length" class="log-hint">暂无记录</p>
        <div v-for="row in visibleRows" :key="row.id" class="log-row">
          <span class="log-time">{{ formatLogTime(row.created_at) }}</span>
          <span class="log-level" :class="`log-level--${row.level}`">{{ levelLabel(row.level) }}</span>
          <span class="log-actor">{{ row.actor || '—' }}</span>
          <span class="log-ip">{{ row.ip || '—' }}</span>
          <span class="log-action">{{ row.action }}</span>
          <span class="log-detail">{{ row.detail || row.target }}</span>
        </div>
      </div>
    </ConsolePanel>

    <TodoDrawer
      v-model:show="todoOpen"
      :counts="todoCounts"
      :items="todoItems"
      :loading="overviewLoading"
      :error="overviewError"
      :truncated="Boolean(overview && overview.truncated)"
    />
  </div>
</template>

<style scoped>
.console-overview {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ===== 指标行：待办数量卡 + 四张指标卡同处一行 =====
   一行里的卡片天然等高，待办从整块列表改成数量卡后也不会在下方留出空洞。 */
.metric-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 12px;
}

/* ===== 待办数量卡：与指标卡同一套外观，整卡可点 ===== */
.todo-card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--card);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.4s ease, border-color 0.2s ease;
}

.todo-card:hover {
  border-color: var(--border-strong);
}

.todo-card-head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.todo-card-icon {
  flex-shrink: 0;
  color: var(--muted-foreground);
  transition: color 0.4s ease;
}

.todo-card-label {
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--muted-foreground);
  transition: color 0.4s ease;
}

.todo-card-value {
  margin-top: 10px;
  font-size: 1.6rem;
  font-weight: 700;
  line-height: 1.25;
  color: var(--foreground);
  font-variant-numeric: tabular-nums;
  transition: color 0.4s ease;
}

.todo-card-hint {
  margin-top: 4px;
  font-size: 0.75rem;
  color: var(--subtle-foreground);
  line-height: 1.45;
  transition: color 0.4s ease;
}

.todo-card-arrow {
  position: absolute;
  top: 16px;
  right: 16px;
  color: var(--subtle-foreground);
  transition: color 0.2s ease, transform 0.2s ease;
}

.todo-card:hover .todo-card-arrow {
  color: var(--foreground);
  transform: translateX(2px);
}

/* ===== 中区：同行两张卡等高 =====
   与首页卡片同一套做法：grid 默认 stretch，矮的那张被拉齐到行高（内容顶部对齐、下方留白）；
   同时给高度上限，内容再多也不会把整行撑开，超出部分在卡片内部滚动。 */
.panel-columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  align-items: stretch;
  gap: 16px;
}

.panel-columns :deep(.console-panel) {
  height: 100%;
  max-height: var(--console-panel-max-height, 420px);
}

/* ===== 访问统计：整行铺开的五格，不再是一列 label/value ===== */
.traffic-extra {
  display: flex;
  align-items: center;
  gap: 8px;
}

.traffic-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
}

.traffic-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border-radius: var(--radius-lg);
  background: var(--muted);
  transition: background-color 0.4s ease;
}

.traffic-label {
  font-size: 0.75rem;
  color: var(--muted-foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.4s ease;
}

.traffic-cell-value {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.3;
  color: var(--foreground);
  font-variant-numeric: tabular-nums;
  transition: color 0.4s ease;
}

/* 环比胶囊：箭头 + 百分比，底色由语义色按透明度派生（与状态胶囊同一套做法） */
.traffic-delta {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  align-self: center;
  padding: 1px 7px;
  border-radius: var(--radius-full);
  corner-shape: round;
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1.6;
  white-space: nowrap;
  transition: color 0.4s ease, background-color 0.4s ease;
}

.traffic-delta--up {
  color: var(--destructive);
  background: color-mix(in srgb, var(--destructive) 12%, transparent);
}

.traffic-delta--down {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 12%, transparent);
}

.traffic-delta--flat {
  color: var(--subtle-foreground);
  background: color-mix(in srgb, var(--muted-foreground) 12%, transparent);
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

.inline-empty {
  margin: 0;
  padding: 10px 0;
  color: var(--subtle-foreground);
  font-size: 0.78rem;
  text-align: center;
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

/* ===== Uptime：名称 + 心跳条 + 24 小时可用率 ===== */
.uptime-extra {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--muted-foreground);
  transition: color 0.2s ease, border-color 0.2s ease;
}

.icon-link:hover {
  color: var(--foreground);
  border-color: var(--border-strong);
}

.uptime-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.uptime-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  position: relative;
  font-size: 0.82rem;
}

.uptime-row + .uptime-row::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--border);
  transition: background-color 0.4s ease;
}

.uptime-name {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.uptime-name-text {
  color: var(--foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.4s ease;
}

.uptime-dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  corner-shape: round;
  background: currentColor;
  transition: background-color 0.4s ease;
}

.uptime-dot--up {
  color: var(--success);
}

.uptime-dot--down {
  color: var(--destructive);
}

.uptime-dot--pending {
  color: var(--warning);
}

.uptime-dot--maintenance {
  color: var(--muted-foreground);
}

.uptime-dot--unknown {
  color: var(--subtle-foreground);
}

/* 心跳条：正常状态压得很淡，异常才跳出来——一眼扫过去先看到红点 */
.uptime-beats {
  display: inline-flex;
  gap: 2px;
  align-items: flex-end;
  height: 14px;
}

.uptime-beat {
  width: 4px;
  height: 100%;
  border-radius: var(--radius-full);
  corner-shape: round;
  transition: background-color 0.4s ease;
}

/* 正常态用实色：45% 的绿压在白色卡片上对比度只有 1.7:1，30 格连成一片几乎融进背景。
   异常与维护仍靠色相和灰阶区分，不再靠"把正常态压淡"来突出 */
.uptime-beat--up {
  background: var(--success);
}

.uptime-beat--down {
  background: var(--destructive);
}

.uptime-beat--pending {
  background: var(--warning);
}

.uptime-beat--maintenance {
  background: color-mix(in srgb, var(--muted-foreground) 45%, transparent);
}

.uptime-beat--unknown {
  background: var(--border);
}

/* 可用率是右对齐的定宽列：各行的数字位数不同（9.9% / 99.9% / 100%），
   宽度跟着文字走会让每行的网格不同宽，心跳条整列跟着左右错位 */
.uptime-pct {
  width: 3.6em;
  text-align: right;
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  transition: color 0.4s ease;
}

.uptime-pct--ok {
  color: var(--muted-foreground);
}

.uptime-pct--warn {
  color: var(--warning);
}

.uptime-pct--bad {
  color: var(--destructive);
}

.uptime-pct--muted {
  color: var(--subtle-foreground);
}

/* ===== 管理日志 ===== */
/* 全屏：整张卡浮起来，标题与工具栏跟着走，读长流水时不被页面其他内容挤着 */
.log-panel--full {
  position: fixed;
  inset: 16px;
  z-index: 1500;
  margin: 0;
  max-height: none;
  box-shadow: var(--shadow-popover);
}

.log-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.log-pill {
  padding: 2px 9px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  corner-shape: round;
  background: transparent;
  color: var(--muted-foreground);
  font-family: inherit;
  font-size: 0.72rem;
  line-height: 1.6;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
}

.log-pill:hover {
  color: var(--foreground);
}

.log-pill--on {
  color: var(--foreground);
  border-color: var(--border-strong);
  background: var(--accent);
}

.log-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease;
}

.log-icon-btn:hover {
  color: var(--foreground);
}

.log-box {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 260px;
  padding: 10px 12px;
  border-radius: var(--radius-lg);
  background: var(--muted);
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  font-size: 0.74rem;
  line-height: 1.7;
  overflow: auto;
  transition: background-color 0.4s ease;
}

.log-panel--full .log-box {
  flex: 1;
  max-height: none;
}

.log-row {
  display: flex;
  gap: 8px;
  min-width: 0;
}

.log-time,
.log-actor {
  flex-shrink: 0;
  color: var(--subtle-foreground);
  transition: color 0.4s ease;
}

.log-ip {
  flex-shrink: 0;
  min-width: 88px;
  color: var(--subtle-foreground);
  transition: color 0.4s ease;
}

.log-level {
  flex-shrink: 0;
  width: 38px;
  transition: color 0.4s ease;
}

.log-level--info {
  color: var(--muted-foreground);
}

.log-level--warn {
  color: var(--warning);
}

.log-level--error {
  color: var(--destructive);
}

.log-action {
  flex-shrink: 0;
  color: var(--foreground);
  transition: color 0.4s ease;
}

.log-detail {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--muted-foreground);
  transition: color 0.4s ease;
}

.log-hint {
  margin: 0;
  padding: 2px 0;
  color: var(--subtle-foreground);
  font-family: inherit;
  transition: color 0.4s ease;
}

/* ===== 标记与提示 ===== */
.panel-note {
  font-size: 0.75rem;
  color: var(--subtle-foreground);
  white-space: nowrap;
  transition: color 0.4s ease;
}

@media (max-width: 1100px) {
  .metric-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .metric-row {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }

  /* 窄屏只保留「标题 + 状态」，时间与操作列让位 */
  .submission-table .data-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .submission-table .data-row > *:nth-child(2),
  .submission-table .data-row > *:nth-child(4) {
    display: none;
  }

  /* 心跳条在窄屏放不下，留名称与可用率 */
  .uptime-beats {
    display: none;
  }

  /* 日志行在窄屏折行：原来一行排不下就横向滚动，等于把动作与详情推到屏幕外，
     而这两列恰是看日志时唯一非看不可的内容 */
  .log-row {
    flex-wrap: wrap;
    row-gap: 0;
  }

  /* 窄屏不再为对齐留 88px，IP 按自身长度占位，把宽度让给右侧 */
  .log-ip {
    min-width: 0;
  }

  /* 详情独占一行并允许折行，不再用省略号截断 */
  .log-detail {
    flex: 1 1 100%;
    white-space: normal;
    overflow-wrap: anywhere;
  }
}
</style>

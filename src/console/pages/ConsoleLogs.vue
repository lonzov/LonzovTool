<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NIcon, NInput, useMessage } from 'naive-ui'
import {
  ArrowClockwise24Regular,
  ChevronDown24Regular,
  History24Regular,
  Search16Regular,
} from '@vicons/fluent'
import ConsolePanel from '../components/ConsolePanel.vue'
import { consoleFetch } from '../consoleRequest.js'

const LOGS_URL = '/api/v1/console/logs'
const PAGE_SIZE = 100

const LEVELS = [
  { key: 'all', label: '全部' },
  { key: 'info', label: '信息' },
  { key: 'warn', label: '警告' },
  { key: 'error', label: '错误' },
]

const route = useRoute()
const router = useRouter()
const message = useMessage()

const rows = ref([])
const level = ref('all')
const keyword = ref('')
const loading = ref(false)
const loadingMore = ref(false)
const errorText = ref('')
const hasMore = ref(false)
const oldestId = ref(0)

const hasFilter = computed(() => level.value !== 'all' || keyword.value.trim() !== '')

function params(extra = {}) {
  const query = new URLSearchParams({ limit: String(PAGE_SIZE) })
  if (level.value !== 'all') query.set('level', level.value)
  if (keyword.value.trim()) query.set('q', keyword.value.trim())
  for (const [key, value] of Object.entries(extra)) {
    if (value) query.set(key, String(value))
  }
  return query.toString()
}

function gotUnauthorized(e) {
  if (e?.code !== 'unauthorized') return false
  router.replace({ path: '/console/login', query: { redirect: route.fullPath } })
  return true
}

/** 接口按时间正序给一页，展示要最新的在上面 */
function toNewestFirst(items) {
  return [...items].reverse()
}

async function load() {
  loading.value = true
  errorText.value = ''
  try {
    const payload = await consoleFetch(`${LOGS_URL}?${params()}`)
    rows.value = toNewestFirst(payload?.items || [])
    hasMore.value = !!payload?.has_more
    oldestId.value = rows.value.length ? rows.value[rows.value.length - 1].id : 0
  } catch (e) {
    if (gotUnauthorized(e)) return
    errorText.value = e?.message || '读取失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (loadingMore.value || !hasMore.value || !oldestId.value) return
  loadingMore.value = true
  try {
    const payload = await consoleFetch(`${LOGS_URL}?${params({ before: oldestId.value })}`)
    const older = toNewestFirst(payload?.items || [])
    rows.value = rows.value.concat(older)
    hasMore.value = !!payload?.has_more
    if (older.length) oldestId.value = older[older.length - 1].id
  } catch (e) {
    if (gotUnauthorized(e)) return
    message.error(e?.message || '加载失败，请稍后重试')
  } finally {
    loadingMore.value = false
  }
}

function pickLevel(key) {
  if (level.value === key) return
  level.value = key
  load()
}

let searchTimer = null

function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(load, 350)
}

function clearSearch() {
  if (!keyword.value) return
  keyword.value = ''
  load()
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function formatTime(timestamp) {
  const date = new Date(timestamp * 1000)
  if (Number.isNaN(date.getTime())) return '—'
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function formatTitle(timestamp) {
  const date = new Date(timestamp * 1000)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN', { hour12: false })
}

const LEVEL_STYLE = {
  info: { label: '信息', className: 'level level--info' },
  warn: { label: '警告', className: 'level level--warn' },
  error: { label: '错误', className: 'level level--error' },
}

function levelOf(row) {
  return LEVEL_STYLE[row.level] || LEVEL_STYLE.info
}

onMounted(load)
</script>

<template>
  <div class="console-logs">
    <div class="logs-toolbar">
      <div class="tab-group" role="tablist">
        <button
          v-for="item in LEVELS"
          :key="item.key"
          class="tab-btn"
          :class="{ 'tab-btn--on': level === item.key }"
          type="button"
          role="tab"
          :aria-selected="level === item.key"
          @click="pickLevel(item.key)"
        >
          {{ item.label }}
        </button>
      </div>

      <NInput
        v-model:value="keyword"
        class="logs-search"
        clearable
        maxlength="64"
        placeholder="搜操作者、动作、对象、详情或 IP"
        @update:value="onSearchInput"
        @clear="clearSearch"
      >
        <template #prefix>
          <NIcon :component="Search16Regular" :size="14" />
        </template>
      </NInput>

      <button
        class="app-btn app-btn--outline app-btn--sm"
        type="button"
        :disabled="loading"
        @click="load"
      >
        <NIcon :component="ArrowClockwise24Regular" :size="14" />
        <span>刷新</span>
      </button>
    </div>

    <p v-if="errorText" class="inline-hint inline-hint--error">{{ errorText }}</p>

    <ConsolePanel
      :icon="History24Regular"
      title="管理日志"
      description="登录、内容增删改、账号与权限变更都在这里；按时间倒序，越新越靠上"
    >
      <template #extra>
        <span class="count-tag">
          {{ hasFilter ? '筛选结果' : '最近记录' }} · 已载入 {{ rows.length }} 条
        </span>
      </template>

      <p v-if="loading && !rows.length" class="inline-hint">读取中…</p>
      <p v-else-if="!rows.length" class="inline-hint">
        {{ hasFilter ? '没有匹配的记录，换个关键词或级别试试' : '还没有日志' }}
      </p>

      <div v-else class="log-rows">
        <div v-for="row in rows" :key="row.id" class="log-row">
          <span class="log-time" :title="formatTitle(row.created_at)">
            {{ formatTime(row.created_at) }}
          </span>
          <span :class="levelOf(row).className">{{ levelOf(row).label }}</span>
          <span class="log-action" :title="row.action">{{ row.action }}</span>
          <div class="log-content">
            <div class="log-line">
              <span class="log-actor">{{ row.actor || '匿名' }}</span>
              <span v-if="row.target" class="log-target" :title="row.target">· {{ row.target }}</span>
            </div>
            <p v-if="row.detail" class="log-detail" :title="row.detail">{{ row.detail }}</p>
          </div>
          <span class="log-ip">{{ row.ip || '—' }}</span>
        </div>

        <div class="log-footer">
          <button
            v-if="hasMore"
            class="app-btn app-btn--outline app-btn--sm"
            type="button"
            :disabled="loadingMore"
            @click="loadMore"
          >
            <NIcon :component="ChevronDown24Regular" :size="14" />
            <span>{{ loadingMore ? '加载中…' : '加载更多' }}</span>
          </button>
          <span v-else class="log-end">已经到底了</span>
        </div>
      </div>
    </ConsolePanel>
  </div>
</template>

<style scoped>
.console-logs {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
  min-width: 0;
}

.logs-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.tab-group {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--muted);
}

.tab-btn {
  height: 28px;
  padding: 0 12px;
  border: none;
  border-radius: calc(var(--radius-lg) - 3px);
  background: transparent;
  color: var(--muted-foreground);
  font-family: inherit;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: color 0.2s ease, background-color 0.2s ease;
}

.tab-btn:hover {
  color: var(--foreground);
}

.tab-btn--on {
  background: var(--card);
  color: var(--foreground);
  box-shadow: var(--shadow-sm);
}

.logs-search {
  width: 260px;
  max-width: 100%;
}

.logs-toolbar > .app-btn {
  margin-left: auto;
}

.count-tag {
  color: var(--subtle-foreground);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.log-rows {
  display: flex;
  flex-direction: column;
}

.log-row {
  display: grid;
  grid-template-columns: 128px 52px 168px minmax(0, 1fr) 112px;
  align-items: baseline;
  gap: 12px;
  padding: 9px 0;
  border-bottom: 1px solid var(--border);
}

.log-row:last-of-type {
  border-bottom: none;
}

.log-time {
  color: var(--muted-foreground);
  font-size: 0.74rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.level {
  justify-self: start;
  padding: 1px 7px;
  border-radius: var(--radius-full);
  corner-shape: round;
  font-size: 0.68rem;
  line-height: 1.5;
}

.level--info {
  background: var(--muted);
  color: var(--muted-foreground);
}

.level--warn {
  background: color-mix(in srgb, var(--warning) 16%, transparent);
  color: var(--warning);
}

.level--error {
  background: color-mix(in srgb, var(--destructive) 14%, transparent);
  color: var(--destructive);
}

.log-action {
  overflow: hidden;
  color: var(--foreground);
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: 0.74rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.log-line {
  display: flex;
  align-items: baseline;
  gap: 4px;
  min-width: 0;
  font-size: 0.78rem;
}

.log-actor {
  flex-shrink: 0;
  color: var(--foreground);
}

.log-target {
  overflow: hidden;
  color: var(--muted-foreground);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-detail {
  margin: 0;
  overflow: hidden;
  color: var(--muted-foreground);
  font-size: 0.74rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-ip {
  color: var(--subtle-foreground);
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.log-footer {
  display: flex;
  justify-content: center;
  padding-top: 14px;
}

.log-end {
  color: var(--subtle-foreground);
  font-size: 0.74rem;
}

@media (width <= 900px) {
  .log-row {
    grid-template-columns: 104px 52px minmax(0, 1fr);
    row-gap: 2px;
  }

  .log-content {
    grid-column: 1 / -1;
  }

  .log-ip {
    display: none;
  }

  .logs-search {
    width: 100%;
    order: 3;
  }
}
</style>

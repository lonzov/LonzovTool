<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NIcon, NInput, NInputNumber, useMessage } from 'naive-ui'
import {
  ArrowClockwise24Regular,
  ChevronDown24Regular,
  History24Regular,
  Search16Regular,
  Settings24Regular,
} from '@vicons/fluent'
import AppButton from '../../components/ui/AppButton.vue'
import AppModal from '../../components/ui/AppModal.vue'
import ConsolePanel from '../components/ConsolePanel.vue'
import ConsoleSkeleton from '../components/ConsoleSkeleton.vue'
import { consoleFetch } from '../consoleRequest.js'
import { usePermissions } from '../usePermissions.js'

const LOGS_URL = '/api/v1/console/logs'
const RETENTION_URL = '/api/v1/console/logs/retention'
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
const { can } = usePermissions()
const canManageRetention = computed(() => can('system.manage'))

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

function clearFilters() {
  level.value = 'all'
  keyword.value = ''
  load()
}

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})

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

const retentionVisible = ref(false)
const retentionLoading = ref(false)
const retentionSaving = ref(false)
const retentionError = ref('')
const retentionForm = ref({
  retentionDays: 90,
  warnRetentionDays: 365,
  maxRows: 100000,
})

async function loadRetention() {
  retentionLoading.value = true
  retentionError.value = ''
  try {
    const payload = await consoleFetch(RETENTION_URL)
    retentionForm.value = {
      retentionDays: payload.retention_days,
      warnRetentionDays: payload.warn_retention_days,
      maxRows: payload.max_rows,
    }
  } catch (e) {
    if (gotUnauthorized(e)) return
    retentionError.value = e?.message || '读取留存设置失败'
  } finally {
    retentionLoading.value = false
  }
}

function openRetention() {
  retentionVisible.value = true
  loadRetention()
}

async function saveRetention() {
  if (retentionSaving.value) return
  const infoDays = Number(retentionForm.value.retentionDays)
  const warnDays = Number(retentionForm.value.warnRetentionDays)
  const maxRows = Number(retentionForm.value.maxRows)
  // 服务端会拒绝越界值；这里先拦一次，避免把用户输入原样送上去再看一条 400
  if (!Number.isFinite(infoDays) || infoDays < 1) {
    message.error('信息级日志至少保留 1 天')
    return
  }
  if (!Number.isFinite(warnDays) || warnDays < 90) {
    message.error('警告与错误日志至少保留 90 天')
    return
  }
  if (!Number.isFinite(maxRows) || maxRows < 100) {
    message.error('最大日志条数至少 100 条')
    return
  }
  retentionSaving.value = true
  try {
    const payload = await consoleFetch(RETENTION_URL, {
      method: 'PATCH',
      body: JSON.stringify({
        retention_days: retentionForm.value.retentionDays,
        warn_retention_days: retentionForm.value.warnRetentionDays,
        max_rows: retentionForm.value.maxRows,
      }),
    })
    retentionForm.value = {
      retentionDays: payload.retention_days,
      warnRetentionDays: payload.warn_retention_days,
      maxRows: payload.max_rows,
    }
    retentionVisible.value = false
    message.success('留存设置已保存')
  } catch (e) {
    if (gotUnauthorized(e)) return
    message.error(e?.message || '保存失败，请稍后重试')
  } finally {
    retentionSaving.value = false
  }
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
        placeholder="搜索日志"
        @update:value="onSearchInput"
        @clear="clearSearch"
      >
        <template #prefix>
          <NIcon :component="Search16Regular" :size="14" />
        </template>
      </NInput>

      <div class="logs-actions">
        <AppButton
          variant="outline"
          size="sm"
          icon-only
          label="刷新"
          :icon="ArrowClockwise24Regular"
          :disabled="loading"
          @click="load"
        />
        <AppButton
          v-if="canManageRetention"
          variant="outline"
          size="sm"
          icon-only
          label="留存设置"
          :icon="Settings24Regular"
          @click="openRetention"
        />
      </div>
    </div>

    <p v-if="errorText" class="inline-hint inline-hint--error" role="alert">{{ errorText }}</p>

    <ConsolePanel :icon="History24Regular" title="日志记录">
      <template #extra>
        <span v-if="loading && !rows.length" class="count-tag">
          <ConsoleSkeleton width="10em" height="1.2em" />
        </span>
        <span v-else class="count-tag">
          {{ hasFilter ? '筛选结果' : '最近记录' }} · 已载入 {{ rows.length }} 条
        </span>
      </template>

      <div v-if="loading && !rows.length" class="log-rows" aria-hidden="true">
        <div class="log-row log-row--head">
          <span>时间</span>
          <span>级别</span>
          <span>动作</span>
          <span>操作者与对象</span>
          <span>来源 IP</span>
        </div>
        <div v-for="index in 8" :key="index" class="log-row">
          <span class="log-time">
            <ConsoleSkeleton width="86%" height="1.2em" />
          </span>
          <span>
            <ConsoleSkeleton width="44" :height="18" radius="var(--radius-full)" />
          </span>
          <ConsoleSkeleton :width="index % 2 ? '72%' : '58%'" height="1.2em" />
          <div class="log-content">
            <ConsoleSkeleton width="64%" height="1.2em" />
            <ConsoleSkeleton :width="index % 2 ? '48%' : '36%'" height="1.1em" />
          </div>
          <span class="log-ip">
            <ConsoleSkeleton width="76%" height="1.2em" />
          </span>
        </div>
      </div>
      <div v-else-if="!rows.length && !errorText" class="empty-state">
        <p>{{ hasFilter ? '没有匹配的记录' : '还没有日志' }}</p>
        <div class="empty-actions">
          <AppButton
            v-if="hasFilter"
            variant="outline"
            size="sm"
            @click="clearFilters"
          >
            清除筛选
          </AppButton>
          <AppButton variant="outline" size="sm" :disabled="loading" @click="load">
            刷新
          </AppButton>
        </div>
      </div>

      <div v-else-if="rows.length" class="log-rows">
        <div class="log-row log-row--head">
          <span>时间</span>
          <span>级别</span>
          <span>动作</span>
          <span>操作者与对象</span>
          <span>来源 IP</span>
        </div>
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
          <AppButton
            v-if="hasMore"
            variant="outline"
            size="sm"
            :icon="ChevronDown24Regular"
            :disabled="loadingMore"
            @click="loadMore"
          >
            {{ loadingMore ? '加载中…' : '加载更多' }}
          </AppButton>
          <span v-else class="log-end">已经到底了</span>
        </div>
      </div>
    </ConsolePanel>

    <AppModal
      v-model:show="retentionVisible"
      title="日志留存设置"
      description="按级别设置保留天数；超出总条数时只清理信息级记录，警告与错误记录不会因条数上限被删除"
      :max-width="520"
      :z-index="2200"
      :auto-focus="false"
    >
      <div class="retention-body">
        <p v-if="retentionError" class="inline-hint inline-hint--error" role="alert">
          {{ retentionError }}
        </p>
        <div class="retention-row">
          <div class="retention-label">
            <span>信息级日志保留</span>
            <p>最少 1 天，到期后才会被清理</p>
          </div>
          <div class="retention-control">
            <NInputNumber
              v-model:value="retentionForm.retentionDays"
              :min="1"
              :max="3650"
              :disabled="retentionLoading || retentionSaving"
            />
            <span>天</span>
          </div>
        </div>
        <div class="retention-row">
          <div class="retention-label">
            <span>警告 / 错误日志保留</span>
            <p>最少 90 天，且不会因条数上限被提前清理</p>
          </div>
          <div class="retention-control">
            <NInputNumber
              v-model:value="retentionForm.warnRetentionDays"
              :min="90"
              :max="3650"
              :disabled="retentionLoading || retentionSaving"
            />
            <span>天</span>
          </div>
        </div>
        <div class="retention-row">
          <div class="retention-label">
            <span>最大日志条数</span>
            <p>所有级别合计；超出时从最旧的信息级记录开始清理</p>
          </div>
          <div class="retention-control">
            <NInputNumber
              v-model:value="retentionForm.maxRows"
              :min="100"
              :max="1000000"
              :disabled="retentionLoading || retentionSaving"
            />
            <span>条</span>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="retention-actions">
          <AppButton
            variant="outline"
            size="md"
            :disabled="retentionSaving"
            @click="retentionVisible = false"
          >
            取消
          </AppButton>
          <AppButton
            variant="solid"
            size="md"
            :loading="retentionSaving"
            :disabled="retentionLoading || retentionSaving"
            @click="saveRetention"
          >
            保存
          </AppButton>
        </div>
      </template>
    </AppModal>
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
  height: 36px;
}

.logs-search :deep(.n-input__border),
.logs-search :deep(.n-input__state-border) {
  border-radius: var(--radius-lg);
}

.logs-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 14px 12px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-lg);
  color: var(--subtle-foreground);
  font-size: 0.8rem;
  text-align: center;
}

.empty-state p {
  margin: 0;
}

.empty-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
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
  grid-template-columns: 118px 52px minmax(220px, 1.1fr) minmax(0, 1.6fr) 104px;
  align-items: baseline;
  gap: 12px;
  padding: 9px 0;
  border-bottom: 1px solid var(--border);
}

.log-row--head {
  padding: 0 0 8px;
  color: var(--subtle-foreground);
  font-size: 0.75rem;
}

.log-row--head > span:last-child {
  text-align: right;
}

.log-row:last-of-type {
  border-bottom: none;
}

.log-time {
  color: var(--muted-foreground);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.level {
  justify-self: start;
  padding: 1px 7px;
  border-radius: var(--radius-full);
  corner-shape: round;
  font-size: 0.75rem;
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
  display: -webkit-box;
  overflow: hidden;
  color: var(--foreground);
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: 0.75rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
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
  font-size: 0.75rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-ip {
  color: var(--subtle-foreground);
  font-size: 0.75rem;
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
  font-size: 0.75rem;
}

.retention-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.retention-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.retention-label {
  min-width: 0;
}

.retention-label > span {
  display: block;
  color: var(--foreground);
  font-size: 0.9rem;
  font-weight: 500;
}

.retention-label > p {
  margin: 3px 0 0;
  color: var(--subtle-foreground);
  font-size: 0.78rem;
  line-height: 1.45;
}

.retention-control {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  color: var(--muted-foreground);
  font-size: 0.82rem;
}

.retention-control :deep(.n-input-number) {
  width: 150px;
}

.retention-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (width <= 900px) {
  .log-row--head {
    display: none;
  }

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

@media (max-width: 600px) {
  .retention-row {
    align-items: stretch;
    flex-direction: column;
    gap: 8px;
  }

  .retention-control {
    justify-content: flex-end;
  }
}
</style>

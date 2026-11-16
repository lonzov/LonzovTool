<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NSelect, NSwitch, useMessage } from 'naive-ui'
import { ArrowClockwise24Regular, Image24Regular } from '@vicons/fluent'
import AppButton from '../../components/ui/AppButton.vue'
import ConsolePanel from '../components/ConsolePanel.vue'
import { confirmDialog } from '../../composables/useConfirm.js'
import { consoleFetch } from '../consoleRequest.js'

const ORPHANS_URL = '/api/v1/console/system/assets/orphans'
const PRUNE_URL = '/api/v1/console/system/assets/orphans/prune'
const CLEANUP_URL = '/api/v1/console/system/assets/cleanup'

const INTERVAL_OPTIONS = [
  { label: '每 6 小时', value: 6 },
  { label: '每 12 小时', value: 12 },
  { label: '每天', value: 24 },
  { label: '每 3 天', value: 72 },
  { label: '每 7 天', value: 168 },
]

const KIND_LABELS = {
  card_logo: '卡片图标',
  avatar: '头像',
  download_cover: '下载页封面',
  promo_image: '推广图',
  submission_icon: '提交图标',
  feedback_image: '反馈截图',
}

const route = useRoute()
const router = useRouter()
const message = useMessage()

const overview = ref(null)
const cleanup = ref(null)
const loading = ref(false)
const pruning = ref(false)
const configSaving = ref(false)
const errorText = ref('')
const autoEnabled = ref(false)
const intervalHours = ref(24)

const items = computed(() => overview.value?.items || [])
const ready = computed(() => Number(overview.value?.ready) || 0)
const total = computed(() => Number(overview.value?.total) || 0)
const graceHours = computed(() => Number(overview.value?.grace_hours) || 24)
const runs = computed(() => cleanup.value?.runs || [])
const nextRunText = computed(() => {
  const setting = cleanup.value?.setting
  if (!setting?.auto_enabled) return '—'
  if (!setting.next_run_at) return '待首次执行'
  return formatTime(setting.next_run_at)
})
const lastAutoRunText = computed(() =>
  cleanup.value?.setting?.last_run_at
    ? formatTime(cleanup.value.setting.last_run_at)
    : '—',
)

function applySetting(setting) {
  autoEnabled.value = setting?.auto_enabled === true
  intervalHours.value = Number(setting?.interval_hours) || 24
}

function gotUnauthorized(e) {
  if (e?.code !== 'unauthorized') return false
  router.replace({ path: '/console/login', query: { redirect: route.fullPath } })
  return true
}

async function load() {
  loading.value = true
  errorText.value = ''
  try {
    const [nextOverview, nextCleanup] = await Promise.all([
      consoleFetch(ORPHANS_URL),
      consoleFetch(CLEANUP_URL),
    ])
    overview.value = nextOverview
    cleanup.value = nextCleanup
    applySetting(nextCleanup?.setting)
  } catch (e) {
    if (gotUnauthorized(e)) return
    errorText.value = e?.message || '读取图片资产失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

async function askPrune() {
  if (!ready.value || pruning.value) return
  const confirmed = await confirmDialog({
    title: '清理孤儿图片',
    message: `将永久删除 ${ready.value} 个已解绑超过 ${graceHours.value} 小时的图片资产，此操作不可撤销。`,
    confirmText: '继续',
    danger: true,
  })
  if (!confirmed) return
  await runPrune()
}

async function runPrune() {
  if (pruning.value) return
  pruning.value = true
  try {
    const result = await consoleFetch(PRUNE_URL, { method: 'POST' })
    message.success(`已清理 ${result.deleted} 个孤儿文件，释放 ${formatBytes(result.freed_bytes)}`)
    await load()
  } catch (e) {
    if (gotUnauthorized(e)) return
    message.error(e?.message || '清理失败，请稍后重试')
  } finally {
    pruning.value = false
  }
}

async function persistSetting() {
  if (configSaving.value) return
  configSaving.value = true
  try {
    const payload = await consoleFetch(CLEANUP_URL, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auto_enabled: autoEnabled.value,
        interval_hours: intervalHours.value,
      }),
    })
    cleanup.value = payload
    applySetting(payload?.setting)
  } catch (e) {
    applySetting(cleanup.value?.setting)
    if (gotUnauthorized(e)) return
    message.error(e?.message || '更新失败，请稍后重试')
  } finally {
    configSaving.value = false
  }
}

function onAutoEnabledChange(value) {
  autoEnabled.value = value
  persistSetting()
}

function onIntervalChange(value) {
  intervalHours.value = value
  persistSetting()
}

function formatBytes(value) {
  const bytes = Number(value) || 0
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTime(timestamp) {
  const date = new Date((Number(timestamp) || 0) * 1000)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

onMounted(load)
</script>

<template>
  <div class="system-assets">
    <p v-if="errorText" class="system-error" role="alert">{{ errorText }}</p>

    <ConsolePanel
      title="自动清理"
      description="按固定间隔清理超过宽限期的孤儿图片"
      :icon="ArrowClockwise24Regular"
    >
      <template #extra>
        <AppButton
          variant="text"
          size="sm"
          :icon="ArrowClockwise24Regular"
          :disabled="loading"
          @click="load"
        >
          刷新
        </AppButton>
      </template>
      <div class="auto-row">
        <span class="auto-label">下次自动清理</span>
        <span class="auto-value">{{ nextRunText }}</span>
      </div>
      <div class="auto-row">
        <span class="auto-label">上次自动清理</span>
        <span class="auto-value">{{ lastAutoRunText }}</span>
      </div>
      <div class="auto-row">
        <span class="auto-label">启用自动清理</span>
        <NSwitch
          :value="autoEnabled"
          :loading="configSaving"
          :disabled="loading || configSaving"
          @update:value="onAutoEnabledChange"
        />
      </div>
      <div class="auto-row">
        <span class="auto-label">执行间隔</span>
        <NSelect
          :value="intervalHours"
          class="auto-interval"
          :options="INTERVAL_OPTIONS"
          :disabled="!autoEnabled || loading || configSaving"
          @update:value="onIntervalChange"
        />
      </div>
    </ConsolePanel>

    <ConsolePanel
      title="孤儿文件清理"
      description="删除超过宽限期的孤儿图片；仍被引用的资产会保留"
      :icon="Image24Regular"
    >
      <template #extra>
        <AppButton
          variant="solid"
          size="sm"
          :disabled="!ready || loading"
          :loading="pruning"
          @click="askPrune"
        >
          立即清理
        </AppButton>
      </template>
      <div class="orphan-stats">
        <div class="orphan-stat">
          <span class="orphan-stat-label">待清理</span>
          <strong class="orphan-stat-value">{{ ready }}</strong>
          <span class="orphan-stat-note">转为孤儿超过 {{ graceHours }} 小时</span>
        </div>
        <div class="orphan-stat">
          <span class="orphan-stat-label">全部孤儿</span>
          <strong class="orphan-stat-value">{{ total }}</strong>
          <span class="orphan-stat-note">含仍在宽限期内的资产</span>
        </div>
        <div class="orphan-stat">
          <span class="orphan-stat-label">可释放空间</span>
          <strong class="orphan-stat-value">{{ formatBytes(overview?.ready_bytes) }}</strong>
          <span class="orphan-stat-note">仅统计待清理项</span>
        </div>
      </div>

      <p v-if="loading" class="orphan-empty">正在读取…</p>
      <p v-else-if="!items.length" class="orphan-empty">
        当前没有可清理的孤儿文件。
      </p>
      <div v-else class="orphan-list">
        <div class="orphan-list-head">
          <span>文件</span>
          <span>类型</span>
          <span>大小</span>
          <span>转为孤儿时间</span>
        </div>
        <div v-for="item in items" :key="item.id" class="orphan-row">
          <span class="orphan-key" :title="item.key">{{ item.key }}</span>
          <span>{{ KIND_LABELS[item.kind] || item.kind }}</span>
          <span>{{ formatBytes(item.bytes) }}</span>
          <span>{{ formatTime(item.orphaned_at) }}</span>
        </div>
        <p v-if="overview?.has_more" class="orphan-more">
          仅展示前 {{ items.length }} 项，实际待清理 {{ overview.ready }} 项。
        </p>
      </div>
    </ConsolePanel>

    <ConsolePanel
      title="执行记录"
      description="最近 20 次清理"
    >
      <p v-if="!runs.length" class="orphan-empty">还没有执行记录。</p>
      <div v-else class="cleanup-history">
        <div class="history-head">
          <span>时间</span>
          <span>方式</span>
          <span>结果</span>
          <span>处理</span>
        </div>
        <div v-for="run in runs" :key="run.id" class="history-row">
          <span>{{ formatTime(run.finished_at || run.started_at) }}</span>
          <span>{{ run.trigger === 'auto' ? '自动' : '手动' }}</span>
          <span :class="`history-status history-status--${run.status}`">
            {{ run.status === 'success' ? '成功' : run.status === 'failed' ? '失败' : run.status === 'interrupted' ? '已中断' : '执行中' }}
          </span>
          <span class="history-detail">
            删除 {{ run.deleted }} 个 · 释放 {{ formatBytes(run.freed_bytes) }}
            <template v-if="run.skipped_referenced">
              · 恢复引用 {{ run.skipped_referenced }} 个
            </template>
            <span v-if="run.error" class="history-error" :title="run.error"> · {{ run.error }}</span>
          </span>
        </div>
      </div>
    </ConsolePanel>
  </div>
</template>

<style scoped>
.system-assets {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.system-error {
  margin: 0;
  color: var(--destructive);
  font-size: 0.8rem;
}

.auto-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 0;
}

.auto-row + .auto-row {
  border-top: 1px solid var(--border);
}

.auto-label {
  color: var(--foreground);
  font-size: 0.86rem;
  font-weight: 500;
}

.auto-interval {
  flex: 0 0 140px;
}

.auto-value {
  color: var(--muted-foreground);
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
}

.cleanup-history {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.history-head,
.history-row {
  display: grid;
  grid-template-columns: 1.1fr 0.5fr 0.5fr 1.8fr;
  gap: 10px;
  align-items: center;
  padding: 8px 12px;
  font-size: 0.76rem;
}

.history-head {
  color: var(--subtle-foreground);
  background: var(--accent);
}

.history-row {
  border-top: 1px solid var(--border);
  color: var(--muted-foreground);
}

.history-status--success {
  color: var(--success);
}

.history-status--failed {
  color: var(--destructive);
}

.history-status--running {
  color: var(--muted-foreground);
}

.history-status--interrupted {
  color: var(--warning);
}

.history-detail {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-error {
  color: var(--destructive);
}

.orphan-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.orphan-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--background);
  transition: background-color 0.4s ease, border-color 0.4s ease;
}

.orphan-stat-label {
  color: var(--muted-foreground);
  font-size: 0.76rem;
}

.orphan-stat-value {
  color: var(--foreground);
  font-size: 1.15rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.orphan-stat-note {
  color: var(--subtle-foreground);
  font-size: 0.72rem;
}

.orphan-empty {
  margin: 14px 0 0;
  padding: 18px 14px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  color: var(--subtle-foreground);
  font-size: 0.8rem;
}

.orphan-list {
  margin-top: 14px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.orphan-list-head,
.orphan-row {
  display: grid;
  grid-template-columns: minmax(0, 2fr) 0.8fr 0.7fr 0.9fr;
  gap: 10px;
  align-items: center;
  padding: 8px 12px;
  font-size: 0.76rem;
}

.orphan-list-head {
  color: var(--subtle-foreground);
  background: var(--accent);
}

.orphan-row {
  border-top: 1px solid var(--border);
  color: var(--muted-foreground);
}

.orphan-key {
  overflow: hidden;
  color: var(--foreground);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.orphan-more {
  margin: 0;
  padding: 8px 12px;
  border-top: 1px solid var(--border);
  color: var(--subtle-foreground);
  font-size: 0.74rem;
}

@media (width <= 640px) {
  .auto-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }

  .auto-interval {
    flex: none;
    width: 100%;
  }

    .orphan-stats {
    grid-template-columns: minmax(0, 1fr);
  }

  .orphan-list-head {
    display: none;
  }

  .orphan-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 3px 10px;
    padding: 10px 12px;
  }

  .orphan-key {
    grid-column: 1 / -1;
    white-space: normal;
    word-break: break-all;
  }

  .history-head {
    display: none;
  }

  .history-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 3px 10px;
    padding: 10px 12px;
  }

  .history-detail {
    grid-column: 1 / -1;
    white-space: normal;
  }
}
</style>

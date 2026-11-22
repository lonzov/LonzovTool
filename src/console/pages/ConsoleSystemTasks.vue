<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NDrawer,
  NDrawerContent,
  NInput,
  NInputNumber,
  NSelect,
  NSwitch,
  useMessage,
} from 'naive-ui'
import { ArrowClockwise24Regular, Clock24Regular } from '@vicons/fluent'
import AppButton from '../../components/ui/AppButton.vue'
import AppModal from '../../components/ui/AppModal.vue'
import ConsolePanel from '../components/ConsolePanel.vue'
import { confirmDialog } from '../../composables/useConfirm.js'
import { useIsMobile } from '../../composables/useIsMobile.js'
import { consoleFetch } from '../consoleRequest.js'

const TASKS_URL = '/api/v1/console/system/tasks'
const RUN_URL = (id) => `${TASKS_URL}/runs/${id}`

const INTERVAL_OPTIONS = [
  { label: '每 5 分钟', value: 300 },
  { label: '每 15 分钟', value: 900 },
  { label: '每小时', value: 3600 },
  { label: '每 6 小时', value: 6 * 3600 },
  { label: '每 12 小时', value: 12 * 3600 },
  { label: '每天', value: 24 * 3600 },
  { label: '每 3 天', value: 3 * 24 * 3600 },
  { label: '每 7 天', value: 7 * 24 * 3600 },
]

const STATUS_LABELS = {
  queued: '排队中',
  running: '执行中',
  cancelled: '已取消',
  success: '成功',
  failed: '失败',
  interrupted: '已中断',
  timed_out: '已超时',
}

const route = useRoute()
const router = useRouter()
const message = useMessage()
const { isMobile } = useIsMobile()

const tasks = ref([])
const loading = ref(false)
const errorText = ref('')
const runningKey = ref('')

const drawerVisible = ref(false)
const detailTask = ref(null)
const detailRuns = ref([])
const detailLoading = ref(false)

const editVisible = ref(false)
const editTask = ref(null)
const editSaving = ref(false)
const editForm = ref({
  enabled: false,
  scheduleType: 'interval',
  intervalSeconds: 86400,
  cron: '',
  timeoutSeconds: 300,
})

const drawerTitle = computed(() => detailTask.value?.name || '任务详情')
const editTitle = computed(() =>
  editTask.value ? `编辑 · ${editTask.value.name}` : '编辑定时任务',
)

function gotUnauthorized(e) {
  if (e?.code !== 'unauthorized') return false
  router.replace({ path: '/console/login', query: { redirect: route.fullPath } })
  return true
}

async function load() {
  loading.value = true
  errorText.value = ''
  try {
    const payload = await consoleFetch(TASKS_URL)
    tasks.value = Array.isArray(payload?.tasks) ? payload.tasks : []
    if (detailTask.value) {
      const current = tasks.value.find((item) => item.key === detailTask.value.key)
      if (current) detailTask.value = current
    }
  } catch (e) {
    if (gotUnauthorized(e)) return
    errorText.value = e?.message || '读取定时任务失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

async function loadRuns(task) {
  detailLoading.value = true
  try {
    const payload = await consoleFetch(`${TASKS_URL}/${task.key}/runs?limit=30`)
    detailRuns.value = Array.isArray(payload?.runs) ? payload.runs : []
  } catch (e) {
    if (gotUnauthorized(e)) return
    message.error(e?.message || '读取执行记录失败')
  } finally {
    detailLoading.value = false
  }
}

function openDrawer(task) {
  detailTask.value = task
  detailRuns.value = []
  drawerVisible.value = true
  loadRuns(task)
}

function openEdit(task) {
  editTask.value = task
  editForm.value = {
    enabled: task.enabled,
    scheduleType: task.cron ? 'cron' : 'interval',
    intervalSeconds: task.interval_seconds,
    cron: task.cron || '',
    timeoutSeconds: task.timeout_seconds,
  }
  editVisible.value = true
}

async function saveEdit() {
  if (!editTask.value || editSaving.value) return
  const form = editForm.value
  if (form.scheduleType === 'cron' && !form.cron.trim()) {
    message.error('请输入 cron 表达式')
    return
  }
  editSaving.value = true
  try {
    await consoleFetch(`${TASKS_URL}/${editTask.value.key}`, {
      method: 'PATCH',
      body: JSON.stringify({
        enabled: form.enabled,
        interval_seconds:
          form.scheduleType === 'interval' ? form.intervalSeconds : undefined,
        cron: form.scheduleType === 'cron' ? form.cron.trim() : '',
        timeout_seconds: form.timeoutSeconds,
      }),
    })
    editVisible.value = false
    message.success('已更新')
    await load()
  } catch (e) {
    if (gotUnauthorized(e)) return
    message.error(e?.message || '更新失败，请稍后重试')
  } finally {
    editSaving.value = false
  }
}

async function toggleEnabled(task) {
  const enable = !task.enabled
  const confirmed = await confirmDialog({
    title: enable ? '启用任务' : '停用任务',
    message: `确定${enable ? '启用' : '停用'}「${task.name}」吗？`,
    confirmText: enable ? '启用' : '停用',
    danger: !enable,
  })
  if (!confirmed) return
  try {
    await consoleFetch(`${TASKS_URL}/${task.key}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: enable }),
    })
    message.success(enable ? '已启用' : '已停用')
    await load()
  } catch (e) {
    if (gotUnauthorized(e)) return
    message.error(e?.message || '更新失败，请稍后重试')
  }
}

async function waitForRun(runId) {
  for (let i = 0; i < 20; i += 1) {
    const run = await consoleFetch(RUN_URL(runId))
    if (['success', 'failed', 'interrupted', 'timed_out'].includes(run.status)) {
      return run
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  return null
}

async function runNow(task) {
  if (runningKey.value) return
  runningKey.value = task.key
  try {
    const started = await consoleFetch(`${TASKS_URL}/${task.key}/run`, {
      method: 'POST',
    })
    const run = await waitForRun(started.id)
    if (!run) {
      message.info('任务已提交，执行完成后刷新查看')
    } else if (run.status === 'success') {
      message.success(run.summary || '执行完成')
    } else {
      message.error(run.error || '执行失败')
    }
    await load()
    if (drawerVisible.value && detailTask.value?.key === task.key) {
      await loadRuns(detailTask.value)
    }
  } catch (e) {
    if (gotUnauthorized(e)) return
    message.error(e?.message || '执行失败，请稍后重试')
  } finally {
    runningKey.value = ''
  }
}

function intervalLabel(seconds) {
  const found = INTERVAL_OPTIONS.find((item) => item.value === Number(seconds))
  if (found) return found.label
  if (seconds % 3600 === 0) return `每 ${seconds / 3600} 小时`
  return `每 ${Math.max(1, Math.round(seconds / 60))} 分钟`
}

function scheduleText(task) {
  return task.cron ? '自定义周期' : intervalLabel(task.interval_seconds)
}

function statusLabel(status) {
  return STATUS_LABELS[status] || '未执行'
}

function formatTime(timestamp) {
  const value = Number(timestamp)
  if (!Number.isFinite(value) || value <= 0) return '—'
  return new Date(value * 1000).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function formatDuration(run) {
  const start = Number(run.started_at)
  const end = Number(run.finished_at)
  if (!start || !end || end < start) return ''
  return `${Math.max(1, Math.round(end - start))}s`
}

onMounted(load)
</script>

<template>
  <div class="system-tasks">
    <p v-if="errorText" class="system-error" role="alert">{{ errorText }}</p>

    <ConsolePanel title="任务列表" :icon="Clock24Regular">
      <template #extra>
        <AppButton
          variant="text"
          size="sm"
          :icon="ArrowClockwise24Regular"
          icon-only
          label="刷新"
          :disabled="loading"
          @click="load"
        />
      </template>

      <p v-if="loading" class="task-empty">正在读取…</p>
      <p v-else-if="!tasks.length" class="task-empty">还没有注册定时任务。</p>
      <div v-else class="task-table">
        <div class="task-table-head">
          <span>任务</span>
          <span>状态</span>
          <span>执行周期</span>
          <span>下次执行</span>
          <span>上次执行</span>
          <span class="task-table-actions-head">操作</span>
        </div>
        <article v-for="task in tasks" :key="task.key" class="task-row">
          <div class="task-cell task-cell--name">
            <strong class="task-name">{{ task.name }}</strong>
            <p class="task-desc">{{ task.description }}</p>
          </div>

          <div class="task-cell task-cell--status">
            <span class="task-label">状态</span>
            <button
              type="button"
              class="task-toggle"
              :class="task.enabled ? 'task-toggle--on' : 'task-toggle--off'"
              @click="toggleEnabled(task)"
            >
              {{ task.enabled ? '已启用' : '已停用' }}
            </button>
          </div>

          <div class="task-cell">
            <span class="task-label">执行周期</span>
            <span class="task-primary">{{ scheduleText(task) }}</span>
          </div>

          <div class="task-cell">
            <span class="task-label">下次执行</span>
            <span class="task-primary">{{ formatTime(task.next_run_at) }}</span>
          </div>

          <div class="task-cell">
            <span class="task-label">上次执行</span>
            <span class="task-primary">{{ formatTime(task.last_run_at) }}</span>
            <span :class="`task-status task-last-status task-status--${task.last_status || 'off'}`">
              {{ statusLabel(task.last_status) }}
            </span>
          </div>

          <div class="task-mobile-status">
            <span class="task-label">状态</span>
            <div class="task-status-cluster">
              <button
                type="button"
                class="task-toggle"
                :class="task.enabled ? 'task-toggle--on' : 'task-toggle--off'"
                @click="toggleEnabled(task)"
              >
                {{ task.enabled ? '已启用' : '已停用' }}
              </button>
            </div>
          </div>

          <div class="task-actions">
            <AppButton
              :variant="isMobile ? 'outline' : 'text'"
              size="sm"
              @click="openDrawer(task)"
            >
              详情
            </AppButton>
          </div>
        </article>
      </div>
    </ConsolePanel>

    <NDrawer
      v-model:show="drawerVisible"
      placement="right"
      :width="isMobile ? '100%' : 560"
      :auto-focus="false"
    >
      <NDrawerContent :title="drawerTitle" closable :body-content-style="{ padding: '0' }">
        <div v-if="detailTask" class="drawer-body">
          <section class="drawer-section">
            <p class="drawer-desc">{{ detailTask.description }}</p>
          </section>

          <section class="drawer-section">
            <div class="meta-row">
              <span>状态</span>
              <button
                type="button"
                class="task-toggle"
                :class="detailTask.enabled ? 'task-toggle--on' : 'task-toggle--off'"
                @click="toggleEnabled(detailTask)"
              >
                {{ detailTask.enabled ? '已启用' : '已停用' }}
              </button>
            </div>
            <div class="meta-row">
              <span>任务标识</span>
              <span>{{ detailTask.key }}</span>
            </div>
            <div class="meta-row">
              <span>执行规则</span>
              <span>{{ detailTask.cron || intervalLabel(detailTask.interval_seconds) }}</span>
            </div>
            <div class="meta-row">
              <span>下次执行</span>
              <span>{{ formatTime(detailTask.next_run_at) }}</span>
            </div>
            <div class="meta-row">
              <span>上次执行</span>
              <span>{{ formatTime(detailTask.last_run_at) }}</span>
            </div>
            <div class="meta-row">
              <span>上次结果</span>
              <span :class="`task-status task-status--${detailTask.last_status || 'off'}`">
                {{ statusLabel(detailTask.last_status) }}
              </span>
            </div>
            <div class="meta-row">
              <span>超时</span>
              <span>{{ detailTask.timeout_seconds }} 秒</span>
            </div>
            <p v-if="detailTask.last_error" class="run-error">{{ detailTask.last_error }}</p>
          </section>

          <section class="detail-actions">
            <AppButton
              variant="outline"
              size="sm"
              :loading="runningKey === detailTask.key"
              :disabled="!!runningKey"
              @click="runNow(detailTask)"
            >
              执行
            </AppButton>
            <AppButton variant="outline" size="sm" @click="openEdit(detailTask)">
              编辑
            </AppButton>
          </section>

          <section class="drawer-section">
            <div class="drawer-section-head">
              <span>执行记录</span>
              <AppButton
                variant="outline"
                size="sm"
                :icon="ArrowClockwise24Regular"
                icon-only
                label="刷新"
                :disabled="detailLoading"
                @click="loadRuns(detailTask)"
              />
            </div>
            <p v-if="detailLoading" class="drawer-empty">读取中…</p>
            <p v-else-if="!detailRuns.length" class="drawer-empty">还没有执行记录。</p>
            <div v-else class="run-list">
              <div v-for="run in detailRuns" :key="run.id" class="run-row">
                <div class="run-line">
                  <span :class="`task-status task-status--${run.status}`">
                    {{ statusLabel(run.status) }}
                  </span>
                  <span class="run-time">{{ formatTime(run.queued_at) }}</span>
                  <span class="run-meta">
                    {{ run.trigger === 'auto' ? '自动' : '手动' }}
                    <template v-if="run.worker_name"> · {{ run.worker_name }}</template>
                    <template v-if="formatDuration(run)"> · {{ formatDuration(run) }}</template>
                  </span>
                </div>
                <p v-if="run.summary" class="run-summary">{{ run.summary }}</p>
                <p v-if="run.error" class="run-error">{{ run.error }}</p>
              </div>
            </div>
          </section>
        </div>
      </NDrawerContent>
    </NDrawer>

    <AppModal
      v-model:show="editVisible"
      :title="editTitle"
      :max-width="520"
      :z-index="2200"
      :auto-focus="false"
      animated
      content-scrollable
    >
      <div class="edit-body">
        <div class="meta-row">
          <span>启用任务</span>
          <NSwitch v-model:value="editForm.enabled" />
        </div>
        <div class="meta-row">
          <span>执行方式</span>
          <NSelect
            v-model:value="editForm.scheduleType"
            class="edit-control"
            :options="[
              { label: '固定间隔', value: 'interval' },
              { label: 'cron 表达式', value: 'cron' },
            ]"
          />
        </div>
        <div v-if="editForm.scheduleType === 'interval'" class="meta-row">
          <span>执行间隔</span>
          <NSelect
            v-model:value="editForm.intervalSeconds"
            class="edit-control"
            :options="INTERVAL_OPTIONS"
          />
        </div>
        <div v-else class="meta-row meta-row--stack">
          <span>cron 表达式</span>
          <NInput
            v-model:value="editForm.cron"
            class="edit-control"
            placeholder="0 3 * * *"
            maxlength="120"
          />
        </div>
        <div class="meta-row">
          <span>超时（秒）</span>
          <NInputNumber
            v-model:value="editForm.timeoutSeconds"
            class="edit-control"
            :min="30"
            :max="3600"
          />
        </div>
      </div>

      <template #footer>
        <div class="edit-actions">
          <div class="edit-actions-main">
            <AppButton variant="outline" size="md" @click="editVisible = false">
              取消
            </AppButton>
            <AppButton
              variant="solid"
              size="md"
              :loading="editSaving"
              :disabled="editSaving"
              @click="saveEdit"
            >
              保存
            </AppButton>
          </div>
        </div>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.system-tasks {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.system-error {
  margin: 0;
  color: var(--destructive);
  font-size: 0.8rem;
}

.task-empty {
  margin: 0;
  padding: 18px 14px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  color: var(--subtle-foreground);
  font-size: 0.8rem;
}

.task-table {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.task-table-head,
.task-row {
  display: grid;
  grid-template-columns: minmax(0, 2.4fr) 0.8fr 1fr 1fr 1fr 64px;
  gap: 16px;
  align-items: center;
}

.task-table-head {
  padding: 9px 16px;
  color: var(--subtle-foreground);
  background: var(--accent);
  font-size: 0.75rem;
}

.task-row {
  padding: 14px 16px;
}

.task-row + .task-row {
  border-top: 1px solid var(--border);
}

.task-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
}

.task-cell--status {
  align-items: flex-start;
}

.task-status-cluster {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.task-mobile-status {
  display: none;
}

.task-label {
  display: none;
  color: var(--subtle-foreground);
  font-size: 0.75rem;
}

.task-primary {
  color: var(--foreground);
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
}

.task-sub {
  color: var(--subtle-foreground);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.task-name {
  color: var(--foreground);
  font-size: 0.86rem;
  font-weight: 600;
}

.task-desc {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 0.78rem;
  line-height: 1.45;
}

.task-toggle {
  padding: 0;
  border: 0;
  border-bottom: 1px dashed var(--border);
  background: transparent;
  color: var(--muted-foreground);
  font: inherit;
  font-size: 0.78rem;
  line-height: 1.4;
  cursor: pointer;
}

.task-toggle:hover {
  color: var(--foreground);
}

.task-toggle--on {
  color: var(--success);
}

.task-toggle--off {
  color: var(--subtle-foreground);
}

.task-table-actions-head {
  text-align: right;
}

.task-actions {
  display: flex;
  justify-content: flex-end;
}

.task-status {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 1px 7px;
  border-radius: var(--radius-full);
  corner-shape: round;
  background: var(--accent);
  color: var(--muted-foreground);
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
}

.task-status--success {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 12%, transparent);
}

.task-status--failed,
.task-status--timed_out {
  color: var(--destructive);
  background: color-mix(in srgb, var(--destructive) 12%, transparent);
}

.task-status--interrupted,
.task-status--queued,
.task-status--cancelled {
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 12%, transparent);
}

.task-status--running {
  color: var(--primary);
  background: color-mix(in srgb, var(--primary) 12%, transparent);
}

.task-status--off {
  color: var(--subtle-foreground);
}

.drawer-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 18px 20px 24px;
}

.drawer-section {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.drawer-section + .drawer-section {
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.drawer-desc {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 0.78rem;
  line-height: 1.5;
}

.drawer-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--foreground);
  font-size: 0.8rem;
  font-weight: 600;
}

.meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  color: var(--muted-foreground);
  font-size: 0.78rem;
}

.meta-row > span:first-child {
  color: var(--foreground);
  font-weight: 500;
}

.meta-row--stack {
  align-items: center;
}

.edit-control {
  width: 170px;
}

.detail-actions {
  display: flex;
  gap: 18px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.drawer-empty {
  margin: 0;
  color: var(--subtle-foreground);
  font-size: 0.78rem;
}

.run-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.run-row {
  padding: 9px 11px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.run-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
}

.run-time {
  color: var(--foreground);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.run-meta {
  color: var(--subtle-foreground);
  font-size: 0.75rem;
}

.run-summary {
  margin: 6px 0 0;
  color: var(--muted-foreground);
  font-size: 0.75rem;
  line-height: 1.45;
}

.run-error {
  margin: 6px 0 0;
  color: var(--destructive);
  font-size: 0.75rem;
  line-height: 1.45;
}

.edit-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.edit-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 4px;
}

.edit-actions-main {
  display: flex;
  gap: 8px;
}

@media (width <= 760px) {
  .task-table {
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow: visible;
    border: 0;
  }

  .task-table-head {
    display: none;
  }

  .task-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    padding: 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .task-row + .task-row {
    border-top: 1px solid var(--border);
  }

  .task-cell {
    grid-column: 1 / -1;
  }

  .task-cell--status {
    display: none;
  }

  .task-mobile-status {
    display: flex;
    grid-column: 1;
    flex-direction: column;
    gap: 5px;
    align-self: end;
  }

  .task-label {
    display: block;
  }

  .task-actions {
    grid-column: 2;
    align-self: end;
    justify-content: flex-end;
    padding-top: 0;
    border-top: 0;
  }

  .edit-control {
    width: 100%;
  }

  .edit-body .meta-row {
    display: grid;
    grid-template-columns: 76px minmax(0, 1fr);
    align-items: center;
    gap: 10px;
  }

  .edit-body .meta-row > :last-child {
    justify-self: end;
  }

  .edit-body .meta-row--stack {
    grid-template-columns: 76px minmax(0, 1fr);
    align-items: center;
  }

  .edit-body .meta-row :deep(.n-input),
  .edit-body .meta-row :deep(.n-input-number),
  .edit-body .meta-row :deep(.n-select) {
    width: 100%;
  }

  .edit-actions-main {
    justify-content: flex-end;
    width: 100%;
  }
}
</style>

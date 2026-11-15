<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NIcon, useMessage } from 'naive-ui'
import {
  ArrowClockwise24Regular,
  ArrowUndo24Regular,
  CheckmarkCircle24Regular,
  Delete24Regular,
  DismissCircle24Regular,
  Mail24Regular,
  Open24Regular,
  Settings24Regular,
  ShieldProhibited24Regular,
} from '@vicons/fluent'
import AppButton from '../../components/ui/AppButton.vue'
import AppModal from '../../components/ui/AppModal.vue'
import IpBanDrawer from '../components/IpBanDrawer.vue'
import NotificationComposeModal from '../components/NotificationComposeModal.vue'
import NotificationSettingsDrawer from '../components/NotificationSettingsDrawer.vue'
import ConsolePanel from '../components/ConsolePanel.vue'
import { confirmDialog } from '../../composables/useConfirm.js'
import { consoleFetch } from '../consoleRequest.js'
import { useSensitiveTrust } from '../useSensitiveTrust.js'
import { usePermissions } from '../usePermissions.js'

/* 待审核队列。概览里的卡片只是预览，审核动作全部落在这个页面：
   概览的「查看」会带 ?id= 跳过来，这里定位并高亮那一条。 */
const { ensureTrust } = useSensitiveTrust()
const { can } = usePermissions()

const route = useRoute()
const router = useRouter()
const message = useMessage()

const FILTERS = [
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已拒绝' },
  { value: '', label: '全部' },
]

const items = ref([])
const filter = ref('pending')
const loading = ref(false)
const errorText = ref('')
const highlightId = ref(0)
const notes = ref({})
const pendingId = ref(0)
const notifyLoadingId = ref(0)
const settingsOpen = ref(false)
const banOpen = ref(false)
const notify = ref({
  show: false,
  item: null,
  title: '发送审核结果通知',
  templateLabel: '',
  contact: '',
  recipient: '',
  subject: '',
  body: '',
  sending: false,
})
/* 长文本走模态框查看：列表里只留摘要，避免一屏被一段说明撑爆 */
const detailModal = ref({ show: false, title: '', body: '' })

const STATUS_LABEL = {
  pending: { text: '待审核', tone: 'warning' },
  approved: { text: '已通过', tone: 'success' },
  rejected: { text: '已拒绝', tone: 'destructive' },
}

const emptyText = computed(() => (loading.value ? '读取中…' : '没有符合条件的提交'))

async function load({ keepHighlight = true } = {}) {
  loading.value = true
  errorText.value = ''
  try {
    const params = new URLSearchParams({ limit: '100' })
    if (filter.value) params.set('status', filter.value)
    const payload = await consoleFetch(`/api/v1/console/submissions?${params.toString()}`)
    items.value = payload?.items || []
    if (!keepHighlight) highlightId.value = 0
  } catch (e) {
    if (e?.code === 'unauthorized') {
      router.replace({ path: '/console/login', query: { redirect: route.fullPath } })
      return
    }
    errorText.value = e?.message || '读取失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

async function focusRequested() {
  const id = Number(route.query.id)
  if (!Number.isInteger(id) || id <= 0) return

  highlightId.value = id
  if (items.value.some((item) => item.id === id)) {
    await scrollToHighlight()
    return
  }

  // 目标不在当前筛选里：切到「全部」再定位，避免用户以为链接失效
  filter.value = ''
  await load({ keepHighlight: false })
  highlightId.value = id
  await scrollToHighlight()
}

async function scrollToHighlight() {
  await nextTick()
  const element = document.getElementById(`submission-${highlightId.value}`)
  if (element) element.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

async function review(item, status) {
  if (!(await ensureTrust())) return
  pendingId.value = item.id
  try {
    const updated = await consoleFetch(`/api/v1/console/submissions/${item.id}/review`, {
      method: 'POST',
      body: JSON.stringify({ status, note: (notes.value[item.id] || '').trim() }),
    })
    Object.assign(item, updated)
    notes.value[item.id] = ''
    message.success(
      status === 'approved'
        ? updated.published
          ? updated.published_hidden
            ? '已通过，卡片仍保持隐藏'
            : '已通过并上架到首页卡片'
          : '已标记为通过'
        : status === 'pending'
          ? updated.published_hidden
            ? '已恢复为待审核，卡片已隐藏'
            : '已恢复为待审核'
          : updated.published_hidden
            ? '已标记为拒绝，卡片已隐藏'
            : '已标记为拒绝',
    )
  } catch (e) {
    if (e?.code === 'unauthorized') {
      router.replace({ path: '/console/login', query: { redirect: route.fullPath } })
      return
    }
    message.error(e?.message || '审核失败，请稍后重试')
  } finally {
    pendingId.value = 0
    // 任何审核动作后都重拉一次：状态、上架结果与排队顺序都可能变化
    await load()
  }
}

const NOTIFICATION_LABEL = {
  email: '已发邮件',
  manual: '已人工通知',
  failed: '通知失败',
}

function notificationText(item) {
  return NOTIFICATION_LABEL[item.notification_status] || '未通知'
}

async function openNotify(item) {
  notifyLoadingId.value = item.id
  try {
    const preview = await consoleFetch(
      `/api/v1/console/notifications/submissions/${item.id}`,
    )
    notify.value = {
      show: true,
      item,
      title: '发送审核结果通知',
      templateLabel: preview?.label || '',
      contact: preview?.contact || item.contact || '',
      recipient: preview?.recipient || '',
      subject: preview?.subject || '',
      body: preview?.body || '',
      sending: false,
    }
  } catch (e) {
    if (e?.code === 'unauthorized') {
      router.replace({ path: '/console/login', query: { redirect: route.fullPath } })
      return
    }
    message.error(e?.message || '读取通知模板失败，请稍后重试')
  } finally {
    notifyLoadingId.value = 0
  }
}

async function sendNotify(payload) {
  const item = notify.value.item
  if (!item) return
  notify.value.sending = true
  try {
    const updated = await consoleFetch(
      `/api/v1/console/notifications/submissions/${item.id}`,
      { method: 'POST', body: JSON.stringify(payload) },
    )
    Object.assign(item, updated)
    notify.value.show = false
    message.success(
      payload.channel === 'manual' ? '已标记为人工通知' : '通知邮件已发送',
    )
  } catch (e) {
    if (e?.code === 'unauthorized') {
      router.replace({ path: '/console/login', query: { redirect: route.fullPath } })
      return
    }
    if (e?.code === 'notification_failed') item.notification_status = 'failed'
    message.error(e?.message || '发送失败，请稍后重试')
  } finally {
    notify.value.sending = false
  }
}

async function remove(item) {
  const confirmed = await confirmDialog({
    title: '删除提交',
    message: `确定删除「${item.title}」这条提交记录吗？\n已上架的卡片不会被删除。`,
    confirmText: '删除',
    danger: true,
  })
  if (!confirmed) return
  if (!(await ensureTrust())) return

  pendingId.value = item.id
  try {
    await consoleFetch(`/api/v1/console/submissions/${item.id}`, { method: 'DELETE' })
    message.success('已删除')
  } catch (e) {
    if (e?.code === 'unauthorized') {
      router.replace({ path: '/console/login', query: { redirect: route.fullPath } })
      return
    }
    message.error(e?.message || '删除失败，请稍后重试')
  } finally {
    pendingId.value = 0
    await load()
  }
}

function openDetail(item) {
  // 用文本插值渲染，不碰 v-html：提交内容来自访客，按 HTML 解释就是给自己开 XSS
  detailModal.value = { show: true, title: item.title, body: item.detail || item.summary || '' }
}

watch(filter, () => load({ keepHighlight: false }))

onMounted(async () => {
  await load()
  await focusRequested()
})
</script>

<template>
  <div class="console-submissions">
    <div class="submissions-toolbar">
      <div class="tab-group" role="tablist">
        <button
          v-for="option in FILTERS"
          :key="option.label"
          class="tab-btn"
          :class="{ 'tab-btn--on': filter === option.value }"
          type="button"
          role="tab"
          :aria-selected="filter === option.value"
          @click="filter = option.value"
        >
          {{ option.label }}
        </button>
      </div>
      <div class="toolbar-actions">
        <AppButton
          v-if="can('accounts.manage')"
          variant="outline"
          size="sm"
          icon-only
          label="通知设置"
          :icon="Settings24Regular"
          @click="settingsOpen = true"
        />
        <AppButton
          v-if="can('accounts.manage')"
          variant="outline"
          size="sm"
          icon-only
          label="IP 封禁"
          :icon="ShieldProhibited24Regular"
          @click="banOpen = true"
        />
        <AppButton
          variant="outline"
          size="sm"
          icon-only
          label="刷新"
          :icon="ArrowClockwise24Regular"
          :disabled="loading"
          @click="load()"
        />
      </div>
    </div>

    <p v-if="errorText" class="inline-hint inline-hint--error">{{ errorText }}</p>

    <ConsolePanel :icon="CheckmarkCircle24Regular" :title="`提交列表（${items.length}）`">
      <p v-if="!items.length" class="inline-hint">{{ emptyText }}</p>
      <div v-else class="submission-list">
        <article
          v-for="item in items"
          :id="`submission-${item.id}`"
          :key="item.id"
          class="submission-card"
          :class="{ 'submission-card--focus': item.id === highlightId }"
        >
          <div class="submission-head">
            <img v-if="item.icon" class="submission-icon" :src="item.icon" :alt="item.title" />
            <div class="submission-title-block">
              <div class="submission-title-line">
                <span class="submission-title">{{ item.title }}</span>
                <span class="status-pill" :class="`status-pill--${STATUS_LABEL[item.status].tone}`">
                  {{ STATUS_LABEL[item.status].text }}
                </span>
                <span v-if="item.is_duplicate" class="tag-pill tag-pill--duplicate">重复</span>
                <span v-if="item.is_core_developer" class="tag-pill">核心开发者</span>
                <span v-if="item.captcha_bypassed" class="tag-pill tag-pill--warn">验证降级</span>
              </div>
              <a class="submission-link" :href="item.link" target="_blank" rel="noopener noreferrer">
                {{ item.link }}
                <NIcon :component="Open24Regular" :size="12" />
              </a>
            </div>
            <div class="submission-side">
              <span class="submission-time">{{ new Date(item.created_at * 1000).toLocaleString() }}</span>
              <span class="submission-ip">{{ item.source_ip || 'IP 未知' }}</span>
            </div>
          </div>

          <dl class="submission-meta">
            <div><dt>分类</dt><dd>{{ item.category }}</dd></div>
            <div><dt>介绍</dt><dd class="cell-clamp">{{ item.summary }}</dd></div>
            <div><dt>联系方式</dt><dd class="cell-clamp">{{ item.contact }}</dd></div>
            <div class="meta-wide">
              <dt>说明</dt>
              <dd class="cell-clamp cell-clamp--clickable" :title="item.detail" @click="openDetail(item)">
                {{ item.detail || '—' }}
                <span v-if="item.detail && item.detail.length > 40" class="cell-more">查看全部</span>
              </dd>
            </div>
          </dl>

          <div v-if="item.published" class="published-hint">
            已上架为卡片 <code>{{ item.published_slug }}</code>
            <span v-if="item.published_hidden">（审核隐藏）</span>
          </div>

          <div v-if="item.status !== 'pending'" class="notify-row">
            <span
              class="notify-state"
              :class="{
                'notify-state--sent': item.notification_status === 'email',
                'notify-state--manual': item.notification_status === 'manual',
                'notify-state--failed': item.notification_status === 'failed',
              }"
            >
              {{ notificationText(item) }}
            </span>
            <span v-if="item.notified_by" class="notify-by">
              {{ item.notified_by }}
            </span>
            <AppButton
              variant="outline"
              size="sm"
              :icon="Mail24Regular"
              :disabled="notifyLoadingId === item.id || pendingId === item.id"
              :loading="notifyLoadingId === item.id"
              @click="openNotify(item)"
            >
              发送通知
            </AppButton>
          </div>

          <div class="submission-actions">
            <input
              v-model="notes[item.id]"
              class="note-input"
              type="text"
              maxlength="200"
              placeholder="备注（可选，写进审核记录）"
            />
            <div class="action-buttons">
              <template v-if="item.status === 'pending'">
                <AppButton
                  class="action-btn"
                  variant="solid"
                  size="sm"
                  :icon="CheckmarkCircle24Regular"
                  :disabled="pendingId === item.id"
                  @click="review(item, 'approved')"
                >
                  通过
                </AppButton>
                <AppButton
                  class="action-btn"
                  variant="outline"
                  size="sm"
                  :icon="DismissCircle24Regular"
                  :disabled="pendingId === item.id"
                  @click="review(item, 'rejected')"
                >
                  拒绝
                </AppButton>
              </template>
              <template v-else>
                <AppButton
                  class="action-btn"
                  variant="solid"
                  size="sm"
                  label="恢复为待审核"
                  :icon="ArrowUndo24Regular"
                  :disabled="pendingId === item.id"
                  @click="review(item, 'pending')"
                >
                  待审核
                </AppButton>
                <AppButton
                  v-if="item.status === 'approved'"
                  class="action-btn"
                  variant="outline"
                  size="sm"
                  :icon="DismissCircle24Regular"
                  :disabled="pendingId === item.id"
                  @click="review(item, 'rejected')"
                >
                  拒绝
                </AppButton>
                <AppButton
                  v-else
                  class="action-btn"
                  variant="outline"
                  size="sm"
                  :icon="CheckmarkCircle24Regular"
                  :disabled="pendingId === item.id"
                  @click="review(item, 'approved')"
                >
                  通过
                </AppButton>
              </template>
              <AppButton
                class="action-btn"
                variant="solid"
                tone="danger"
                size="sm"
                :icon="Delete24Regular"
                :disabled="pendingId === item.id"
                @click="remove(item)"
              >
                删除
              </AppButton>
            </div>
          </div>
        </article>
      </div>
    </ConsolePanel>

    <AppModal
      v-model:show="detailModal.show"
      :title="detailModal.title"
      :max-width="560"
      :actions="[{ text: '关闭', variant: 'outline', onClick: () => (detailModal.show = false) }]"
      content-scrollable
    >
      <!-- 纯文本渲染：内容来自访客，按 HTML 解释等于开 XSS 口子 -->
      <p class="detail-body">{{ detailModal.body || '—' }}</p>
    </AppModal>

    <NotificationComposeModal
      v-model:show="notify.show"
      :title="notify.title"
      :template-label="notify.templateLabel"
      :contact="notify.contact"
      :recipient="notify.recipient"
      :subject="notify.subject"
      :body="notify.body"
      :sending="notify.sending"
      @submit="sendNotify"
    />

    <NotificationSettingsDrawer
      v-model:show="settingsOpen"
      default-tab="submission_approved"
    />

    <IpBanDrawer v-model:show="banOpen" />
  </div>
</template>

<style scoped>
.console-submissions {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
  min-width: 0;
}

.submissions-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
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

.submission-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.submission-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--muted);
  scroll-margin: 96px;
  transition: border-color 0.3s ease, background-color 0.4s ease, box-shadow 0.3s ease;
}

.submission-card--focus {
  border-color: var(--ring);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--ring) 35%, transparent);
}

.submission-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.submission-icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  object-fit: contain;
  background: var(--card);
}

.submission-title-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.submission-title-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.submission-title {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--foreground);
}

.submission-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  color: var(--muted-foreground);
  font-size: 0.78rem;
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.2s ease;
}

.submission-link:hover {
  color: var(--foreground);
}

.submission-time {
  flex-shrink: 0;
  color: var(--subtle-foreground);
  font-size: 0.74rem;
}

.submission-side {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
}

.submission-ip {
  color: var(--subtle-foreground);
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  font-size: 0.7rem;
  overflow-wrap: anywhere;
}

.submission-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 6px 16px;
  margin: 0;
  font-size: 0.78rem;
}

.submission-meta div {
  display: flex;
  gap: 8px;
  min-width: 0;
}

.submission-meta dt {
  flex-shrink: 0;
  color: var(--subtle-foreground);
}

.submission-meta dd {
  margin: 0;
  min-width: 0;
  color: var(--muted-foreground);
  overflow-wrap: anywhere;
}

/* 长文本只留两行摘要，点开模态框看全文 */
.cell-clamp {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  white-space: normal;
}

.cell-clamp--clickable {
  cursor: pointer;
}

.cell-clamp--clickable:hover {
  color: var(--foreground);
}

.cell-more {
  margin-left: 6px;
  color: var(--ring);
  font-size: 0.72rem;
  white-space: nowrap;
}

.meta-wide {
  grid-column: 1 / -1;
}

.published-hint {
  color: var(--success);
  font-size: 0.74rem;
}

.published-hint code {
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
}

.notify-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.notify-state {
  padding: 1px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  corner-shape: round;
  color: var(--muted-foreground);
  font-size: 0.74rem;
  line-height: 1.7;
}

.notify-state--sent {
  border-color: color-mix(in srgb, var(--success) 35%, var(--border));
  color: var(--success);
}

.notify-state--manual {
  border-color: color-mix(in srgb, var(--primary) 35%, var(--border));
  color: var(--primary);
}

.notify-state--failed {
  border-color: color-mix(in srgb, var(--danger) 35%, var(--border));
  color: var(--danger);
}

.notify-by {
  color: var(--subtle-foreground);
  font-size: 0.74rem;
}

/* 滚动交给 AppModal 的 content-scrollable 统一处理，这里只负责排版 */
.detail-body {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 0.84rem;
  line-height: 1.7;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.submission-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  flex-wrap: wrap;
}

/* 动作按钮同高，备注占剩余宽度 */
.action-btn {
  flex-shrink: 0;
}

.note-input {
  flex: 1;
  min-width: 140px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  corner-shape: round;
  background: var(--card);
  color: var(--foreground);
  font-family: inherit;
  font-size: 0.78rem;
  transition: border-color 0.2s ease, background-color 0.4s ease;
}

.note-input:focus {
  outline: none;
  border-color: var(--ring);
}

.tag-pill {
  padding: 1px 8px;
  border-radius: var(--radius-full);
  corner-shape: round;
  background: var(--accent);
  color: var(--muted-foreground);
  font-size: 0.7rem;
}

.tag-pill--warn {
  color: var(--warning);
}

.tag-pill--duplicate {
  color: var(--destructive);
  background: color-mix(in srgb, var(--destructive) 12%, transparent);
}

.inline-hint {
  margin: 0;
  padding: 8px 0;
  color: var(--subtle-foreground);
  font-size: 0.8rem;
}

.inline-hint--error {
  color: var(--destructive);
}

.status-pill {
  padding: 1px 8px;
  border-radius: var(--radius-full);
  corner-shape: round;
  font-size: 0.7rem;
  transition: color 0.4s ease;
}

.status-pill--warning {
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 12%, transparent);
}

.status-pill--success {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 12%, transparent);
}

.status-pill--destructive {
  color: var(--destructive);
  background: color-mix(in srgb, var(--destructive) 12%, transparent);
}

@media (width <= 720px) {
  .console-submissions {
    gap: 12px;
  }

  .submissions-toolbar {
    align-items: center;
  }

  .submission-card {
    gap: 12px;
    padding: 12px;
  }

  .submission-head {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr);
    gap: 4px 10px;
  }

  .submission-icon {
    grid-row: 1 / span 2;
  }

  .submission-title-block {
    grid-column: 2;
  }

  .submission-side {
    grid-column: 2;
    grid-row: 2;
    align-items: flex-start;
  }

  .submission-meta {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }

  .submission-meta div {
    display: grid;
    grid-template-columns: 4.5em minmax(0, 1fr);
    gap: 6px;
  }

  .submission-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .note-input {
    width: 100%;
    min-width: 0;
    flex: 0 0 30px;
  }

  .action-buttons {
    justify-content: flex-end;
    margin-left: 0;
    flex-wrap: nowrap;
  }
}
</style>

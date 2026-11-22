<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NDrawer, NDrawerContent, NIcon, NInput, NSelect, useMessage } from 'naive-ui'
import {
  ArrowClockwise24Regular,
  ArrowUndo24Regular,
  ChatHelp24Regular,
  Bug24Regular,
  Checkmark24Regular,
  CommentNote24Regular,
  Lightbulb24Regular,
  Copy24Regular,
  Delete24Regular,
  Filter24Regular,
  Image24Regular,
  Mail24Regular,
  MailProhibited24Regular,
  Search24Regular,
  Settings24Regular,
  ShieldProhibited24Regular,
} from '@vicons/fluent'
import AppButton from '../../components/ui/AppButton.vue'
import SheetHandle from '../../components/ui/SheetHandle.vue'
import ConsolePanel from '../components/ConsolePanel.vue'
import FeedbackFilterModal from '../components/FeedbackFilterModal.vue'
import IpBanDrawer from '../components/IpBanDrawer.vue'
import NotificationComposeModal from '../components/NotificationComposeModal.vue'
import NotificationSettingsDrawer from '../components/NotificationSettingsDrawer.vue'
import { confirmDialog } from '../../composables/useConfirm.js'
import { copyText } from '../../utils/clipboard.js'
import { consoleFetch } from '../consoleRequest.js'
import { useSensitiveTrust } from '../useSensitiveTrust.js'
import { openImageLightbox } from '../useImageLightbox.js'
import { useIsMobile } from '../../composables/useIsMobile.js'
import { useMobileSheet } from '../../composables/useMobileSheet.js'
import { usePermissions } from '../usePermissions.js'

/* 访客反馈的处理队列。
   列表只做预览：一眼看清"是什么事、什么状态、要不要现在处理"；
   优先级与备注的编辑全部发生在详情抽屉里，列表不承载任何输入控件。 */
const { ensureTrust } = useSensitiveTrust()
const { can } = usePermissions()

const LIST_URL = '/api/v1/console/feedback'
const PAGE_SIZE = 50

const TABS = [
  { value: 'pending', label: '待处理' },
  { value: 'handled', label: '已处理' },
  { value: '', label: '全部' },
]

/* 类型用图标表达：列表里一个形状 + 一种颜色就能区分"这是 bug 还是建议"，
   比再挂一个文字标签省位置，也不会让标题行堆满标签 */
const KIND_META = {
  bug: { label: 'BUG', icon: Bug24Regular, tone: 'danger' },
  suggestion: { label: '建议', icon: Lightbulb24Regular, tone: 'info' },
  reminder: { label: '提醒', icon: CommentNote24Regular, tone: 'warn' },
}
const KIND_TONE = { bug: 'danger', suggestion: 'info', reminder: 'warn' }

const PRIORITY_OPTIONS = [
  { label: '一般', value: 'normal' },
  { label: '注意', value: 'attention' },
  { label: '紧急', value: 'urgent' },
  { label: '重复', value: 'duplicate' },
]
const PRIORITY_TONE = {
  normal: 'muted',
  attention: 'warn',
  urgent: 'danger',
  duplicate: 'muted',
}

const route = useRoute()
const router = useRouter()
const message = useMessage()
const { isMobile } = useIsMobile()
const { mobile, sheetPlacement, sheetWidth, sheetHeight, sheetHeaderStyle, sheetStyle } =
  useMobileSheet(isMobile, {
    width: 640,
    desktopStyle: {
      background: 'var(--background)',
      borderLeft: '1px solid var(--border)',
      boxShadow: 'var(--shadow-drawer)',
    },
  })

const items = ref([])
const status = ref('pending')
const loading = ref(false)
const loadingMore = ref(false)
const errorText = ref('')
const lastId = ref(0)
const hasMore = ref(false)
const pendingId = ref(0)

/** 已应用的筛选规则 */
const rules = ref([])
const filterOpen = ref(false)
const search = ref('')
let searchTimer = 0

const detail = ref({ show: false, item: null })
const form = ref({ priority: 'normal', note: '' })
const saving = ref(false)
const reopening = ref(false)
const notifyLoadingId = ref(0)
const unavailableLoadingId = ref(0)
const settingsOpen = ref(false)
const banOpen = ref(false)
const notify = ref({
  show: false,
  item: null,
  title: '发送反馈通知',
  templates: [],
  defaultEvent: 'feedback_handled',
  contact: '',
  recipient: '',
  subject: '',
  body: '',
  sending: false,
})

const NOTIFICATION_LABEL = {
  email: '已发',
  manual: '已发',
  failed: '无法通知',
}

const emptyText = computed(() => (loading.value ? '读取中…' : '没有符合条件的反馈'))

function notifySent(item) {
  return item?.notification_status === 'email'
}

function gotUnauthorized(e) {
  if (e?.code !== 'unauthorized') return false
  router.replace({ path: '/console/login', query: { redirect: route.fullPath } })
  return true
}

function kindText(item) {
  return item?.kind_label || KIND_META[item?.kind]?.label || '反馈'
}

function kindIcon(item) {
  return KIND_META[item?.kind]?.icon || CommentNote24Regular
}

function statusOf(item) {
  return item?.status === 'handled'
    ? { text: '已处理', tone: 'success' }
    : { text: '待处理', tone: 'warn' }
}

function isEmail(contact) {
  return (contact || '').includes('@')
}

/** 相对时间：列表里「3 天前」比绝对时间更有用 */
function relativeTime(value) {
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  const diff = Date.now() / 1000 - seconds
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} 天前`
  return new Date(seconds * 1000).toLocaleDateString('zh-CN')
}

function fullTime(value) {
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  return new Date(seconds * 1000).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function imageList(item) {
  return Array.isArray(item?.images) ? item.images.filter(Boolean) : []
}

function excerpt(item) {
  const text = (item?.detail || '').replace(/\s+/g, ' ').trim()
  return text || '（没有填写详细描述）'
}

async function load({ append = false } = {}) {
  if (append ? loadingMore.value : loading.value) return

  if (append) loadingMore.value = true
  else loading.value = true
  errorText.value = ''

  try {
    const params = new URLSearchParams({
      after: append ? String(lastId.value) : '0',
      limit: String(PAGE_SIZE),
    })
    if (status.value) params.set('status', status.value)
    const keyword = search.value.trim()
    if (keyword) params.set('q', keyword)
    for (const rule of rules.value) {
      params.append('filter', `${rule.field}:${rule.op}:${rule.value}`)
    }

    const payload = await consoleFetch(`${LIST_URL}?${params.toString()}`)
    const list = Array.isArray(payload?.items) ? payload.items : []
    items.value = append ? [...items.value, ...list] : list

    const nextLast = Number(payload?.last_id)
    lastId.value =
      Number.isFinite(nextLast) && nextLast > 0
        ? nextLast
        : list.length
          ? list[list.length - 1].id
          : lastId.value
    hasMore.value = list.length >= PAGE_SIZE
  } catch (e) {
    if (gotUnauthorized(e)) return
    errorText.value = e?.message || '读取失败，请稍后重试'
    hasMore.value = false
    if (!append) items.value = []
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

function openDetail(item) {
  detail.value = { show: true, item }
  form.value = { priority: item.priority || 'normal', note: item.note || '' }
}

/** 保存优先级与备注：只改这两个字段，不动处理状态 */
async function saveReview() {
  const item = detail.value.item
  if (!item) return
  saving.value = true
  try {
    const updated = await consoleFetch(`${LIST_URL}/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ priority: form.value.priority, note: form.value.note }),
    })
    Object.assign(item, updated)
    message.success('已保存')
  } catch (e) {
    if (gotUnauthorized(e)) return
    message.error(e?.message || '保存失败，请稍后重试')
  } finally {
    saving.value = false
  }
}

/** 重新打开：状态回到待处理，处理人与处理时间由服务端清空 */
async function reopen(item) {
  reopening.value = true
  try {
    const updated = await consoleFetch(`${LIST_URL}/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'pending',
        priority: form.value.priority,
        note: form.value.note,
      }),
    })
    Object.assign(item, updated)
    message.success('已重新打开')
    await load()
  } catch (e) {
    if (gotUnauthorized(e)) return
    message.error(e?.message || '重新打开失败，请稍后重试')
  } finally {
    reopening.value = false
  }
}

async function markHandled(item) {
  pendingId.value = item.id
  try {
    const updated = await consoleFetch(`${LIST_URL}/${item.id}/handle`, {
      method: 'POST',
      body: JSON.stringify({ priority: form.value.priority, note: form.value.note }),
    })
    Object.assign(item, updated)
    form.value = { priority: updated.priority || 'normal', note: updated.note || '' }
    message.success('已标记为已处理')
    await load()
  } catch (e) {
    if (gotUnauthorized(e)) return
    message.error(e?.message || '操作失败，请稍后重试')
  } finally {
    pendingId.value = 0
  }
}

function notificationText(item) {
  return NOTIFICATION_LABEL[item?.notification_status] || '未发'
}

async function openNotify(item) {
  notifyLoadingId.value = item.id
  try {
    const events = ['feedback_handled', 'feedback_unresolved']
    const previews = await Promise.all(
      events.map((event) =>
        consoleFetch(
          `/api/v1/console/notifications/feedback/${item.id}?event=${event}`,
        ),
      ),
    )
    const templates = previews
      .filter(Boolean)
      .map((preview) => ({
        event: preview.event,
        label: preview.label,
        recipient: preview.recipient || '',
        subject: preview.subject || '',
        body: preview.body || '',
      }))
    const first = templates[0]
    notify.value = {
      show: true,
      item,
      title: '发送反馈通知',
      templates,
      defaultEvent: 'feedback_handled',
      contact: item.contact || '',
      recipient: first?.recipient || '',
      subject: first?.subject || '',
      body: first?.body || '',
      sending: false,
    }
  } catch (e) {
    if (gotUnauthorized(e)) return
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
      `/api/v1/console/notifications/feedback/${item.id}`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    )
    Object.assign(item, updated)
    notify.value.show = false
    message.success(
      payload.channel === 'manual' ? '已标记为人工通知' : '通知邮件已发送',
    )
  } catch (e) {
    if (gotUnauthorized(e)) return
    if (e?.code === 'rate_limited') {
      const retry = Number(e?.meta?.retry_after ?? e?.retryAfterSeconds ?? 0)
      message.warning(
        retry > 0
          ? `发送过于频繁，请 ${Math.max(1, Math.ceil(retry / 60))} 分钟后重试`
          : '发送过于频繁，请稍后重试',
      )
      return
    }
    if (e?.code === 'duplicate_notification') {
      notify.value.show = false
      message.warning('这条通知刚发过，60 秒内不能重复发送')
      await load()
      return
    }
    if (e?.code === 'notification_failed') item.notification_status = 'failed'
    message.error(e?.message || '发送失败，请稍后重试')
  } finally {
    notify.value.sending = false
  }
}

async function markUnavailable(item) {
  unavailableLoadingId.value = item.id
  try {
    const updated = await consoleFetch(
      `/api/v1/console/notifications/feedback/${item.id}`,
      {
        method: 'POST',
        body: JSON.stringify({ channel: 'unavailable' }),
      },
    )
    Object.assign(item, updated)
    message.success('已标记为无法通知')
  } catch (e) {
    if (gotUnauthorized(e)) return
    message.error(e?.message || '标记失败，请稍后重试')
  } finally {
    unavailableLoadingId.value = 0
  }
}

async function remove(item) {
  const confirmed = await confirmDialog({
    title: '删除反馈',
    message: `确定删除「${item.title}」这条反馈吗？\n删除后无法恢复，截图也会一并移除。`,
    confirmText: '删除',
    danger: true,
  })
  if (!confirmed) return
  if (!(await ensureTrust())) return

  pendingId.value = item.id
  try {
    await consoleFetch(`${LIST_URL}/${item.id}`, { method: 'DELETE' })
    message.success('已删除')
    if (detail.value.item?.id === item.id) detail.value.show = false
    await load()
  } catch (e) {
    if (gotUnauthorized(e)) return
    message.error(e?.message || '删除失败，请稍后重试')
  } finally {
    pendingId.value = 0
  }
}

/* 抽屉锁着焦点，兜底复制必须把临时节点挂进抽屉内部，否则 execCommand 会假装成功 */
async function copyContact(contact, container) {
  if (!contact) return
  const ok = await copyText(contact, { container })
  if (ok) message.success('已复制')
  else message.error('复制失败，请手动选中')
}

function openShots(item, index = 0) {
  openImageLightbox(imageList(item), index)
}

function applyRules(next) {
  rules.value = next
  load()
}

/* 待办抽屉与外部链接会带 ?id= 跳过来：按 id 找到那条并直接展开详情。
   目标可能已经被处理、不在「待处理」页里，因此找不到时退到「全部」再定位一次。 */
async function focusRequested() {
  const id = Number(route.query.id)
  if (!Number.isInteger(id) || id <= 0) return

  const found = items.value.find((item) => item.id === id)
  if (found) {
    openDetail(found)
    return
  }

  status.value = ''
  await load()
  const target = items.value.find((item) => item.id === id)
  if (target) openDetail(target)
  else errorText.value = `没有找到编号 ${id} 的反馈`
}

watch(status, () => load())
watch(search, () => {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => load(), 300)
})

/* 抽屉是页面级浮层：换页后收起，免得它继续盖在新页面上 */
watch(
  () => route.fullPath,
  () => {
    if (detail.value.show) detail.value.show = false
  },
)

onBeforeUnmount(() => window.clearTimeout(searchTimer))
onMounted(async () => {
  await load()
  await focusRequested()
})
</script>

<template>
  <div class="console-feedback">
    <div class="feedback-toolbar">
      <div class="tab-group">
        <button
          v-for="tab in TABS"
          :key="tab.label"
          class="tab-btn"
          :class="{ 'tab-btn--on': status === tab.value }"
          type="button"
          role="tab"
          :aria-selected="status === tab.value"
          @click="status = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>

      <div class="toolbar-actions">
        <div class="feedback-search">
          <NInput
            v-model:value="search"
            size="small"
            round
            clearable
            placeholder="搜索"
          >
            <template #prefix>
              <NIcon :component="Search24Regular" :size="14" />
            </template>
          </NInput>
        </div>
        <AppButton
          variant="outline"
          size="sm"
          :icon="Filter24Regular"
          :class="{ 'tool-btn--on': rules.length }"
          @click="filterOpen = true"
        >
          筛选
          <span v-if="rules.length" class="tool-count">{{ rules.length }}</span>
        </AppButton>
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

    <p v-if="errorText" class="inline-hint inline-hint--error" role="alert">{{ errorText }}</p>

    <ConsolePanel :icon="ChatHelp24Regular" :title="`反馈列表（${items.length}）`">
      <div v-if="!items.length" class="empty-state">
        <p>{{ emptyText }}</p>
        <div class="empty-actions">
          <AppButton v-if="status" variant="outline" size="sm" @click="status = ''">
            查看全部状态
          </AppButton>
          <AppButton variant="outline" size="sm" :disabled="loading" @click="load()">
            刷新
          </AppButton>
        </div>
      </div>

      <ul v-else class="issue-list">
        <li v-for="item in items" :key="item.id">
          <button class="issue-row" type="button" @click="openDetail(item)">
            <span class="issue-kind" :class="`issue-kind--${KIND_META[item.kind]?.tone || 'info'}`" :title="kindText(item)">
              <NIcon :component="kindIcon(item)" :size="18" />
            </span>

            <span class="issue-main">
              <span class="issue-title-line">
                <span class="issue-title">{{ item.title }}</span>
                <span class="tag" :class="`tag--${PRIORITY_TONE[item.priority] || 'muted'}`">
                  {{ item.priority_label || '一般' }}
                </span>
              </span>
              <span class="issue-excerpt">{{ excerpt(item) }}</span>
              <span class="issue-meta">
                #{{ item.id }} · {{ relativeTime(item.created_at) }} · {{ statusOf(item).text }}
                <template v-if="item.created_ip"> · {{ item.created_ip }}</template>
                <template v-if="item.note"> · 已备注</template>
              </span>
            </span>

            <span v-if="imageList(item).length" class="issue-shots">
              <NIcon :component="Image24Regular" :size="14" />
              {{ imageList(item).length }}
            </span>
          </button>
        </li>
      </ul>

      <div v-if="hasMore" class="load-more-row">
        <AppButton
          variant="outline"
          size="sm"
          :disabled="loadingMore"
          @click="load({ append: true })"
        >
          {{ loadingMore ? '加载中…' : '加载更多' }}
        </AppButton>
      </div>
    </ConsolePanel>

    <FeedbackFilterModal v-model:show="filterOpen" :rules="rules" @apply="applyRules" />

    <NDrawer
      v-model:show="detail.show"
      :placement="sheetPlacement"
      :width="sheetWidth"
      :height="sheetHeight"
      :z-index="2100"
      :style="sheetStyle"
      @update:show="detail.show = $event"
    >
      <SheetHandle
        v-if="mobile"
        :show="detail.show"
        @close="detail.show = false"
      />
      <NDrawerContent
        v-if="detail.item"
        :title="`反馈详情 #${detail.item.id}`"
        closable
        :body-content-style="{ padding: '0' }"
        :footer-style="{ padding: '0' }"
        :header-style="sheetHeaderStyle"
      >
        <div class="detail">
          <div class="detail-tags">
            <span class="tag" :class="`tag--${statusOf(detail.item).tone}`">
              {{ statusOf(detail.item).text }}
            </span>
            <span class="tag" :class="`tag--${KIND_TONE[detail.item.kind] || 'muted'}`">
              {{ kindText(detail.item) }}
            </span>
          </div>

          <h2 class="detail-title">{{ detail.item.title }}</h2>
          <p class="detail-sub">{{ fullTime(detail.item.created_at) }} 提交</p>

          <section class="detail-section">
            <h3 class="section-title">反馈内容</h3>
            <!-- 纯文本渲染：内容来自访客，按 HTML 解释等于开 XSS 口子 -->
            <p class="detail-body">{{ detail.item.detail || '（没有填写详细描述）' }}</p>
          </section>

          <section v-if="imageList(detail.item).length" class="detail-section">
            <h3 class="section-title">截图</h3>
            <div class="detail-shots">
              <button
                v-for="(src, index) in imageList(detail.item)"
                :key="src"
                class="detail-shot"
                type="button"
                :title="`查看第 ${index + 1} 张截图`"
                @click="openShots(detail.item, index)"
              >
                <img :src="src" :alt="`截图 ${index + 1}`" loading="lazy" />
              </button>
            </div>
          </section>

          <section class="detail-section">
            <h3 class="section-title">处理</h3>

            <div class="form-field">
              <span class="form-label">优先级</span>
              <NSelect
                v-model:value="form.priority"
                :options="PRIORITY_OPTIONS"
                :menu-props="{ class: 'feedback-priority-menu' }"
              />
            </div>

            <div class="form-field">
              <span class="form-label">备注</span>
              <NInput
                v-model:value="form.note"
                type="textarea"
                :rows="3"
                maxlength="200"
                show-count
                placeholder="写点给下一个人看的东西：已经联系过访客、同样的问题出现过几次……"
              />
            </div>

            <div class="form-actions">
              <AppButton
                variant="solid"
                :icon="Checkmark24Regular"
                :disabled="saving"
                @click="saveReview"
              >
                {{ saving ? '保存中…' : '保存' }}
              </AppButton>
              <AppButton
                v-if="detail.item.status !== 'handled'"
                variant="outline"
                :disabled="pendingId === detail.item.id"
                @click="markHandled(detail.item)"
              >
                标记已处理
              </AppButton>
              <AppButton
                v-else
                variant="outline"
                :icon="ArrowUndo24Regular"
                :disabled="reopening"
                @click="reopen(detail.item)"
              >
                {{ reopening ? '处理中…' : '重新打开' }}
              </AppButton>
            </div>
          </section>

          <section v-if="detail.item.status === 'handled'" class="detail-section">
            <h3 class="section-title">通知访客</h3>
            <p class="notify-hint">
              处理完成后不会自动发信；确认文案后再发送。
            </p>
            <div class="notify-row">
              <span
                class="notify-state"
                :class="{
                  'notify-state--sent': ['email', 'manual'].includes(detail.item.notification_status),
                  'notify-state--failed': detail.item.notification_status === 'failed',
                }"
              >
                {{ notificationText(detail.item) }}
              </span>
              <span v-if="detail.item.notified_by" class="notify-by">
                {{ detail.item.notified_by }}
              </span>
              <div class="notify-actions">
                <AppButton
                  v-if="can('notifications.send')"
                  variant="outline"
                  size="sm"
                  :icon="Mail24Regular"
                  :disabled="notifySent(detail.item) || notifyLoadingId === detail.item.id"
                  :loading="notifyLoadingId === detail.item.id"
                  @click="openNotify(detail.item)"
                >
                  {{ notifySent(detail.item) ? '已发送' : '发送邮件' }}
                </AppButton>
                <AppButton
                  variant="outline"
                  size="sm"
                  :icon="MailProhibited24Regular"
                  :disabled="unavailableLoadingId === detail.item.id"
                  :loading="unavailableLoadingId === detail.item.id"
                  @click="markUnavailable(detail.item)"
                >
                  标记无法通知
                </AppButton>
              </div>
            </div>
          </section>

          <section class="detail-section">
            <h3 class="section-title">访客信息</h3>
            <dl class="detail-meta">
              <div class="meta-row">
                <dt>联系方式</dt>
                <dd>
                  <a v-if="isEmail(detail.item.contact)" class="meta-link" :href="`mailto:${detail.item.contact}`">
                    {{ detail.item.contact }}
                  </a>
                  <span v-else>{{ detail.item.contact }}</span>
                  <AppButton
                    variant="text"
                    size="xs"
                    icon-only
                    label="复制"
                    :icon="Copy24Regular"
                    @click="copyContact(detail.item.contact, $event.currentTarget)"
                  />
                </dd>
              </div>
              <div class="meta-row">
                <dt>页面</dt>
                <dd>{{ detail.item.page_path || '未填写' }}</dd>
              </div>
              <div class="meta-row">
                <dt>来源 IP</dt>
                <dd class="meta-code">{{ detail.item.created_ip || '未知' }}</dd>
              </div>
              <div v-if="detail.item.handled_by" class="meta-row">
                <dt>处理人</dt>
                <dd>{{ detail.item.handled_by }} · {{ fullTime(detail.item.handled_at) }}</dd>
              </div>
            </dl>
          </section>
        </div>

        <template #footer>
          <div class="detail-footer">
            <AppButton
              variant="text"
              size="sm"
              :icon="Delete24Regular"
              :disabled="pendingId === detail.item.id"
              @click="remove(detail.item)"
            >
              删除这条反馈
            </AppButton>
          </div>
        </template>
      </NDrawerContent>
    </NDrawer>

    <NotificationComposeModal
      v-model:show="notify.show"
      :title="notify.title"
      :templates="notify.templates"
      :default-event="notify.defaultEvent"
      :contact="notify.contact"
      :recipient="notify.recipient"
      :subject="notify.subject"
      :body="notify.body"
      :sending="notify.sending"
      @submit="sendNotify"
    />

    <NotificationSettingsDrawer
      v-model:show="settingsOpen"
      default-tab="feedback_handled"
    />

    <IpBanDrawer v-model:show="banOpen" />
  </div>
</template>

<style scoped>
.console-feedback {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
  min-width: 0;
}

.feedback-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
  transition: background-color 0.4s ease, border-color 0.4s ease;
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

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
  min-width: 0;
}

.feedback-search {
  flex: 1 1 220px;
  min-width: 0;
  max-width: 320px;
}

.feedback-search :deep(.n-input),
.feedback-search :deep(.n-input__border),
.feedback-search :deep(.n-input__state-border) {
  width: 100%;
  border-radius: var(--radius-full);
  corner-shape: round;
}

.toolbar-actions :deep(.app-btn) {
  flex: 0 0 auto;
}

/* 空态只占一行说明的高度，并把可执行入口放在下面，避免整页只剩一块空白 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 14px 12px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-lg);
  color: var(--subtle-foreground);
  font-size: 0.8125rem;
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

.tool-btn--on {
  border-color: var(--border-strong);
  background: var(--accent);
  color: var(--foreground);
}

.tool-count {
  min-width: 18px;
  margin-left: 2px;
  padding: 0 5px;
  border-radius: var(--radius-full);
  corner-shape: round;
  background: var(--primary);
  color: var(--primary-foreground);
  font-size: 0.75rem;
  line-height: 18px;
  text-align: center;
}

/* ===== 列表：一条条 issue，靠分隔线而不是卡片堆叠 ===== */
.issue-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.issue-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  padding: 14px 10px;
  border: none;
  border-bottom: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: transparent;
  color: inherit;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.issue-list li:last-child .issue-row {
  border-bottom: none;
}

.issue-row:hover {
  background: var(--accent);
}

.issue-kind {
  display: inline-flex;
  flex-shrink: 0;
  padding-top: 1px;
}

.issue-kind--danger {
  color: var(--destructive);
}

.issue-kind--info {
  color: var(--muted-foreground);
}

.issue-kind--warn {
  color: var(--warning);
}

.issue-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.issue-title-line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.issue-title {
  min-width: 0;
  color: var(--foreground);
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.issue-excerpt {
  color: var(--muted-foreground);
  font-size: 0.875rem;
  line-height: 1.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.issue-meta {
  color: var(--subtle-foreground);
  font-size: 0.8125rem;
  line-height: 1.5;
}

.issue-shots {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  padding-top: 2px;
  color: var(--subtle-foreground);
  font-size: 0.8125rem;
}

.load-more-row {
  display: flex;
  justify-content: center;
  padding-top: 12px;
}

/* ===== 标签 ===== */
.tag {
  flex-shrink: 0;
  padding: 1px 9px;
  border-radius: var(--radius-full);
  corner-shape: round;
  background: var(--muted);
  color: var(--muted-foreground);
  font-size: 0.75rem;
  line-height: 20px;
  white-space: nowrap;
  transition: color 0.4s ease, background-color 0.4s ease;
}

.tag--success {
  background: color-mix(in srgb, var(--success) 16%, transparent);
  color: var(--success);
}

.tag--warn {
  background: color-mix(in srgb, var(--warning) 16%, transparent);
  color: var(--warning);
}

.tag--danger {
  background: color-mix(in srgb, var(--destructive) 14%, transparent);
  color: var(--destructive);
}

.tag--info {
  background: color-mix(in srgb, var(--foreground) 8%, transparent);
  color: var(--foreground);
}

/* ===== 详情抽屉：编辑只在这里出现 ===== */

/* 全局禁选（App.vue）对抽屉整体生效，这里只给"需要复制的内容"开白名单：
   标题、反馈正文、字段值可选中；标签、字段名、时间这类装饰性文字保持不可选 */
.detail-title,
.detail-body,
.detail-meta dd {
  user-select: text !important;
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
}
.detail {
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 20px 24px 24px;
}

.detail-tags {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-id {
  margin-left: auto;
  color: var(--subtle-foreground);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
}

.detail-title {
  margin: 0;
  color: var(--foreground);
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.4;
}

.detail-sub {
  margin: -14px 0 0;
  color: var(--subtle-foreground);
  font-size: 0.8125rem;
  line-height: 1.5;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
}

/* 段落标题是父级：字号与颜色都要压过下方的表单标签，否则父子层级看不出来 */
.section-title {
  margin: 0;
  color: var(--foreground);
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.4;
}

.detail-body {
  margin: 0;
  color: var(--foreground);
  font-size: 0.9375rem;
  line-height: 1.8;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.detail-shots {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.detail-shot {
  width: 104px;
  height: 104px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--muted);
  overflow: hidden;
  cursor: zoom-in;
  transition: border-color 0.2s ease, transform 0.2s ease;
}

.detail-shot:hover {
  border-color: var(--border-strong);
  transform: translateY(-1px);
}

.detail-shot img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  color: var(--muted-foreground);
  font-size: 0.8125rem;
  font-weight: 400;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.notify-hint {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 0.8125rem;
  line-height: 1.55;
}

.notify-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.notify-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  flex-wrap: wrap;
}

.notify-state {
  padding: 1px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  corner-shape: round;
  color: var(--muted-foreground);
  font-size: 0.75rem;
  line-height: 1.7;
}

.notify-state--sent {
  border-color: color-mix(in srgb, var(--success) 35%, var(--border));
  color: var(--success);
}

.notify-state--failed {
  border-color: color-mix(in srgb, var(--danger) 35%, var(--border));
  color: var(--danger);
}

.notify-by {
  color: var(--subtle-foreground);
  font-size: 0.75rem;
}

.detail-meta {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.meta-row {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr);
  gap: 12px;
  align-items: baseline;
  font-size: 0.875rem;
  line-height: 1.6;
}

.meta-row dt {
  color: var(--subtle-foreground);
}

.meta-row dd {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--foreground);
  overflow-wrap: anywhere;
}

.meta-code {
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  font-size: 0.8125rem;
}

.meta-link {
  color: var(--foreground);
  text-decoration: none;
}

.meta-link:hover {
  text-decoration: underline;
}

.detail-footer {
  display: flex;
  justify-content: flex-start;
  padding: 12px 24px;
}

@media (width <= 640px) {
  .feedback-toolbar {
    align-items: stretch;
    gap: 8px;
  }

  .toolbar-actions {
    flex: 1 1 100%;
    flex-wrap: nowrap;
    gap: 6px;
  }

  .feedback-search {
    flex: 1 1 auto;
    max-width: none;
  }

  .feedback-search :deep(.n-input) {
    height: 30px;
  }

  .toolbar-actions :deep(.app-btn) {
    flex: 0 0 auto;
  }

  .issue-row {
    padding: 14px 4px;
    gap: 10px;
  }

  .issue-title {
    font-size: 0.9375rem;
  }

  .detail {
    padding: 16px 18px 20px;
    gap: 18px;
  }

  .detail-title {
    font-size: 1.125rem;
  }

  .detail-shot {
    width: 84px;
    height: 84px;
  }

  .meta-row {
    grid-template-columns: 68px minmax(0, 1fr);
  }
}
</style>

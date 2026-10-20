<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NIcon, useMessage } from 'naive-ui'
import {
  ArrowClockwise24Regular,
  ChatHelp24Regular,
  CheckmarkCircle24Regular,
  Copy24Regular,
  Delete24Regular,
  Mail24Regular,
} from '@vicons/fluent'
import AppModal from '../../components/ui/AppModal.vue'
import ConsolePanel from '../components/ConsolePanel.vue'
import { confirmDialog } from '../../composables/useConfirm.js'
import { copyText } from '../../utils/clipboard.js'
import { consoleFetch } from '../consoleRequest.js'

/* 访客反馈的处理队列。取数走 after + last_id 增量：反馈只增不删，
   翻页期间新提交插入队列头部也不会造成重复或漏项。 */
const LIST_URL = '/api/v1/console/feedback'
const PAGE_SIZE = 50

const FILTERS = [
  { value: 'pending', label: '待处理' },
  { value: 'handled', label: '已处理' },
  { value: '', label: '全部' },
]

const KIND_TEXT = { bug: 'BUG', suggestion: '建议', reminder: '提醒' }

const route = useRoute()
const router = useRouter()
const message = useMessage()

const items = ref([])
const filter = ref('pending')
const loading = ref(false)
const loadingMore = ref(false)
const errorText = ref('')
const lastId = ref(0)
const hasMore = ref(false)
const pendingId = ref(0)

const detail = ref({ show: false, item: null })
const preview = ref({ show: false, src: '' })

const emptyText = computed(() => (loading.value ? '读取中…' : '没有符合条件的反馈'))

function gotUnauthorized(e) {
  if (e?.code !== 'unauthorized') return false
  router.replace({ path: '/console/login', query: { redirect: route.fullPath } })
  return true
}

function kindText(item) {
  return item?.kind_label || KIND_TEXT[item?.kind] || '反馈'
}

function statusOf(item) {
  if (item?.status === 'handled') return { text: '已处理', tone: 'success' }
  return { text: '待处理', tone: 'warning' }
}

function isEmail(contact) {
  return (contact || '').includes('@')
}

function formatTime(value) {
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
    if (filter.value) params.set('status', filter.value)

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
    // 契约不带 has_more，满页就认为还有下一页：多请求一次只会拿到空列表
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

async function markHandled(item) {
  pendingId.value = item.id
  try {
    const updated = await consoleFetch(`${LIST_URL}/${item.id}/handle`, { method: 'POST' })
    Object.assign(item, updated)
    message.success('已标记为已处理')
  } catch (e) {
    if (gotUnauthorized(e)) return
    message.error(e?.message || '操作失败，请稍后重试')
  } finally {
    pendingId.value = 0
    // 待处理筛选下处理完就该从列表里消失，重拉一次比手工剔除更不容易漏状态
    await load()
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

  pendingId.value = item.id
  try {
    await consoleFetch(`${LIST_URL}/${item.id}`, { method: 'DELETE' })
    message.success('已删除')
    if (detail.value.item?.id === item.id) detail.value.show = false
  } catch (e) {
    if (gotUnauthorized(e)) return
    message.error(e?.message || '删除失败，请稍后重试')
  } finally {
    pendingId.value = 0
    await load()
  }
}

async function copyContact(contact) {
  if (!contact) return
  const ok = await copyText(contact)
  if (ok) message.success('已复制')
  else message.error('复制失败，请手动选中')
}

function openDetail(item) {
  detail.value = { show: true, item }
}

function openPreview(src) {
  preview.value = { show: true, src }
}

// 页脚动作跟着详情里的状态走：已处理的条目不再出现「标记已处理」
const detailActions = computed(() => {
  const item = detail.value.item
  const busy = !!item && pendingId.value === item.id
  const actions = []

  if (item && item.status !== 'handled') {
    actions.push({
      text: busy ? '处理中…' : '标记已处理',
      variant: 'fill',
      disabled: busy,
      onClick: () => markHandled(item),
    })
  }
  if (item) {
    actions.push({ text: '删除', variant: 'danger', disabled: busy, onClick: () => remove(item) })
  }
  actions.push({ text: '关闭', variant: 'outline', onClick: () => (detail.value.show = false) })
  return actions
})

watch(filter, () => load())

onMounted(load)
</script>

<template>
  <div class="console-feedback">
    <div class="feedback-toolbar">
      <div class="filter-group">
        <button
          v-for="option in FILTERS"
          :key="option.label"
          class="filter-pill"
          :class="{ 'filter-pill--on': filter === option.value }"
          type="button"
          @click="filter = option.value"
        >
          {{ option.label }}
        </button>
      </div>
      <button class="refresh-btn" type="button" :disabled="loading" @click="load()">
        <NIcon :component="ArrowClockwise24Regular" :size="14" />
        刷新
      </button>
    </div>

    <p v-if="errorText" class="inline-hint inline-hint--error">{{ errorText }}</p>

    <ConsolePanel :icon="ChatHelp24Regular" :title="`反馈列表（${items.length}）`">
      <p v-if="!items.length" class="inline-hint">{{ emptyText }}</p>

      <div v-else class="feedback-list">
        <article
          v-for="item in items"
          :key="item.id"
          class="feedback-card"
          role="button"
          tabindex="0"
          @click="openDetail(item)"
          @keydown.enter="openDetail(item)"
        >
          <div class="feedback-head">
            <span class="kind-pill" :class="`kind-pill--${item.kind}`">{{ kindText(item) }}</span>
            <span class="feedback-title">{{ item.title }}</span>
            <span class="status-pill" :class="`status-pill--${statusOf(item).tone}`">
              {{ statusOf(item).text }}
            </span>
            <span class="feedback-time">{{ formatTime(item.created_at) }}</span>
          </div>

          <div class="feedback-meta">
            <span class="meta-item">
              <NIcon :component="Mail24Regular" :size="12" class="meta-icon" />
              <a
                v-if="isEmail(item.contact)"
                class="meta-link"
                :href="`mailto:${item.contact}`"
                @click.stop
              >
                {{ item.contact }}
              </a>
              <button
                v-else
                class="meta-link"
                type="button"
                title="复制 QQ 号"
                @click.stop="copyContact(item.contact)"
              >
                {{ item.contact }}
                <NIcon :component="Copy24Regular" :size="11" />
              </button>
            </span>
            <span v-if="item.page_path" class="meta-item meta-path">{{ item.page_path }}</span>
          </div>

          <div class="feedback-actions">
            <button
              v-if="item.status !== 'handled'"
              class="app-btn app-btn--fill app-btn--sm action-btn"
              type="button"
              :disabled="pendingId === item.id"
              @click.stop="markHandled(item)"
            >
              <NIcon :component="CheckmarkCircle24Regular" :size="14" />
              标记已处理
            </button>
            <button
              class="app-btn app-btn--danger app-btn--sm action-btn"
              type="button"
              :disabled="pendingId === item.id"
              @click.stop="remove(item)"
            >
              <NIcon :component="Delete24Regular" :size="14" />
              删除
            </button>
          </div>
        </article>
      </div>

      <div v-if="hasMore" class="load-more-row">
        <button
          class="app-btn app-btn--outline app-btn--sm"
          type="button"
          :disabled="loadingMore"
          @click="load({ append: true })"
        >
          {{ loadingMore ? '加载中…' : '加载更多' }}
        </button>
      </div>
    </ConsolePanel>

    <AppModal
      v-model:show="detail.show"
      :title="detail.item ? detail.item.title : '反馈详情'"
      :max-width="640"
      :auto-focus="false"
      :actions="detailActions"
      content-scrollable
    >
      <div v-if="detail.item" class="detail">
        <div class="detail-tags">
          <span class="kind-pill" :class="`kind-pill--${detail.item.kind}`">
            {{ kindText(detail.item) }}
          </span>
          <span class="status-pill" :class="`status-pill--${statusOf(detail.item).tone}`">
            {{ statusOf(detail.item).text }}
          </span>
          <span class="detail-id">#{{ detail.item.id }}</span>
        </div>

        <dl class="detail-meta">
          <div>
            <dt>联系方式</dt>
            <dd>
              <a
                v-if="isEmail(detail.item.contact)"
                class="meta-link"
                :href="`mailto:${detail.item.contact}`"
              >
                {{ detail.item.contact }}
              </a>
              <button
                v-else
                class="meta-link"
                type="button"
                title="复制 QQ 号"
                @click="copyContact(detail.item.contact)"
              >
                {{ detail.item.contact }}
                <NIcon :component="Copy24Regular" :size="11" />
              </button>
            </dd>
          </div>
          <div><dt>页面路径</dt><dd>{{ detail.item.page_path || '未填写' }}</dd></div>
          <div><dt>提交时间</dt><dd>{{ formatTime(detail.item.created_at) }}</dd></div>
          <div><dt>处理人</dt><dd>{{ detail.item.handled_by || '—' }}</dd></div>
          <div><dt>处理时间</dt><dd>{{ formatTime(detail.item.handled_at) }}</dd></div>
        </dl>

        <p class="detail-label">详细描述</p>
        <!-- 纯文本渲染：内容来自访客，按 HTML 解释等于开 XSS 口子 -->
        <p class="detail-body">{{ detail.item.detail || '—' }}</p>

        <template v-if="imageList(detail.item).length">
          <p class="detail-label">截图（点击看大图）</p>
          <div class="detail-images">
            <button
              v-for="(src, index) in imageList(detail.item)"
              :key="src"
              class="detail-shot"
              type="button"
              @click="openPreview(src)"
            >
              <img :src="src" :alt="`截图 ${index + 1}`" loading="lazy" />
            </button>
          </div>
        </template>
      </div>
    </AppModal>

    <AppModal
      v-model:show="preview.show"
      title="截图"
      :max-width="960"
      :max-height-offset="96"
      :auto-focus="false"
      :actions="[{ text: '关闭', variant: 'outline', onClick: () => (preview.show = false) }]"
      content-scrollable
    >
      <img v-if="preview.src" class="preview-image" :src="preview.src" alt="截图大图" />
    </AppModal>
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

.filter-group {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.filter-pill {
  padding: 4px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  corner-shape: round;
  background: transparent;
  color: var(--muted-foreground);
  font-family: inherit;
  font-size: 0.78rem;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
}

.filter-pill:hover {
  color: var(--foreground);
}

.filter-pill--on {
  color: var(--foreground);
  border-color: var(--border-strong);
  background: var(--accent);
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  corner-shape: round;
  background: transparent;
  color: var(--muted-foreground);
  font-family: inherit;
  font-size: 0.78rem;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease;
}

.refresh-btn:hover:not(:disabled) {
  color: var(--foreground);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.feedback-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.feedback-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--muted);
  cursor: pointer;
  transition: border-color 0.3s ease, background-color 0.4s ease;
}

.feedback-card:hover {
  border-color: var(--border-strong);
}

.feedback-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.feedback-title {
  flex: 1 1 200px;
  min-width: 0;
  color: var(--foreground);
  font-size: 0.9rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.4s ease;
}

.feedback-time {
  flex-shrink: 0;
  color: var(--subtle-foreground);
  font-size: 0.74rem;
  transition: color 0.4s ease;
}

.feedback-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  min-width: 0;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  color: var(--muted-foreground);
  font-size: 0.78rem;
}

.meta-icon {
  flex-shrink: 0;
  color: var(--subtle-foreground);
}

/* 路径可能很长，允许在任意位置断行，不让它把卡片撑出横向滚动 */
.meta-path {
  overflow-wrap: anywhere;
  color: var(--subtle-foreground);
  font-size: 0.74rem;
}

.meta-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--muted-foreground);
  font-family: inherit;
  font-size: inherit;
  text-decoration: none;
  cursor: pointer;
  overflow-wrap: anywhere;
  transition: color 0.2s ease;
}

.meta-link:hover {
  color: var(--foreground);
}

.feedback-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.action-btn {
  gap: 6px;
  flex-shrink: 0;
}

.load-more-row {
  display: flex;
  justify-content: center;
  padding-top: 12px;
}

.kind-pill {
  flex-shrink: 0;
  padding: 1px 8px;
  border-radius: var(--radius-full);
  corner-shape: round;
  font-size: 0.7rem;
  transition: color 0.4s ease;
}

.kind-pill--bug {
  color: var(--destructive);
  background: color-mix(in srgb, var(--destructive) 12%, transparent);
}

.kind-pill--suggestion {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 12%, transparent);
}

.kind-pill--reminder {
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 12%, transparent);
}

.status-pill {
  flex-shrink: 0;
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

.inline-hint {
  margin: 0;
  padding: 8px 0;
  color: var(--subtle-foreground);
  font-size: 0.8rem;
  text-align: center;
}

.inline-hint--error {
  color: var(--destructive);
  text-align: left;
}

/* ===== 详情 ===== */
.detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.detail-id {
  color: var(--subtle-foreground);
  font-size: 0.72rem;
}

.detail-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 6px 16px;
  margin: 0;
  font-size: 0.78rem;
}

.detail-meta div {
  display: flex;
  gap: 8px;
  min-width: 0;
}

.detail-meta dt {
  flex-shrink: 0;
  color: var(--subtle-foreground);
}

.detail-meta dd {
  margin: 0;
  min-width: 0;
  color: var(--muted-foreground);
  overflow-wrap: anywhere;
}

.detail-label {
  margin: 0;
  color: var(--subtle-foreground);
  font-size: 0.74rem;
}

/* 滚动交给 AppModal 的 content-scrollable 统一处理，这里只负责排版 */
.detail-body {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--muted);
  color: var(--muted-foreground);
  font-size: 0.82rem;
  line-height: 1.7;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  transition: background-color 0.4s ease, border-color 0.4s ease, color 0.4s ease;
}

.detail-images {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 8px;
}

.detail-shot {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--muted);
  cursor: zoom-in;
  transition: border-color 0.2s ease, background-color 0.4s ease;
}

.detail-shot:hover {
  border-color: var(--border-strong);
}

.detail-shot img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-image {
  display: block;
  max-width: 100%;
  max-height: 68vh;
  margin: 0 auto;
  border-radius: var(--radius-md);
  object-fit: contain;
}

@media (width <= 520px) {
  .feedback-title {
    flex-basis: 100%;
  }

  .feedback-time {
    margin-left: auto;
  }
}
</style>

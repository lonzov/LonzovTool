<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NIcon, useMessage } from 'naive-ui'
import {
  ArrowClockwise24Regular,
  CheckmarkCircle24Regular,
  Delete24Regular,
  DismissCircle24Regular,
  Open24Regular,
} from '@vicons/fluent'
import AppModal from '../../components/ui/AppModal.vue'
import ConsolePanel from '../components/ConsolePanel.vue'
import { confirmDialog } from '../../composables/useConfirm.js'
import { consoleFetch } from '../consoleRequest.js'

/* 待审核队列。概览里的卡片只是预览，审核动作全部落在这个页面：
   概览的「查看」会带 ?id= 跳过来，这里定位并高亮那一条。 */
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
          ? '已通过并上架到首页卡片'
          : '已标记为通过'
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

async function remove(item) {
  const confirmed = await confirmDialog({
    title: '删除提交',
    message: `确定删除「${item.title}」这条提交记录吗？\n已上架的卡片不会被删除。`,
    confirmText: '删除',
    danger: true,
  })
  if (!confirmed) return

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
            <span class="submission-time">{{ new Date(item.created_at * 1000).toLocaleString() }}</span>
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
          </div>

          <div class="submission-actions">
            <input
              v-model="notes[item.id]"
              class="note-input"
              type="text"
              maxlength="200"
              placeholder="备注（可选，写进审核记录）"
            />
            <button
              class="app-btn app-btn--fill app-btn--sm action-btn"
              type="button"
              :disabled="pendingId === item.id"
              @click="review(item, 'approved')"
            >
              <NIcon :component="CheckmarkCircle24Regular" :size="14" />
              通过
            </button>
            <button
              class="app-btn app-btn--outline app-btn--sm action-btn"
              type="button"
              :disabled="pendingId === item.id"
              @click="review(item, 'rejected')"
            >
              <NIcon :component="DismissCircle24Regular" :size="14" />
              拒绝
            </button>
            <button
              class="app-btn app-btn--danger app-btn--sm action-btn"
              type="button"
              :disabled="pendingId === item.id"
              @click="remove(item)"
            >
              <NIcon :component="Delete24Regular" :size="14" />
              删除
            </button>
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

/* 三个动作按钮同高同宽（30px，与输入框一致），备注占剩余宽度 */
.action-btn {
  gap: 6px;
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
</style>

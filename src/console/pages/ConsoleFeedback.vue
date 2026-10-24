<script setup>
import { computed, onMounted, ref, watch } from 'vue'
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
} from '@vicons/fluent'
import ConsolePanel from '../components/ConsolePanel.vue'
import FeedbackFilterModal from '../components/FeedbackFilterModal.vue'
import { confirmDialog } from '../../composables/useConfirm.js'
import { copyText } from '../../utils/clipboard.js'
import { consoleFetch } from '../consoleRequest.js'
import { useSensitiveTrust } from '../useSensitiveTrust.js'
import { openImageLightbox } from '../useImageLightbox.js'
import { useIsMobile } from '../../composables/useIsMobile.js'

/* 访客反馈的处理队列。
   列表只做预览：一眼看清"是什么事、什么状态、要不要现在处理"；
   优先级与备注的编辑全部发生在详情抽屉里，列表不承载任何输入控件。 */
const { ensureTrust } = useSensitiveTrust()

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

const detail = ref({ show: false, item: null })
const form = ref({ priority: 'normal', note: '' })
const saving = ref(false)
const reopening = ref(false)

const emptyText = computed(() => (loading.value ? '读取中…' : '没有符合条件的反馈'))

const drawerStyle = computed(() => ({
  background: 'var(--background)',
  borderLeft: '1px solid var(--border)',
  boxShadow: 'var(--shadow-drawer)',
  ...(isMobile.value ? { borderTopLeftRadius: '0', borderBottomLeftRadius: '0' } : {}),
}))

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
          class="tab"
          :class="{ 'tab--on': status === tab.value }"
          type="button"
          @click="status = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>

      <div class="toolbar-actions">
        <button
          class="tool-btn"
          :class="{ 'tool-btn--on': rules.length }"
          type="button"
          @click="filterOpen = true"
        >
          <NIcon :component="Filter24Regular" :size="15" />
          筛选
          <span v-if="rules.length" class="tool-count">{{ rules.length }}</span>
        </button>
        <button class="tool-btn tool-btn--icon" type="button" title="刷新" :disabled="loading" @click="load()">
          <NIcon :component="ArrowClockwise24Regular" :size="16" />
        </button>
      </div>
    </div>

    <p v-if="errorText" class="inline-hint inline-hint--error">{{ errorText }}</p>

    <ConsolePanel :icon="ChatHelp24Regular" :title="`反馈列表（${items.length}）`">
      <p v-if="!items.length" class="inline-hint">{{ emptyText }}</p>

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

    <FeedbackFilterModal v-model:show="filterOpen" :rules="rules" @apply="applyRules" />

    <NDrawer
      v-model:show="detail.show"
      placement="right"
      :width="isMobile ? '100%' : 640"
      :z-index="2100"
      :style="drawerStyle"
      @update:show="detail.show = $event"
    >
      <NDrawerContent
        v-if="detail.item"
        :title="`反馈详情 #${detail.item.id}`"
        closable
        :body-content-style="{ padding: '0' }"
        :footer-style="{ padding: '0' }"
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
              <NSelect v-model:value="form.priority" :options="PRIORITY_OPTIONS" />
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
              <button class="app-btn app-btn--fill" type="button" :disabled="saving" @click="saveReview">
                <NIcon :component="Checkmark24Regular" :size="16" />
                {{ saving ? '保存中…' : '保存' }}
              </button>
              <button
                v-if="detail.item.status !== 'handled'"
                class="app-btn app-btn--outline"
                type="button"
                :disabled="pendingId === detail.item.id"
                @click="markHandled(detail.item)"
              >
                标记已处理
              </button>
              <button
                v-else
                class="app-btn app-btn--outline"
                type="button"
                :disabled="reopening"
                @click="reopen(detail.item)"
              >
                <NIcon :component="ArrowUndo24Regular" :size="16" />
                {{ reopening ? '处理中…' : '重新打开' }}
              </button>
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
                  <button
                    class="meta-copy"
                    type="button"
                    title="复制"
                    @click="copyContact(detail.item.contact, $event.currentTarget)"
                  >
                    <NIcon :component="Copy24Regular" :size="13" />
                  </button>
                </dd>
              </div>
              <div class="meta-row">
                <dt>页面</dt>
                <dd>{{ detail.item.page_path || '未填写' }}</dd>
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
            <button
              class="app-btn app-btn--text app-btn--sm detail-delete"
              type="button"
              :disabled="pendingId === detail.item.id"
              @click="remove(detail.item)"
            >
              <NIcon :component="Delete24Regular" :size="14" />
              删除这条反馈
            </button>
          </div>
        </template>
      </NDrawerContent>
    </NDrawer>
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
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--muted);
  transition: background-color 0.4s ease, border-color 0.4s ease;
}

.tab {
  padding: 5px 14px;
  border: none;
  border-radius: calc(var(--radius-md) - 3px);
  background: transparent;
  color: var(--muted-foreground);
  font-family: inherit;
  font-size: 0.875rem;
  cursor: pointer;
  transition: color 0.2s ease, background-color 0.2s ease;
}

.tab:hover {
  color: var(--foreground);
}

.tab--on {
  background: var(--card);
  color: var(--foreground);
  box-shadow: var(--shadow-sm);
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--muted-foreground);
  font-family: inherit;
  font-size: 0.875rem;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
}

.tool-btn:hover:not(:disabled) {
  border-color: var(--border-strong);
  background: var(--accent);
  color: var(--foreground);
}

.tool-btn--on {
  border-color: var(--border-strong);
  background: var(--accent);
  color: var(--foreground);
}

.tool-btn--icon {
  width: 32px;
  padding: 0;
  justify-content: center;
}

.tool-count {
  min-width: 18px;
  padding: 0 5px;
  border-radius: var(--radius-full);
  corner-shape: round;
  background: var(--primary);
  color: var(--primary-foreground);
  font-size: 0.7rem;
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

.meta-link {
  color: var(--foreground);
  text-decoration: none;
}

.meta-link:hover {
  text-decoration: underline;
}

.meta-copy {
  display: inline-flex;
  align-items: center;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--subtle-foreground);
  cursor: pointer;
  transition: color 0.2s ease;
}

.meta-copy:hover {
  color: var(--foreground);
}

.detail-footer {
  display: flex;
  justify-content: flex-start;
  padding: 12px 24px;
}

.detail-delete {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--subtle-foreground);
  font-size: 0.8125rem;
}

.detail-delete:hover:not(:disabled) {
  color: var(--destructive);
}

@media (width <= 640px) {
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

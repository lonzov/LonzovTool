<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NDatePicker, NForm, NFormItem, NIcon, NInput, useMessage } from 'naive-ui'
import {
  Add24Regular,
  ArrowClockwise24Regular,
  Delete24Regular,
  Edit24Regular,
  MegaphoneLoud24Regular,
  Open24Regular,
  ReOrderDotsVertical16Regular,
} from '@vicons/fluent'
import Sortable from 'sortablejs'
import AppModal from '../../components/ui/AppModal.vue'
import ConsolePanel from '../components/ConsolePanel.vue'
import { confirmDialog } from '../../composables/useConfirm.js'
import { consoleFetch } from '../consoleRequest.js'

const NOTICES_URL = '/api/v1/console/notices'

const DATE_SHORTCUTS = { 现在: () => Date.now() }

const route = useRoute()
const router = useRouter()
const message = useMessage()

const notices = ref([])
const loading = ref(false)
const errorText = ref('')
const pendingId = ref(0)
const reordering = ref(false)

const listEl = ref(null)
let sortable = null

const contentError = ref('')
const dateError = ref('')

const editor = ref({ show: false, editing: false, noticeId: 0, error: '' })
const form = ref({ content: '', link: '', dateAt: null })
const editorSaving = ref(false)

const emptyText = computed(() => (loading.value ? '读取中…' : '还没有公告，新建一条试试'))

/* 库里存的是带偏移的字符串（如 2026-05-24T21:32+08:00），解析不了也不能让整页垮掉 */
function parseTime(text) {
  const ts = Date.parse(text)
  return Number.isNaN(ts) ? null : ts
}

function formatTime(text) {
  const ts = parseTime(text)
  if (ts === null) return text || '—'
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
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
    const payload = await consoleFetch(NOTICES_URL)
    notices.value = payload?.items || []
  } catch (e) {
    if (gotUnauthorized(e)) return
    errorText.value = e?.message || '读取失败，请稍后重试'
  } finally {
    loading.value = false
    await nextTick()
    setupSortable()
  }
}

/* 顺序由后端存：排序结果整体回传，本地不维护第二套顺序 */
function setupSortable() {
  sortable?.destroy()
  sortable = null
  if (!listEl.value) return
  sortable = Sortable.create(listEl.value, {
    handle: '.drag-handle',
    animation: 150,
    ghostClass: 'notice-row--ghost',
    chosenClass: 'notice-row--chosen',
    onEnd: handleDragEnd,
  })
}

function orderedIds() {
  return [...listEl.value.querySelectorAll('[data-notice-id]')].map((el) =>
    Number(el.dataset.noticeId),
  )
}

async function handleDragEnd(event) {
  const { item, from, oldIndex } = event
  const ids = orderedIds()

  // Sortable 直接改了 DOM，而 Vue 的虚拟 DOM 并不知道；先把它原地挪回去，
  // 让顺序只由数据驱动。否则 keyed diff 会按旧顺序计算节点移动，和外部改过的 DOM 打架。
  from.removeChild(item)
  from.insertBefore(item, from.children[oldIndex] || null)

  const previous = notices.value.map((notice) => notice.notice_id)
  if (ids.join() === previous.join()) return

  const byId = new Map(notices.value.map((notice) => [notice.notice_id, notice]))
  notices.value = ids.map((id) => byId.get(id)).filter(Boolean)

  reordering.value = true
  // 请求在途时禁手：连着拖两次会让先发的响应把后发的顺序盖回去
  if (sortable) sortable.option('disabled', true)
  try {
    const payload = await consoleFetch(`${NOTICES_URL}/reorder`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
    notices.value = payload?.items || notices.value
    message.success('顺序已保存')
  } catch (e) {
    if (gotUnauthorized(e)) return
    message.error(e?.message || '顺序保存失败，已恢复原顺序')
    await load()
  } finally {
    reordering.value = false
    if (sortable) sortable.option('disabled', false)
  }
}

function openCreate() {
  editor.value = { show: true, editing: false, noticeId: 0, error: '' }
  form.value = { content: '', link: '', dateAt: Date.now() }
}

function openEdit(item) {
  editor.value = { show: true, editing: true, noticeId: item.notice_id, error: '' }
  form.value = {
    content: item.content,
    link: item.link,
    dateAt: parseTime(item.date),
  }
}

async function save() {
  const content = form.value.content.trim()
  contentError.value = content ? '' : '公告内容不能为空'
  dateError.value = form.value.dateAt ? '' : '请选择公告时间'
  if (contentError.value || dateError.value) return

  const payload = {
    content,
    link: form.value.link.trim(),
    // 接口只收带时区的时间点，本地墙上时间由浏览器换算成绝对时间
    date: new Date(form.value.dateAt).toISOString(),
  }

  editorSaving.value = true
  editor.value.error = ''
  try {
    if (editor.value.editing) {
      await consoleFetch(`${NOTICES_URL}/${editor.value.noticeId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      message.success('已保存修改')
    } else {
      await consoleFetch(NOTICES_URL, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      message.success('公告已发布，已排到末尾')
    }
    editor.value.show = false
  } catch (e) {
    if (gotUnauthorized(e)) return
    editor.value.error = e?.message || '保存失败，请稍后重试'
  } finally {
    editorSaving.value = false
    await load()
  }
}

async function remove(item) {
  const confirmed = await confirmDialog({
    title: '删除公告',
    message: `确定删除这条公告吗？\n「${item.content}」删除后立即从站上消失，且无法恢复。`,
    confirmText: '删除',
    danger: true,
  })
  if (!confirmed) return

  pendingId.value = item.notice_id
  try {
    await consoleFetch(`${NOTICES_URL}/${item.notice_id}`, { method: 'DELETE' })
    message.success('已删除')
  } catch (e) {
    if (gotUnauthorized(e)) return
    message.error(e?.message || '删除失败，请稍后重试')
  } finally {
    pendingId.value = 0
    await load()
  }
}

onMounted(load)

onBeforeUnmount(() => {
  sortable?.destroy()
  sortable = null
})
</script>

<template>
  <div class="console-notices">
    <div class="notices-toolbar">
      <div class="toolbar-actions">
        <button
          class="app-btn app-btn--outline app-btn--sm"
          type="button"
          :disabled="loading"
          @click="load"
        >
          <NIcon :component="ArrowClockwise24Regular" :size="14" />
          <span class="btn-label">刷新</span>
        </button>
        <button class="app-btn app-btn--fill app-btn--sm" type="button" @click="openCreate">
          <NIcon :component="Add24Regular" :size="14" />
          <span class="btn-label">新建公告</span>
        </button>
      </div>
    </div>

    <p v-if="errorText" class="inline-hint inline-hint--error">{{ errorText }}</p>

    <ConsolePanel
      :icon="MegaphoneLoud24Regular"
      title="公告列表"
      description="按住行首把手拖动即可调整顺序，松手即保存"
    >
      <p v-if="!notices.length" class="inline-hint">{{ emptyText }}</p>

      <div v-else class="notice-table" :class="{ 'notice-table--busy': reordering }">
        <div class="notice-row notice-row--head">
          <span aria-hidden="true"></span>
          <span>内容</span>
          <span>时间</span>
          <span class="col-actions">操作</span>
        </div>
        <div ref="listEl" class="notice-rows">
          <div
            v-for="item in notices"
            :key="item.notice_id"
            :data-notice-id="item.notice_id"
            class="notice-row"
          >
            <span class="drag-handle" title="按住拖动调整顺序" aria-hidden="true">
              <NIcon :component="ReOrderDotsVertical16Regular" :size="16" />
            </span>
            <div class="cell-text">
              <span class="cell-content" :title="item.content">{{ item.content }}</span>
              <a
                v-if="item.link"
                class="cell-sub"
                :href="item.link"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ item.link }}
                <NIcon :component="Open24Regular" :size="11" />
              </a>
            </div>
            <span class="cell-meta">{{ formatTime(item.date) }}</span>
            <span class="col-actions">
              <button class="icon-btn" type="button" title="编辑" @click="openEdit(item)">
                <NIcon :component="Edit24Regular" :size="14" />
              </button>
              <button
                class="icon-btn icon-btn--danger"
                type="button"
                title="删除"
                :disabled="pendingId === item.notice_id"
                @click="remove(item)"
              >
                <NIcon :component="Delete24Regular" :size="14" />
              </button>
            </span>
          </div>
        </div>
      </div>
    </ConsolePanel>

    <AppModal
      v-model:show="editor.show"
      :title="editor.editing ? '编辑公告' : '新建公告'"
      :max-width="560"
      :auto-focus="false"
      :actions="[
        { text: '取消', variant: 'outline', onClick: () => (editor.show = false) },
        { text: editorSaving ? '保存中…' : '保存', variant: 'fill', disabled: editorSaving, onClick: save },
      ]"
      content-scrollable
    >
      <NForm label-placement="top">
        <NFormItem
          label="内容"
          required
          :validation-status="contentError ? 'error' : undefined"
          :feedback="contentError || undefined"
        >
          <NInput
            v-model:value="form.content"
            type="textarea"
            maxlength="512"
            show-count
            :autosize="{ minRows: 3, maxRows: 6 }"
            placeholder="例如：宣传视频已发布，还请多多三连哦~"
          />
        </NFormItem>
        <NFormItem label="链接">
          <NInput
            v-model:value="form.link"
            maxlength="512"
            placeholder="可选。填了之后公告可以点开，以 http:// 或 https:// 开头"
          />
        </NFormItem>
        <NFormItem
          label="公告时间"
          required
          :validation-status="dateError ? 'error' : undefined"
          :feedback="dateError || undefined"
        >
          <NDatePicker
            v-model:value="form.dateAt"
            type="datetime"
            format="yyyy-MM-dd HH:mm"
            :shortcuts="DATE_SHORTCUTS"
            clearable
            placeholder="选择日期与时间"
            class="date-input"
          />
        </NFormItem>
        <p class="field-hint">
          时间决定站上显示的"多久以前"；顺序在列表里拖拽调整，新公告默认排在末尾。
        </p>
        <p v-if="editor.error" class="editor-error">{{ editor.error }}</p>
      </NForm>
    </AppModal>
  </div>
</template>

<style scoped>
.console-notices {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
  min-width: 0;
}

.notices-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-actions .app-btn {
  gap: 6px;
}

.notice-table {
  display: flex;
  flex-direction: column;
}

.notice-rows {
  display: flex;
  flex-direction: column;
}

.notice-row {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) 148px 88px;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
  transition: background-color 0.2s ease, opacity 0.2s ease;
}

.notice-row:last-child {
  border-bottom: none;
}

.notice-row--head {
  color: var(--subtle-foreground);
  font-size: 0.74rem;
  padding-bottom: 8px;
}

/* 拖拽中的占位块：留出位置并压低存在感，让插入点一眼可见 */
.notice-row--ghost {
  opacity: 0.45;
}

.notice-row--chosen {
  background: var(--muted);
}

/* 排序请求在途：整表降透明，提示此刻不要再拖 */
.notice-table--busy .notice-rows {
  opacity: 0.6;
}

.drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 28px;
  color: var(--subtle-foreground);
  cursor: grab;
  /* 触摸端在把手上起手即拖，不触发页面滚动 */
  touch-action: none;
  transition: color 0.2s ease;
}

.drag-handle:hover {
  color: var(--foreground);
}

.cell-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.cell-content {
  color: var(--foreground);
  font-size: 0.86rem;
  line-height: 1.5;
  /* 长公告只留两行，完整内容看悬停提示 */
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow-wrap: anywhere;
}

.cell-sub {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  overflow: hidden;
  color: var(--muted-foreground);
  font-size: 0.74rem;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.2s ease;
}

.cell-sub:hover {
  color: var(--foreground);
}

.cell-meta {
  color: var(--muted-foreground);
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
}

.col-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: flex-end;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease;
}

.icon-btn:hover:not(:disabled) {
  color: var(--foreground);
}

.icon-btn--danger:hover:not(:disabled) {
  color: var(--destructive);
  border-color: var(--destructive);
}

.icon-btn:disabled {
  opacity: 0.5;
  cursor: default;
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

.date-input {
  width: 100%;
  max-width: 260px;
}

.field-hint {
  margin: 0 0 4px;
  color: var(--subtle-foreground);
  font-size: 0.72rem;
  line-height: 1.5;
}

.editor-error {
  margin: 6px 0 0;
  color: var(--destructive);
  font-size: 0.8rem;
}

@media (width <= 720px) {
  .notice-row {
    grid-template-columns: 22px minmax(0, 1fr) 88px;
  }

  /* 窄屏把宽度让给内容：几时发布在行内信息密度最低，完整时间仍在编辑框里 */
  .notice-row > .cell-meta,
  .notice-row--head > span:nth-child(3) {
    display: none;
  }
}
</style>

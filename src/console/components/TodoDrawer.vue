<script setup>
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NDrawer, NDrawerContent, NIcon } from 'naive-ui'
import {
  Bug24Regular,
  ChevronRight24Regular,
  CommentNote24Regular,
  Lightbulb24Regular,
  Send24Regular,
} from '@vicons/fluent'
import { useIsMobile } from '../../composables/useIsMobile.js'
import { useMobileSheet } from '../../composables/useMobileSheet.js'
import SheetHandle from '../../components/ui/SheetHandle.vue'

/* 待办抽屉：概览上的卡片只留总数，要点开才知道具体是哪几件事。
   数据由概览页一次取回（后端已合并排序），这里只负责呈现与跳转。 */
const props = defineProps({
  show: { type: Boolean, default: false },
  counts: { type: Object, default: () => ({}) },
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  truncated: { type: Boolean, default: false },
})

const emit = defineEmits(['update:show'])

const router = useRouter()
const route = useRoute()
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

/* 抽屉是页面级浮层：换页后收起，免得它继续盖在新页面上 */
watch(
  () => route.fullPath,
  () => {
    if (props.show) emit('update:show', false)
  },
)

const KIND_LABELS = { bug: 'BUG', suggestion: '建议', reminder: '提醒' }
const KIND_ICONS = {
  bug: Bug24Regular,
  suggestion: Lightbulb24Regular,
  reminder: CommentNote24Regular,
}
const KIND_TONES = { bug: 'danger', suggestion: 'info', reminder: 'warn' }
const PRIORITY_LABELS = { urgent: '紧急', attention: '注意', duplicate: '重复' }

const total = computed(() =>
  Object.values(props.counts).reduce((sum, value) => sum + (Number(value) || 0), 0),
)

const breakdown = computed(() => {
  const parts = []
  if ('submissions_pending' in props.counts) {
    parts.push(`网址提交 ${props.counts.submissions_pending}`)
  }
  if ('feedback_pending' in props.counts) {
    parts.push(`建议反馈 ${props.counts.feedback_pending}`)
  }
  return parts.join(' · ')
})

const emptyText = computed(() => {
  if (props.loading) return '读取中…'
  if (props.error) return props.error
  return '暂无待处理事项'
})

function toneOf(item) {
  if (item.type === 'submission') return 'info'
  return KIND_TONES[item.kind] || 'info'
}

function iconOf(item) {
  if (item.type === 'submission') return Send24Regular
  return KIND_ICONS[item.kind] || CommentNote24Regular
}

function subtitleOf(item) {
  const head = item.type === 'submission' ? '网址提交' : KIND_LABELS[item.kind] || '反馈'
  return item.subtitle ? `${head} · ${item.subtitle}` : head
}

/** 相对时间：待办关心的是「等了多久」，绝对时间在详情页里看 */
function relativeTime(seconds) {
  const value = Number(seconds)
  if (!Number.isFinite(value) || value <= 0) return ''
  const diff = Date.now() / 1000 - value
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} 天前`
  return new Date(value * 1000).toLocaleDateString('zh-CN')
}

function open(item) {
  emit('update:show', false)
  const path = item.type === 'submission' ? '/console/submissions' : '/console/feedback'
  router.push({ path, query: { id: String(item.id) } })
}
</script>

<template>
  <NDrawer
    :show="show"
    :placement="sheetPlacement"
    :width="sheetWidth"
    :height="sheetHeight"
    :style="sheetStyle"
    :z-index="2100"
    @update:show="emit('update:show', $event)"
  >
    <SheetHandle v-if="mobile" :show="show" @close="emit('update:show', false)" />
    <NDrawerContent
      title="待办事项"
      closable
      :body-content-style="{ padding: '0' }"
      :header-style="sheetHeaderStyle"
    >
      <div class="todo-body">
        <div class="todo-summary">
          <span class="todo-total">{{ total }}</span>
          <span class="todo-summary-text">
            <span class="todo-summary-label">待处理</span>
            <span v-if="breakdown" class="todo-summary-breakdown">{{ breakdown }}</span>
          </span>
        </div>

        <p v-if="!items.length" class="todo-empty">{{ emptyText }}</p>

        <ul v-else class="todo-list">
          <li v-for="item in items" :key="`${item.type}-${item.id}`">
            <button class="todo-row" type="button" @click="open(item)">
              <span class="todo-icon" :class="`todo-icon--${toneOf(item)}`">
                <NIcon :component="iconOf(item)" :size="16" />
              </span>

              <span class="todo-main">
                <span class="todo-title-line">
                  <span class="todo-title">{{ item.title }}</span>
                  <span
                    v-if="PRIORITY_LABELS[item.priority]"
                    class="todo-tag"
                    :class="`todo-tag--${item.priority}`"
                  >
                    {{ PRIORITY_LABELS[item.priority] }}
                  </span>
                </span>
                <span class="todo-sub">{{ subtitleOf(item) }}</span>
              </span>

              <span class="todo-time">{{ relativeTime(item.created_at) }}</span>
              <NIcon class="todo-arrow" :component="ChevronRight24Regular" :size="14" />
            </button>
          </li>
        </ul>

        <p v-if="items.length && truncated" class="todo-more">
          只列出最近的一批，其余请到对应页面处理
        </p>
      </div>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.todo-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
}

.todo-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--muted);
  transition: background-color 0.4s ease, border-color 0.4s ease;
}

.todo-total {
  font-size: 1.7rem;
  font-weight: 700;
  line-height: 1.2;
  color: var(--foreground);
  font-variant-numeric: tabular-nums;
  transition: color 0.4s ease;
}

.todo-summary-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.todo-summary-label {
  color: var(--foreground);
  font-size: 0.84rem;
  transition: color 0.4s ease;
}

.todo-summary-breakdown {
  color: var(--subtle-foreground);
  font-size: 0.78rem;
  transition: color 0.4s ease;
}

.todo-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.todo-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 6px;
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

.todo-list li:last-child .todo-row {
  border-bottom: none;
}

.todo-row:hover {
  background: var(--accent);
}

.todo-icon {
  display: inline-flex;
  flex-shrink: 0;
}

.todo-icon--danger {
  color: var(--destructive);
}

.todo-icon--warn {
  color: var(--warning);
}

.todo-icon--info {
  color: var(--muted-foreground);
}

.todo-main {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
}

.todo-title-line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.todo-title {
  min-width: 0;
  color: var(--foreground);
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.4s ease;
}

.todo-sub {
  color: var(--subtle-foreground);
  font-size: 0.76rem;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.4s ease;
}

.todo-tag {
  flex-shrink: 0;
  padding: 0 7px;
  border-radius: var(--radius-full);
  corner-shape: round;
  font-size: 0.75rem;
  line-height: 18px;
  white-space: nowrap;
}

.todo-tag--urgent {
  color: var(--destructive);
  background: color-mix(in srgb, var(--destructive) 14%, transparent);
}

.todo-tag--attention {
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 14%, transparent);
}

.todo-tag--duplicate {
  color: var(--subtle-foreground);
  background: var(--accent);
}

.todo-time {
  flex-shrink: 0;
  color: var(--subtle-foreground);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  transition: color 0.4s ease;
}

.todo-arrow {
  flex-shrink: 0;
  color: var(--subtle-foreground);
  transition: color 0.2s ease, transform 0.2s ease;
}

.todo-row:hover .todo-arrow {
  color: var(--foreground);
  transform: translateX(2px);
}

.todo-empty,
.todo-more {
  margin: 0;
  padding: 10px 0;
  color: var(--subtle-foreground);
  font-size: 0.78rem;
  text-align: center;
  transition: color 0.4s ease;
}

.todo-more {
  padding: 4px 0 0;
  text-align: left;
}
</style>

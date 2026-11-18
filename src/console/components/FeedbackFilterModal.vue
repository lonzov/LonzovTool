<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { NInput, NSelect } from 'naive-ui'
import { Add24Regular, Dismiss24Regular } from '@vicons/fluent'
import AppButton from '../../components/ui/AppButton.vue'
import AppModal from '../../components/ui/AppModal.vue'
import { consoleFetch } from '../consoleRequest.js'

/**
 * 筛选规则编辑器。
 *
 * 交互参照 Umami 的筛选器：一行一条「字段 + 匹配方式 + 值」，彼此 AND。
 * 值不是写死的选项，而是按字段向后端要候选（带出现次数），下拉最多 7 条，
 * 所以输入即搜索——用户几乎总是靠打字而不是翻列表找到目标。
 */

const FACETS_URL = '/api/v1/console/feedback/facets'
const FACET_LIMIT = 7
const SEARCH_DEBOUNCE_MS = 200

const FIELD_OPTIONS = [
  { label: '类型', value: 'kind' },
  { label: '标题', value: 'title' },
  { label: '内容', value: 'content' },
  { label: '优先级', value: 'priority' },
  { label: '页面路径', value: 'path' },
  { label: 'IP', value: 'ip' },
  { label: '联系方式', value: 'email' },
  { label: '通知', value: 'notification' },
]

const OP_OPTIONS = {
  title: [
    { label: '等于', value: 'eq' },
    { label: '包含', value: 'contains' },
    { label: '开头是', value: 'prefix' },
    { label: '正则', value: 'regex' },
  ],
  content: [
    { label: '等于', value: 'eq' },
    { label: '包含', value: 'contains' },
    { label: '开头是', value: 'prefix' },
    { label: '正则', value: 'regex' },
  ],
  priority: [{ label: '等于', value: 'eq' }],
  notification: [{ label: '等于', value: 'eq' }],
  ip: [{ label: '匹配', value: 'eq' }],
  email: [
    { label: '等于', value: 'eq' },
    { label: '包含', value: 'contains' },
    { label: '开头是', value: 'prefix' },
  ],
  path: [
    { label: '等于', value: 'eq' },
    { label: '包含', value: 'contains' },
    { label: '开头是', value: 'prefix' },
  ],
  kind: [{ label: '等于', value: 'eq' }],
}

const PRIORITY_OPTIONS = [
  { label: '一般', value: 'normal' },
  { label: '注意', value: 'attention' },
  { label: '紧急', value: 'urgent' },
  { label: '重复', value: 'duplicate' },
]

const NOTIFICATION_OPTIONS = [
  { label: '未发', value: 'none' },
  { label: '已发', value: 'sent' },
  { label: '无法通知', value: 'unavailable' },
]

const FIXED_OPTIONS = {
  priority: PRIORITY_OPTIONS,
  notification: NOTIFICATION_OPTIONS,
}

const FACET_FIELDS = new Set(['email', 'path', 'kind'])
const FREE_TEXT_FIELDS = new Set(['title', 'content', 'ip'])

const props = defineProps({
  show: { type: Boolean, default: false },
  rules: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:show', 'apply'])

const draft = ref([])
/** 每一行的候选项、加载态与搜索词，按行索引存，互不干扰 */
const facets = ref([])
const timers = []

function blankRule() {
  return { field: 'email', op: 'eq', value: '' }
}

function resetFacets(size) {
  facets.value = Array.from({ length: size }, () => ({ options: [], loading: false }))
}

watch(
  () => props.show,
  (open) => {
    if (!open) return
    draft.value = props.rules.length
      ? props.rules.map((rule) => ({ ...rule }))
      : [blankRule()]
    resetFacets(draft.value.length)
    draft.value.forEach((_rule, index) => loadFacets(index, ''))
  },
)

function describe(option) {
  return option.count > 0 ? `${option.label}（${option.count}）` : option.label
}

function isFreeTextField(field) {
  return FREE_TEXT_FIELDS.has(field)
}

function isFacetField(field) {
  return FACET_FIELDS.has(field)
}

function valuePlaceholder(rule) {
  if (rule.field === 'ip') return 'IP、CIDR 或起止范围'
  if (rule.op === 'regex') return '输入正则表达式'
  return rule.field === 'content' ? '输入内容关键词' : '输入标题关键词'
}

async function loadFacets(index, keyword) {
  const rule = draft.value[index]
  if (!rule) return
  const state = facets.value[index]
  if (!state) return
  if (!isFacetField(rule.field)) {
    state.options = []
    return
  }

  state.loading = true
  try {
    const params = new URLSearchParams({ field: rule.field, q: keyword || '', limit: String(FACET_LIMIT) })
    const payload = await consoleFetch(`${FACETS_URL}?${params.toString()}`)
    const items = Array.isArray(payload?.items) ? payload.items : []
    state.options = items.map((item) => ({
      label: describe(item),
      value: item.value,
      count: item.count,
    }))
  } catch {
    state.options = []
  } finally {
    state.loading = false
  }
}

function scheduleSearch(index, keyword) {
  const timer = timers[index]
  if (timer) window.clearTimeout(timer)
  timers[index] = window.setTimeout(() => loadFacets(index, keyword), SEARCH_DEBOUNCE_MS)
}

onBeforeUnmount(() => {
  for (const timer of timers) window.clearTimeout(timer)
})

function changeField(index, field) {
  const rule = draft.value[index]
  rule.field = field
  rule.value = ''
  if (!OP_OPTIONS[field].some((option) => option.value === rule.op)) {
    rule.op = OP_OPTIONS[field][0].value
  }
  loadFacets(index, '')
}

function addRule() {
  if (draft.value.length >= 10) return
  draft.value.push(blankRule())
  facets.value.push({ options: [], loading: false })
  loadFacets(draft.value.length - 1, '')
}

function removeRule(index) {
  draft.value.splice(index, 1)
  facets.value.splice(index, 1)
}

function apply() {
  // 值为空的行视为未填完，直接丢弃：让用户看到"没生效"比悄悄过滤成空列表好
  emit(
    'apply',
    draft.value.filter((rule) => rule.value),
  )
  emit('update:show', false)
}

function reset() {
  draft.value = [blankRule()]
  resetFacets(1)
  loadFacets(0, '')
}

const actions = [
  { text: '重置', variant: 'outline', onClick: reset },
  { text: '取消', variant: 'outline', onClick: () => emit('update:show', false) },
  { text: '应用', variant: 'fill', onClick: apply },
]
</script>

<template>
  <AppModal
    :show="show"
    title="筛选反馈"
    :max-width="640"
    :auto-focus="false"
    :actions="actions"
    content-scrollable
    @update:show="emit('update:show', $event)"
  >
    <div class="rule-list">
      <div v-for="(rule, index) in draft" :key="index" class="rule-row">
        <NSelect
          class="rule-field"
          :value="rule.field"
          :options="FIELD_OPTIONS"
          size="small"
          @update:value="changeField(index, $event)"
        />
        <NSelect
          class="rule-op"
          v-model:value="rule.op"
          :options="OP_OPTIONS[rule.field]"
          size="small"
        />
        <NInput
          v-if="isFreeTextField(rule.field)"
          v-model:value="rule.value"
          class="rule-value"
          size="small"
          maxlength="200"
          :placeholder="valuePlaceholder(rule)"
        />
        <NSelect
          v-else-if="FIXED_OPTIONS[rule.field]"
          v-model:value="rule.value"
          class="rule-value"
          :options="FIXED_OPTIONS[rule.field]"
          size="small"
          placeholder="选择..."
        />
        <NSelect
          v-else
          class="rule-value"
          v-model:value="rule.value"
          :options="facets[index]?.options || []"
          :loading="facets[index]?.loading"
          filterable
          remote
          clearable
          size="small"
          placeholder="输入关键词搜索"
          :show-arrow="false"
          @search="scheduleSearch(index, $event)"
        />
        <AppButton
          class="rule-remove"
          variant="text"
          size="xs"
          shape="rect"
          icon-only
          label="删除这条规则"
          :icon="Dismiss24Regular"
          :disabled="draft.length === 1"
          @click="removeRule(index)"
        />
      </div>
    </div>

    <AppButton class="rule-add" variant="text" size="sm" :icon="Add24Regular" @click="addRule">
      添加规则
    </AppButton>

    <p class="rule-hint">
      多条规则同时生效；标题和内容支持正则；IP 支持单地址、CIDR 和起止范围；下拉字段只列出最常出现的 7 个值，输入关键词可缩小范围。
    </p>
  </AppModal>
</template>

<style scoped>
.rule-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rule-row {
  display: grid;
  grid-template-columns: 118px 96px minmax(0, 1fr) 32px;
  align-items: center;
  gap: 8px;
}

.rule-remove:hover:not(:disabled) {
  color: var(--destructive);
}

.rule-add :deep(.app-btn__content) {
  gap: 4px;
}

.rule-add {
  height: auto;
  gap: 4px;
  margin-top: 12px;
  padding: 4px 10px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--muted-foreground);
  font-family: inherit;
  font-size: 0.78rem;
}

.rule-add:hover {
  border-color: var(--border-strong);
  background: var(--accent);
  color: var(--foreground);
}

.rule-hint {
  margin: 10px 0 0;
  color: var(--subtle-foreground);
  font-size: 0.75rem;
  line-height: 1.6;
}

@media (width <= 640px) {
  .rule-row {
    grid-template-columns: 1fr 1fr 32px;
  }

  .rule-value {
    grid-column: 1 / -2;
  }
}
</style>

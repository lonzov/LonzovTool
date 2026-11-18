<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NDatePicker,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NInputNumber,
  NSelect,
  NSwitch,
  NTabPane,
  NTabs,
  useMessage,
} from 'naive-ui'
import {
  Add24Regular,
  ArrowClockwise24Regular,
  Delete24Regular,
  Edit24Regular,
  MegaphoneLoud24Regular,
  ReOrderDotsVertical16Regular,
} from '@vicons/fluent'
import { createConsoleSortable } from '../sortable.js'
import AppButton from '../../components/ui/AppButton.vue'
import AppModal from '../../components/ui/AppModal.vue'
import AnnouncementModal from '../../components/AnnouncementModal.vue'
import ConsolePanel from '../components/ConsolePanel.vue'
import { submitOnEnter } from '../enterSubmit.js'
import { confirmDialog } from '../../composables/useConfirm.js'
import { consoleFetch } from '../consoleRequest.js'
import { useSensitiveTrust } from '../useSensitiveTrust.js'

const { ensureTrust } = useSensitiveTrust()

const ANNOUNCEMENTS_URL = '/api/v1/console/announcements'
const ANNOUNCEMENT_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/

const CONDITION_OPTIONS = [
  { label: '灰度概率（服务端）', value: 'probability' },
  { label: '导航次数', value: 'navClicks' },
  { label: '工具打开次数', value: 'toolOpens' },
  { label: '首次打开天数', value: 'daysSinceFirstOpen' },
  { label: '当前路径', value: 'path' },
]

const OPERATOR_OPTIONS = [
  { label: '大于等于', value: 'gte' },
  { label: '小于等于', value: 'lte' },
  { label: '等于', value: 'eq' },
  { label: '包含', value: 'contains' },
]

const BUTTON_VARIANTS = [
  { label: '实心', value: 'solid' },
  { label: '描边', value: 'outline' },
  { label: '文字', value: 'text' },
]

const BUTTON_ACTIONS = [
  { label: '关闭', value: 'close' },
  { label: '关闭并记住', value: 'dismiss' },
  { label: '打开外链', value: 'link' },
  { label: '站内跳转', value: 'route' },
]

const REMEMBER_OPTIONS = [
  { label: '本会话内不再显示', value: 'session' },
  { label: '指定小时数内不显示', value: 'hours' },
  { label: '永久关闭', value: 'forever' },
  { label: '不记忆，下次仍显示', value: 'none' },
]

const BUTTON_REMEMBER_OPTIONS = [
  { label: '跟随弹窗', value: 'inherit' },
  ...REMEMBER_OPTIONS,
]

const route = useRoute()
const router = useRouter()
const message = useMessage()

const items = ref([])
const loading = ref(false)
const errorText = ref('')
const reordering = ref(false)
const listEl = ref(null)
let sortable = null

const editor = ref({ show: false, editing: false, id: '', error: '' })
const editorTab = ref('basic')
const saving = ref(false)
const form = ref(blankForm())
const previewShow = ref(false)
const previewData = ref(null)

function blankForm() {
  return {
    id: '',
    title: '',
    content: '',
    hidden: false,
    delayMs: 0,
    startsAt: null,
    endsAt: null,
    conditions: [],
    buttons: [],
    close: {
      show_close_button: true,
      mask_closable: true,
      min_seconds: 0,
      remember: 'hours',
      hours: 12,
    },
  }
}

function parseTime(text) {
  const ts = Date.parse(text)
  return Number.isNaN(ts) ? null : ts
}

function formatTime(text) {
  const ts = parseTime(text)
  if (ts === null) return '—'
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function gotUnauthorized(error) {
  if (error?.code !== 'unauthorized') return false
  router.replace({ path: '/console/login', query: { redirect: route.fullPath } })
  return true
}

async function load() {
  loading.value = true
  errorText.value = ''
  try {
    const payload = await consoleFetch(ANNOUNCEMENTS_URL)
    items.value = payload?.items || []
  } catch (error) {
    if (gotUnauthorized(error)) return
    errorText.value = error?.message || '读取失败，请稍后重试'
  } finally {
    loading.value = false
    await nextTick()
    setupSortable()
  }
}

function setupSortable() {
  sortable?.destroy()
  sortable = null
  if (!listEl.value) return
  sortable = createConsoleSortable(listEl.value, {
    handle: '.drag-handle',
    animation: 150,
    onEnd: handleDragEnd,
  })
}

function orderedIds() {
  return [...listEl.value.querySelectorAll('[data-announcement-id]')].map(
    (el) => el.dataset.announcementId,
  )
}

async function handleDragEnd(event) {
  const { item, from, oldIndex } = event
  const ids = orderedIds()
  from.removeChild(item)
  from.insertBefore(item, from.children[oldIndex] || null)

  const previous = items.value.map((entry) => entry.id)
  if (ids.join() === previous.join()) return
  if (!(await ensureTrust())) {
    await load()
    return
  }

  const byId = new Map(items.value.map((entry) => [entry.id, entry]))
  items.value = ids.map((id) => byId.get(id)).filter(Boolean)
  reordering.value = true
  if (sortable) sortable.option('disabled', true)
  try {
    const payload = await consoleFetch(`${ANNOUNCEMENTS_URL}/reorder`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
    items.value = payload?.items || items.value
    message.success('顺序已保存')
  } catch (error) {
    if (gotUnauthorized(error)) return
    message.error(error?.message || '顺序保存失败，已恢复原顺序')
    await load()
  } finally {
    reordering.value = false
    if (sortable) sortable.option('disabled', false)
  }
}

function openCreate() {
  editor.value = { show: true, editing: false, id: '', error: '' }
  editorTab.value = 'basic'
  form.value = blankForm()
}

function openEdit(item) {
  editor.value = { show: true, editing: true, id: item.id, error: '' }
  editorTab.value = 'basic'
  form.value = {
    id: item.id,
    title: item.title,
    content: item.content,
    hidden: item.hidden,
    delayMs: Number(item.delay_ms) || 0,
    startsAt: parseTime(item.starts_at),
    endsAt: parseTime(item.ends_at),
    conditions: (item.conditions || []).map((condition) => ({ ...condition })),
    buttons: (item.buttons || []).map((button) => ({
      ...button,
      remember: button.remember || 'inherit',
      hours: button.hours || 12,
    })),
    close: {
      show_close_button: true,
      mask_closable: true,
      min_seconds: 0,
      remember: 'hours',
      hours: 12,
      ...item.close,
    },
  }
}

function conditionMeta(type) {
  if (type === 'probability') {
    return { scope: 'server', operator: 'gte', value: 25, isPath: false }
  }
  if (type === 'path') {
    return { scope: 'client', operator: 'contains', value: '/', isPath: true }
  }
  return { scope: 'client', operator: 'gte', value: 1, isPath: false }
}

function addCondition() {
  if (form.value.conditions.length >= 8) return
  form.value.conditions.push({
    type: 'navClicks',
    operator: 'gte',
    value: 1,
  })
}

function onConditionTypeChange(condition, type) {
  const meta = conditionMeta(type)
  condition.type = type
  condition.operator = meta.operator
  condition.value = meta.value
}

function addButton() {
  if (form.value.buttons.length >= 3) return
  form.value.buttons.push({
    label: '我已知晓',
    variant: 'solid',
    tone: 'default',
    size: 'md',
    action: 'close',
    target: '',
    disabled_seconds: 0,
    close_on_click: true,
    remember: 'inherit',
    hours: 12,
  })
}

function onButtonActionChange(button, action) {
  if (action !== 'link' && action !== 'route') button.target = ''
}

function buildPayload() {
  const conditions = form.value.conditions.map((condition) => {
    const meta = conditionMeta(condition.type)
    const numeric = !meta.isPath
    return {
      scope: meta.scope,
      type: condition.type,
      operator: condition.operator,
      value: numeric ? Number(condition.value) || 0 : String(condition.value || '').trim(),
    }
  })
  return {
    id: form.value.id.trim() || null,
    title: form.value.title.trim(),
    content: form.value.content.trim(),
    hidden: form.value.hidden,
    delay_ms: Math.max(0, Math.min(Number(form.value.delayMs) || 0, 10000)),
    starts_at: form.value.startsAt
      ? new Date(form.value.startsAt).toISOString()
      : null,
    ends_at: form.value.endsAt ? new Date(form.value.endsAt).toISOString() : null,
    conditions,
    buttons: form.value.buttons.map((button) => ({
      ...button,
      target: button.target.trim(),
    })),
    close: { ...form.value.close },
  }
}

function formError(payload) {
  if (payload.id && !ANNOUNCEMENT_ID_RE.test(payload.id)) {
    return '公告 ID 只能使用字母、数字、下划线或短横线，且不超过 64 位'
  }
  if (!payload.title) return '标题不能为空'
  if (!payload.content) return '内容不能为空'
  if (payload.starts_at && payload.ends_at && Date.parse(payload.ends_at) <= Date.parse(payload.starts_at)) {
    return '结束时间必须晚于开始时间'
  }
  const hasClosePath =
    payload.close.show_close_button ||
    payload.close.mask_closable ||
    payload.buttons.some((button) => button.action === 'close' || button.action === 'dismiss')
  if (!hasClosePath) return '至少保留一个关闭入口：叉号、遮罩或关闭按钮'
  for (const button of payload.buttons) {
    if ((button.action === 'link' || button.action === 'route') && !button.target) {
      return `按钮「${button.label || '未命名'}」需要填写目标`
    }
  }
  return ''
}

function focusErrorTab(message) {
  if (message.includes('按钮') || message.includes('关闭入口')) editorTab.value = 'delivery'
  else if (message.includes('条件')) editorTab.value = 'conditions'
  else editorTab.value = 'basic'
}

async function save() {
  const payload = buildPayload()
  const error = formError(payload)
  editor.value.error = error
  if (error) {
    focusErrorTab(error)
    return
  }
  if (!(await ensureTrust())) return

  saving.value = true
  try {
    if (editor.value.editing) {
      await consoleFetch(`${ANNOUNCEMENTS_URL}/${editor.value.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      message.success('已保存修改')
    } else {
      await consoleFetch(ANNOUNCEMENTS_URL, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      message.success('弹窗公告已创建，已排到末尾')
    }
    editor.value.show = false
    await load()
  } catch (catchError) {
    if (gotUnauthorized(catchError)) return
    message.error(catchError?.message || '保存失败，请稍后重试')
  } finally {
    saving.value = false
  }
}

function openPreview() {
  const payload = buildPayload()
  previewData.value = {
    id: 'preview',
    title: payload.title || '公告标题',
    content: payload.content || '公告内容会显示在这里。',
    priority: 0,
    conditions: [],
    buttons: payload.buttons,
    close: payload.close,
  }
  previewShow.value = true
}

async function remove(item) {
  const confirmed = await confirmDialog({
    title: '删除弹窗公告',
    message: `确定删除「${item.title}」吗？删除后所有访客都不再看到它。`,
    confirmText: '删除',
    danger: true,
  })
  if (!confirmed) return
  if (!(await ensureTrust())) return
  try {
    await consoleFetch(`${ANNOUNCEMENTS_URL}/${item.id}`, { method: 'DELETE' })
    message.success('已删除')
    await load()
  } catch (error) {
    if (gotUnauthorized(error)) return
    message.error(error?.message || '删除失败，请稍后重试')
  }
}

onMounted(load)
onBeforeUnmount(() => {
  sortable?.destroy()
  sortable = null
})
</script>

<template>
  <div class="console-announcements">
    <div class="announcements-toolbar">
      <AppButton
        variant="outline"
        size="sm"
        :icon="ArrowClockwise24Regular"
        :disabled="loading"
        @click="load"
      >
        刷新
      </AppButton>
      <AppButton variant="solid" size="sm" :icon="Add24Regular" @click="openCreate">
        新建弹窗公告
      </AppButton>
    </div>

    <p v-if="errorText" class="inline-hint inline-hint--error" role="alert">{{ errorText }}</p>

    <ConsolePanel
      :icon="MegaphoneLoud24Regular"
      title="弹窗公告列表"
      description="按优先级从高到低展示；新公告默认排在末尾"
    >
      <p v-if="!items.length" class="inline-hint">
        {{ loading ? '读取中…' : '还没有弹窗公告，新建一条试试' }}
      </p>

      <div v-else class="announcement-table" :class="{ 'announcement-table--busy': reordering }">
        <div class="announcement-row announcement-row--head">
          <span aria-hidden="true"></span>
          <span>标题</span>
          <span>状态 / 生效时间</span>
          <span class="col-actions">操作</span>
        </div>
        <div ref="listEl" class="announcement-rows">
          <div
            v-for="item in items"
            :key="item.id"
            :data-announcement-id="item.id"
            class="announcement-row"
          >
            <span class="drag-handle" title="按住拖动调整顺序" aria-hidden="true">
              <NIcon :component="ReOrderDotsVertical16Regular" :size="16" />
            </span>
            <div class="cell-text">
              <span class="cell-title">{{ item.title }}</span>
              <span class="cell-sub">{{ item.content.replace(/[#*`>_-]/g, '').slice(0, 80) }}</span>
            </div>
            <div class="cell-meta">
              <span
                class="state-pill"
                :class="item.hidden ? 'state-pill--hidden' : 'state-pill--visible'"
              >
                {{ item.hidden ? '已隐藏' : '展示中' }}
              </span>
              <span class="cell-time">
                {{ item.starts_at ? formatTime(item.starts_at) : '立即生效' }}
                <span aria-hidden="true">·</span>
                {{ item.ends_at ? formatTime(item.ends_at) : '长期有效' }}
              </span>
            </div>
            <span class="col-actions">
              <AppButton
                variant="outline"
                size="xs"
                icon-only
                label="编辑"
                :icon="Edit24Regular"
                @click="openEdit(item)"
              />
              <AppButton
                class="row-delete"
                variant="outline"
                size="xs"
                icon-only
                label="删除"
                :icon="Delete24Regular"
                @click="remove(item)"
              />
            </span>
          </div>
        </div>
      </div>
    </ConsolePanel>

    <AppModal
      v-model:show="editor.show"
      :title="editor.editing ? '编辑弹窗公告' : '新建弹窗公告'"
      :max-width="760"
      :auto-focus="false"
      :mask-closable="false"
      animated
      :actions="[
        { text: '预览', variant: 'outline', onClick: openPreview },
        { text: '取消', variant: 'outline', onClick: () => (editor.show = false) },
        { text: saving ? '保存中…' : '保存', variant: 'fill', disabled: saving, onClick: save },
      ]"
      content-scrollable
    >
      <NForm
        label-placement="top"
        class="editor-form"
        @keydown.enter="submitOnEnter($event, save)"
      >
        <div v-if="editor.error" class="editor-error" role="alert">{{ editor.error }}</div>

        <NTabs v-model:value="editorTab" type="line" animated class="editor-tabs">
          <NTabPane name="basic" tab="基本信息">
            <section class="editor-block">
              <div class="block-head">
                <div>
                  <h3>内容</h3>
                  <p>标题和正文会直接显示在访客的弹窗里，正文支持 Markdown。</p>
                </div>
              </div>
              <NFormItem label="标题" required>
                <NInput v-model:value="form.title" maxlength="80" placeholder="弹窗标题" />
              </NFormItem>
              <NFormItem label="公告 ID">
                <NInput
                  v-model:value="form.id"
                  maxlength="64"
                  placeholder="留空自动生成，例如 survey-2026"
                />
              </NFormItem>
              <NFormItem label="内容（Markdown）" required>
                <NInput
                  v-model:value="form.content"
                  type="textarea"
                  :autosize="{ minRows: 8, maxRows: 16 }"
                  placeholder="支持 Markdown；原始 HTML 不会渲染"
                />
              </NFormItem>
            </section>

            <section class="editor-block">
              <div class="block-head">
                <div>
                  <h3>展示时间</h3>
                  <p>留空表示立即开始、长期有效。只填结束时间也可以。</p>
                </div>
              </div>
              <div class="field-grid">
                <NFormItem label="开始时间">
                  <NDatePicker
                    v-model:value="form.startsAt"
                    type="datetime"
                    clearable
                    format="yyyy-MM-dd HH:mm"
                    placeholder="立即开始"
                    class="date-input"
                  />
                </NFormItem>
                <NFormItem label="结束时间">
                  <NDatePicker
                    v-model:value="form.endsAt"
                    type="datetime"
                    clearable
                    format="yyyy-MM-dd HH:mm"
                    placeholder="长期有效"
                    class="date-input"
                  />
                </NFormItem>
              </div>
              <NFormItem label="延迟打开">
                <NInputNumber
                  v-model:value="form.delayMs"
                  :min="0"
                  :max="10000"
                  class="delay-input"
                >
                  <template #suffix>ms</template>
                </NInputNumber>
              </NFormItem>
              <div class="rule-row">
                <div>
                  <div class="rule-title">暂时隐藏</div>
                  <div class="rule-desc">隐藏后访客不再看到这条公告，配置和关闭记录仍保留。</div>
                </div>
                <NSwitch v-model:value="form.hidden" />
              </div>
            </section>
          </NTabPane>

          <NTabPane name="conditions" tab="展示条件">
            <section class="editor-block">
              <div class="block-head">
                <div>
                  <h3>筛选访客</h3>
                  <p>多个条件全部满足才展示。</p>
                </div>
                <AppButton
                  variant="outline"
                  size="sm"
                  :icon="Add24Regular"
                  :disabled="form.conditions.length >= 8"
                  @click="addCondition"
                >
                  添加条件
                </AppButton>
              </div>

              <div v-if="!form.conditions.length" class="empty-state">
                当前没有条件，所有访客都会看到这条公告。
              </div>

              <div
                v-for="(condition, index) in form.conditions"
                :key="index"
                class="condition-card"
              >
                <div class="card-head">
                  <span class="card-index">条件 {{ index + 1 }}</span>
                  <AppButton
                    variant="text"
                    size="xs"
                    icon-only
                    label="删除条件"
                    :icon="Delete24Regular"
                    @click="form.conditions.splice(index, 1)"
                  />
                </div>
                <div class="field-grid field-grid--3">
                  <NFormItem label="条件类型">
                    <NSelect
                      :value="condition.type"
                      :options="CONDITION_OPTIONS"
                      @update:value="(value) => onConditionTypeChange(condition, value)"
                    />
                  </NFormItem>
                  <NFormItem label="判断">
                    <NSelect
                      v-model:value="condition.operator"
                      :options="
                        condition.type === 'path'
                          ? OPERATOR_OPTIONS.filter((item) => ['eq', 'contains'].includes(item.value))
                          : OPERATOR_OPTIONS.filter((item) => ['gte', 'lte'].includes(item.value))
                      "
                    />
                  </NFormItem>
                  <NFormItem label="值">
                    <NInput
                      v-if="condition.type === 'path'"
                      v-model:value="condition.value"
                      placeholder="/docs"
                    />
                    <NInputNumber
                      v-else
                      v-model:value="condition.value"
                      :min="0"
                      :max="condition.type === 'probability' ? 100 : undefined"
                    >
                      <template #suffix>
                        {{ condition.type === 'probability' ? '%' : '' }}
                      </template>
                    </NInputNumber>
                  </NFormItem>
                </div>
                <p v-if="condition.type === 'probability'" class="field-note">
                  按访客匿名 ID 稳定分桶，比例指大约多少比例的访客会看到。
                </p>
              </div>
            </section>
          </NTabPane>

          <NTabPane name="delivery" tab="按钮与关闭">
            <section class="editor-block">
              <div class="block-head">
                <div>
                  <h3>按钮</h3>
                  <p>最多 3 个；动作由站点执行，不支持任意脚本。</p>
                </div>
                <AppButton
                  variant="outline"
                  size="sm"
                  :icon="Add24Regular"
                  :disabled="form.buttons.length >= 3"
                  @click="addButton"
                >
                  添加按钮
                </AppButton>
              </div>

              <div v-if="!form.buttons.length" class="empty-state">
                没有按钮时，访客只能通过叉号或遮罩关闭弹窗。
              </div>

              <div v-for="(button, index) in form.buttons" :key="index" class="button-card">
                <div class="card-head">
                  <span class="card-index">按钮 {{ index + 1 }}</span>
                  <AppButton
                    variant="text"
                    size="xs"
                    icon-only
                    label="删除按钮"
                    :icon="Delete24Regular"
                    @click="form.buttons.splice(index, 1)"
                  />
                </div>

                <div class="field-grid field-grid--3">
                  <NFormItem label="文字">
                    <NInput
                      v-model:value="button.label"
                      maxlength="20"
                      placeholder="按钮文字"
                    />
                  </NFormItem>
                  <NFormItem label="样式">
                    <NSelect v-model:value="button.variant" :options="BUTTON_VARIANTS" />
                  </NFormItem>
                  <NFormItem label="动作">
                    <NSelect
                      :value="button.action"
                      :options="BUTTON_ACTIONS"
                      @update:value="(value) => onButtonActionChange(button, value)"
                    />
                  </NFormItem>
                </div>

                <NFormItem
                  v-if="button.action === 'link' || button.action === 'route'"
                  :label="button.action === 'link' ? '外链地址' : '站内路径'"
                >
                  <NInput
                    v-model:value="button.target"
                    :placeholder="button.action === 'link' ? 'https://…' : '/console'"
                  />
                </NFormItem>

                <div class="field-grid field-grid--3">
                  <NFormItem label="点击前锁定">
                    <NInputNumber
                      v-model:value="button.disabled_seconds"
                      :min="0"
                      :max="5"
                    >
                      <template #suffix>秒</template>
                    </NInputNumber>
                  </NFormItem>
                  <NFormItem label="关闭后记住">
                    <NSelect
                      v-model:value="button.remember"
                      :options="BUTTON_REMEMBER_OPTIONS"
                    />
                  </NFormItem>
                  <NFormItem v-if="button.remember === 'hours'" label="隐藏小时数">
                    <NInputNumber v-model:value="button.hours" :min="1" :max="8760" />
                  </NFormItem>
                </div>

                <div
                  v-if="button.action === 'link' || button.action === 'route'"
                  class="rule-row rule-row--compact"
                >
                  <div>
                    <div class="rule-title">点击后关闭弹窗</div>
                    <div class="rule-desc">跳转成功后不再停留在公告上。</div>
                  </div>
                  <NSwitch v-model:value="button.close_on_click" />
                </div>
              </div>
            </section>

            <section class="editor-block">
              <div class="block-head">
                <div>
                  <h3>关闭规则</h3>
                  <p>至少保留一个关闭入口：叉号、遮罩或关闭按钮。</p>
                </div>
              </div>

              <div class="rule-row">
                <div>
                  <div class="rule-title">显示右上角关闭叉号</div>
                  <div class="rule-desc">访客可以随时点叉号关闭弹窗。</div>
                </div>
                <NSwitch v-model:value="form.close.show_close_button" />
              </div>
              <div class="rule-row">
                <div>
                  <div class="rule-title">允许点击遮罩 / ESC 关闭</div>
                  <div class="rule-desc">关闭遮罩点击与键盘 Esc 两种快捷关闭方式。</div>
                </div>
                <NSwitch v-model:value="form.close.mask_closable" />
              </div>

              <div class="field-grid">
                <NFormItem label="整个弹窗最少显示">
                  <NInputNumber v-model:value="form.close.min_seconds" :min="0" :max="5">
                    <template #suffix>秒</template>
                  </NInputNumber>
                </NFormItem>
                <NFormItem label="关闭后记住">
                  <NSelect v-model:value="form.close.remember" :options="REMEMBER_OPTIONS" />
                </NFormItem>
                <NFormItem v-if="form.close.remember === 'hours'" label="隐藏小时数">
                  <NInputNumber v-model:value="form.close.hours" :min="1" :max="8760" />
                </NFormItem>
              </div>
            </section>
          </NTabPane>
        </NTabs>
      </NForm>
    </AppModal>

    <AnnouncementModal
      :show="previewShow"
      :announcement="previewData"
      preview
      @close="previewShow = false"
    />
  </div>
</template>

<style scoped>
.console-announcements {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
  min-width: 0;
}

.announcements-toolbar {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.announcement-table {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: opacity 0.2s ease;
}

.announcement-table--busy {
  opacity: 0.65;
  pointer-events: none;
}

.announcement-row {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) minmax(190px, 230px) 92px;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-bottom: 1px solid var(--border);
}

.announcement-row:last-child {
  border-bottom: none;
}

.announcement-row--head {
  background: var(--muted);
  color: var(--subtle-foreground);
  font-size: 0.75rem;
}

.drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--subtle-foreground);
  cursor: grab;
}

.cell-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.cell-title {
  overflow: hidden;
  color: var(--foreground);
  font-size: 0.86rem;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-sub {
  overflow: hidden;
  color: var(--subtle-foreground);
  font-size: 0.75rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.cell-time {
  overflow: hidden;
  color: var(--subtle-foreground);
  font-size: 0.75rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.state-pill {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 1px 8px;
  border-radius: var(--radius-full);
  corner-shape: round;
  font-size: 0.75rem;
  line-height: 1.6;
}

.state-pill--visible {
  background: color-mix(in srgb, var(--success) 12%, transparent);
  color: var(--success);
}

.state-pill--hidden {
  background: var(--muted);
  color: var(--subtle-foreground);
}

.col-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

/* 列表内删除只保留中性外观，危险色推迟到确认弹窗 */
.row-delete:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--destructive) 45%, var(--border));
  color: var(--destructive);
}

.editor-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.editor-error {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--destructive) 35%, transparent);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--destructive) 8%, transparent);
  color: var(--destructive);
  font-size: 0.8rem;
  line-height: 1.6;
}

.editor-tabs :deep(.n-tab-pane) {
  padding-top: 14px;
}

.editor-block {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--muted) 55%, transparent);
}

.editor-block + .editor-block {
  margin-top: 14px;
}

.block-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.block-head h3 {
  margin: 0;
  color: var(--foreground);
  font-size: 0.9rem;
  font-weight: 600;
}

.block-head p {
  margin: 4px 0 0;
  color: var(--subtle-foreground);
  font-size: 0.76rem;
  line-height: 1.6;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;
}

.field-grid--3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.field-grid :deep(.n-form-item) {
  margin-bottom: 0;
}

.field-grid :deep(.n-form-item-label) {
  font-size: 0.78rem;
}

.date-input {
  width: 100%;
}

.delay-input {
  width: 180px;
}

.rule-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.rule-row--compact {
  padding-top: 10px;
}

.rule-title {
  color: var(--foreground);
  font-size: 0.82rem;
}

.rule-desc {
  margin-top: 3px;
  color: var(--subtle-foreground);
  font-size: 0.75rem;
  line-height: 1.6;
}

.condition-card,
.button-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card);
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.card-index {
  color: var(--muted-foreground);
  font-size: 0.76rem;
  font-weight: 500;
}

.empty-state {
  padding: 18px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  color: var(--subtle-foreground);
  font-size: 0.8rem;
  line-height: 1.6;
  text-align: center;
}

.field-note {
  margin: 0;
  color: var(--subtle-foreground);
  font-size: 0.75rem;
  line-height: 1.6;
}

@media (width <= 720px) {
  .announcement-row--head {
    display: none;
  }

  .announcement-row {
    grid-template-areas:
      'drag title actions'
      'drag meta meta';
    grid-template-columns: 24px minmax(0, 1fr) auto;
    row-gap: 6px;
    column-gap: 10px;
    padding: 12px;
  }

  .drag-handle {
    grid-area: drag;
    align-self: center;
  }

  .cell-text {
    grid-area: title;
  }

  .cell-title {
    white-space: normal;
  }

  .cell-sub {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    white-space: normal;
  }

  .cell-meta {
    grid-area: meta;
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }

  .cell-time {
    flex: 1 1 auto;
  }

  .col-actions {
    grid-area: actions;
    align-self: start;
  }

  .field-grid,
  .field-grid--3 {
    grid-template-columns: minmax(0, 1fr);
  }

  .editor-block {
    padding: 12px;
  }
}

@media (width <= 640px) {
  .block-head {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>

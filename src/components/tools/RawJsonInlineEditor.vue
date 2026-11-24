<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { NInput, NSelect } from 'naive-ui'
import {
  Add16Filled, ArrowDown24Regular, ArrowUp24Regular, Color24Regular, Delete24Regular,
} from '@vicons/fluent'
import AppButton from '../ui/AppButton.vue'
import {
  createElement, data, encodeEscapes, getElementKey, getElPreviewText, getElType, getElTypeClass, getElTypeLabel,
  lastAddedEl, validationResult,
  openColorTable, processEscapes, resetElementType, touchInline,
} from '../../composables/useRawJsonEditor.js'
import { reduceMotion } from '../../composables/useMotion.js'
import {
  HEIGHT_EASE, HEIGHT_MS, animateRowIn, animateRowOut, createRowSwap, nextFrames,
} from '../../utils/listMotion.js'

/**
 * 桌面端就地编辑器：直接编辑传入的元素对象，没有「保存」这一步，
 * 每次改动都写回数据并刷新预览与 JSON。移动端的美化弹窗保持原样。
 */
const props = defineProps({
  /** 被编辑的元素对象（data 中的那一份，不是副本） */
  el: { type: Object, required: true },
  /** 0 = 顶层元素；1 = with.rawtext 内的元素，不再向下开放对象型 with，避免自相似嵌套 */
  depth: { type: Number, default: 0 },
})

const TYPE_OPTIONS = [
  { label: '文本', value: 'text' },
  { label: '选择器', value: 'selector' },
  { label: '记分板', value: 'score' },
  { label: '翻译键', value: 'translate' },
]

const type = computed(() => getElType(props.el))
const elIndex = computed(() => data.value.indexOf(props.el))
const elIssues = computed(() => (elIndex.value < 0
  ? []
  : validationResult.value.errors.filter(error => error.idx === elIndex.value)))
/** 失焦后才标红；已有错误的元素打开编辑时直接带上标记，新建的空元素先不标 */
const touchedFields = ref(new Set(
  lastAddedEl.value === props.el ? [] : elIssues.value.map(error => error.field),
))

function markTouched(field) {
  touchedFields.value = new Set(touchedFields.value).add(field)
}

function fieldError(field) {
  if (!touchedFields.value.has(field)) return ''
  return elIssues.value.find(error => error.field === field)?.msg || ''
}

const fieldStatus = field => (fieldError(field) ? 'error' : undefined)
const primaryRef = ref(null)

// 导入或历史数据里 score 可能是残缺对象，绑到不存在的字段会在渲染期抛错
if (type.value === 'score' && (!props.el.score || typeof props.el.score !== 'object')) {
  props.el.score = { name: '@s', objective: '' }
}

const textDraft = ref('')

function syncTextDraft() {
  const raw = typeof props.el.text === 'string' ? props.el.text : String(props.el.text ?? '')
  textDraft.value = encodeEscapes(raw)
}

syncTextDraft()

/**
 * 数据里存真实换行，编辑框按转义序列展示（\n 等），与弹窗编辑同一套约定。
 * 输入即时解析写回元素，预览与命令输出才会跟着变。
 */
function onTextInput(value) {
  textDraft.value = value
  props.el.text = processEscapes(value)
  touchInline()
}


function setProp(key, value) {
  props.el[key] = value
  touchInline()
}

function setScoreProp(key, value) {
  props.el.score[key] = value
  touchInline()
}

function changeType(next) {
  resetElementType(props.el, next)
  syncTextDraft()
  nextTick(focusPrimary)
}

function focusPrimary() {
  // NInput 的 focus() 不带 preventScroll，浏览器会把外层滚动容器（展开中的编辑区）滚出一截，
  // 展开动画里内容就会错位。这里直接聚焦内部字段并显式关掉自动滚动，定位交给列表自己的平滑滚动
  const root = primaryRef.value?.$el ?? primaryRef.value
  const input = root?.querySelector?.('textarea, input')
  input?.focus?.({ preventScroll: true })
}

// ========== 内部列表的过渡 ==========
// 与左侧元素条同一套节奏：新增展开、删除收起渐隐、上下移动用位移互换、展开编辑区高度渐开
const rootRef = ref(null)
const withBodyRef = ref(null)
const nestedSwap = createRowSwap()
/** 本次新增的嵌套元素：它的编辑区入场动画让位给整行的高度动画 */
let insertingNestedKey = null

function nestedNodeOf(key) {
  return rootRef.value?.querySelector(`[data-nested-key="${key}"]`) || null
}

function paramNodeOf(id) {
  return rootRef.value?.querySelector(`[data-param-key="${id}"]`) || null
}

function enterNestedEditor(el, done) {
  const key = el.closest('.rj-nested')?.dataset.nestedKey
  if (reduceMotion.value || key === insertingNestedKey) {
    done()
    return
  }
  el.style.height = '0px'
  el.style.opacity = '0'
  void el.offsetHeight
  nextFrames(2).then(() => {
    if (!el.isConnected) {
      el.style.height = ''
      el.style.opacity = ''
      done()
      return
    }
    const height = el.scrollHeight
    el.animate(
      [{ height: '0px', opacity: 0 }, { height: `${height}px`, opacity: 1 }],
      { duration: HEIGHT_MS, easing: HEIGHT_EASE },
    )
      .finished.catch(() => {})
      .finally(() => {
        el.style.height = ''
        el.style.opacity = ''
        done()
      })
  })
}

function leaveNestedEditor(el, done) {
  if (reduceMotion.value) {
    done()
    return
  }
  const height = el.offsetHeight
  if (height <= 0) {
    done()
    return
  }
  el.animate(
    [{ height: `${height}px`, opacity: 1 }, { height: '0px', opacity: 0 }],
    { duration: HEIGHT_MS, easing: HEIGHT_EASE },
  )
    .finished.catch(() => {})
    .finally(done)
}

// ========== translate 的 with ==========
const withMode = computed(() => {
  if (Array.isArray(props.el.with)) return 'array'
  if (props.el.with && Array.isArray(props.el.with.rawtext)) return 'object'
  return 'array'
})
const canUseObjectWith = computed(() => props.depth === 0)
const withParams = computed(() => (Array.isArray(props.el.with) ? props.el.with : []))
const nestedEls = computed(() => (withMode.value === 'object' ? props.el.with.rawtext : []))

/** 参数行只有字符串，没有对象标识，增删动画要给每行配一个稳定 key */
let paramIdSeq = 0
const paramIds = ref([])

function syncParamIds() {
  const total = withParams.value.length
  while (paramIds.value.length < total) paramIds.value.push(++paramIdSeq)
  if (paramIds.value.length > total) paramIds.value.length = total
}

watch(() => withParams.value.length, syncParamIds, { immediate: true })

async function setWithMode(mode) {
  if (withMode.value === mode) return
  touchInline()
  const body = withBodyRef.value
  const from = body ? body.offsetHeight : 0
  props.el.with = mode === 'array' ? [] : { rawtext: [] }
  nestedEditKey.value = null
  await nextTick()
  const target = withBodyRef.value
  if (!target || reduceMotion.value) return
  const to = target.offsetHeight
  target.style.overflow = 'hidden'
  target.style.height = `${from}px`
  void target.offsetHeight
  target.animate(
    [{ height: `${from}px`, opacity: 0.35 }, { height: `${to}px`, opacity: 1 }],
    { duration: HEIGHT_MS, easing: HEIGHT_EASE },
  )
    .finished.catch(() => {})
    .finally(() => {
      target.style.overflow = ''
      target.style.height = ''
    })
}

async function addWithParam() {
  touchInline()
  if (!Array.isArray(props.el.with)) props.el.with = []
  props.el.with.push('')
  await nextTick()
  const node = paramNodeOf(paramIds.value[paramIds.value.length - 1])
  if (node) animateRowIn(node)
}

function setWithParam(index, value) {
  props.el.with[index] = value
  touchInline()
}

// ========== with.rawtext 内的嵌套元素 ==========
// 用稳定 key 记录展开项而不是下标：增删与上下移动时不会串行
const nestedEditKey = ref(null)

function isNestedEditing(nested) {
  return nestedEditKey.value === getElementKey(nested)
}

function toggleNestedEdit(nested) {
  const key = getElementKey(nested)
  nestedEditKey.value = nestedEditKey.value === key ? null : key
}

async function addNestedEl() {
  touchInline()
  if (!Array.isArray(props.el.with?.rawtext)) props.el.with = { rawtext: [] }
  props.el.with.rawtext.push(createElement('text'))
  // 从数组里读回来的才是响应式代理，key 必须取同一份，否则展开态对不上模板里的行
  const added = props.el.with.rawtext[props.el.with.rawtext.length - 1]
  const key = getElementKey(added)
  insertingNestedKey = key
  nestedEditKey.value = key
  await nextTick()
  const node = nestedNodeOf(key)
  if (node) await animateRowIn(node)
  insertingNestedKey = null
}

async function moveNested(index, dir) {
  const list = nestedEls.value
  const target = dir === 'up' ? index - 1 : index + 1
  if (target < 0 || target >= list.length) return
  touchInline()
  const fromNode = nestedNodeOf(getElementKey(list[index]))
  const toNode = nestedNodeOf(getElementKey(list[target]))
  const fromTopBefore = fromNode?.getBoundingClientRect().top
  const toTopBefore = toNode?.getBoundingClientRect().top
  const temp = list[index]
  list[index] = list[target]
  list[target] = temp
  if (reduceMotion.value || !fromNode || !toNode) return
  await nextTick()
  nestedSwap.play(fromNode, toNode, fromTopBefore, toTopBefore)
}

// ========== 二次点击确认删除 ==========
const pendingRemove = ref('')
let removeTimer = null

function requestRemove(key, apply) {
  if (pendingRemove.value === key) {
    clearTimeout(removeTimer)
    pendingRemove.value = ''
    touchInline()
    apply()
    return
  }
  clearTimeout(removeTimer)
  pendingRemove.value = key
  removeTimer = setTimeout(() => { pendingRemove.value = '' }, 5000)
}

function removeParam(index) {
  requestRemove(`param:${index}`, async () => {
    await animateRowOut(paramNodeOf(paramIds.value[index]))
    paramIds.value.splice(index, 1)
    props.el.with.splice(index, 1)
  })
}

function removeNested(index) {
  const nested = nestedEls.value[index]
  requestRemove(`nested:${index}`, async () => {
    await animateRowOut(nestedNodeOf(getElementKey(nested)))
    if (isNestedEditing(nested)) nestedEditKey.value = null
    props.el.with.rawtext.splice(index, 1)
  })
}

onMounted(() => nextTick(focusPrimary))
onBeforeUnmount(() => {
  clearTimeout(removeTimer)
  nestedSwap.cancel()
})
</script>

<template>
  <div ref="rootRef" class="rj-edit" :class="{ 'rj-edit--nested': depth > 0 }">
    <div class="rj-edit-head">
      <NSelect
        :value="type"
        :options="TYPE_OPTIONS"
        size="small"
        class="rj-edit-type"
        @update:value="changeType"
      />
      <AppButton
        v-if="type === 'text'"
        variant="text"
        size="xs"
        :icon="Color24Regular"
        @click="openColorTable"
      >
        颜色表
      </AppButton>
    </div>

    <!-- 文本：按转义序列编辑（\n 换行），嵌套元素与顶层、弹窗保持同一套约定 -->
    <template v-if="type === 'text'">
      <NInput
        ref="primaryRef"
        type="textarea"
        size="small"
        class="rj-edit-mono"
        :value="textDraft"
        :autosize="{ minRows: 2, maxRows: 6 }"
        placeholder="支持 § 颜色代码，使用 \n 换行"
        spellcheck="false"
        :status="fieldStatus('text')"
        @update:value="onTextInput"
        @blur="markTouched('text')"
      />
      <p v-if="fieldError('text')" class="rj-edit-error">{{ fieldError('text') }}</p>
    </template>

    <!-- 选择器 -->
    <NInput
      v-else-if="type === 'selector'"
      ref="primaryRef"
      size="small"
      class="rj-edit-mono"
      :value="el.selector"
      placeholder="@p"
      spellcheck="false"
      :status="fieldStatus('selector')"
      @update:value="value => setProp('selector', value)"
      @blur="markTouched('selector')"
    />
    <p v-if="fieldError('selector')" class="rj-edit-error">{{ fieldError('selector') }}</p>

    <!-- 记分板 -->
    <div v-else-if="type === 'score'" class="rj-edit-pair">
      <div class="rj-edit-field">
        <span class="rj-edit-label">记分项</span>
        <NInput
          ref="primaryRef"
          size="small"
          class="rj-edit-mono"
          :value="el.score.objective"
          placeholder="money"
          spellcheck="false"
          :status="fieldStatus('score.objective')"
          @update:value="value => setScoreProp('objective', value)"
          @blur="markTouched('score.objective')"
        />
        <p v-if="fieldError('score.objective')" class="rj-edit-error">{{ fieldError('score.objective') }}</p>
      </div>
      <div class="rj-edit-field">
        <span class="rj-edit-label">目标</span>
        <NInput
          size="small"
          class="rj-edit-mono"
          :value="el.score.name"
          placeholder="@s"
          spellcheck="false"
          :status="fieldStatus('score.name')"
          @update:value="value => setScoreProp('name', value)"
          @blur="markTouched('score.name')"
        />
        <p v-if="fieldError('score.name')" class="rj-edit-error">{{ fieldError('score.name') }}</p>
      </div>
    </div>

    <!-- 翻译键 -->
    <template v-else-if="type === 'translate'">
      <div class="rj-edit-field">
        <span class="rj-edit-label">键名</span>
        <NInput
          ref="primaryRef"
          size="small"
          class="rj-edit-mono"
          :value="el.translate"
          placeholder="tile.stone.name"
          spellcheck="false"
          :status="fieldStatus('translate')"
          @update:value="value => setProp('translate', value)"
          @blur="markTouched('translate')"
        />
        <p v-if="fieldError('translate')" class="rj-edit-error">{{ fieldError('translate') }}</p>
      </div>

      <div class="rj-edit-with">
        <div class="rj-edit-with-head">
          <span class="rj-edit-label">With 参数</span>
          <div v-if="canUseObjectWith" class="rj-seg">
            <button
              v-for="option in [{ label: '列表', value: 'array' }, { label: '对象', value: 'object' }]"
              :key="option.value"
              class="rj-seg-btn"
              :class="{ 'rj-seg-btn--active': withMode === option.value }"
              @click="setWithMode(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <p v-if="fieldError('with')" class="rj-edit-error">{{ fieldError('with') }}</p>
        <div ref="withBodyRef" class="rj-edit-with-body">
        <!-- [...] 列表：一项一个槽位，空串也占位，%1/%2 的对应关系才与游戏一致 -->
        <template v-if="withMode === 'array'">
          <div v-if="withParams.length === 0" class="rj-edit-empty">没有参数</div>
          <div
            v-for="(param, i) in withParams"
            :key="paramIds[i]"
            :data-param-key="paramIds[i]"
            class="rj-edit-param"
          >
            <span class="rj-edit-param-index">{{ i + 1 }}</span>
            <NInput
              size="small"
              class="rj-edit-mono"
              :value="param"
              :placeholder="`参数 ${i + 1}`"
              spellcheck="false"
              @update:value="value => setWithParam(i, value)"
            />
            <AppButton
              variant="text"
              size="xs"
              icon-only
              :icon="Delete24Regular"
              :label="`删除参数 ${i + 1}`"
              :class="{ 'confirm-destructive': pendingRemove === `param:${i}` }"
              @click="removeParam(i)"
            />
          </div>
          <AppButton variant="text" size="xs" :icon="Add16Filled" @click="addWithParam">
            添加参数
          </AppButton>
        </template>

        <!-- {...} 对象：with.rawtext 里再放元素，行内展开继续编辑 -->
        <template v-else>
          <div v-if="nestedEls.length === 0" class="rj-edit-empty">没有元素</div>
          <div
            v-for="(nested, i) in nestedEls"
            :key="getElementKey(nested)"
            :data-nested-key="getElementKey(nested)"
            class="rj-nested"
          >
            <div
              class="rj-nested-row"
              :class="{ 'rj-nested-row--active': isNestedEditing(nested) }"
              @click="toggleNestedEdit(nested)"
            >
              <span class="rj-edit-param-index">{{ i + 1 }}</span>
              <span class="rj-nested-badge" :class="getElTypeClass(nested)">{{ getElTypeLabel(nested) }}</span>
              <span class="rj-nested-text">{{ getElPreviewText(nested) }}</span>
              <div class="rj-nested-actions" @click.stop>
                <AppButton
                  variant="text"
                  size="xs"
                  icon-only
                  :icon="ArrowUp24Regular"
                  label="上移"
                  :disabled="i === 0"
                  @click="moveNested(i, 'up')"
                />
                <AppButton
                  variant="text"
                  size="xs"
                  icon-only
                  :icon="ArrowDown24Regular"
                  label="下移"
                  :disabled="i === nestedEls.length - 1"
                  @click="moveNested(i, 'down')"
                />
                <AppButton
                  variant="text"
                  size="xs"
                  icon-only
                  :icon="Delete24Regular"
                  :label="pendingRemove === `nested:${i}` ? '再次点击确认删除' : '删除'"
                  :class="{ 'confirm-destructive': pendingRemove === `nested:${i}` }"
                  @click="removeNested(i)"
                />
              </div>
            </div>
            <Transition :css="false" @enter="enterNestedEditor" @leave="leaveNestedEditor">
              <div v-if="isNestedEditing(nested)" class="rj-nested-editor-wrap" @click.stop>
                <RawJsonInlineEditor :el="nested" :depth="depth + 1" class="rj-nested-editor" />
              </div>
            </Transition>
          </div>
          <AppButton variant="text" size="xs" :icon="Add16Filled" @click="addNestedEl">
            添加元素
          </AppButton>
        </template>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.rj-edit {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
  transition: border-color 0.4s ease;
}
.rj-edit--nested {
  margin-top: 8px;
  padding-top: 8px;
  padding-left: 10px;
  border-top: none;
  border-left: 2px solid var(--border);
}

.rj-edit-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.rj-edit-type { width: 108px; flex-shrink: 0; }

.rj-edit-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.rj-edit-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.rj-edit-error {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  letter-spacing: 0.2px;
  color: var(--destructive);
}
.rj-edit-label {
  font-size: 12px;
  font-weight: 400;
  color: var(--muted-foreground);
  transition: color 0.4s ease;
}
.rj-edit-mono :deep(.n-input__input-el),
.rj-edit-mono :deep(.n-input__textarea-el) {
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: 13px;
  line-height: 1.7;
}

/* with 段：与元素字段区分开，右侧分栏用细线收口 */
.rj-edit-with {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px dashed var(--border);
  transition: border-color 0.4s ease;
}
.rj-edit-with-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.rj-edit-with-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rj-edit-empty {
  font-size: 12px;
  color: var(--muted-foreground);
  transition: color 0.4s ease;
}
.rj-edit-param { display: flex; align-items: center; gap: 6px; }
.rj-edit-param-index {
  width: 14px;
  flex-shrink: 0;
  text-align: right;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--muted-foreground);
  transition: color 0.4s ease;
}

/* 分段切换：两档并排，选中态用反色块 */
.rj-seg {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: var(--radius-sm);
  background: var(--muted);
  transition: background-color 0.4s ease;
}
.rj-seg-btn {
  padding: 3px 10px;
  border: none;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--muted-foreground);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.rj-seg-btn:hover { color: var(--foreground); }
.rj-seg-btn--active {
  background: var(--card);
  color: var(--foreground);
}
[data-theme='dark'] .rj-seg-btn--active { background: var(--card); }

/* 嵌套元素行：与左侧元素条同一套语言，整体低一档厚度 */
.rj-nested { display: flex; flex-direction: column; }
.rj-nested-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 6px 5px 2px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color 0.15s ease;
}
.rj-nested-row:hover { background: var(--accent); }
.rj-nested-row--active {
  background: var(--accent);
  box-shadow: inset 2px 0 0 var(--foreground);
}
.rj-nested-badge {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: var(--radius-xs);
  font-size: 11px;
  font-weight: 500;
  transition: background-color 0.4s ease, color 0.4s ease;
}
.rj-nested-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: 12px;
  color: var(--foreground);
  transition: color 0.4s ease;
}
.rj-nested-actions { display: flex; gap: 2px; flex-shrink: 0; }
.rj-nested-editor { margin-left: 4px; }
.rj-nested-editor-wrap {
  /* clip 而不是 hidden：隐藏的溢出框仍可被聚焦滚走，展开/收起时内容会错位 */
  overflow: clip;
}
</style>

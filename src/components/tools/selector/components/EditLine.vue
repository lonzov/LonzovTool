<template>
  <div class="code-line code-line--editing" @click.stop>
    <span class="code-key code-key--editing">{{ getParamKey(param) }}</span>
    <span class="code-eq">=</span>

    <div class="code-edit-area">
      <!-- text / text-not -->
      <template v-if="editor === 'text' || editor === 'text-not'">
        <div
          v-if="editor === 'text-not'"
          class="not-toggle"
          :class="{ 'not-active': editNot }"
          @mousedown.prevent="editNot = !editNot"
          title="反选"
        >
          !
        </div>
        <NInput
          v-model:value="editValue"
          size="tiny"
          class="code-edit-input"
          :style="inputWidthStyle(editValue)"
          :placeholder="editor === 'text-not' ? '实体类型' : '值'"
          @keydown="handleKeydown"
        />
      </template>

      <!-- name -->
      <template v-if="editor === 'name'">
        <div
          class="not-toggle"
          :class="{ 'not-active': editNot }"
          @mousedown.prevent="editNot = !editNot"
          title="反选"
        >
          !
        </div>
        <span class="code-quote">"</span>
        <NInput
          v-model:value="editValue"
          size="tiny"
          class="code-edit-input code-edit-input--name"
          :style="inputWidthStyle(editValue, { min: 100 })"
          placeholder="实体名称"
          @keydown="handleKeydown"
        />
        <span class="code-quote">"</span>
      </template>

      <!-- tag -->
      <template v-if="editor === 'tag'">
        <div
          class="not-toggle"
          :class="{ 'not-active': editNot }"
          @mousedown.prevent="editNot = !editNot"
          title="反选"
        >
          !
        </div>
        <NInput
          v-model:value="editValue"
          size="tiny"
          class="code-edit-input"
          :style="inputWidthStyle(editValue)"
          placeholder="标签"
          @keydown="handleKeydown"
        />
      </template>

      <!-- gamemode -->
      <template v-if="editor === 'gamemode'">
        <NSelect
          v-model:value="editValue"
          :options="GAMEMODE_OPTIONS"
          size="tiny"
          class="code-edit-select"
        />
      </template>

      <!-- scores / has_property -->
      <template v-if="editor === 'scores' || editor === 'has_property'">
        <span class="code-brace">{</span>
        <NInput
          v-model:value="editValue"
          size="tiny"
          class="code-edit-input code-edit-input--brace"
          :style="inputWidthStyle(editValue, { min: 120, max: 300 })"
          :placeholder="editor === 'scores' ? 'a=1..,b=2' : 'property=value'"
          @keydown="handleKeydown"
        />
        <span class="code-brace">}</span>
      </template>

      <!-- hasitem -->
      <template v-if="editor === 'hasitem'">
        <span class="code-value--static">{{ hasitemParts.prefix }}</span>
        <button
          class="code-edit-hasitem-btn code-edit-hasitem-btn--inline"
          @click="openHasitem"
        >
          <NIcon :component="Edit24Filled" :size="13" />
        </button>
        <span class="code-value--static">{{ hasitemParts.suffix }}</span>
      </template>

      <!-- haspermission -->
      <template v-if="editor === 'haspermission'">
        <span class="code-value--static">{{ haspermissionParts.prefix }}</span>
        <button
          class="code-edit-hasitem-btn code-edit-hasitem-btn--inline"
          @click="openHaspermission"
        >
          <NIcon :component="Edit24Filled" :size="13" />
        </button>
        <span class="code-value--static">{{ haspermissionParts.suffix }}</span>
      </template>

    </div>

    <div class="code-edit-actions">
      <button class="code-edit-confirm-btn" title="确认" @click="commitCurrentState">
        <NIcon :component="Checkmark24Filled" :size="18" />
      </button>
      <button
        class="code-edit-delete-btn"
        :class="{ 'code-delete-confirmed': deleteConfirmId === param.id }"
        :title="deleteConfirmId === param.id ? '再次点击确认删除' : '删除参数'"
        @click.stop="deleteParam(param.id)"
      >
        <NIcon :component="Delete24Filled" :size="18" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { NIcon, NSelect, NInput } from 'naive-ui'
import { Checkmark24Filled, Edit24Filled, Delete24Filled } from '@vicons/fluent'
import { GAMEMODE_OPTIONS, PARAM_KINDS } from '../constants.js'
import {
  editNot,
  editValue,
  deleteConfirmId,
} from '../composables/useState.js'
import { getParamKey } from '../composables/useParams.js'
import { getParamValueText } from '../composables/useOutput.js'
import {
  saveEdit,
  cancelEdit,
  openHasitemEditor,
  openHaspermissionEditor,
  commitCurrentState,
  deleteParam,
} from '../composables/useParams.js'

const props = defineProps({
  param: { type: Object, required: true },
})

function resolveEditor(p) {
  if (p.kind === 'custom') return 'text'
  return (PARAM_KINDS[p.kind] && PARAM_KINDS[p.kind].editor) || 'text'
}
const editor = resolveEditor(props.param)

const hasitemParts = computed(() => {
  const text = getParamValueText(props.param)
  if (!text || text.length < 2) return { prefix: text || '', suffix: '' }
  const lastChar = text.slice(-1)
  if (lastChar === '}' || lastChar === ']') {
    return { prefix: text.slice(0, -1), suffix: lastChar }
  }
  return { prefix: text, suffix: '' }
})

function openHasitem() {
  openHasitemEditor(props.param.id)
  cancelEdit()
}

const haspermissionParts = computed(() => {
  const text = getParamValueText(props.param)
  if (!text || text.length < 2) return { prefix: text || '', suffix: '' }
  const lastChar = text.slice(-1)
  if (lastChar === '}' || lastChar === ']') {
    return { prefix: text.slice(0, -1), suffix: lastChar }
  }
  return { prefix: text, suffix: '' }
})

function openHaspermission() {
  openHaspermissionEditor(props.param.id)
  cancelEdit()
}

function inputWidthStyle(val, opts = {}) {
  const min = opts.min ?? 80
  const extra = opts.extra ?? 2
  const len = String(val ?? '').length
  return { width: `max(${min}px, ${len + extra}ch)`, maxWidth: '100%' }
}

function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    saveEdit()
  }
  if (e.key === 'Escape') cancelEdit()
}
</script>

<style scoped>
.code-line {
  display: flex;
  align-items: center;
  gap: 0;
  min-height: 34px;
  padding-right: 36px;
  position: relative;
}
.code-line.code-line--editing {
  display: flex;
  width: calc(100% - 28px);
  align-items: center;
  height: 36px;
  box-sizing: border-box;
  margin-left: 28px;
  margin-top: 1px;
  margin-bottom: 1px;
  border-radius: 6px;
  padding: 0 8px 0 8px;
  background: var(--bg-sub);
  border: 1px solid var(--border-color);
  transition:
    background-color 0.4s ease,
    border-color 0.4s ease;
}

.code-key {
  color: var(--text-primary);
  font-weight: 500;
  transition: color 0.4s ease;
  flex-shrink: 0;
}
.code-eq {
  color: var(--text-tertiary);
  margin: 0 0.35em;
  transition: color 0.4s ease;
  flex-shrink: 0;
}
.code-edit-area {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

/* 编辑区内 NInput / NSelect / NCascader 统一高度 28px，输入文字放大 */
.code-edit-area :deep(.n-input) {
  height: 28px !important;
  --n-height: 28px !important;
}
.code-edit-area :deep(.n-input__input-el) {
  font-size: 14px;
  padding: 2px 0px;
}
.code-edit-area :deep(.n-base-selection) {
  height: 28px !important;
  --n-height: 28px !important;
}

.code-edit-input {
  width: auto;
  min-width: 80px;
  max-width: 100%;
}
.code-edit-input--name {
  min-width: 100px;
  max-width: 100%;
}
.code-edit-input--key {
  min-width: 70px;
  max-width: 100%;
}
.code-edit-input--brace {
  min-width: 120px;
  max-width: 100%;
}

.code-edit-select {
  min-width: 140px;
  max-width: 100%;
}

.code-quote {
  color: var(--text-secondary);
  flex-shrink: 0;
  transition: color 0.4s ease;
}
.code-brace {
  color: var(--text-tertiary);
  flex-shrink: 0;
  transition: color 0.4s ease;
}

.code-value--static {
  color: var(--text-primary);
  font-size: 13px;
  transition: color 0.4s ease;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.code-edit-hasitem-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border: 1px dashed var(--border-color);
  background: transparent;
  color: var(--text-secondary);
  font-size: 11px;
  font-family: inherit;
  border-radius: 5px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease;
}
.code-edit-hasitem-btn:hover {
  border-color: var(--text-secondary);
  color: var(--text-primary);
}
.code-edit-hasitem-btn--inline {
  padding: 1px 5px;
  margin: 0 2px;
  gap: 0;
  font-size: 10px;
  vertical-align: middle;
}

.code-edit-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  margin-left: 8px;
}

.code-edit-confirm-btn,
.code-edit-delete-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background-color 0.12s ease,
    color 0.12s ease,
    transform 0.12s ease;
}
.code-edit-confirm-btn:hover,
.code-edit-delete-btn:hover {
  background: var(--bg-sub);
  color: var(--text-primary);
}
.code-edit-confirm-btn:active,
.code-edit-delete-btn:active {
  transform: scale(0.95);
}
.code-delete-confirmed,
.code-delete-confirmed:hover {
  background: #dc2626 !important;
  color: #fff !important;
  opacity: 1 !important;
}

/* 反选开关 */
.not-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  padding-bottom: 1px;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
  border: 1px dashed var(--border-color);
  transition:
    border-color 0.15s ease,
    color 0.15s ease;
}
.not-toggle:hover {
  border-color: var(--text-secondary);
  color: var(--text-primary);
}
.not-active {
  color: #dc2626 !important;
  border: 1px solid #dc2626 !important;
  background: rgba(220, 38, 38, 0.08) !important;
}

@media (max-width: 640px) {
  .code-line.code-line--editing {
    display: flex;
    margin-left: 16px;
    width: calc(100% - 16px);
    padding-right: 0;
  }
  .code-edit-area {
    flex: 1;
    min-width: 0;
  }
  .code-edit-input,
  .code-edit-input--name,
  .code-edit-input--key,
  .code-edit-input--brace,
  .code-edit-select {
    flex: 1;
    min-width: 0;
    width: auto !important;
    max-width: none;
  }
  .code-edit-input--brace {
    min-width: 80px;
  }
}
</style>

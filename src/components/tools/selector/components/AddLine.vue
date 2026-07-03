<template>
  <div class="code-line code-line--editing code-line--adding" @click.stop>
    <div class="code-edit-area">
      <n-dropdown
        placement="bottom-start"
        trigger="click"
        size="small"
        :options="kindDropdownOptions"
        @select="handleKindSelect"
        :style="{
          '--n-color': 'var(--bg-card)',
          '--n-text-color': 'var(--text-primary)',
          '--n-icon-color': 'var(--text-secondary)',
          '--n-divider-color': 'var(--border-color)',
          '--n-option-color-hover': 'var(--bg-sub)',
          '--n-option-color-active': 'var(--bg-sub)',
          '--n-group-header-color': 'var(--text-secondary)',
        }"
      >
        <div class="kind-trigger">
          <span>{{ kindLabel || '参数类型' }}</span>
          <NIcon :component="ChevronDown20Filled" :size="12" />
        </div>
      </n-dropdown>

      <!-- custom -->
      <template v-if="newKind === 'custom'">
        <span class="code-eq">=</span>
        <NInput
          v-model:value="newCustomKey"
          size="tiny"
          class="code-edit-input code-edit-input--key"
          :style="inputWidthStyle(newCustomKey, { min: 70, max: 140 })"
          placeholder="参数名"
          @keydown="handleKeydown"
        />
        <span class="code-eq">=</span>
        <NInput
          v-model:value="newValue"
          size="tiny"
          class="code-edit-input"
          :style="inputWidthStyle(newValue)"
          placeholder="值"
          @keydown="handleKeydown"
        />
      </template>

      <!-- text / text-not -->
      <template v-else-if="addingKindEditor === 'text' || addingKindEditor === 'text-not'">
        <span class="code-eq">=</span>
        <div
          v-if="addingKindEditor === 'text-not'"
          class="not-toggle"
          :class="{ 'not-active': newNot }"
          @mousedown.prevent="newNot = !newNot"
          title="反选"
        >
          !
        </div>
        <NInput
          v-model:value="newValue"
          size="tiny"
          class="code-edit-input"
          :style="inputWidthStyle(newValue)"
          :placeholder="addingKindEditor === 'text-not' ? '实体类型' : '值'"
          @keydown="handleKeydown"
        />
      </template>

      <!-- name -->
      <template v-else-if="addingKindEditor === 'name'">
        <span class="code-eq">=</span>
        <div
          class="not-toggle"
          :class="{ 'not-active': newNot }"
          @mousedown.prevent="newNot = !newNot"
          title="反选"
        >
          !
        </div>
        <span class="code-quote">"</span>
        <NInput
          v-model:value="newValue"
          size="tiny"
          class="code-edit-input code-edit-input--name"
          :style="inputWidthStyle(newValue, { min: 100 })"
          placeholder="实体名称"
          @keydown="handleKeydown"
        />
        <span class="code-quote">"</span>
      </template>

      <!-- tag -->
      <template v-else-if="addingKindEditor === 'tag'">
        <span class="code-eq">=</span>
        <div
          class="not-toggle"
          :class="{ 'not-active': newNot }"
          @mousedown.prevent="newNot = !newNot"
          title="反选"
        >
          !
        </div>
        <NInput
          v-model:value="newValue"
          size="tiny"
          class="code-edit-input"
          :style="inputWidthStyle(newValue)"
          placeholder="标签"
          @keydown="handleKeydown"
        />
      </template>

      <!-- gamemode -->
      <template v-else-if="addingKindEditor === 'gamemode'">
        <span class="code-eq">=</span>
        <NSelect
          v-model:value="newValue"
          :options="GAMEMODE_OPTIONS"
          size="tiny"
          class="code-edit-select"
        />
      </template>

      <!-- scores / has_property -->
      <template v-else-if="addingKindEditor === 'scores' || addingKindEditor === 'has_property'">
        <span class="code-eq">=</span>
        <span class="code-brace">{</span>
        <NInput
          v-model:value="newValue"
          size="tiny"
          class="code-edit-input code-edit-input--brace"
          :style="inputWidthStyle(newValue, { min: 120, max: 300 })"
          :placeholder="addingKindEditor === 'scores' ? 'a=1..,b=2' : 'property=value'"
          @keydown="handleKeydown"
        />
        <span class="code-brace">}</span>
      </template>

      <!-- hasitem -->
      <template v-else-if="addingKindEditor === 'hasitem'">
        <span class="code-eq">=</span>
        <span class="code-value--static">{{ hasitemAddParts.prefix }}</span>
        <button
          class="code-edit-hasitem-btn code-edit-hasitem-btn--inline"
          @click="openHasitemAddModal"
        >
          <NIcon :component="Edit24Filled" :size="13" />
        </button>
        <span class="code-value--static">{{ hasitemAddParts.suffix }}</span>
      </template>

      <!-- haspermission -->
      <template v-else-if="addingKindEditor === 'haspermission'">
        <span class="code-eq">=</span>
        <span class="code-value--static">{{ haspermissionAddParts.prefix }}</span>
        <button
          class="code-edit-hasitem-btn code-edit-hasitem-btn--inline"
          @click="openHaspermissionAddModal"
        >
          <NIcon :component="Edit24Filled" :size="13" />
        </button>
        <span class="code-value--static">{{ haspermissionAddParts.suffix }}</span>
      </template>
    </div>

    <button class="code-edit-confirm-btn" title="确认添加" @click="commitCurrentState">
      <NIcon :component="Checkmark24Filled" :size="18" />
    </button>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { NIcon, NInput, NSelect, NDropdown } from 'naive-ui'
import { Checkmark24Filled, ChevronDown20Filled, Edit24Filled } from '@vicons/fluent'
import { PARAM_KINDS, GAMEMODE_OPTIONS, kindDropdownOptions } from '../constants.js'
import {
  newKind,
  newCustomKey,
  newValue,
  newNot,
  newHasitemItems,
  newHasitemIsArray,
  newPermCamera,
  newPermMovement,
} from '../composables/useState.js'
import { confirmAdd, cancelAdd, openHasitemAddModal, openHaspermissionAddModal, openCoordCalcModal, commitCurrentState } from '../composables/useParams.js'

const addingKindEditor = computed(() => {
  if (newKind.value === 'custom') return 'text'
  return (PARAM_KINDS[newKind.value] && PARAM_KINDS[newKind.value].editor) || 'text'
})

function inputWidthStyle(val, opts = {}) {
  const min = opts.min ?? 80
  const extra = opts.extra ?? 2
  const len = String(val ?? '').length
  return { width: `max(${min}px, ${len + extra}ch)`, maxWidth: '100%' }
}

function handleKindSelect(key) {
  if (key === 'auto_calc') {
    openCoordCalcModal()
    return
  }
  newKind.value = key
}

const kindLabel = computed(() => {
  if (!newKind.value) return null
  if (newKind.value === 'custom') return '自定义'
  return (PARAM_KINDS[newKind.value] && PARAM_KINDS[newKind.value].label) || newKind.value
})

function formatHasitemAddText() {
  const items = newHasitemItems.value
  if (!items || items.length === 0) return newHasitemIsArray.value ? '[]' : '{}'
  if (newHasitemIsArray.value) {
    const inner = items.map(it => {
      const parts = []
      if (it.item) parts.push(`item=${it.item}`)
      if (it.data) parts.push(`data=${it.data}`)
      if (it.location) parts.push(`location=${it.location}`)
      if (it.slot) parts.push(`slot=${it.slot}`)
      if (it.quantity) parts.push(`quantity=${it.quantity}`)
      return '{' + parts.join(',') + '}'
    })
    return '[' + inner.join(',') + ']'
  }
  const parts = []
  if (items[0].item) parts.push(`item=${items[0].item}`)
  if (items[0].data) parts.push(`data=${items[0].data}`)
  if (items[0].location) parts.push(`location=${items[0].location}`)
  if (items[0].slot) parts.push(`slot=${items[0].slot}`)
  if (items[0].quantity) parts.push(`quantity=${items[0].quantity}`)
  return '{' + parts.join(',') + '}'
}

const hasitemAddParts = computed(() => {
  const text = formatHasitemAddText()
  if (!text || text.length < 2) return { prefix: text || '', suffix: '' }
  const lastChar = text.slice(-1)
  if (lastChar === '}' || lastChar === ']') {
    return { prefix: text.slice(0, -1), suffix: lastChar }
  }
  return { prefix: text, suffix: '' }
})

const haspermissionAddParts = computed(() => {
  const parts = []
  if (newPermCamera.value) parts.push(`camera=${newPermCamera.value}`)
  if (newPermMovement.value) parts.push(`movement=${newPermMovement.value}`)
  const text = '{' + parts.join(',') + '}'
  if (text.length < 2) return { prefix: text, suffix: '' }
  return { prefix: text.slice(0, -1), suffix: '}' }
})

watch(newKind, () => {
  newValue.value = ''
  newNot.value = false
  newHasitemItems.value = []
  newHasitemIsArray.value = false
  newPermCamera.value = null
  newPermMovement.value = null
  newCustomKey.value = ''
})

function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    confirmAdd()
  }
  if (e.key === 'Escape') cancelAdd()
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
.code-edit-area {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}
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
.kind-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  user-select: none;
  font-size: 13px;
  color: var(--text-primary);
  transition: color 0.4s ease;
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
.code-eq {
  color: var(--text-tertiary);
  margin: 0 0.35em;
  transition: color 0.4s ease;
  flex-shrink: 0;
}
.code-quote {
  color: var(--text-secondary);
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

.code-brace {
  color: var(--text-tertiary);
  flex-shrink: 0;
  transition: color 0.4s ease;
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

.code-edit-confirm-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 5px;
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  margin-left: 8px;
  transition:
    background-color 0.12s ease,
    color 0.12s ease;
}
.code-edit-confirm-btn:hover {
  background: var(--bg-sub);
  color: var(--text-primary);
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
  .code-edit-select,
  .perm-select {
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

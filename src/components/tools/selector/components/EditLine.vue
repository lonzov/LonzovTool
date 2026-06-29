<template>
  <div class="code-line code-line--editing" @click.stop>
    <span class="code-key code-key--editing">{{ getParamKey(param) }}</span>
    <span class="code-eq"> = </span>

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
        <span class="code-brace">{</span>
        <div class="perm-edit-group">
          <label class="perm-label">camera</label>
          <NSelect
            v-model:value="editPermCamera"
            :options="PERM_VALUE_OPTIONS"
            size="tiny"
            class="perm-select"
            :clearable="true"
            placeholder="未设置"
          />
        </div>
        <div class="perm-edit-group">
          <label class="perm-label">movement</label>
          <NSelect
            v-model:value="editPermMovement"
            :options="PERM_VALUE_OPTIONS"
            size="tiny"
            class="perm-select"
            :clearable="true"
            placeholder="未设置"
          />
        </div>
        <span class="code-brace">}</span>
      </template>

      <!-- custom -->
      <template v-if="param.kind === 'custom'">
        <NInput
          v-model:value="editCustomKey"
          size="tiny"
          class="code-edit-input code-edit-input--key"
          placeholder="参数名"
          @keydown="handleKeydown"
        />
        <span class="code-eq">=</span>
        <NInput
          v-model:value="editValue"
          size="tiny"
          class="code-edit-input"
          placeholder="值"
          @keydown="handleKeydown"
        />
      </template>
    </div>

    <button class="code-edit-confirm-btn" title="确认" @click="commitCurrentState">
      <NIcon :component="Checkmark24Filled" :size="14" />
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { NIcon, NSelect, NInput } from 'naive-ui'
import { Checkmark24Filled, Edit24Filled } from '@vicons/fluent'
import { GAMEMODE_OPTIONS, PERM_VALUE_OPTIONS, PARAM_KINDS } from '../constants.js'
import {
  editNot,
  editValue,
  editCustomKey,
  editPermCamera,
  editPermMovement,
} from '../composables/useState.js'
import { getParamKey } from '../composables/useParams.js'
import { getParamValueText } from '../composables/useOutput.js'
import {
  saveEdit,
  cancelEdit,
  openHasitemEditor,
  commitCurrentState,
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
.code-line--editing {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  height: 39px;
  box-sizing: border-box;
  margin-left: 28px;
  margin-top: 1px;
  margin-bottom: 1px;
  border-radius: 6px;
  padding: 0 8px;
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
  margin: 0 2px;
  transition: color 0.4s ease;
  flex-shrink: 0;
}
.code-edit-area {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 编辑区内 NInput / NSelect / NCascader 统一高度 31px */
.code-edit-area :deep(.n-input) {
  height: 31px !important;
  --n-height: 31px !important;
}
.code-edit-area :deep(.n-base-selection) {
  height: 31px !important;
  --n-height: 31px !important;
}

.code-edit-input {
  width: auto;
  min-width: 80px;
  max-width: 200px;
}
.code-edit-input--name {
  min-width: 100px;
}
.code-edit-input--key {
  min-width: 70px;
  max-width: 140px;
}
.code-edit-input--brace {
  min-width: 120px;
  max-width: 240px;
}

.code-edit-select {
  min-width: 140px;
  max-width: 200px;
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

/* 反选开关 */
.not-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-tertiary);
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
  border: 1px solid transparent;
  transition:
    color 0.15s ease,
    background-color 0.15s ease,
    border-color 0.15s ease;
}
.not-toggle:hover {
  color: var(--text-primary);
  background: var(--bg-card);
}
.not-active {
  color: #dc2626 !important;
  border-color: #dc2626 !important;
  background: rgba(220, 38, 38, 0.08) !important;
}

/* haspermission */
.perm-edit-group {
  display: flex;
  align-items: center;
  gap: 3px;
}
.perm-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  transition: color 0.4s ease;
  flex-shrink: 0;
}
.perm-select {
  min-width: 110px;
}

@media (max-width: 640px) {
  .code-line--editing {
    margin-left: 16px;
    width: auto;
  }
  .code-edit-input {
    min-width: 60px;
    max-width: 140px;
  }
  .code-edit-input--brace {
    min-width: 80px;
    max-width: 160px;
  }
}
</style>

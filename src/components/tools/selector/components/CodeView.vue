<template>
  <div class="code-card">
    <div class="code-view" @click.self="commitCurrentState">
      <!-- 头部行: 选择器 + [ -->
      <div class="code-line code-line--header">
        <NSelect
          v-model:value="selectorType"
          :options="SELECTOR_OPTIONS"
          size="small"
          class="selector-select"
        />
        <span class="code-bracket"> [</span>
      </div>

      <!-- 参数行 -->
      <template v-for="p in params" :key="p.id">
        <!-- 显示模式 -->
        <ParamLine
          v-if="editingId !== p.id"
          :param="p"
          @edit="beginEdit"
        />

        <!-- 编辑模式 -->
        <EditLine
          v-else
          :param="p"
        />
      </template>

      <!-- 添加表单行 -->
      <AddLine v-if="addingParam" />

      <!-- 添加参数按钮 -->
      <div class="code-line code-line--add">
        <button class="add-param-btn" @click="handleStartAdd">
          <NIcon :component="Add16Filled" :size="13" />
          <span>添加参数</span>
        </button>
      </div>

      <!-- 尾部 ] -->
      <div class="code-line code-line--footer">
        <span class="code-bracket">]</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { NIcon, NSelect } from 'naive-ui'
import { Add16Filled } from '@vicons/fluent'
import { SELECTOR_OPTIONS } from '../constants.js'
import {
  selectorType,
  params,
  editingId,
  addingParam,
} from '../composables/useState.js'
import {
  beginEdit,
  commitCurrentState,
  startAdd,
} from '../composables/useParams.js'
import ParamLine from './ParamLine.vue'
import EditLine from './EditLine.vue'
import AddLine from './AddLine.vue'

function handleStartAdd() {
  commitCurrentState()
  startAdd()
}
</script>

<style scoped>
.code-card {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e0e0e0;
  padding: 20px 24px;
  transition:
    background-color 0.4s ease,
    border-color 0.4s ease;
  overflow-x: auto;
}
[data-theme='dark'] .code-card {
  background: #191919;
  border-color: #2b2b2b;
}

.code-view {
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: 14px;
  line-height: 2.2;
  color: var(--text-primary);
  transition: color 0.4s ease;
}

.code-line {
  display: flex;
  align-items: center;
  gap: 0;
  min-height: 34px;
  padding-right: 36px;
  position: relative;
}
.code-line--header {
  gap: 4px;
}
.code-line--footer {
  /* empty */
}
.code-line--add {
  margin-left: 28px;
}

.selector-select {
  width: 160px;
  flex-shrink: 0;
}

.code-bracket {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 600;
  transition: color 0.4s ease;
}

/* 添加按钮 */
.add-param-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border: 1px dashed var(--border-color);
  background: transparent;
  color: var(--text-tertiary);
  font-size: 12px;
  font-family: inherit;
  border-radius: 5px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    background-color 0.15s ease;
}
.add-param-btn:hover {
  border-color: var(--text-secondary);
  color: var(--text-primary);
  background: var(--bg-sub);
}

@media (max-width: 640px) {
  .code-card {
    padding: 12px 10px;
  }
  .code-view {
    font-size: 13px;
  }
  .code-line--add {
    margin-left: 16px;
  }
  .selector-select {
    width: 130px;
  }
}
</style>

<script setup>
import { NButton, NIcon, NSelect } from 'naive-ui'
import {
  ArrowImport24Regular, ArrowUndo24Regular, ArrowRedo24Regular,
  BookOpen48Regular, Color24Regular, Delete24Regular, Add16Filled,
} from '@vicons/fluent'
import {
  cmdType, titlePos, targetSel, targetCustom,
  undoStack, redoStack,
  isTitle, targetValue, elementCount,
  triggerSave, onTargetSelChange,
  undo, redo,
  openImport, loadExample, openColorTable,
  addElement, clearAll,
} from '../../composables/useRawJsonEditor.js'
</script>

<template>
  <!-- 指令配置 -->
  <div class="config-card">
    <div class="config-grid">
      <div class="config-field">
        <label class="config-label">指令类型</label>
        <NSelect
          v-model:value="cmdType"
          :options="[
            { label: '/tellraw', value: 'tellraw' },
            { label: '/titleraw', value: 'titleraw' },
          ]"
          size="small"
          class="config-select"
          @update:value="triggerSave"
        />
      </div>
      <div v-if="isTitle" class="config-field">
        <label class="config-label">显示位置</label>
        <NSelect
          v-model:value="titlePos"
          :options="[
            { label: 'actionbar', value: 'actionbar' },
            { label: 'title', value: 'title' },
            { label: 'subtitle', value: 'subtitle' },
          ]"
          size="small"
          class="config-select"
          @update:value="triggerSave"
        />
      </div>
      <div class="config-field config-field-target">
        <label class="config-label">目标</label>
        <div class="target-row">
          <NSelect
            v-model:value="targetSel"
            :options="[
              { label: '@s (执行者)', value: '@s' },
              { label: '@a (所有玩家)', value: '@a' },
              { label: '@r (随机玩家)', value: '@r' },
              { label: '@p (最近玩家)', value: '@p' },
              { label: '@n (最近实体)', value: '@n' },
              { label: '@e (所有实体)', value: '@e' },
              { label: '自定义', value: 'custom' },
            ]"
            size="small"
            class="target-select"
            @update:value="onTargetSelChange"
          />
          <input
            v-if="targetSel === 'custom'"
            v-model="targetCustom"
            type="text"
            class="target-input"
            placeholder="@a[tag=vip]"
            @input="triggerSave"
          />
          <div v-else class="target-show">{{ targetValue }}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- 工具栏 -->
  <div class="toolbar-row">
    <div class="toolbar-left">
      <NButton quaternary size="small" @click="openImport">
        <template #icon><NIcon :component="ArrowImport24Regular" /></template>
        导入
      </NButton>
      <NButton quaternary size="small" @click="loadExample">
        <template #icon><NIcon :component="BookOpen48Regular" /></template>
        示例
      </NButton>
      <NButton quaternary size="small" @click="openColorTable">
        <template #icon><NIcon :component="Color24Regular" /></template>
        颜色表
      </NButton>
      <NButton quaternary size="small" :disabled="undoStack.length === 0" @click="undo">
        <template #icon><NIcon :component="ArrowUndo24Regular" /></template>
        撤销
      </NButton>
      <NButton quaternary size="small" :disabled="redoStack.length === 0" @click="redo">
        <template #icon><NIcon :component="ArrowRedo24Regular" /></template>
        重做
      </NButton>
    </div>
    <span class="toolbar-count">元素 <strong>{{ elementCount }}</strong></span>
  </div>

  <!-- 列表头部 -->
  <div class="list-card">
    <div class="list-header">
      <button class="add-btn" @click="addElement(null)">
        <NIcon :component="Add16Filled" :size="14" />
        <span>添加元素</span>
      </button>
      <NButton size="tiny" quaternary @click="clearAll">
        <template #icon><NIcon :component="Delete24Regular" :size="14" /></template>
        清空
      </NButton>
    </div>
    <slot />
  </div>
</template>

<style scoped>
.config-card, .list-card {
  background: #FFFFFF;
  border-radius: 12px;
  border: 1px solid #E0E0E0;
  padding: 16px;
  transition: background-color 0.4s ease, border-color 0.4s ease;
}
[data-theme="dark"] .config-card,
[data-theme="dark"] .list-card {
  background: #191919;
  border-color: #2B2B2B;
}
.config-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.config-field-target {
  grid-column: 1 / -1;
}
.config-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
  transition: color 0.4s ease;
}
.config-select { width: 100%; }
.target-row { display: flex; gap: 8px; align-items: center; }
.target-select { flex-shrink: 0; width: 140px; }
.target-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-sub);
  color: var(--text-primary);
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: 13px;
  outline: none;
  transition: border-color 0.3s ease, background-color 0.4s ease, color 0.4s ease;
}
.target-input:focus { border-color: var(--text-secondary); }
.target-show {
  flex: 1;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--bg-sub);
  color: var(--text-secondary);
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: 13px;
  transition: background-color 0.4s ease, color 0.4s ease;
}
.toolbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
.toolbar-left {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-wrap: wrap;
}
.toolbar-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transition: color 0.4s ease;
  white-space: nowrap;
}
.toolbar-count strong {
  color: var(--text-tertiary);
  font-weight: 400;
  margin-left: 4px;
  transition: color 0.4s ease;
}
.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

/* 自定义添加按钮 */
.add-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 12px;
  border: none;
  background: #333;
  color: #fff;
  font-size: 12px; font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
  transition: background-color 0.15s ease, transform 0.1s ease;
}
.add-btn:hover { background: #444; }
.add-btn:active { transform: scale(0.97); }
[data-theme="dark"] .add-btn {
  background: #ccc;
  color: #1a1a1a;
}
[data-theme="dark"] .add-btn:hover { background: #bbb; }

@media (max-width: 480px) {
  .config-grid { grid-template-columns: 1fr; }
  .config-field-target { grid-column: 1; }
  .target-row { flex-direction: column; }
  .target-select { width: 100%; }
  .toolbar-row { flex-direction: column; align-items: stretch; }
  .toolbar-left { flex-wrap: wrap; }
  .toolbar-count { text-align: right; }
}
</style>

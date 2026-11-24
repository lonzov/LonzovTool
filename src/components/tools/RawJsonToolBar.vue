<script setup>
import { NIcon } from 'naive-ui'
import { Warning16Filled } from '@vicons/fluent'
import {
  ArrowImport24Regular, ArrowRedo24Regular, ArrowUndo24Regular, Braces24Filled,
  Settings24Regular,
} from '@vicons/fluent'
import AppButton from '../ui/AppButton.vue'
import {
  errorCount, modeLabel, redo, redoStack, targetValue, undo, undoStack, openImport,
} from '../../composables/useRawJsonEditor.js'

defineEmits(['open-settings', 'locate-issue'])
</script>

<template>
  <div class="rj-toolbar">
    <div class="rj-brand">
      <NIcon :component="Braces24Filled" class="rj-brand-icon" />
      <h1 class="rj-brand-title">T显可视化编辑器</h1>
      <span class="rj-mode" title="指令类型、显示位置与目标在设置中修改">
        {{ modeLabel }} {{ targetValue }}
      </span>
    </div>

    <div class="rj-toolbar-actions">
      <button
        v-if="errorCount"
        type="button"
        class="rj-issue-btn"
        title="定位到第一个待修正的元素"
        @click="$emit('locate-issue')"
      >
        <NIcon :component="Warning16Filled" :size="13" />
        <span>{{ errorCount }} 处待修正</span>
      </button>
      <AppButton
        variant="text"
        size="xs"
        icon-only
        :icon="ArrowUndo24Regular"
        label="撤销"
        :disabled="undoStack.length === 0"
        @click="undo"
      />
      <AppButton
        variant="text"
        size="xs"
        icon-only
        :icon="ArrowRedo24Regular"
        label="重做"
        :disabled="redoStack.length === 0"
        @click="redo"
      />
      <span class="rj-toolbar-divider" aria-hidden="true" />
      <AppButton variant="outline" size="sm" :icon="ArrowImport24Regular" @click="openImport">
        导入
      </AppButton>
      <AppButton variant="outline" size="sm" :icon="Settings24Regular" @click="$emit('open-settings')">
        设置
      </AppButton>
    </div>
  </div>
</template>

<style scoped>
.rj-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  padding: 0 2px;
}
.rj-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.rj-brand-icon {
  flex-shrink: 0;
  font-size: 18px;
  color: var(--foreground);
  transition: color 0.4s ease;
}
.rj-brand-title {
  flex-shrink: 0;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: 0.01em;
  color: var(--foreground);
  transition: color 0.4s ease;
}
.rj-mode {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  corner-shape: round;
  background: var(--muted);
  color: var(--muted-foreground);
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: 12px;
  font-weight: 400;
  transition: background-color 0.4s ease, color 0.4s ease;
}
/* 待修正状态：和主题切换一样走 token 派生，错误色只做小幅上底色 */
.rj-issue-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border: none;
  border-radius: var(--radius-full);
  corner-shape: round;
  background: color-mix(in srgb, var(--destructive) 12%, transparent);
  color: var(--destructive);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease;
}
.rj-issue-btn:hover { background: color-mix(in srgb, var(--destructive) 20%, transparent); }

.rj-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.rj-toolbar-divider {
  width: 1px;
  height: 16px;
  margin: 0 2px;
  background: var(--border);
  transition: background-color 0.4s ease;
}
</style>

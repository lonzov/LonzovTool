<script setup>
import {
  ArrowImport24Regular, ArrowUndo24Regular, ArrowRedo24Regular,
  BookOpen48Regular, Color24Regular, LocalLanguage24Regular,
} from '@vicons/fluent'
import AppButton from '../ui/AppButton.vue'
import {
  undoStack, redoStack, elementCount,
  undo, redo, openImport, loadExample, openColorTable,
} from '../../composables/useRawJsonEditor.js'
import { openLangModal, activePackName } from '../../composables/useRawJsonLang.js'
import RawJsonConfigCard from './RawJsonConfigCard.vue'
import RawJsonListCard from './RawJsonListCard.vue'
</script>

<template>
  <!-- 指令配置 -->
  <RawJsonConfigCard />

  <!-- 工具栏 -->
  <div class="toolbar-row">
    <div class="toolbar-left">
      <AppButton variant="text" size="sm" :icon="ArrowImport24Regular" @click="openImport">
        导入
      </AppButton>
      <AppButton variant="text" size="sm" :icon="BookOpen48Regular" @click="loadExample">
        示例
      </AppButton>
      <AppButton variant="text" size="sm" :icon="Color24Regular" @click="openColorTable">
        颜色表
      </AppButton>
      <AppButton variant="text" size="sm" :icon="LocalLanguage24Regular" @click="openLangModal">
        语言包
        <span v-if="activePackName" class="toolbar-dot" :title="`当前语言包：${activePackName}`" />
      </AppButton>
      <AppButton
        variant="text"
        size="sm"
        :icon="ArrowUndo24Regular"
        :disabled="undoStack.length === 0"
        @click="undo"
      >
        撤销
      </AppButton>
      <AppButton
        variant="text"
        size="sm"
        :icon="ArrowRedo24Regular"
        :disabled="redoStack.length === 0"
        @click="redo"
      >
        重做
      </AppButton>
    </div>
    <span class="toolbar-count">元素 <strong>{{ elementCount }}</strong></span>
  </div>

  <!-- 元素列表 -->
  <RawJsonListCard>
    <slot />
  </RawJsonListCard>
</template>

<style scoped>
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
/* 「语言包」已加载指示点 */
.toolbar-dot {
  display: inline-block;
  width: 5px; height: 5px;
  margin-left: 5px;
  border-radius: 50%;
  corner-shape: round;
  background: var(--success);
  vertical-align: middle;
}
.toolbar-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--foreground);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transition: color 0.4s ease;
  white-space: nowrap;
}
.toolbar-count strong {
  color: var(--subtle-foreground);
  font-weight: 400;
  margin-left: 4px;
  transition: color 0.4s ease;
}
</style>

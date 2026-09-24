<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { NIcon } from 'naive-ui'
import { Braces24Filled } from '@vicons/fluent'
import {
  useRawJsonEditor,
  showEditModal, showImportModal, showColorModal,
  closeEditModal, closeImport, closeColorTable,
  undo, redo,
} from '../../composables/useRawJsonEditor.js'
import RawJsonConfigBar from './RawJsonConfigBar.vue'
import RawJsonElementList from './RawJsonElementList.vue'
import RawJsonRightPanel from './RawJsonRightPanel.vue'
import RawJsonEditModal from './RawJsonEditModal.vue'
import RawJsonImportModal from './RawJsonImportModal.vue'
import RawJsonColorModal from './RawJsonColorModal.vue'
import RawJsonLangModal from './RawJsonLangModal.vue'
import RawJsonSimulatorModal from './RawJsonSimulatorModal.vue'
import { initLangStore, showLangModal, closeLangModal } from '../../composables/useRawJsonLang.js'
import {
  showSimModal, closeSimModal, loadSimFromStorage, disposeSimulator,
} from '../../composables/useRawJsonSimulator.js'

defineProps({
  tabPath: { type: String, default: '' },
})


// 初始化编辑器（捕获 message 实例 + localStorage 加载 + 生命周期）
useRawJsonEditor()
// 模拟器同步读取 localStorage（数据 <1KB，需首帧可用）；语言包走 IndexedDB，异步加载
loadSimFromStorage()

// 键盘快捷键
function handleKeydown(e) {
  if (e.key === 'Escape') {
    if (showEditModal.value) closeEditModal()
    else if (showColorModal.value) closeColorTable()
    else if (showLangModal.value) closeLangModal()
    else if (showSimModal.value) closeSimModal()
    else if (showImportModal.value) closeImport()
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault(); undo()
  }
  if ((e.ctrlKey || e.metaKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
    e.preventDefault(); redo()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  initLangStore()
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
  disposeSimulator()
})
</script>

<template>
  <div class="rawjson-tool">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="page-title-row">
        <NIcon :component="Braces24Filled" class="page-title-icon" />
        <h1 class="page-title">T显可视化编辑器</h1>
      </div>
      <p class="page-desc">可视化构建 rawtext JSON，原项目@矩阵方块，详见关于页</p>
    </div>

    <!-- 双栏布局 -->
    <div class="panels">
      <!-- 左栏 -->
      <div class="left-col">
        <RawJsonConfigBar>
          <RawJsonElementList />
        </RawJsonConfigBar>
      </div>

      <!-- 右栏 -->
      <div class="right-col">
        <RawJsonRightPanel />
      </div>
    </div>

    <!-- 弹窗 -->
    <RawJsonEditModal />
    <RawJsonImportModal />
    <RawJsonColorModal />
    <RawJsonLangModal />
    <RawJsonSimulatorModal />
  </div>
</template>

<style scoped>
.rawjson-tool { display: flex; flex-direction: column; gap: 16px; }

.page-header { margin-bottom: 0; }
.page-title-row { display: flex; align-items: center; gap: 10px; }
.page-title-icon {
  font-size: 26px; color: var(--foreground); flex-shrink: 0;
  transition: color 0.4s ease;
}
.page-title {
  font-size: 22px; font-weight: 700; color: var(--foreground);
  line-height: 1.3; margin: 0; transition: color 0.4s ease;
}
.page-desc {
  font-size: 14px; color: var(--muted-foreground); line-height: 1.5;
  margin-top: 6px; transition: color 0.4s ease;
}

.panels {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 16px; align-items: start;
}
.left-col { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.right-col { display: flex; flex-direction: column; gap: 12px; min-width: 0; }

/* 响应式 */
@media (max-width: 1023px) {
  .panels { grid-template-columns: 1fr; }
}
</style>

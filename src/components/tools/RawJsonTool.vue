<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { NIcon, NConfigProvider, darkTheme } from 'naive-ui'
import { TextGrammarWand24Regular } from '@vicons/fluent'
import { useTheme } from '../../composables/useTheme'
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

defineProps({
  tabPath: { type: String, default: '' },
})

const { isDark } = useTheme()

// 初始化编辑器（捕获 message 实例 + localStorage 加载 + 生命周期）
useRawJsonEditor()

// 键盘快捷键
function handleKeydown(e) {
  if (e.key === 'Escape') {
    if (showEditModal.value) closeEditModal()
    else if (showColorModal.value) closeColorTable()
    else if (showImportModal.value) closeImport()
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault(); undo()
  }
  if ((e.ctrlKey || e.metaKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
    e.preventDefault(); redo()
  }
}

onMounted(() => { document.addEventListener('keydown', handleKeydown) })
onBeforeUnmount(() => { document.removeEventListener('keydown', handleKeydown) })

/** NSelect 深色模式 peer 覆盖（按 customize-theme.md 文档方式） */
const darkSelectOverrides = {
  Select: {
    peers: {
      InternalSelection: {
        color: '#191919',
        textColor: '#E8E8E8',
        border: '1px solid #333333',
        borderHover: '1px solid #555555',
        borderFocus: '1px solid #E8E8E8',
        borderActive: '1px solid #E8E8E8',
        boxShadowFocus: 'none',
        boxShadowActive: 'none',
      },
      InternalSelectMenu: {
        color: '#1E1E1E',
        optionTextColor: '#E8E8E8',
        optionTextColorActive: '#E8E8E8',
        optionTextColorPressed: '#E8E8E8',
        optionCheckColor: '#E8E8E8',
        optionColorActive: '#2A2A2A',
        optionColorActivePending: '#2A2A2A',
        optionColorPending: '#2A2A2A',
        loadingColor: '#E8E8E8',
      },
    },
  },
}
</script>

<template>
  <NConfigProvider
    :theme="isDark ? darkTheme : null"
    :theme-overrides="isDark ? darkSelectOverrides : undefined"
  >
    <div class="rawjson-tool">
      <!-- 页面标题 -->
      <div class="page-header">
        <div class="page-title-row">
          <NIcon :component="TextGrammarWand24Regular" class="page-title-icon" />
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
    </div>
  </NConfigProvider>
</template>

<style scoped>
.rawjson-tool { display: flex; flex-direction: column; gap: 16px; }

.page-header { margin-bottom: 0; }
.page-title-row { display: flex; align-items: center; gap: 10px; }
.page-title-icon {
  font-size: 26px; color: var(--text-primary); flex-shrink: 0;
  transition: color 0.4s ease;
}
.page-title {
  font-size: 22px; font-weight: 700; color: var(--text-primary);
  line-height: 1.3; margin: 0; transition: color 0.4s ease;
}
.page-desc {
  font-size: 14px; color: var(--text-secondary); line-height: 1.5;
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

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { NIcon } from 'naive-ui'
import { Braces24Filled, Settings24Regular, Add16Filled } from '@vicons/fluent'
import {
  useRawJsonEditor,
  showEditModal, showImportModal, showColorModal, elementCount,
  closeEditModal, closeImport, closeColorTable,
  addElement, undo, redo,
} from '../../composables/useRawJsonEditor.js'
import RawJsonConfigBar from './RawJsonConfigBar.vue'
import RawJsonElementList from './RawJsonElementList.vue'
import RawJsonListCard from './RawJsonListCard.vue'
import RawJsonPreviewCard from './RawJsonPreviewCard.vue'
import RawJsonOutputCard from './RawJsonOutputCard.vue'
import RawJsonCommandCard from './RawJsonCommandCard.vue'
import RawJsonSettingsSheet from './RawJsonSettingsSheet.vue'
import RawJsonEditModal from './RawJsonEditModal.vue'
import RawJsonImportModal from './RawJsonImportModal.vue'
import RawJsonColorModal from './RawJsonColorModal.vue'
import RawJsonLangModal from './RawJsonLangModal.vue'
import RawJsonSimulatorModal from './RawJsonSimulatorModal.vue'
import { initLangStore, showLangModal, closeLangModal } from '../../composables/useRawJsonLang.js'
import {
  showSimModal, closeSimModal, loadSimFromStorage, disposeSimulator,
} from '../../composables/useRawJsonSimulator.js'
import { loadRenderMode } from '../../composables/useRawJsonRenderMode.js'
import { startObfuscateTimer, stopObfuscateTimer } from '../../vendor/mcfc/mcfc.js'

defineProps({
  tabPath: { type: String, default: '' },
})

/**
 * 紧凑布局阈值。判定的是编辑器自身拿到的宽度而不是窗口宽度 ——
 * 桌面端侧栏占位会吃掉主区域宽度，同一个窗口宽度下主区域并不一样宽。
 * 双栏各要让出 380px 才不至于把元素行挤断，所以低于 760px 整体切成单列。
 */
const COMPACT_MAX_WIDTH = 760

// 紧凑布局的追加栏：触摸端列表行间的插入间隙不可用，四类元素各给一个直接入口
const ADD_ENTRIES = [
  { type: 'text', label: '文本' },
  { type: 'selector', label: '选择器' },
  { type: 'score', label: '记分板' },
  { type: 'translate', label: '翻译键' },
]

const rootEl = ref(null)
const compact = ref(false)
const showSettings = ref(false)
let resizeObserver = null

// 初始化编辑器（捕获 message 实例 + localStorage 加载 + 生命周期）
useRawJsonEditor()
// 模拟器与渲染模式同步读取 localStorage（数据 <1KB，需首帧可用）；语言包走 IndexedDB，异步加载
loadSimFromStorage()
loadRenderMode()

// 键盘快捷键
function handleKeydown(e) {
  if (e.key === 'Escape') {
    if (showEditModal.value) closeEditModal()
    else if (showSettings.value) showSettings.value = false
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

function syncCompact(width) {
  compact.value = width > 0 && width < COMPACT_MAX_WIDTH
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  initLangStore()
  // 渲染模式可能让预览舞台同时存在于大区域与设置面板，§k 抖动交给页面级持有
  startObfuscateTimer()

  // 先量一次再挂监听：挂载后再切布局会多闪一帧桌面结构
  syncCompact(rootEl.value.getBoundingClientRect().width)
  if (typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver(([entry]) => syncCompact(entry.contentRect.width))
  resizeObserver.observe(rootEl.value)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
  resizeObserver?.disconnect()
  stopObfuscateTimer()
  disposeSimulator()
})
</script>

<template>
  <div ref="rootEl" class="rawjson-tool" :class="{ 'rawjson-tool--compact': compact }">
    <!-- 紧凑布局：顶栏收纳设置，预览常驻，只有编辑区滚动 -->
    <template v-if="compact">
      <div class="rj-bar">
        <NIcon :component="Braces24Filled" class="rj-bar-icon" />
        <span class="rj-bar-title">T显可视化编辑器</span>
        <span class="rj-bar-count">元素 {{ elementCount }}</span>
        <button class="rj-settings-btn" @click="showSettings = true">
          <NIcon :component="Settings24Regular" :size="16" />
          <span>设置</span>
        </button>
      </div>

      <RawJsonPreviewCard class="rj-preview" compact />

      <div class="rj-add-bar">
        <button
          v-for="entry in ADD_ENTRIES"
          :key="entry.type"
          class="rj-add-btn"
          @click="addElement(null, entry.type)"
        >
          <NIcon :component="Add16Filled" :size="13" />
          <span>{{ entry.label }}</span>
        </button>
      </div>

      <div class="rj-scroll">
        <RawJsonListCard class="rj-list" compact>
          <RawJsonElementList />
        </RawJsonListCard>
      </div>
    </template>

    <!-- 桌面布局 -->
    <template v-else>
      <div class="page-header">
        <div class="page-title-row">
          <NIcon :component="Braces24Filled" class="page-title-icon" />
          <h1 class="page-title">T显可视化编辑器</h1>
        </div>
        <p class="page-desc">可视化构建 rawtext JSON，原项目@矩阵方块，详见关于页</p>
      </div>

      <div class="panels">
        <div class="left-col">
          <RawJsonConfigBar>
            <RawJsonElementList />
          </RawJsonConfigBar>
        </div>

        <div class="right-col">
          <RawJsonPreviewCard />
          <RawJsonOutputCard />
          <RawJsonCommandCard />
        </div>
      </div>
    </template>

    <!-- 弹窗 -->
    <RawJsonSettingsSheet v-model:show="showSettings" />
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

/* ===== 紧凑布局 =====
   整屏三区：可用高度扣掉外壳留白后由页面自己吃满，页面不再滚动，
   溢出全部收进 .rj-scroll，避免预览被滚走 */
.rawjson-tool--compact {
  gap: 10px;
  /* 预览区与编辑区对半分。高度低于下限时整体抬到下限、退化成整页滚动，
     免得矮屏上两区被压到互相挤变形 */
  height: max(var(--shell-content-height, 80vh), 440px);
  overflow: hidden;
}
.rj-bar {
  display: flex; align-items: center; gap: 8px;
  flex-shrink: 0;
}
.rj-bar-icon {
  font-size: 18px; color: var(--foreground); flex-shrink: 0;
  transition: color 0.4s ease;
}
.rj-bar-title {
  font-size: 14px; font-weight: 700; color: var(--foreground);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  transition: color 0.4s ease;
}
.rj-bar-count {
  margin-right: auto;
  font-size: 11px; font-weight: 600; color: var(--subtle-foreground);
  letter-spacing: 0.5px; white-space: nowrap;
  transition: color 0.4s ease;
}
.rj-settings-btn {
  display: inline-flex; align-items: center; gap: 4px;
  flex-shrink: 0;
  min-height: 32px; padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  corner-shape: round;
  background: var(--card);
  color: var(--foreground);
  font-size: 12px; font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.4s ease, color 0.4s ease;
}
.rj-settings-btn:hover { background: var(--muted); }
.rj-settings-btn:active { transform: scale(0.97); }

/* 预览卡与编辑区等分剩余高度，预览内容由卡片内部再分配 */
.rj-preview { flex: 1 1 0; min-height: 0; }

/* 追加栏直接落在背景上，不带卡片外壳。
   两侧内缩，整排比上下两张卡片窄一档，实心块才不至于顶满显得发胀 */
.rj-add-bar {
  display: flex; gap: 8px;
  padding: 0 12px;
  flex-shrink: 0;
}
.rj-add-btn {
  flex: 1 1 0; min-width: 0;
  display: inline-flex; align-items: center; justify-content: center; gap: 3px;
  min-height: 28px; padding: 0 6px;
  border: none;
  border-radius: var(--radius-full);
  corner-shape: round;
  background: var(--primary);
  color: var(--primary-foreground);
  font-size: 11px; font-weight: 500;
  font-family: inherit;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.4s ease, color 0.4s ease, opacity 0.15s ease;
}
.rj-add-btn:hover { opacity: 0.85; }
.rj-add-btn:active { transform: scale(0.97); }

.rj-scroll {
  flex: 1 1 0;
  min-height: 0;
  display: flex; flex-direction: column;
  overflow-y: auto;
  overscroll-behavior: contain;
}
/* 元素少时卡片也铺满这半区，与预览卡等高；内容超长才交给外层滚动 */
.rj-list { flex: 1 0 auto; }
</style>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { NIcon } from 'naive-ui'
import { Braces24Filled, Settings24Regular, Add16Filled, ChevronUp16Regular } from '@vicons/fluent'
import {
  useRawJsonEditor, elementCount, addElement, undo, redo,
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
import { initLangStore } from '../../composables/useRawJsonLang.js'
import { loadSimFromStorage, disposeSimulator } from '../../composables/useRawJsonSimulator.js'
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
/** 全屏编辑态：预览收起、顶栏让位，元素区吃满一屏，由追加栏最左侧的按钮切换 */
const focusMode = ref(false)
let resizeObserver = null

// 初始化编辑器（捕获 message 实例 + localStorage 加载 + 生命周期）
useRawJsonEditor()
// 模拟器与渲染模式同步读取 localStorage（数据 <1KB，需首帧可用）；语言包走 IndexedDB，异步加载
loadSimFromStorage()
loadRenderMode()

// 键盘快捷键。Escape 不在这里处理：弹层自己带 closeOnEsc，且会在下拉菜单
// 已经消费掉 Esc 时跳过关闭，document 级监听做不到这层判断，只会连带误关。
function handleKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault(); undo()
  }
  if ((e.ctrlKey || e.metaKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
    e.preventDefault(); redo()
  }
}

// 设置面板与全屏编辑态都只存在于紧凑布局，切回桌面双栏时一并复位
watch(compact, (isCompact) => {
  if (isCompact) return
  showSettings.value = false
  focusMode.value = false
})

function syncCompact(width) {
  // 宽度为 0 说明元素没参与布局（被隐藏等），保留上一次判定，免得白翻一次结构
  if (width <= 0) return
  compact.value = width < COMPACT_MAX_WIDTH
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
  <div
    ref="rootEl"
    class="rawjson-tool"
    :class="{ 'rawjson-tool--compact': compact, 'rawjson-tool--focus': focusMode }"
  >
    <!-- 紧凑布局：顶栏收纳设置，预览占上半屏，元素区在下方自己滚 -->
    <template v-if="compact">
      <div v-if="!focusMode" class="rj-bar">
        <NIcon :component="Braces24Filled" class="rj-bar-icon" />
        <span class="rj-bar-title">T显可视化编辑器</span>
        <span class="rj-bar-count">元素 {{ elementCount }}</span>
        <button class="rj-settings-btn" @click="showSettings = true">
          <NIcon :component="Settings24Regular" :size="16" />
          <span>设置</span>
        </button>
      </div>

      <div class="rj-preview">
        <RawJsonPreviewCard compact :collapsed="focusMode" />
      </div>

      <div class="rj-add-bar">
        <button
          class="rj-mode-btn"
          :class="{ 'rj-mode-btn--focus': focusMode }"
          :title="focusMode ? '恢复预览' : '全屏编辑'"
          :aria-label="focusMode ? '恢复预览' : '全屏编辑'"
          @click="focusMode = !focusMode"
        >
          <NIcon :component="ChevronUp16Regular" :size="14" class="rj-mode-icon" />
        </button>
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
        <RawJsonListCard compact>
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
   整块吃满一屏：预览占上半屏，元素区在下半屏自己滚，页面本身不滚动。
   全屏编辑态把预览收成一条细条、顶栏撤掉，元素区改吃整屏 */
.rawjson-tool--compact {
  --rj-stage-h: max(var(--shell-content-height, 80vh), 440px);
  gap: 10px;
  height: var(--rj-stage-h);
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

/* 预览固定占上半屏，进出全屏编辑态只走高度，动画即"吸附"的观感来源 */
.rj-preview {
  flex: none;
  height: calc(var(--rj-stage-h) / 2);
  overflow: hidden;
  transition: height 0.28s cubic-bezier(0.2, 0, 0, 1);
}
.rawjson-tool--focus .rj-preview { height: 0; }

/* 追加栏直接落在背景上，不带卡片外壳。
   两侧内缩，整排比上下两张卡片窄一档，实心块才不至于顶满显得发胀 */
.rj-add-bar {
  display: flex; align-items: center; gap: 6px;
  padding: 0 10px;
  flex-shrink: 0;
}
/* 全屏编辑开关：等边圆形，取追加按钮同一套配色与高度 */
.rj-mode-btn {
  flex: none;
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; padding: 0;
  border: none;
  border-radius: var(--radius-full);
  corner-shape: round;
  background: var(--primary);
  color: var(--primary-foreground);
  font-family: inherit;
  cursor: pointer;
  transition: background-color 0.4s ease, color 0.4s ease, opacity 0.15s ease;
}
.rj-mode-btn:hover { opacity: 0.85; }
.rj-mode-btn:active { transform: scale(0.94); }
/* 只换朝向、不加过渡：按钮自己的 transition 不含 transform，切换是直接翻过去的 */
.rj-mode-btn--focus .rj-mode-icon { transform: rotate(180deg); }
.rj-add-btn {
  flex: 1 1 0; min-width: 0;
  display: inline-flex; align-items: center; justify-content: center; gap: 2px;
  min-height: 28px; padding: 0 4px;
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

/* 元素区吃掉剩余高度，自己滚；overscroll 收住，避免滚动链到页面 */
.rj-scroll {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
</style>

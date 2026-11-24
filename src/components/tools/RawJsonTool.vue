<script setup>
import { nextTick, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { NIcon, NSplit } from 'naive-ui'
import {
  Braces24Filled, Settings24Regular, Add16Filled, ChevronUp16Regular, Warning16Filled,
} from '@vicons/fluent'
import {
  useRawJsonEditor, elementCount, errorCount, validationResult, addElement, addInlineElement, inlineIdx,
  startInlineEdit, editElement, undo, redo, stopInlineEdit,
} from '../../composables/useRawJsonEditor.js'
import {
  JSON_RATIO_MAX, JSON_RATIO_MIN, LIST_WIDTH_MIN, PREVIEW_RATIO_MAX, PREVIEW_RATIO_MIN,
  jsonRatio, listWidthMax, listWidthMaxSize, listWidthMin, listWidthPx, listWidthSize,
  loadLayout, previewRatio, resetJsonRatio, resetListWidth, resetPreviewRatio, saveLayout,
  setContainerWidth, setJsonRatio, setListWidth, setPreviewRatio,
} from '../../composables/useRawJsonLayout.js'
import RawJsonToolBar from './RawJsonToolBar.vue'
import RawJsonSplitHandle from './RawJsonSplitHandle.vue'
import RawJsonElementList from './RawJsonElementList.vue'
import RawJsonListCard from './RawJsonListCard.vue'
import RawJsonQuickAdd from './RawJsonQuickAdd.vue'
import RawJsonPreviewCard from './RawJsonPreviewCard.vue'
import RawJsonOutputCard from './RawJsonOutputCard.vue'
import RawJsonCommandCard from './RawJsonCommandCard.vue'
import RawJsonSettingsDrawer from './RawJsonSettingsDrawer.vue'
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
import { reduceMotion } from '../../composables/useMotion.js'

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
// 分栏宽度同样要首帧到位，否则会先按默认宽度画一帧再跳
loadLayout()

/** 分隔条上的键盘微调与双击复位：宽度走像素，高度按比例走 */
const WIDTH_STEP = 16
const RATIO_STEP = 0.02

function nudgeListWidth(direction) {
  setListWidth(listWidthPx.value + direction * WIDTH_STEP)
  saveLayout()
}

function nudgePreviewRatio(direction) {
  setPreviewRatio(previewRatio.value + direction * RATIO_STEP)
  saveLayout()
}

function nudgeJsonRatio(direction) {
  setJsonRatio(jsonRatio.value + direction * RATIO_STEP)
  saveLayout()
}

// 键盘快捷键。Escape 不在这里处理：弹层自己带 closeOnEsc，且会在下拉菜单
// 已经消费掉 Esc 时跳过关闭，document 级监听做不到这层判断，只会连带误关。
function handleKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault(); undo()
  }
  if ((e.ctrlKey || e.metaKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
    e.preventDefault(); redo()
  }
  // Ctrl/Alt + 回车收起展开的元素：编辑区里回车是换行，这个组合正好用来结束编辑
  if (e.key === 'Enter' && (e.ctrlKey || e.altKey) && inlineIdx.value !== null) {
    e.preventDefault()
    stopInlineEdit()
  }
}

// 设置抽屉、全屏编辑态与就地编辑都依附于具体布局：两侧互切时一并复位，
// 免得把桌面端的抽屉状态带进移动端，或让紧凑布局的列表继承一个失效的编辑下标
watch(compact, () => {
  clearFocusAnim()
  showSettings.value = false
  focusMode.value = false
  stopInlineEdit()
})

/** 待修正：桌面展开该行、移动端打开编辑弹窗；重复点击跳到下一条 */
function locateIssue() {
  const errors = validationResult.value.errors
  if (errors.length === 0) return
  const editing = inlineIdx.value
  const target = errors.find(error => error.idx !== editing) || errors[0]
  if (compact.value) editElement(target.idx)
  else startInlineEdit(target.idx)
}

// ===== 折叠预览的过渡 =====
// 布局只在首尾各落一次位，过程里只改 transform / opacity（合成层），不逐帧重排。
// 收起：保持展开布局（顶栏与预览还要看得见），元素区先长到最终高度，整列上移并淡出；
//       动画结束后再切换布局——此时画面已在终点，切换不可见。
// 展开：先把布局落到展开态，再用反向位移把画面按回折叠态，然后动到 0。
const FOCUS_MS = 280
let focusTimer = null
let focusBusy = false

/** 量两态下元素区顶部的差：临时切一次 class 强制布局，同一帧内还原，不会画出中间态 */
function measureFocusShift() {
  const root = rootEl.value
  const list = root?.querySelector('.rj-scroll')
  if (!root || !list) return 0
  const before = list.getBoundingClientRect().top
  root.classList.toggle('rawjson-tool--focus')
  const after = list.getBoundingClientRect().top
  root.classList.toggle('rawjson-tool--focus')
  return Math.abs(before - after)
}

function setFocusFrame(shift, fade) {
  const root = rootEl.value
  if (!root) return
  root.style.setProperty('--rj-focus-shift', `${shift}px`)
  root.style.setProperty('--rj-focus-fade', String(fade))
}

function runFocusAnim(from, to, fadeFrom) {
  const root = rootEl.value
  if (!root) return
  root.classList.remove('rawjson-tool--focus-anim')
  setFocusFrame(from, fadeFrom)
  void root.offsetHeight
  root.classList.add('rawjson-tool--focus-anim')
  setFocusFrame(to, fadeFrom === 0 ? 1 : 0)
}

function clearFocusAnim() {
  focusBusy = false
  clearTimeout(focusTimer)
  const root = rootEl.value
  if (!root) return
  root.classList.remove('rawjson-tool--focus-anim')
  root.style.removeProperty('--rj-focus-shift')
  root.style.removeProperty('--rj-focus-fade')
  const list = root.querySelector('.rj-scroll')
  if (list) list.style.minHeight = ''
}

/**
 * 收起：布局先不动（顶栏与预览还要看得见），元素区补上让出的高度后整列上移并淡出，
 * 结束后再切布局；展开：先把布局落到展开态，再用反向位移摆回折叠态。
 */
async function toggleFocus() {
  if (focusBusy) return
  const root = rootEl.value
  const list = root?.querySelector('.rj-scroll')
  if (!root || !list || reduceMotion.value) {
    focusMode.value = !focusMode.value
    return
  }
  focusBusy = true
  const collapsing = !focusMode.value
  if (collapsing) {
    const shift = measureFocusShift()
    // flex 项按 flex 定尺寸，height 会被忽略，撑高要用 min-height
    list.style.minHeight = `${list.getBoundingClientRect().height + shift}px`
    runFocusAnim(0, -shift, 1)
  } else {
    focusMode.value = false
    await nextTick()
    const shift = measureFocusShift()
    list.style.minHeight = `${list.getBoundingClientRect().height + shift}px`
    runFocusAnim(-shift, 0, 0)
  }
  focusTimer = setTimeout(() => {
    if (collapsing) focusMode.value = true
    nextTick(clearFocusAnim)
  }, FOCUS_MS)
}

function syncCompact(width) {
  // 宽度为 0 说明元素没参与布局（被隐藏等），保留上一次判定，免得白翻一次结构
  if (width <= 0) return
  // 分栏左栏的上限跟着编辑器自身宽度走，窗口变窄时先把预览让出来
  setContainerWidth(width)
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
  clearTimeout(focusTimer)
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
    :class="{
      'rawjson-tool--desktop': !compact,
      'rawjson-tool--compact': compact,
      'rawjson-tool--focus': focusMode,
    }"
  >
    <!-- 桌面布局：整屏工作区。左元素列表、右预览，设置收进抽屉 -->
    <template v-if="!compact">
      <RawJsonToolBar @open-settings="showSettings = true" @locate-issue="locateIssue" />

      <div class="rj-workspace">
        <NSplit
          direction="horizontal"
          :size="listWidthSize"
          :min="listWidthMin"
          :max="listWidthMaxSize"
          :resize-trigger-size="12"
          @update:size="setListWidth"
          @drag-end="saveLayout"
        >
          <template #1>
            <div class="rj-pane rj-list-pane">
              <RawJsonQuickAdd @add="type => addInlineElement(null, type)" />
              <RawJsonListCard inline>
                <RawJsonElementList inline />
              </RawJsonListCard>
            </div>
          </template>

          <template #2>
            <NSplit
              direction="vertical"
              :size="previewRatio"
              :min="PREVIEW_RATIO_MIN"
              :max="PREVIEW_RATIO_MAX"
              :resize-trigger-size="12"
              @update:size="setPreviewRatio"
              @drag-end="saveLayout"
            >
              <template #1>
                <div class="rj-pane">
                  <RawJsonPreviewCard />
                </div>
              </template>

              <template #2>
                <NSplit
                  direction="vertical"
                  :size="jsonRatio"
                  :min="JSON_RATIO_MIN"
                  :max="JSON_RATIO_MAX"
                  :resize-trigger-size="12"
                  @update:size="setJsonRatio"
                  @drag-end="saveLayout"
                >
                  <template #1>
                    <div class="rj-pane">
                      <RawJsonOutputCard stretch />
                    </div>
                  </template>

                  <template #2>
                    <div class="rj-pane">
                      <RawJsonCommandCard stretch />
                    </div>
                  </template>

                  <template #resize-trigger>
                    <RawJsonSplitHandle
                      orientation="horizontal"
                      unit="ratio"
                      :value="jsonRatio"
                      :min="JSON_RATIO_MIN"
                      :max="JSON_RATIO_MAX"
                      label="JSON 输出高度"
                      @nudge="nudgeJsonRatio"
                      @reset="resetJsonRatio"
                    />
                  </template>
                </NSplit>
              </template>

              <template #resize-trigger>
                <RawJsonSplitHandle
                  orientation="horizontal"
                  unit="ratio"
                  :value="previewRatio"
                  :min="PREVIEW_RATIO_MIN"
                  :max="PREVIEW_RATIO_MAX"
                  label="预览高度"
                  @nudge="nudgePreviewRatio"
                  @reset="resetPreviewRatio"
                />
              </template>
            </NSplit>
          </template>

          <template #resize-trigger>
            <RawJsonSplitHandle
              orientation="vertical"
              unit="px"
              :value="listWidthPx"
              :min="LIST_WIDTH_MIN"
              :max="listWidthMax"
              label="元素列表宽度"
              @nudge="nudgeListWidth"
              @reset="resetListWidth"
            />
          </template>
        </NSplit>
      </div>
    </template>

    <!-- 紧凑布局：顶栏收纳设置，预览占上半屏，元素区在下方自己滚 -->
    <template v-else>
      <div class="rj-bar-wrap">
        <div class="rj-bar">
          <NIcon :component="Braces24Filled" class="rj-bar-icon" />
          <span class="rj-bar-title">T显可视化编辑器</span>
          <span class="rj-bar-count">元素 {{ elementCount }}</span>
          <button
            v-if="errorCount"
            type="button"
            class="rj-issue-chip"
            title="定位到第一个待修正的元素"
            @click="locateIssue"
          >
            <NIcon :component="Warning16Filled" :size="11" />
            <span>{{ errorCount }} 处</span>
          </button>
          <button class="rj-settings-btn" @click="showSettings = true">
            <NIcon :component="Settings24Regular" :size="16" />
            <span>设置</span>
          </button>
        </div>
      </div>

      <div class="rj-preview">
        <div class="rj-preview-inner">
          <RawJsonPreviewCard compact />
        </div>
      </div>

      <div class="rj-add-bar">
        <button
          class="rj-mode-btn"
          :class="{ 'rj-mode-btn--focus': focusMode }"
          :title="focusMode ? '恢复预览' : '全屏编辑'"
          :aria-label="focusMode ? '恢复预览' : '全屏编辑'"
          @click="toggleFocus"
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
        <RawJsonListCard>
          <RawJsonElementList />
        </RawJsonListCard>
      </div>
    </template>

    <!-- 设置：桌面端从右侧抽屉进入，移动端保持底部面板 -->
    <RawJsonSettingsDrawer v-if="!compact" v-model:show="showSettings" />
    <RawJsonSettingsSheet v-else v-model:show="showSettings" />

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

/* ===== 桌面布局 =====
   整块吃满一屏：面板各自内部滚动，元素列表与预览始终同屏可见。
   高度从外壳可用高度里扣掉工作站标签栏（43px）与它的下外边距（24px），
   再让出 1px 防亚像素取整多出一条页面滚动条。 */
.rawjson-tool--desktop {
  --rj-desktop-h: max(calc(var(--shell-content-height, 100vh) - 68px), 520px);
  height: var(--rj-desktop-h);
  gap: 12px;
  overflow: hidden;
}
.rj-workspace { flex: 1; min-height: 0; }
/* 每个分栏面板的挂载点：卡片自己撑满，滚动都发生在卡片内部 */
.rj-pane {
  height: 100%;
  min-width: 0;
  min-height: 0;
}
/* 元素列：顶部快捷添加栏 + 下方列表卡片，卡片吃掉剩余高度 */
.rj-list-pane {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ===== 紧凑布局 =====
   整块吃满一屏：预览占上半屏，元素区在下半屏自己滚，页面本身不滚动。
   全屏编辑态把预览收成一条细条、顶栏撤掉，元素区改吃整屏。 */
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
  font-size: 15px; font-weight: 600; color: var(--foreground);
  letter-spacing: 0.01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  transition: color 0.4s ease;
}
.rj-bar-count {
  margin-right: auto;
  font-size: 12px; font-weight: 400; color: var(--muted-foreground);
  white-space: nowrap;
  transition: color 0.4s ease;
}
.rj-issue-chip {
  display: inline-flex; align-items: center; gap: 4px;
  flex-shrink: 0;
  padding: 3px 8px;
  border: none;
  border-radius: var(--radius-full);
  corner-shape: round;
  background: color-mix(in srgb, var(--destructive) 12%, transparent);
  color: var(--destructive);
  font-family: inherit; font-size: 12px; font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease;
}
.rj-issue-chip:hover { background: color-mix(in srgb, var(--destructive) 20%, transparent); }

.rj-settings-btn {
  display: inline-flex; align-items: center; gap: 4px;
  flex-shrink: 0;
  min-height: 32px; padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  corner-shape: round;
  background: var(--card);
  color: var(--foreground);
  font-size: 13px; font-weight: 500;
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
  overflow: clip;
}
/* 卡片保持整块尺寸：折叠只裁外层，内部预览不参与重排 */
.rj-preview-inner { height: calc(var(--rj-stage-h) / 2); }

/* 折叠过渡：布局只在首尾各落一次位，过程只改 transform / opacity（合成层），不逐帧重排 */
.rawjson-tool--compact > .rj-bar-wrap,
.rawjson-tool--compact > .rj-preview,
.rawjson-tool--compact > .rj-add-bar,
.rawjson-tool--compact > .rj-scroll {
  transform: translateY(var(--rj-focus-shift, 0px));
}
.rawjson-tool--compact > .rj-bar-wrap,
.rawjson-tool--compact > .rj-preview { opacity: var(--rj-focus-fade, 1); }
.rawjson-tool--focus-anim > .rj-bar-wrap,
.rawjson-tool--focus-anim > .rj-preview,
.rawjson-tool--focus-anim > .rj-add-bar,
.rawjson-tool--focus-anim > .rj-scroll {
  transition: transform 0.28s cubic-bezier(0.2, 0, 0, 1), opacity 0.2s ease;
  will-change: transform, opacity;
}
/* 减少动态效果：切换直接到位 */
html[data-motion='reduced'] .rawjson-tool--focus-anim > * {
  transition: none !important;
}

/* 全屏编辑态的落位：顶栏与预览让出高度，元素区吃满 */
.rawjson-tool--focus .rj-preview { height: 0; pointer-events: none; }
.rj-bar-wrap {
  display: grid;
  grid-template-rows: 1fr;
  flex: none;
}
.rj-bar-wrap > .rj-bar {
  min-height: 0;
  overflow: hidden;
}
.rawjson-tool--focus .rj-bar-wrap {
  grid-template-rows: 0fr;
  opacity: 0;
  pointer-events: none;
}

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
  font-size: 12px; font-weight: 500;
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

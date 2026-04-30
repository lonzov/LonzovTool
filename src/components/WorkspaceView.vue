<script setup>
import { computed, watch, onMounted, onBeforeUnmount, ref, defineAsyncComponent } from 'vue'
import { NEmpty, NProgress, NDropdown, useMessage } from 'naive-ui'
import { useRouter, useRoute } from 'vue-router'
import { ChevronDown16Filled } from '@vicons/fluent'
import { useWorkspace } from '../composables/useWorkspace.js'
import { useTheme } from '../composables/useTheme.js'

// 动态加载工具组件，实现按需加载
const ArtTextTool = defineAsyncComponent(() => import('./tools/ArtTextTool.vue'))
const TrAnimationTool = defineAsyncComponent(() => import('./tools/TrAnimationTool.vue'))
const ExecuteTool = defineAsyncComponent(() => import('./tools/ExecuteTool.vue'))
const FuhaoTool = defineAsyncComponent(() => import('./tools/FuhaoTool.vue'))

const router = useRouter()
const route = useRoute()
const message = useMessage()
const { tabs, activeTab, closeTab, restoreTabs, ensureTabForPath } = useWorkspace()
const { isDark } = useTheme()

// 路径到组件的映射
const componentMap = {
  '/c/qjzh': ArtTextTool,
  '/c/tr': TrAnimationTool,
  '/c/execute': ExecuteTool,
  '/c/fuhao': FuhaoTool,
}

function getComponent(path) {
  const normalized = path.replace(/\/+$/, '')
  return componentMap[normalized] || null
}

function handleClose(path) {
  const result = closeTab(path)
  if (result === 'last') {
    message.warning('至少保留一个标签页')
    return
  }
}

// 切换活跃标签
function switchTab(path) {
  if (activeTab.value !== path) {
    activeTab.value = path
  }
}

// ===== 标签下拉菜单（最左侧图标） =====
const tabDropdownOptions = computed(() =>
  tabs.value.map((tab) => ({ label: tab.title, key: tab.path }))
)

function handleTabSelect(key) {
  if (key !== activeTab.value) {
    activeTab.value = key
  }
}

// 监听标签变化，全部关闭时回首页
watch(tabs, (val) => {
  if (val.length === 0 && router.currentRoute.value.path.startsWith('/c/')) {
    router.push('/')
  }
}, { deep: true })

// 当前活跃标签对应的组件
const activeComponent = computed(() => {
  return activeTab.value ? getComponent(activeTab.value) : null
})

// ===== 切换标签时同步 URL =====
let syncingFromRoute = false

watch(activeTab, (newPath) => {
  if (syncingFromRoute || !newPath) return
  const fullPath = '/c/' + (newPath === '/c/' ? '' : newPath.replace(/^\/c\//, ''))
  if (route.fullPath !== fullPath) {
    router.replace(fullPath)
  }
})

// ===== 从路由同步到活跃标签（处理路径不在 tabs 中的情况） =====
function syncFromRoute() {
  const routePath = route.path
  if (!routePath.startsWith('/c/')) return

  syncingFromRoute = true
  ensureTabForPath(routePath)
  setTimeout(() => { syncingFromRoute = false }, 0)
}

onMounted(() => {
  if (!route.path.startsWith('/c/')) return

  // restoreTabs 是幂等的：tabs 已有数据时直接跳过
  const didRestore = restoreTabs()

  // 以 localStorage 恢复的数据为准，用它来同步路由
  if (didRestore && activeTab.value) {
    syncingFromRoute = true
    const targetPath = '/c/' + (activeTab.value === '/c/' ? '' : activeTab.value.replace(/^\/c\//, ''))
    if (route.fullPath !== targetPath) {
      router.replace(targetPath)
    }
    setTimeout(() => { syncingFromRoute = false }, 0)
  } else {
    // 无本地存储数据，用当前路由初始化
    ensureTabForPath(route.path)
  }
})
watch(() => route.path, syncFromRoute)

// ===== 标签栏滚动 & 渐变遮罩 =====
const tabsListEl = ref(null)
const tabsBarEl = ref(null)     // 标签栏容器（用于视觉标签定位）
const showLeftFade = ref(false)
const showRightFade = ref(false)

function updateScrollFades() {
  const el = tabsListEl.value
  if (!el) return
  showLeftFade.value = el.scrollLeft > 1
  showRightFade.value = el.scrollWidth - el.clientWidth - el.scrollLeft > 1
}

// ===== 长按拖拽排序系统 =====
// 流程：按下 → 500ms内松开=普通点击 / 500ms后显示进度环 → 0.7s倒计时 → 进入拖拽模式 → 松手完成排序
const LONG_PRESS_DELAY = 500     // 长按判定时间 ms
const PROGRESS_DURATION = 700    // 进度环计时时间 ms
const MOVE_THRESHOLD_Y = 8       // 纵向移动超过此距离取消长按 px
const MOVE_THRESHOLD_X = 18      // 横向移动超过此距离视为滑动（取消长按）px

// 长按 & 进度环状态
const longPressState = ref({
  showRing: false,
  ringPercent: 0,
  ringX: 0,
  ringY: 0,
})

// 拖拽模式状态
const draggingPath = ref(null)
const dragOverIndex = ref(-1)
const isDraggingTab = ref(false)
const dragFromIndex = ref(-1)
const cachedTabRects = ref([])
const dragSnapping = ref(false)

// 视觉拖拽标签（绝对定位，跟随鼠标，替代原标签的视觉表现）
const visualTag = ref({ show: false, left: 0, top: 0, title: '', showClose: false })

// 非响应式内部状态
let _pressInfo = null            // { x, y, tab, index }
let _longPressTimer = null       // setTimeout ID
let _progressRafId = null        // setInterval ID（进度环定时器）
let _dragOffsetX = 0             // 按下时鼠标相对标签左边缘的偏移（保持拖拽时相对位置不变）
let _barCachedLeft = 0          // 拖拽开始时标签栏左边缘视口坐标（用于坐标转换）

// 计算被动移动 tab 的偏移量（被拖拽标签本身隐藏，仅做排序占位）
const dragOffsets = computed(() => {
  if (!isDraggingTab.value || dragOverIndex.value === -1) return {}
  const fromIdx = dragFromIndex.value
  if (fromIdx === -1) return {}

  const toIdx = dragOverIndex.value
  if (fromIdx === toIdx) return {}

  const offsets = {}
  const dir = toIdx > fromIdx ? 1 : -1
  const tabWidth = cachedTabRects.value[fromIdx]?.width ?? 60
  const gap = 2
  const shift = tabWidth + gap

  // 中间跨过的 tab 反向偏移腾出空间（不含被拖拽的那个，它已被隐藏）
  const [lo, hi] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx]
  for (let i = lo; i <= hi; i++) {
    if (i === fromIdx) continue
    offsets[i] = -dir * shift
  }

  return offsets
})

function getDragOffset(index) {
  return dragOffsets.value[index] ?? 0
}

// ---------- 统一指针事件入口 ----------
function getEventPos(e) {
  if (e.touches && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  return { x: e.clientX, y: e.clientY }
}

function onTabPointerDown(e, tab) {
  // 仅响应主按键（鼠标左键 / 触摸）
  if (e.button && e.button !== 0) return

  const idx = tabs.value.findIndex((t) => t.path === tab.path)
  if (idx === -1) return

  const pos = getEventPos(e)
  const el = e.currentTarget || e.target
  const rect = el.getBoundingClientRect()

  _pressInfo = { x: pos.x, y: pos.y, tab, index: idx }
  // 记录鼠标相对标签左边缘的偏移，拖拽时保持此相对位置不变
  _dragOffsetX = pos.x - rect.left

  // 启动长按定时器
  _longPressTimer = setTimeout(() => {
    _onLongPressConfirmed(pos.x, pos.y)
  }, LONG_PRESS_DELAY)
}

function onTabPointerMove(e) {
  const pos = getEventPos(e)

  if (_pressInfo && !isDraggingTab.value && !longPressState.value.showRing) {
    // 长按判定阶段：检测移动方向
    const dx = pos.x - _pressInfo.x
    const dy = pos.y - _pressInfo.y
    if (Math.abs(dx) > MOVE_THRESHOLD_X || Math.abs(dy) > MOVE_THRESHOLD_Y) {
      const horizontalSwipe = Math.abs(dx) >= MOVE_THRESHOLD_X
      cancelLongPress()

      // 横向滑动 → 取消长按后将控制权移交给滚动系统
      if (horizontalSwipe) {
        const isTouch = e.type === 'touchmove' || (e.touches && e.touches.length > 0)
        if (isTouch) {
          // 触屏：初始化触摸滚动
          touchStartX = pos.x
          touchStartScroll = tabsListEl.value?.scrollLeft || 0
          isTouchMove = false
        } else {
          // 鼠标：初始化鼠标拖拽滚动
          isDragging = true
          dragStartX = pos.x
          dragStartScroll = tabsListEl.value?.scrollLeft || 0
          if (tabsListEl.value) tabsListEl.value.style.cursor = 'grabbing'
        }
      }

      _pressInfo = null
      return  // 返回后 onMouseMove / onTouchMove 会接手滚动
    }
    return
  }

  // 拖拽模式下更新位置
  if (isDraggingTab.value && cachedTabRects.value.length > 0) {
    updateDragOverIndex(pos.x)
    // 视觉标签跟随鼠标横向移动（保持相对偏移不变）
    // pos.x 是视口坐标，需减去 barLeft 转为相对于标签栏容器的坐标
    if (visualTag.value.show) {
      visualTag.value.left = (pos.x - _barCachedLeft) - _dragOffsetX
    }
  }
}

function onTabPointerUp() {
  if (longPressState.value.showRing) {
    // 正在显示进度环时松手 → 取消
    cancelLongPress()
    _pressInfo = null
    return
  }

  if (isDraggingTab.value) {
    // 拖拽模式中松手 → 完成排序
    finalizeDrag()
    _pressInfo = null
    return
  }

  if (_pressInfo) {
    // 500ms 内正常松手 → 不拦截，让 click 处理切换标签
    cancelLongPress()
    _pressInfo = null
  }
}

function onTabPointerCancel() {
  cancelLongPress()
  if (isDraggingTab.value) endDrag()
  _pressInfo = null
}

// ---------- 长按确认 & 进度环 ----------
function _onLongPressConfirmed(x, y) {
  if (!_pressInfo) return

  longPressState.value.showRing = true
  longPressState.value.ringPercent = 0
  longPressState.value.ringX = x
  longPressState.value.ringY = y + 30  // 点击位置下方 20px

  // 每 100ms 更新百分比，1.3s 内走完 0→100
  const step = 100 / Math.ceil(PROGRESS_DURATION / 100)
  _progressRafId = setInterval(() => {
    longPressState.value.ringPercent += step
    if (longPressState.value.ringPercent >= 100) {
      longPressState.value.ringPercent = 100
      clearInterval(_progressRafId)
      _progressRafId = null
      _enterDragMode()
    }
  }, 100)
}

// ---------- 拖拽模式 ----------
function _enterDragMode() {
  if (!_pressInfo) return

  // 长按倒计时结束，震动反馈
  if (navigator.vibrate) navigator.vibrate(200)

  longPressState.value.showRing = false
  longPressState.value.ringPercent = 0

  const info = _pressInfo
  draggingPath.value = info.tab.path
  dragFromIndex.value = info.index
  isDraggingTab.value = true
  dragOverIndex.value = info.index

  // 获取当前被拖拽标签的位置信息（进度环结束后鼠标可能已移动，需实时取）
  const listEl = tabsListEl.value
  const tabItems = listEl ? Array.from(listEl.querySelectorAll('.tab-item')) : []
  const targetEl = tabItems[info.index]
  const tabRect = targetEl ? targetEl.getBoundingClientRect() : null

  // 记录鼠标相对标签左边缘的横轴偏移（拖拽期间保持不变）
  if (tabRect) {
    _dragOffsetX = info.x - tabRect.left
  }

  // 缓存所有 tab 初始位置（用于排序计算）
  cachedTabRects.value = tabItems.map((el) => {
    const r = el.getBoundingClientRect()
    return { left: r.left, right: r.right, width: r.width }
  })

  // 创建视觉标签（绝对定位在标签栏内，坐标需转为相对于 bar 的值）
  const barRect = tabsBarEl.value?.getBoundingClientRect() || { left: 0, top: 0 }
  _barCachedLeft = barRect.left
  visualTag.value = {
    show: true,
    left: tabRect ? tabRect.left - barRect.left : 0,
    top: tabRect ? tabRect.top - barRect.top : 0,
    title: info.tab.title,
    showClose: tabs.value.length > 1,
  }

  // 绑定 document 级指针释放事件（解决拖拽时移出 tab 元素收不到 up 的问题）
  document.addEventListener('mouseup', _onDocPointerUp, { passive: true })
  document.addEventListener('touchend', _onDocPointerUp, { passive: true })
  document.addEventListener('touchcancel', _onDocPointerCancel, { passive: true })
}

// document 级松手处理（拖拽模式下）
function _onDocPointerUp() {
  if (isDraggingTab.value) {
    finalizeDrag()
    _pressInfo = null
  }
}

// document 级取消处理
function _onDocPointerCancel() {
  cancelLongPress()
  if (isDraggingTab.value) endDrag()
  _pressInfo = null
}

function updateDragOverIndex(mouseX) {
  let targetIdx = 0
  for (let i = 0; i < cachedTabRects.value.length; i++) {
    const rect = cachedTabRects.value[i]
    const midX = (rect.left + rect.right) / 2
    if (mouseX > midX) {
      targetIdx = i + 1
    } else {
      targetIdx = i
      break
    }
  }
  dragOverIndex.value = Math.max(0, Math.min(targetIdx, tabs.value.length))
}

function finalizeDrag() {
  const fromIdx = dragFromIndex.value
  if (fromIdx === -1) { endDrag(); return }

  let toIdx = dragOverIndex.value
  if (toIdx === -1) toIdx = fromIdx

  // 被拖拽的标签本身不占位（已隐藏），所以不需要 toIdx--
  // 直接用 dragOverIndex 作为目标位置即可
  toIdx = Math.max(0, Math.min(toIdx, tabs.value.length - 1))

  if (fromIdx !== toIdx) {
    const [moved] = tabs.value.splice(fromIdx, 1)
    tabs.value.splice(toIdx, 0, moved)
  }

  endDrag()
}

function endDrag() {
  // 移除 document 级监听
  document.removeEventListener('mouseup', _onDocPointerUp)
  document.removeEventListener('touchend', _onDocPointerUp)
  document.removeEventListener('touchcancel', _onDocPointerCancel)

  // 隐藏视觉标签
  visualTag.value.show = false

  dragSnapping.value = true
  draggingPath.value = null
  dragOverIndex.value = -1
  dragFromIndex.value = -1
  cachedTabRects.value = []
  isDraggingTab.value = false
  _dragOffsetX = 0
  _barCachedLeft = 0

  requestAnimationFrame(() => {
    requestAnimationFrame(() => { dragSnapping.value = false })
  })
}

function cancelLongPress() {
  clearTimeout(_longPressTimer)
  clearInterval(_progressRafId)
  _longPressTimer = null
  _progressRafId = null
  longPressState.value.showRing = false
  longPressState.value.ringPercent = 0
}

// 组件卸载时清理
onBeforeUnmount(() => {
  cancelLongPress()
})

function onTabsWheel(e) {
  if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
    e.preventDefault()
  }
  tabsListEl.value.scrollLeft += e.deltaY
  updateScrollFades()
}

// 触摸拖拽（横向滚动）
let touchStartX = 0
let touchStartScroll = 0
let isTouchMove = false

function onTouchStart(e) {
  // 拖拽模式下不接管触摸
  if (isDraggingTab.value || _pressInfo) return
  touchStartX = e.touches[0].clientX
  touchStartScroll = tabsListEl.value?.scrollLeft || 0
  isTouchMove = false
}

function onTouchMove(e) {
  if (isDraggingTab.value) { e.preventDefault(); return }
  const dx = e.touches[0].clientX - touchStartX
  if (Math.abs(dx) > 5) {
    isTouchMove = true
    if (tabsListEl.value) {
      tabsListEl.value.scrollLeft = touchStartScroll - dx * 1.3
      updateScrollFades()
    }
  }
  if (isTouchMove) e.preventDefault()
}

function onTouchEnd() {
  isTouchMove = false
  // 触摸滚动结束，同步清理鼠标状态（防止跨输入类型污染）
  isDragging = false
  if (tabsListEl.value) tabsListEl.value.style.cursor = ''
}

// 鼠标拖拽滚动
let isDragging = false
let dragStartX = 0
let dragStartScroll = 0

function onMouseDown(e) {
  if (isDraggingTab.value || _pressInfo) return
  isDragging = true
  dragStartX = e.pageX
  dragStartScroll = tabsListEl.value?.scrollLeft || 0
  tabsListEl.value.style.cursor = 'grabbing'
}

function onMouseMove(e) {
  if (!isDragging) return
  if (isDraggingTab.value) return
  e.preventDefault()
  const walk = (e.pageX - dragStartX) * 1.5
  tabsListEl.value.scrollLeft = dragStartScroll - walk
  updateScrollFades()
}

function onMouseUp() {
  isDragging = false
  isTouchMove = false
  if (tabsListEl.value) tabsListEl.value.style.cursor = ''
}

onMounted(() => {
  updateScrollFades()
  window.addEventListener('resize', updateScrollFades)
})
</script>

<template>
  <div class="workspace-container">
    <!-- 自定义标签栏（可横向滚动 + 渐变遮罩） -->
    <div ref="tabsBarEl" class="workspace-tabs-bar">
      <!-- 标签下拉菜单 -->
      <NDropdown
        trigger="click"
        :options="tabDropdownOptions"
        :on-select="handleTabSelect"
        placement="bottom-start"
      >
        <div class="tab-dropdown-trigger">
          <NIcon :component="ChevronDown16Filled" size="18" />
        </div>
      </NDropdown>

      <div
        class="scroll-fade scroll-fade--left"
        :class="{ 'scroll-fade--visible': showLeftFade }"
      ></div>
      <div
        class="scroll-fade scroll-fade--right"
        :class="{ 'scroll-fade--visible': showRightFade }"
      ></div>
      <div
        ref="tabsListEl"
        class="tabs-list"
        :class="{ 'tabs-list--snapping': dragSnapping }"
        @wheel.prevent="onTabsWheel"
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
        @mousedown="onMouseDown"
        @mousemove="onMouseMove"
        @mouseup="onMouseUp"
        @mouseleave="onMouseUp"
      >
        <button
          v-for="(tab, index) in tabs"
          :key="tab.path"
          class="tab-item"
          :class="{
            'tab-item--active': activeTab === tab.path,
            'tab-item--dragging': draggingPath === tab.path,
            'tab-item--displaced': getDragOffset(index) !== 0 && draggingPath !== tab.path,
          }"
          :style="{ transform: `translateX(${getDragOffset(index)}px)` }"
          @click="switchTab(tab.path)"
          @mousedown="onTabPointerDown($event, tab)"
          @touchstart.passive="onTabPointerDown($event, tab)"
          @mousemove="onTabPointerMove($event)"
          @touchmove="onTabPointerMove($event)"
          @mouseup="onTabPointerUp($event)"
          @touchend="onTabPointerUp($event)"
          @pointercancel="onTabPointerCancel"
          @dragstart.prevent
        >
          <span class="tab-label">{{ tab.title }}</span>
          <span
            v-if="tabs.length > 1"
            class="tab-close"
            role="button"
            tabindex="-1"
            @click.stop="handleClose(tab.path)"
          >&#x2715;</span>
        </button>
      </div>

      <!-- 视觉拖拽标签（绝对定位，跟随鼠标，替代被隐藏的原标签） -->
      <div
        v-if="visualTag.show"
        class="visual-drag-tag"
        :style="{ left: visualTag.left + 'px', top: visualTag.top + 'px' }"
      >
        <span class="tab-label">{{ visualTag.title }}</span>
        <span
          v-if="visualTag.showClose"
          class="tab-close"
          role="button"
          tabindex="-1"
        >&#x2715;</span>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="workspace-content-wrapper">
      <div class="workspace-content">
        <component
          v-if="activeComponent"
          :is="activeComponent"
          :key="activeTab"
          :tab-path="activeTab"
        />
        <NEmpty v-else description="暂无内容" />
      </div>
    </div>

    <!-- 长按进度环（Teleport 到 body，绝对定位） -->
    <Teleport to="body">
      <div
        v-if="longPressState.showRing"
        class="long-press-ring"
        :style="{
          left: longPressState.ringX + 'px',
          top: longPressState.ringY + 'px',
        }"
      >
        <NProgress
          type="circle"
          :percentage="longPressState.ringPercent"
          :show-indicator="false"
          :stroke-width="25"
          :color="isDark ? '#fff' : '#000'"
          :rail-color="isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)'"
          :style="{ width: '15px', height: '15px' }"
        />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.workspace-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

/* ===== 标签栏容器 ===== */
.workspace-tabs-bar {
  position: relative;
  display: flex;
  align-items: flex-end;
  padding-top: 3px;
  flex-shrink: 0;
  background: var(--bg-color);
  width: 100%;
  border-bottom: 1px solid var(--border-color);
  overflow: hidden;
  margin-bottom: 24px;
}

/* 标签下拉菜单触发按钮（最左侧，与标签等高） */
.tab-dropdown-trigger {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 39px;
  flex-shrink: 0;
  cursor: pointer;
  border-radius: 8px 8px 0 0;
  color: var(--text-primary);
  user-select: none;
  margin-right: 5px;
}

/* 背景层独立于内容，opacity 只影响背景 */
.tab-dropdown-trigger::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-color: var(--bg-card);
  transition: opacity 0.15s ease;
}

.tab-dropdown-trigger:focus::before,
.tab-dropdown-trigger:hover::before,
.tab-dropdown-trigger:active::before {
  opacity: 0.72;
}

/* ===== 渐变遮罩 ===== */
.scroll-fade {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 36px;
  pointer-events: none;
  z-index: 2;
  opacity: 0;
  transition: opacity 0.25s ease;
}

.scroll-fade--left {
  left: 49px;
  background: linear-gradient(to right, var(--bg-color), transparent);
}

.scroll-fade--right {
  right: 0;
  background: linear-gradient(to left, var(--bg-color), transparent);
}

.scroll-fade--visible {
  opacity: 1;
}

/* ===== 可滚动的标签列表 ===== */
.tabs-list {
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;
  flex: 1 1 0;
  min-width: 0;
  padding-bottom: 0;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  cursor: grab;
}

.tabs-list::-webkit-scrollbar {
  display: none;
}

.tab-item {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
  overflow: hidden;
  flex-shrink: 0;
  min-height: 39px;
  box-sizing: border-box;
  transition: background-color 0.15s ease, color 0.15s ease, transform 0.15s ease;
}

.tab-item:hover {
  color: var(--text-primary);
  background: var(--bg-sub);
}

.tab-item--active {
  font-weight: 600;
  color: var(--text-primary);
  background: var(--bg-card);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-color);
  border-bottom: none;
}

/* 被拖拽的标签：隐藏（保留占位供排序计算），视觉由 visual-drag-tag 替代 */
.tab-item--dragging {
  visibility: hidden;
  pointer-events: none;
}

/* 被动移动的标签（腾出空间）：下层 */
.tab-item--displaced {
  z-index: 1;
}

/* 拖拽松手瞬间：禁用 transform 动画，偏移量瞬间归零避免多余回弹 */
.tabs-list--snapping .tab-item {
  transition: background-color 0.15s ease, color 0.15s ease !important;
}

.tab-label {
  line-height: 1;
  max-width: 4em;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 活跃标签的文字不截断 */
.tab-item--active .tab-label {
  max-width: none;
}

.tab-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  font-size: 10px;
  color: var(--text-tertiary);
  border-radius: 4px;
  transition: color 0.15s ease, background-color 0.15s ease;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
}

.tab-close:hover {
  color: var(--text-primary);
  background: var(--border-color);
}

/* 内容区域包装器 */
.workspace-content-wrapper {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.workspace-content {
  max-width: 1200px;
  width: 100%;
  box-sizing: border-box;
}

/* 长按进度环 */
.long-press-ring {
  position: fixed;
  z-index: 2147483647;
  pointer-events: none;
  transform: translate(-50%, -50%);
}

/* 覆盖 NProgress 内部 SVG 圆弧的 transition，让 rAF 驱动百分比精确对应 1.3s */
.long-press-ring :deep(.n-progress-circle) .n-progress-circle-fill {
  transition: stroke-dashoffset 0.05s linear !important;
}

/* 视觉拖拽标签（替代被隐藏的原标签，跟随鼠标横向移动） */
.visual-drag-tag {
  position: absolute;
  z-index: 20;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  background: var(--bg-sub);
  border-radius: 8px 8px 0 0;
  opacity: 0.55;
  pointer-events: none;
  white-space: nowrap;
  user-select: none;
  flex-shrink: 0;
  min-height: 39px;
  box-sizing: border-box;
}

.visual-drag-tag .tab-label {
  line-height: 1;
  max-width: none;
}

.visual-drag-tag .tab-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  font-size: 10px;
  color: var(--text-tertiary);
  border-radius: 4px;
  line-height: 1;
  flex-shrink: 0;
}
</style>

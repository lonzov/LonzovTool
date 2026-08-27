<script setup>
import { computed, watch, onMounted, onBeforeUnmount, ref, nextTick, h, defineAsyncComponent } from 'vue'
import { NProgress, NDropdown, NIcon, useMessage } from 'naive-ui'
import { useRouter, useRoute } from 'vue-router'
import { ChevronDown16Filled } from '@vicons/fluent'
import { useWorkspace, isExternalPath, getExternalUrl, isExternalUrlAllowed, getLogoFromPath } from '../composables/useWorkspace.js'
import { getToolIcon } from '../config/categoryIcons'
import { useTheme } from '../composables/useTheme.js'
import ToolLoading from './ToolLoading.vue'
import NotFoundView from '../views/NotFoundView.vue'

// 动态加载工具组件，实现按需加载
const asyncOptions = {
  loadingComponent: ToolLoading,
  errorComponent: ToolLoading,
  delay: 200,
  timeout: 10000,
}

const ExternalSiteView = defineAsyncComponent({
  loader: () => import('./ExternalSiteView.vue'),
  ...asyncOptions,
})

const ArtTextTool = defineAsyncComponent({
  loader: () => import('./tools/ArtTextTool.vue'),
  ...asyncOptions,
})
const TrAnimationTool = defineAsyncComponent({
  loader: () => import('./tools/TrAnimationTool.vue'),
  ...asyncOptions,
})
const SelectorTool = defineAsyncComponent({
  loader: () => import('./tools/selector/index.vue'),
  ...asyncOptions,
})
const ExecuteTool = defineAsyncComponent({
  loader: () => import('./tools/ExecuteTool.vue'),
  ...asyncOptions,
})
const FuhaoTool = defineAsyncComponent({
  loader: () => import('./tools/FuhaoTool.vue'),
  ...asyncOptions,
})
const RawJsonTool = defineAsyncComponent({
  loader: () => import('./tools/RawJsonTool.vue'),
  ...asyncOptions,
})

const router = useRouter()
const route = useRoute()
const message = useMessage()
const { tabs, activeTab, closeTab, restoreTabs, ensureTabForPath, setActiveTabWithoutPersist } = useWorkspace()
const { isDark } = useTheme()

// 路径到组件的映射
const componentMap = {
  '/c/qjzh': ArtTextTool,
  '/c/tr': TrAnimationTool,
  '/c/execute': ExecuteTool,
  '/c/fuhao': FuhaoTool,
  '/c/raw-json': RawJsonTool,
  '/c/selector': SelectorTool,
}

function getComponent(path) {
  const normalized = path.replace(/\/+$/, '')
  return componentMap[normalized] || null
}

// 是否为工作站路由：本地工具页 /c/ 或站外嵌入页 /embed/
function isWorkspaceRoutePath(p) {
  return p.startsWith('/c/') || p.startsWith('/embed/')
}

// 当前活跃标签对应的站外 URL（否则为 null），用于渲染 iframe 嵌入
const activeExternalUrl = computed(() => {
  if (!activeTab.value) return null
  const url = isExternalPath(activeTab.value) ? getExternalUrl(activeTab.value) : null
  // 域名白名单校验：不在 tools.json 站外链接中的直接交 404 处理
  return url && isExternalUrlAllowed(url) ? url : null
})

// 各标签的 logo（放到标签栏标题前 / 下拉菜单）；站外为图片路径或图标名，站内为图标名
const tabLogos = computed(() => {
  const map = {}
  for (const tab of tabs.value) {
    map[tab.path] = getLogoFromPath(tab.path)
  }
  return map
})

function isIconTabLogo(logo) {
  return !!logo && !logo.startsWith('/') && !/^https?:/i.test(logo)
}

// 生成下拉菜单选项的 logo 渲染（naive dropdown option.icon，图片/图标两种）
function makeTabLogoIcon(tab) {
  const logo = getLogoFromPath(tab.path)
  if (!logo) return undefined
  if (isIconTabLogo(logo)) {
    const comp = getToolIcon(logo)
    // 用站点主题色变量，随深浅色自动适配
    return comp ? () => h(NIcon, { component: comp, size: 18, color: 'var(--text-secondary)' }) : undefined
  }
  // 图片 logo：圆角遮罩裁切
  return () =>
    h(
      'span',
      { style: 'width:18px;height:18px;border-radius:4px;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center' },
      [h('img', { src: logo, alt: '', style: 'width:100%;height:100%;object-fit:contain;display:block' })],
    )
}

// 已知工具页或通过白名单的站外标签 → 需持久化为正式标签；其余视为无效页面
function ensureTabForRoutePath(routePath) {
  const externalUrl = isExternalPath(routePath) ? getExternalUrl(routePath) : null
  if (getComponent(routePath) || (externalUrl && isExternalUrlAllowed(externalUrl))) {
    ensureTabForPath(routePath)
  } else {
    // 无效工具页 / 不在白名单的站外链接：UI 显示"暂无内容"，但不写入 localStorage
    setActiveTabWithoutPersist(routePath)
  }
}

function handleClose(path) {
  const result = closeTab(path)
  if (result === 'last') {
    message.warning('至少保留一个标签页')
    return
  }
}

// 中键点击标签页：关闭该标签页（auxclick 也含右键 button=2，需仅响应中键）
function onTabAuxClick(e, tab) {
  if (e.button !== 1) return
  e.preventDefault()
  handleClose(tab.path)
}

// 切换活跃标签
function switchTab(path) {
  if (activeTab.value !== path) {
    activeTab.value = path
  }
}

// ===== 标签下拉菜单（最左侧图标） =====
const tabDropdownOptions = computed(() =>
  tabs.value.map((tab) => {
    const opt = { label: tab.title, key: tab.path }
    const icon = makeTabLogoIcon(tab)
    if (icon) opt.icon = icon
    return opt
  })
)

function handleTabSelect(key) {
  if (key !== activeTab.value) {
    activeTab.value = key
  }
}

// 监听标签变化，全部关闭时回首页
watch(tabs, (val) => {
  if (val.length === 0 && isWorkspaceRoutePath(router.currentRoute.value.path)) {
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
  // 站外标签路径本身即为完整路由；本地工具标签统一补上 /c/ 前缀
  const fullPath = isExternalPath(newPath)
    ? newPath
    : ('/c/' + (newPath === '/c/' ? '' : newPath.replace(/^\/c\//, '')))
  if (route.fullPath !== fullPath) {
    router.replace(fullPath)
  }
})

// ===== 从路由同步到活跃标签（处理路径不在 tabs 中的情况） =====
function syncFromRoute() {
  const routePath = route.path
  if (!isWorkspaceRoutePath(routePath)) return

  syncingFromRoute = true
  ensureTabForRoutePath(routePath)
  setTimeout(() => { syncingFromRoute = false }, 0)
}

// SSR 期间 onMounted 不执行，直接在 setup 中根据路由初始化 activeTab，
// 确保预渲染时工具页渲染正确的工具组件而非 NotFoundView
if (isWorkspaceRoutePath(route.path)) {
  const normalizedRoute = route.path.replace(/\/+$/, '')
  if (normalizedRoute !== '/c' && normalizedRoute !== '/embed') {
    ensureTabForRoutePath(route.path)
  }
}

onMounted(() => {
  if (typeof window === 'undefined' || !isWorkspaceRoutePath(route.path)) return

  // restoreTabs 是幂等的：tabs 已有数据时直接跳过
  restoreTabs()

  const normalizedRoute = route.path.replace(/\/+$/, '')

  if (normalizedRoute !== '/c' && normalizedRoute !== '/embed') {
    // URL 明确指向某个工具页或站外链接 — 以 URL 为准（直接输入地址或卡片点击）
    syncingFromRoute = true
    ensureTabForRoutePath(route.path)
    setTimeout(() => { syncingFromRoute = false }, 0)
  } else if (activeTab.value) {
    // URL 仅为 /c 或 /embed，无具体工具，用本地存储的活跃标签
    syncingFromRoute = true
    const targetPath = isExternalPath(activeTab.value)
      ? activeTab.value
      : '/c/' + (activeTab.value === '/c/' ? '' : activeTab.value.replace(/^\/c\//, ''))
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

// 把焦点标签滚动到标签栏可见区域内：
// 优先让焦点标签位于标签栏区域最左；若其右侧内容不足以填满视口（无法满足居左），则完全居右
function scrollActiveTabIntoView() {
  const list = tabsListEl.value
  const active = activeTab.value
  if (!list || !active) return
  const el = list.querySelector(`.tab-item[data-path="${CSS.escape(active)}"]`)
  if (!el) return

  const listRect = list.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  // 焦点标签相对标签栏内容起始位置的左偏移（= 滚动到其位于最左所需 scrollLeft）
  const preferred = elRect.left - listRect.left + list.scrollLeft
  const max = Math.max(0, list.scrollWidth - list.clientWidth)

  list.scrollTo({ left: Math.max(0, preferred <= max ? preferred : max), behavior: 'smooth' })
  updateScrollFades()
}

// ===== 长按拖拽排序系统 =====
// 流程：按下 → 500ms内松开=普通点击 / 500ms后显示进度环 → 可配置倒计时 → 进入拖拽模式 → 松手完成排序
const LONG_PRESS_DELAY = 500     // 长按判定时间 ms
const PROGRESS_DURATION_DEFAULT = 700

function getProgressDuration() {
  try {
    if (typeof localStorage === 'undefined') return PROGRESS_DURATION_DEFAULT
    const val = localStorage.getItem('tab_drag_delay')
    const num = parseInt(val, 10)
    return (num >= 100 && num <= 2000) ? num : PROGRESS_DURATION_DEFAULT
  } catch { return PROGRESS_DURATION_DEFAULT }
}
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
let _dragScrollStart = 0        // 拖拽开始时的标签栏 scrollLeft（自动滚动时补偿缓存标签位置）
let _dragLastClientX = 0        // 拖拽期间最近一次指针 x（自动滚动时更新排序索引）

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

  // 拖拽位置/边缘自动滚动交由 document 级 _onDocPointerMove 处理，
  // 覆盖标签、空白区、边缘等任意指针位置
  return
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

  // 每 100ms 更新百分比，在配置的时长内走完 0→100
  const duration = getProgressDuration()
  const step = 100 / Math.ceil(duration / 100)
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

  // 记录拖拽开始时的滚动位置（自动滚动时用于补偿缓存标签位置）
  _dragScrollStart = listEl?.scrollLeft || 0

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

  // 绑定 document 级指针移动/释放事件（覆盖空白区、边缘等任意指针位置）
  document.addEventListener('mousemove', _onDocPointerMove, { passive: true })
  document.addEventListener('mouseup', _onDocPointerUp, { passive: true })
  document.addEventListener('touchmove', _onDocPointerMove, { passive: true })
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

// document 级指针移动处理：更新排序索引/视觉标签 + 边缘自动滚动
function _onDocPointerMove(e) {
  if (!isDraggingTab.value) return
  const pos = getEventPos(e)
  _dragLastClientX = pos.x
  updateDragVisual(pos.x)
  updateReorderEdge(pos.x)
}

// 按当前指针位置刷新排序索引与视觉标签位置
function updateDragVisual(clientX) {
  if (cachedTabRects.value.length === 0) return
  // 自动滚动会让缓存标签位置失效，用滚动增量补偿
  const scrollDelta = (tabsListEl.value?.scrollLeft || 0) - _dragScrollStart
  updateDragOverIndex(clientX, scrollDelta)
  // 视觉标签跟随鼠标横向移动（保持相对偏移不变，坐标转为相对于标签栏容器）
  if (visualTag.value.show) {
    visualTag.value.left = (clientX - _barCachedLeft) - _dragOffsetX
  }
}

// document 级取消处理
function _onDocPointerCancel() {
  cancelLongPress()
  if (isDraggingTab.value) endDrag()
  _pressInfo = null
}

function updateDragOverIndex(mouseX, scrollDelta = 0) {
  let targetIdx = 0
  for (let i = 0; i < cachedTabRects.value.length; i++) {
    const rect = cachedTabRects.value[i]
    // 标签栏滚动会让缓存的初始位置失效，需按滚动增量补偿
    const midX = (rect.left + rect.right) / 2 - scrollDelta
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
  document.removeEventListener('mousemove', _onDocPointerMove)
  document.removeEventListener('mouseup', _onDocPointerUp)
  document.removeEventListener('touchmove', _onDocPointerMove)
  document.removeEventListener('touchend', _onDocPointerUp)
  document.removeEventListener('touchcancel', _onDocPointerCancel)
  stopEdgeScroll()

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
  _dragScrollStart = 0
  _dragLastClientX = 0

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
  stopEdgeScroll()
  if (isDraggingTab.value) endDrag()
})

function onTabsWheel(e) {
  // 触控板/鼠标横滚（deltaX 主导）直接按 deltaX 横向滚动；
  // 普通纵向滚轮（deltaY 主导）转换为横向滚动（阻止页面滚动）
  const dx = Math.abs(e.deltaX)
  const dy = Math.abs(e.deltaY)
  const delta = dx >= dy ? e.deltaX : e.deltaY
  if (tabsListEl.value) {
    tabsListEl.value.scrollLeft += delta
    updateScrollFades()
  }
}

// 触摸拖拽（横向滚动）
let touchStartX = 0
let touchStartScroll = 0
let isTouchMove = false

function onTouchStart(e) {
  // 拖拽模式下不接管触摸
  if (isDraggingTab.value) return
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
  // 仅左键触发拖拽滚动，中键/右键交给各自的逻辑（中键关闭标签页）
  if (e.button !== 0) return
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

// ===== 长按排序拖拽到边缘时，标签栏自动滑动（动态速度，越靠边越快）=====
const EDGE_THRESHOLD = 60 // 距标签栏左右边缘多少 px 触发自动滚动
const EDGE_MAX_SPEED = 5 // 贴边时的最快速度（每帧滚动的像素上限）
const EDGE_SPEED_POWER = 2 // 速度曲线指数：>1 时慢速占比更多，快速只集中于贴边附近

let edgeDir = 0 // -1 左 / 1 右 / 0 停
let edgeRafId = null
let edgeAccum = 0 // 子像素位移累积（保证慢速区间也能平滑前进）

// 排序拖拽：指针靠近标签栏左右边缘时决定自动滚动方向
function updateReorderEdge(clientX) {
  const el = tabsListEl.value
  if (!el || !isDraggingTab.value) {
    setEdgeDir(0)
    return
  }
  const rect = el.getBoundingClientRect()
  let dir = 0
  if (clientX - rect.left < EDGE_THRESHOLD) {
    dir = -1
  } else if (rect.right - clientX < EDGE_THRESHOLD) {
    dir = 1
  }
  setEdgeDir(dir)
}

function setEdgeDir(dir) {
  if (edgeDir === dir) return
  edgeDir = dir
  if (dir !== 0) {
    if (!edgeRafId) edgeRafId = requestAnimationFrame(edgeScrollTick)
  } else {
    stopEdgeScroll()
  }
}

// 由指针到边缘的距离动态算每帧速度：贴边最大，向阈值边界渐减，呈"慢占多数、快贴边"的曲线
function getEdgeSpeed() {
  const el = tabsListEl.value
  if (!el) return 0
  const rect = el.getBoundingClientRect()
  const x = _dragLastClientX
  const dist = edgeDir === -1 ? x - rect.left : rect.right - x
  const ratio = Math.max(0, Math.min(dist, EDGE_THRESHOLD)) / EDGE_THRESHOLD
  return EDGE_MAX_SPEED * Math.pow(1 - ratio, EDGE_SPEED_POWER)
}

function edgeScrollTick() {
  if (edgeDir === 0) {
    stopEdgeScroll()
    return
  }
  const el = tabsListEl.value
  if (el) {
    // 累积子像素位移，达到 1px 才滚动，慢速区间也能持续前进
    edgeAccum += getEdgeSpeed() * edgeDir
    const step = Math.floor(Math.abs(edgeAccum))
    if (step > 0) {
      el.scrollLeft += step * Math.sign(edgeAccum)
      edgeAccum -= step * Math.sign(edgeAccum)
      updateScrollFades()
      // 触底/触顶后不再滚动
      el.scrollLeft = Math.max(0, Math.min(el.scrollLeft, el.scrollWidth - el.clientWidth))
      // 自动滚动时同步刷新排序索引/视觉标签，让 drop 目标跟随滚动
      if (isDraggingTab.value) updateDragVisual(_dragLastClientX)
    }
  }
  edgeRafId = requestAnimationFrame(edgeScrollTick)
}

function stopEdgeScroll() {
  if (edgeRafId) {
    cancelAnimationFrame(edgeRafId)
    edgeRafId = null
  }
  edgeDir = 0
  edgeAccum = 0
}

onMounted(() => {
  updateScrollFades()
  window.addEventListener('resize', updateScrollFades)
  // 首次进入工作站页：把焦点标签滚入可见区域（工作站内切换标签不触发）
  nextTick(() => scrollActiveTabIntoView())
})
</script>

<template>
  <div
    class="workspace-container"
    :class="{ 'workspace--external': !!activeExternalUrl }"
  >
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
          :data-path="tab.path"
          :class="{
            'tab-item--active': activeTab === tab.path,
            'tab-item--dragging': draggingPath === tab.path,
            'tab-item--displaced': getDragOffset(index) !== 0 && draggingPath !== tab.path,
          }"
          :style="{ transform: `translateX(${getDragOffset(index)}px)` }"
          @click="switchTab(tab.path)"
          @auxclick="onTabAuxClick($event, tab)"
          @mousedown="onTabPointerDown($event, tab)"
          @touchstart.passive="onTabPointerDown($event, tab)"
          @mousemove="onTabPointerMove($event)"
          @touchmove="onTabPointerMove($event)"
          @mouseup="onTabPointerUp($event)"
          @touchend="onTabPointerUp($event)"
          @pointercancel="onTabPointerCancel"
          @dragstart.prevent
          @contextmenu.prevent
        >
          <span v-if="tabLogos[tab.path]" class="tab-logo">
            <NIcon
              v-if="isIconTabLogo(tabLogos[tab.path])"
              :component="getToolIcon(tabLogos[tab.path])"
              :size="13"
            />
            <img v-else :src="tabLogos[tab.path]" alt="" class="tab-logo-img" />
          </span>
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
        <ExternalSiteView
          v-else-if="activeExternalUrl"
          :url="activeExternalUrl"
          :key="activeTab"
        />
        <NotFoundView v-else />
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
  transition: background-color 0.3s var(--n-bezier, cubic-bezier(.4, 0, .2, 1)),
    border-color 0.3s var(--n-bezier, cubic-bezier(.4, 0, .2, 1));
}

/* 站外嵌入时：标签栏紧贴下方导航栏 */
.workspace--external .workspace-tabs-bar {
  margin-bottom: 10px;
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
  transition: background-color 0.3s var(--n-bezier, cubic-bezier(.4, 0, .2, 1)),
    opacity 0.15s ease;
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

.scroll-fade::after {
  content: '';
  position: absolute;
  inset: 0;
  background-color: var(--bg-color);
  transition: background-color 0.3s var(--n-bezier, cubic-bezier(.4, 0, .2, 1));
}

.scroll-fade--left {
  left: 49px;
}

.scroll-fade--left::after {
  mask-image: linear-gradient(to right, black, transparent);
  -webkit-mask-image: linear-gradient(to right, black, transparent);
}

.scroll-fade--right {
  right: 0;
}

.scroll-fade--right::after {
  mask-image: linear-gradient(to left, black, transparent);
  -webkit-mask-image: linear-gradient(to left, black, transparent);
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
  border-color: var(--border-color);
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none; /* 阻止 iOS 长按弹出 callout/菜单 */
  overflow: hidden;
  flex-shrink: 0;
  min-height: 39px;
  box-sizing: border-box;
  /*
    与 Naive UI layout 的 0.3s + cubic-bezier(.4,0,.2,1) 主题过渡保持一致：
    - 交互属性（背景/文字）→ 0.15s ease 跟手
    - 主题属性（边框/阴影）→ 0.3s，贝塞尔曲线与 NLayout 同步
    - 拖拽位移 → 0.15s ease
  */
  transition: background-color 0.15s ease, color 0.15s ease,
    border-color 0.3s var(--n-bezier, cubic-bezier(.4, 0, .2, 1)),
    box-shadow 0.3s var(--n-bezier, cubic-bezier(.4, 0, .2, 1)),
    transform 0.15s ease;
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
  /*
    焦点标签的 background-color 跟随主题变化，使用与 NLayout 一致的
    0.3s + Naive 贝塞尔曲线；其余属性继承 .tab-item 的过渡
  */
  transition: background-color 0.3s var(--n-bezier, cubic-bezier(.4, 0, .2, 1)),
    color 0.15s ease,
    border-color 0.3s var(--n-bezier, cubic-bezier(.4, 0, .2, 1)),
    box-shadow 0.3s var(--n-bezier, cubic-bezier(.4, 0, .2, 1)),
    transform 0.15s ease;
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
  transition: background-color 0.15s ease, color 0.15s ease,
    border-color 0.3s var(--n-bezier, cubic-bezier(.4, 0, .2, 1)),
    box-shadow 0.3s var(--n-bezier, cubic-bezier(.4, 0, .2, 1)) !important;
}

.tab-label {
  line-height: 1;
  max-width: 4em;
  overflow: hidden;
  text-overflow: ellipsis;
  /* 标签文字不允许被选中 */
  user-select: none;
  -webkit-user-select: none;
}

/* 站外标签标题前的 logo（16px 圆角小图 / 小图标） */
.tab-logo {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.tab-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
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

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { NIcon } from 'naive-ui'
import { ZoomIn24Regular, ZoomOut24Regular } from '@vicons/fluent'
import { previewHtml } from '../../composables/useRawJsonEditor.js'
import AppScrollbar from '../ui/AppScrollbar.vue'
import '../../vendor/mcfc/mcfc.css'

defineProps({
  /** 容器是 flex 列时吃掉剩余高度（紧凑布局的大预览区），否则按内容撑高 */
  fill: { type: Boolean, default: false },
})

const ZOOM_STEP = 0.1
const ZOOM_MIN = 0.5
const ZOOM_MAX = 2
/** 累积多少滚动量走一档：鼠标滚轮一格就跨过去，触控板捏合的碎 delta 则要攒几下 */
const WHEEL_STEP_PX = 40

const zoom = ref(1)
/** 捏合过程中关掉过渡，否则缩放假手，跟不上手指 */
const pinching = ref(false)

function clampZoom(value) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 100) / 100))
}

function stepZoom(delta) {
  zoom.value = clampZoom(zoom.value + delta)
}

// Ctrl + 滚轮，触控板的双指捏合也是这个事件；拦下浏览器自己的页面缩放
let wheelAccum = 0
function onWheel(e) {
  if (!e.ctrlKey) return
  e.preventDefault()
  wheelAccum += e.deltaY
  if (Math.abs(wheelAccum) < WHEEL_STEP_PX) return
  stepZoom(wheelAccum < 0 ? ZOOM_STEP : -ZOOM_STEP)
  wheelAccum = 0
}

// ===== 触摸端双指捏合 =====
let pinchStartDist = 0
let pinchStartZoom = 1

function touchDistance(touches) {
  const [a, b] = touches
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

function onTouchStart(e) {
  if (e.touches.length !== 2) return
  pinchStartDist = touchDistance(e.touches)
  pinchStartZoom = zoom.value
  pinching.value = true
}

function onTouchMove(e) {
  if (e.touches.length !== 2 || !pinchStartDist) return
  e.preventDefault()
  zoom.value = clampZoom(pinchStartZoom * (touchDistance(e.touches) / pinchStartDist))
}

function onTouchEnd(e) {
  if (e.touches.length >= 2) return
  pinchStartDist = 0
  pinching.value = false
}

// ===== 鼠标拖拽平移 =====
// 触摸端交给原生滚动，这里只接鼠标：把拖拽位移映射成容器的滚动偏移，
// 手感与看图工具一致；选区由 .preview-stage 的 user-select: none 兜住
const boxRef = ref(null)
const panning = ref(false)
let panStart = null

function onPanStart(e) {
  if (e.pointerType !== 'mouse' || e.button !== 0) return
  // 缩放按钮与浮层拇指自己接管指针，不参与平移
  if (e.target.closest('.preview-zoom, .asb')) return
  const box = boxRef.value
  if (!box) return
  e.preventDefault()
  panStart = { x: e.clientX, y: e.clientY, left: box.scrollLeft, top: box.scrollTop }
  panning.value = true
  window.addEventListener('pointermove', onPanMove)
  window.addEventListener('pointerup', onPanEnd)
}

function onPanMove(e) {
  if (!panStart) return
  const box = boxRef.value
  if (!box) return
  box.scrollLeft = panStart.left - (e.clientX - panStart.x)
  box.scrollTop = panStart.top - (e.clientY - panStart.y)
}

function onPanEnd() {
  panStart = null
  panning.value = false
  window.removeEventListener('pointermove', onPanMove)
  window.removeEventListener('pointerup', onPanEnd)
}

onBeforeUnmount(onPanEnd)

// ===== 缩放与滚动条同步 =====
// 缩放是 CSS transform，滚动尺寸随之变化，但既不会触发 resize 也不会触发 DOM 变更，
// 滚动条只能靠这里主动同步：过渡期间逐帧测一次，拇指长度与「该不该出现」都跟得上。
const scrollbarRef = ref(null)
let liveRaf = 0
let liveUntil = 0

function keepScrollbarInSync(ms = 320) {
  liveUntil = Math.max(liveUntil, performance.now() + ms)
  if (liveRaf) return
  const tick = () => {
    syncTail()
    scrollbarRef.value?.sync()
    liveRaf = performance.now() < liveUntil ? requestAnimationFrame(tick) : 0
  }
  liveRaf = requestAnimationFrame(tick)
}

// 内容靠 auto 外边距居中、再按左上锚点放大：放大后的外框只朝右下溢出，
// 滚到尽头时下缘/右缘会贴死容器边缘，而上缘/左缘还留着居中留白。
// 垫片把滚动区向右下补出同等留白，两端滚到尽头看到的空隙才一致
const contentRef = ref(null)
const tailRef = ref(null)

function syncTail() {
  const box = boxRef.value
  const content = contentRef.value
  const tail = tailRef.value
  if (!box || !content || !tail) return
  const boxRect = box.getBoundingClientRect()
  const contentRect = content.getBoundingClientRect()
  const boxStyle = getComputedStyle(box)
  const contentLeft = contentRect.left - boxRect.left - box.clientLeft + box.scrollLeft
  const contentTop = contentRect.top - boxRect.top - box.clientTop + box.scrollTop
  const contentRight = contentRect.right - boxRect.left - box.clientLeft + box.scrollLeft
  const contentBottom = contentRect.bottom - boxRect.top - box.clientTop + box.scrollTop
  const gapX = Math.max(contentLeft, Number.parseFloat(boxStyle.paddingLeft) || 0)
  const gapY = Math.max(contentTop, Number.parseFloat(boxStyle.paddingTop) || 0)
  // 向下取整：内容居中时垫片恰好等于可视尺寸，多出 1px 会让滚动条凭空出现
  tail.style.width = `${Math.max(0, Math.floor(contentRight + gapX))}px`
  tail.style.height = `${Math.max(0, Math.floor(contentBottom + gapY))}px`
}

let tailObserver = null

onMounted(() => {
  nextTick(() => {
    syncTail()
    scrollbarRef.value?.sync()
  })
  if (typeof ResizeObserver !== 'undefined') {
    tailObserver = new ResizeObserver(() => {
      syncTail()
      scrollbarRef.value?.sync()
    })
    if (boxRef.value) tailObserver.observe(boxRef.value)
    if (contentRef.value) tailObserver.observe(contentRef.value)
  }
})

watch(zoom, () => {
  keepScrollbarInSync()
  scrollbarRef.value?.wake()
})

onBeforeUnmount(() => {
  if (liveRaf) cancelAnimationFrame(liveRaf)
  tailObserver?.disconnect()
  tailObserver = null
})
</script>

<template>
  <div
    class="preview-stage"
    :class="{ 'preview-stage--fill': fill }"
    @wheel="onWheel"
    @pointerdown="onPanStart"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
    @touchcancel="onTouchEnd"
  >
    <div ref="boxRef" class="preview-box" :class="{ 'preview-box--panning': panning }">
      <div
        ref="contentRef"
        class="preview-content mcfc"
        :class="{ 'preview-content--instant': pinching }"
        :style="{ transform: `scale(${zoom})` }"
        v-html="previewHtml"
      />
      <span ref="tailRef" class="preview-tail" aria-hidden="true" />
    </div>
    <AppScrollbar ref="scrollbarRef" :target="boxRef" horizontal :inset="3" :edge="8" />

    <div class="preview-zoom">
      <button
        class="preview-zoom-btn"
        :disabled="zoom >= ZOOM_MAX"
        title="放大"
        aria-label="放大"
        @click="stepZoom(ZOOM_STEP)"
      >
        <NIcon :component="ZoomIn24Regular" :size="14" />
      </button>
      <button
        class="preview-zoom-btn"
        :disabled="zoom <= ZOOM_MIN"
        title="缩小"
        aria-label="缩小"
        @click="stepZoom(-ZOOM_STEP)"
      >
        <NIcon :component="ZoomOut24Regular" :size="14" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.preview-stage {
  position: relative;
  /* 拦下浏览器自己的双指缩放，捏合交给我们映射成缩放 */
  touch-action: pan-x pan-y;
  /* 拖拽是平移不是选字 */
  user-select: none;
  -webkit-user-select: none;
}
.preview-stage--fill {
  flex: 1;
  min-height: 0;
}

/* stylelint-disable declaration-property-value-disallowed-list --
   预览舞台固定深色：它模拟的是游戏内聊天框，预览内容由 vendor/mcfc 按 Minecraft
   原色渲染、假定深底。改成 --card 会让浅色主题下预览变白底，MC 颜色失去对比。
   缩放按钮与浮层拇指压在这个固定深底上，同理只能用固定浅色。 */
.preview-stage {
  /* 浮层拇指压在深底上：通过组件变量传浅色，不动主题 token */
  --asb-thumb: #ffffff3d;
  --asb-thumb-hover: #ffffff80;
}
.preview-box {
  position: relative;
  height: 100%;
  background: #1a1a1a; border-radius: var(--radius-md); border: 1px solid #333;
  padding: 12px 16px; min-height: 60px;
  /* 居中交给 .preview-content 的 auto 外边距。用 align-items/justify-content 居中时，
     内容一旦高过容器就会向两端等量溢出，顶部那截落在滚动区之外，永远滚不回去 */
  display: flex;
  overflow: auto;
  cursor: grab;
  scrollbar-width: none;
}
/* 右下留白垫片：尺寸由脚本按内容实际外框补出，本身不可见也不吃事件 */
.preview-tail {
  position: absolute;
  top: 0; left: 0;
  pointer-events: none;
}
.preview-box::-webkit-scrollbar {
  display: none;
}
[data-theme="dark"] .preview-box {
  background: #111;
  border-color: #2b2b2b;
}
.preview-box--panning { cursor: grabbing; }
/* 缩放入口：鼠标进到预览区才渐显，按钮不随舞台内容滚动 */
.preview-zoom {
  position: absolute;
  top: 8px; right: 8px;
  display: flex; gap: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.preview-stage:hover .preview-zoom,
.preview-stage:focus-within .preview-zoom { opacity: 1; }
.preview-zoom-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: #ffffff1a;
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  color: #d0d0d0;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, opacity 0.15s ease;
}
.preview-zoom-btn:hover { background: #ffffff33; color: #fff; }
.preview-zoom-btn:active { transform: scale(0.94); }
.preview-zoom-btn:disabled { opacity: 0.35; cursor: default; }
.preview-zoom-btn:disabled:hover { background: #ffffff1a; color: #d0d0d0; }
/* stylelint-enable declaration-property-value-disallowed-list */

.preview-stage--fill .preview-box { min-height: 0; }

.preview-content {
  display: inline-block;
  margin: auto;
  /* 永不自动折行：换行只由内容里的 \n 决定，超长行进游戏内一样靠横向滚动看。
    用 pre 而不是 nowrap —— nowrap 会把 \n 当成普通空格，段落就没了 */
  white-space: pre;
  /* 行高必须写死：符号字形本身近 3em 高，靠字体度量自动算会把带符号的行撑到 2.9em。
     游戏内符号是跨行叠着的，1.19 = 游戏内行距 20px ÷ 汉字墨迹 17px × 本字体汉字墨迹 1.01em */
  font-size: 14px; line-height: 1.19; text-align: left;
  letter-spacing: 0.8px;
  /* 缩放锚在左上：居中锚点会让放大后的内容向两端等量溢出，左上那截滚不到 */
  transform-origin: top left;
  transition: transform 0.2s ease;
}
.preview-content--instant { transition: none; }
</style>

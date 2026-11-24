<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * 浮层滚动条：拇指是绝对定位的真实元素，画在面板内边距里。
 *
 * 不参与流内布局，所以出现/消失不会改变内容宽度（不抖动），面板左右留白也保持设计值；
 * 只在内容溢出时存在，且仅在悬停面板、触摸按下或正在滚动时淡入。
 * 原生滚动继续负责滚轮、键盘与触摸，只是把原生条视觉隐藏。
 *
 * 调用方把本组件放进一个 position: relative 的容器里，容器范围就是拇指可活动的区域。
 */
const props = defineProps({
  /** 滚动容器元素（不是 ref） */
  target: { type: Object, default: null },
  vertical: { type: Boolean, default: true },
  horizontal: { type: Boolean, default: false },
  /** 拇指距容器边缘的距离 */
  inset: { type: Number, default: 3 },
  /** 轨道两端的留白，避开圆角 */
  edge: { type: Number, default: 6 },
})

const THUMB_SIZE = 5
const MIN_THUMB = 24
/** 停止滚动后再停留多久淡出 */
const LINGER_MS = 900

const metrics = ref({ top: 0, left: 0, scrollH: 0, clientH: 0, scrollW: 0, clientW: 0 })
const hovering = ref(false)
const lingering = ref(false)
const dragging = ref(false)

const active = computed(() => hovering.value || lingering.value || dragging.value)
const vOverflow = computed(() => props.vertical && metrics.value.scrollH - metrics.value.clientH > 1)
const hOverflow = computed(() => props.horizontal && metrics.value.scrollW - metrics.value.clientW > 1)

function geometry(axis) {
  const { top, left, scrollH, clientH, scrollW, clientW } = metrics.value
  const isVertical = axis === 'v'
  const view = isVertical ? clientH : clientW
  const content = isVertical ? scrollH : scrollW
  const offset = isVertical ? top : left
  const track = view - props.edge * 2
  if (track <= 0 || content <= view) return { size: 0, pos: 0 }
  const size = Math.min(track, Math.max(MIN_THUMB, Math.round((track * view) / content)))
  const maxScroll = content - view
  const pos = maxScroll > 0 ? Math.round((offset / maxScroll) * (track - size)) : 0
  return { size, pos }
}

const vThumb = computed(() => geometry('v'))
const hThumb = computed(() => geometry('h'))

const vThumbStyle = computed(() => ({
  width: `${THUMB_SIZE}px`,
  height: `${vThumb.value.size}px`,
  top: `${vThumb.value.pos}px`,
}))
const hThumbStyle = computed(() => ({
  height: `${THUMB_SIZE}px`,
  width: `${hThumb.value.size}px`,
  left: `${hThumb.value.pos}px`,
}))

const barStyle = computed(() => ({
  '--asb-inset': `${props.inset}px`,
  '--asb-edge': `${props.edge}px`,
}))

let measureRaf = 0
function scheduleMeasure() {
  if (measureRaf) return
  measureRaf = requestAnimationFrame(() => {
    measureRaf = 0
    measure()
  })
}

function measure() {
  const el = props.target
  if (!el) return
  metrics.value = {
    top: el.scrollTop,
    left: el.scrollLeft,
    scrollH: el.scrollHeight,
    clientH: el.clientHeight,
    scrollW: el.scrollWidth,
    clientW: el.clientWidth,
  }
}

let lingerTimer = 0
function linger() {
  lingering.value = true
  clearTimeout(lingerTimer)
  lingerTimer = setTimeout(() => { lingering.value = false }, LINGER_MS)
}

function onScroll() {
  const el = props.target
  if (!el) return
  // 滚动位置只影响拇指，不必重读内容尺寸
  metrics.value = { ...metrics.value, top: el.scrollTop, left: el.scrollLeft }
  linger()
}

function onPointerDown() {
  // 触摸端没有悬停，按下与滚动同样算「正在操作」
  linger()
}

let boundEl = null
let boundHost = null
let resizeObserver = null
let mutationObserver = null

function unbind() {
  if (boundEl) {
    boundEl.removeEventListener('scroll', onScroll)
    boundEl.removeEventListener('pointerdown', onPointerDown)
  }
  if (boundHost) {
    boundHost.removeEventListener('pointerenter', onHostEnter)
    boundHost.removeEventListener('pointerleave', onHostLeave)
  }
  resizeObserver?.disconnect()
  mutationObserver?.disconnect()
  resizeObserver = null
  mutationObserver = null
  boundEl = null
  boundHost = null
}

function onHostEnter() {
  hovering.value = true
}
function onHostLeave() {
  hovering.value = false
}

function bind(el) {
  unbind()
  if (!el) return
  boundEl = el
  boundHost = el.parentElement ?? null
  el.addEventListener('scroll', onScroll, { passive: true })
  el.addEventListener('pointerdown', onPointerDown, { passive: true })
  boundHost?.addEventListener('pointerenter', onHostEnter)
  boundHost?.addEventListener('pointerleave', onHostLeave)
  resizeObserver = new ResizeObserver(scheduleMeasure)
  resizeObserver.observe(el)
  const content = el.firstElementChild
  if (content) resizeObserver.observe(content)
  mutationObserver = new MutationObserver(scheduleMeasure)
  mutationObserver.observe(el, { childList: true, subtree: true, characterData: true })
  measure()
}

watch(() => props.target, bind)
onMounted(() => bind(props.target))

onBeforeUnmount(() => {
  unbind()
  if (measureRaf) cancelAnimationFrame(measureRaf)
  clearTimeout(lingerTimer)
  stopDrag()
})

// ===== 拇指拖拽 =====
let drag = null

function onThumbDown(event, axis) {
  const el = props.target
  if (!el || event.button !== 0) return
  event.preventDefault()
  event.stopPropagation()
  const isVertical = axis === 'v'
  drag = {
    axis,
    start: isVertical ? event.clientY : event.clientX,
    scroll: isVertical ? el.scrollTop : el.scrollLeft,
    track: (isVertical ? el.clientHeight : el.clientWidth) - props.edge * 2,
    thumb: (isVertical ? vThumb.value : hThumb.value).size,
    max: isVertical ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth,
  }
  dragging.value = true
  document.body.style.userSelect = 'none'
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', stopDrag)
  window.addEventListener('pointercancel', stopDrag)
}

function onDragMove(event) {
  const el = props.target
  if (!drag || !el) return
  const delta = (drag.axis === 'v' ? event.clientY : event.clientX) - drag.start
  const range = drag.track - drag.thumb
  if (range <= 0) return
  const next = drag.scroll + (delta / range) * drag.max
  if (drag.axis === 'v') el.scrollTop = next
  else el.scrollLeft = next
}

function stopDrag() {
  if (!drag) return
  drag = null
  dragging.value = false
  document.body.style.userSelect = ''
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', stopDrag)
  window.removeEventListener('pointercancel', stopDrag)
}

defineExpose({
  /** 内容尺寸变化但既不触发 resize 也不触发 DOM 变更时（如缩放用的 CSS transform），由调用方主动同步 */
  sync: measure,
  /** 主动亮一次滚动条 */
  wake: linger,
})
</script>

<template>
  <div class="asb" :style="barStyle" aria-hidden="true">
    <div v-if="vOverflow" class="asb__track asb__track--v" :class="{ 'is-on': active }">
      <div
        class="asb__thumb"
        :class="{ 'is-on': active }"
        :style="vThumbStyle"
        @pointerdown="onThumbDown($event, 'v')"
      />
    </div>
    <div v-if="hOverflow" class="asb__track asb__track--h" :class="{ 'is-on': active }">
      <div
        class="asb__thumb"
        :class="{ 'is-on': active }"
        :style="hThumbStyle"
        @pointerdown="onThumbDown($event, 'h')"
      />
    </div>
  </div>
</template>

<style scoped>
.asb {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}

.asb__track {
  position: absolute;
  pointer-events: none;
}

.asb__track--v {
  top: var(--asb-edge);
  bottom: var(--asb-edge);
  right: var(--asb-inset);
  width: 5px;
}

.asb__track--h {
  left: var(--asb-edge);
  right: var(--asb-edge);
  bottom: var(--asb-inset);
  height: 5px;
}

.asb__thumb {
  position: absolute;
  border-radius: var(--radius-full);
  corner-shape: round;
  background: var(--asb-thumb, var(--scrollbar));
  opacity: 0;
  transition: opacity 0.18s ease, background-color 0.2s ease;
}

.asb__track--v .asb__thumb {
  left: 0;
  right: 0;
}

.asb__track--h .asb__thumb {
  top: 0;
  bottom: 0;
}

.asb__thumb.is-on {
  opacity: 1;
  pointer-events: auto;
  touch-action: none;
  cursor: default;
}

.asb__track.is-on .asb__thumb:hover {
  background: var(--asb-thumb-hover, var(--scrollbar-hover));
}

@media (prefers-reduced-motion: reduce) {
  .asb__thumb { transition: background-color 0.2s ease; }
}
</style>

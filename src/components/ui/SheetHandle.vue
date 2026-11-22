<script setup>
import { onBeforeUnmount, watch } from 'vue'

/**
 * 底部抽屉顶部的抓手：按住向下拖可收起抽屉。
 * 只接管抓手自身的指针事件，抽屉内容的滚动不受影响；桌面端不渲染它。
 */
const props = defineProps({
  show: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])

const CLOSE_THRESHOLD = 80
const SNAP_BACK_MS = 180

let drawerEl = null
let startY = 0
let offset = 0
let dragging = false

function detachDrag() {
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  window.removeEventListener('pointercancel', onDragEnd)
  dragging = false
}

function onDragStart(event) {
  const el = event.currentTarget?.closest('.n-drawer')
  if (!el) return
  drawerEl = el
  dragging = true
  startY = event.clientY
  offset = 0
  el.style.transition = 'none'
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd)
  window.addEventListener('pointercancel', onDragEnd)
}

function onDragMove(event) {
  if (!dragging) return
  offset = Math.max(0, event.clientY - startY)
  drawerEl.style.transform = `translateY(${offset}px)`
}

function onDragEnd() {
  if (!dragging || !drawerEl) return
  detachDrag()
  const el = drawerEl
  el.style.transition = `transform ${SNAP_BACK_MS}ms ease`
  if (offset < CLOSE_THRESHOLD) {
    el.style.transform = ''
    // 回弹结束后交还 transition 控制权，免得残留的行内时长压过抽屉自己的进出场时长
    setTimeout(() => {
      if (dragging || drawerEl !== el) return
      el.style.transition = ''
      el.style.transform = ''
    }, SNAP_BACK_MS)
    return
  }
  el.style.transform = 'translateY(100%)'
  setTimeout(() => emit('close'), SNAP_BACK_MS)
}

// 拖拽关闭时行内 transform 会停在屏外，离场动画叠在上面看不出来，等下次打开再复位
watch(
  () => props.show,
  (show) => {
    if (!show || !drawerEl) return
    drawerEl.style.transition = ''
    drawerEl.style.transform = ''
    drawerEl = null
  },
)

onBeforeUnmount(detachDrag)
</script>

<template>
  <span class="sheet-handle" aria-hidden="true" @pointerdown="onDragStart" />
</template>

<style scoped>
/* 挂在抽屉面板上沿居中：抓手拿不到整个面板的几何，只能相对 .n-drawer 定位 */
.sheet-handle {
  position: absolute;
  top: 8px;
  left: 50%;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 18px;
  transform: translateX(-50%);
  cursor: grab;
  touch-action: none;
}

.sheet-handle::before {
  content: '';
  width: 36px;
  height: 4px;
  border-radius: var(--radius-full);
  corner-shape: round;
  background: var(--border-strong);
  transition: background-color var(--duration-theme) var(--ease-theme);
}

.sheet-handle:active {
  cursor: grabbing;
}

.sheet-handle:active::before {
  background: var(--muted-foreground);
}
</style>

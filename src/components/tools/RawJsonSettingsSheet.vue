<script setup>
import { computed, ref, watch } from 'vue'
import { NIcon, NDrawer, NDrawerContent } from 'naive-ui'
import { ArrowImport24Regular, LocalLanguage24Regular, Delete24Regular } from '@vicons/fluent'
import { openImport, clearAll } from '../../composables/useRawJsonEditor.js'
import { openLangModal } from '../../composables/useRawJsonLang.js'
import { renderMode, RENDER_MODE_OPTIONS } from '../../composables/useRawJsonRenderMode.js'
import RawJsonCommandCard from './RawJsonCommandCard.vue'
import RawJsonConfigCard from './RawJsonConfigCard.vue'
import RawJsonOutputCard from './RawJsonOutputCard.vue'

/**
 * 紧凑布局的设置面板。用 NDrawer 而非 AppModal —— 它不是一个居中对话框，
 * 而是从底部升起的面板，进出场方向与遮罩行为都跟着 placement 走。
 */
const props = defineProps({
  show: { type: Boolean, default: false },
})
const emit = defineEmits(['update:show'])

const bodyRef = ref(null)

const activeModeIndex = computed(() => Math.max(0, RENDER_MODE_OPTIONS.findIndex(o => o.value === renderMode.value)))
/** 面板里的输出卡与主区域始终是互补的两块，此处跟着主区域取另一档 */
const panelModeIndex = computed(() => (activeModeIndex.value + 1) % RENDER_MODE_OPTIONS.length)
const panelMode = computed(() => RENDER_MODE_OPTIONS[panelModeIndex.value].value)

// 拖拽关闭只写行内 transform，抽屉自身的进出场过渡不受影响
let drawerEl = null
let startY = 0
let offset = 0
let dragging = false
const CLOSE_THRESHOLD = 80
const SNAP_BACK_MS = 180

// 拖拽关闭时行内 transform 会停在屏外，离场动画叠在上面看不出来，等下次打开再复位，
// 否则残留的行内 transform 会盖掉进场动画
watch(() => props.show, (visible) => {
  if (!visible || !drawerEl) return
  drawerEl.style.transition = ''
  drawerEl.style.transform = ''
  drawerEl = null
})

function onDragStart(e) {
  drawerEl = bodyRef.value?.closest('.n-drawer') || null
  if (!drawerEl) return
  dragging = true
  startY = e.clientY
  offset = 0
  drawerEl.style.transition = 'none'
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd)
}

function onDragMove(e) {
  if (!dragging) return
  offset = Math.max(0, e.clientY - startY)
  drawerEl.style.transform = `translateY(${offset}px)`
}

function onDragEnd() {
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  if (!dragging) return
  dragging = false
  const el = drawerEl
  el.style.transition = `transform ${SNAP_BACK_MS}ms ease`
  if (offset < CLOSE_THRESHOLD) {
    el.style.transform = ''
    // 回弹结束后交还 transition 控制权，免得残留的行内时长压过抽屉自己的进出场时长
    setTimeout(() => {
      if (!dragging && el === drawerEl) {
        el.style.transition = ''
        el.style.transform = ''
      }
    }, SNAP_BACK_MS)
    return
  }
  el.style.transform = 'translateY(100%)'
  setTimeout(() => emit('update:show', false), SNAP_BACK_MS)
}

// 弹窗与面板叠在一起会互相遮挡，先在面板内发起、关掉面板再开弹窗
function openTool(fn) {
  emit('update:show', false)
  fn()
}
</script>

<template>
  <NDrawer
    class="rj-settings-drawer"
    :show="show"
    placement="bottom"
    height="80%"
    :style="{
      background: 'var(--background)',
      boxShadow: 'var(--shadow-drawer)',
      borderTopLeftRadius: 'var(--radius-2xl)',
      borderTopRightRadius: 'var(--radius-2xl)',
      overflow: 'hidden',
    }"
    @update:show="emit('update:show', $event)"
  >
    <NDrawerContent :native-scrollbar="false" closable>
      <template #header>
        <span class="sheet-handle" @pointerdown="onDragStart" />
        <span class="sheet-title">设置</span>
      </template>

      <div ref="bodyRef" class="sheet-body">
        <div class="sheet-actions">
          <button class="sheet-action" @click="openTool(openImport)">
            <NIcon :component="ArrowImport24Regular" :size="14" />
            <span>导入</span>
          </button>
          <button class="sheet-action" @click="openTool(openLangModal)">
            <NIcon :component="LocalLanguage24Regular" :size="14" />
            <span>语言包</span>
          </button>
          <button class="sheet-action" @click="openTool(clearAll)">
            <NIcon :component="Delete24Regular" :size="14" />
            <span>清空</span>
          </button>
        </div>

        <RawJsonCommandCard />

        <RawJsonConfigCard />

        <div class="sheet-field">
          <label class="sheet-label">主区域渲染模式</label>
          <div class="seg">
            <span class="seg-thumb" :style="{ transform: `translateX(${activeModeIndex * 100}%)` }" />
            <button
              v-for="option in RENDER_MODE_OPTIONS"
              :key="option.value"
              class="seg-btn"
              :class="{ 'seg-btn--active': renderMode === option.value }"
              @click="renderMode = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <div class="sheet-field sheet-field--disabled">
          <label class="sheet-label">此处渲染模式</label>
          <div class="seg seg--disabled">
            <span class="seg-thumb" :style="{ transform: `translateX(${panelModeIndex * 100}%)` }" />
            <button
              v-for="option in RENDER_MODE_OPTIONS"
              :key="option.value"
              class="seg-btn"
              :class="{ 'seg-btn--active': panelMode === option.value }"
              disabled
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <RawJsonOutputCard :swap-json="renderMode === 'json'" />
      </div>
    </NDrawerContent>
  </NDrawer>
</template>

<style>
/* 拖拽条要相对整个面板上沿居中，而 header 插槽只拿到标题区（右侧还留着关闭按钮），
   所以挂在 header 上并按面板定位；顶部留白同步加高，给把手下让出位置 */
.rj-settings-drawer .n-drawer-header {
  position: relative;
  padding-top: 18px;
}
.rj-settings-drawer .sheet-handle {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 26px;
  cursor: grab;
  touch-action: none;
}
.rj-settings-drawer .sheet-handle::before {
  content: '';
  width: 36px;
  height: 4px;
  border-radius: var(--radius-full);
  corner-shape: round;
  background: var(--border-strong);
  transition: background-color 0.4s ease;
}
.rj-settings-drawer .sheet-handle:active { cursor: grabbing; }
.rj-settings-drawer .sheet-handle:active::before { background: var(--muted-foreground); }
</style>

<style scoped>
.sheet-title {
  font-weight: 600;
  transition: color 0.4s ease;
}
.sheet-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  /* 抽屉内容包装器的内边距被全站样式清零了，这里自己补上；
     上边距对齐标题栏自身的内边距，横向也对齐 24px，免得和标题左右错开 */
  padding: 16px 24px 24px;
}
.sheet-label {
  display: block;
  font-size: 11px; font-weight: 600;
  color: var(--subtle-foreground);
  text-transform: uppercase; letter-spacing: 0.5px;
  margin-bottom: 6px;
  transition: color 0.4s ease;
}
/* 并排两档，滑块跟随当前档位平移。形态与手感对齐选择器编辑器的 hasitem 模式切换 */
.seg {
  position: relative;
  display: flex;
  padding: 4px;
  border-radius: var(--radius-full);
  corner-shape: round;
  background: var(--muted);
  transition: background-color 0.4s ease;
}
.seg-thumb {
  position: absolute;
  top: 4px; left: 4px; bottom: 4px;
  width: calc(50% - 4px);
  border-radius: var(--radius-full);
  corner-shape: round;
  background: var(--card);
  box-shadow: var(--shadow-sm);
  transition: transform 0.28s cubic-bezier(0.2, 0, 0, 1), background-color 0.4s ease;
}
/* 深色下凸起方向相反：轨道比页面底高一档，滑块再高一档，始终是抬起的那块 */
[data-theme='dark'] .seg { background: var(--card); }
[data-theme='dark'] .seg-thumb { background: var(--muted); }
/* 只读的一组：控件本体与上一组完全一致，只靠文字透明度表达不可点 */
.seg--disabled { pointer-events: none; }
.seg--disabled .seg-btn { opacity: 0.5; cursor: default; }
.sheet-field--disabled .sheet-label { opacity: 0.5; }
.seg-btn {
  position: relative;
  flex: 1;
  padding: 7px 0;
  border: none; background: none;
  color: var(--muted-foreground);
  font-size: 12px; font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: color 0.2s ease;
}
.seg-btn--active { color: var(--foreground); }

.sheet-actions { display: flex; align-items: center; gap: 8px; }
.sheet-action {
  flex: 1;
  display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  padding: 9px 0;
  border: none;
  border-radius: var(--radius-full);
  corner-shape: round;
  background: var(--muted);
  color: var(--foreground);
  font-size: 12px; font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.4s ease, opacity 0.15s ease;
}
.sheet-action:hover { background: var(--accent); }
.sheet-action:active { transform: scale(0.97); }
</style>

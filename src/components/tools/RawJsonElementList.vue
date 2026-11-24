<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { NIcon } from 'naive-ui'
import {
  Add16Filled, ArrowDown24Regular, ArrowUp24Regular, BookOpen48Regular,
  Copy24Regular, Delete24Regular, Edit24Filled,
} from '@vicons/fluent'
import AppButton from '../ui/AppButton.vue'
import RawJsonInlineEditor from './RawJsonInlineEditor.vue'
import {
  data, validationResult, deleteConfirmIdx, inlineIdx, lastAddedEl,
  addElement, addInlineElement, copyElement, deleteElement, editElement, loadExample,
  getElementKey, getElPreviewText, getElTypeClass, getElTypeLabel,
  moveElement, toggleInlineEdit,
} from '../../composables/useRawJsonEditor.js'
import { reduceMotion } from '../../composables/useMotion.js'
import {
  HEIGHT_EASE, HEIGHT_MS, REMOVE_MS, boxMetrics, collapseBox, createRowSwap,
  expandBoxKeyframe, nextFrames, restoreBox,
} from '../../utils/listMotion.js'

const props = defineProps({
  /** 桌面端：点击元素条就地展开编辑；紧凑布局（移动端）仍走编辑弹窗 */
  inline: { type: Boolean, default: false },
})

const listEl = ref(null)

function isEditing(index) {
  return props.inline && inlineIdx.value === index
}

function rowErrors(index) {
  // 正在编辑的那条由编辑区按字段标红，行上不再重复
  if (isEditing(index)) return []
  return validationResult.value.errors.filter(error => error.idx === index)
}

function onRowClick(index) {
  if (props.inline) toggleInlineEdit(index)
}

/**
 * 行自身获得焦点时，回车/空格等同点击（切换就地编辑）。
 * 只认行元素本人：编辑区里的输入框、行内的操作按钮都在行内部，按键必须先交给它们自己，
 * 否则空格既打不出来，还会顺手把编辑区关掉。
 */
function onRowKey(e, index) {
  if (e.target !== e.currentTarget) return
  e.preventDefault()
  onRowClick(index)
}

function insertAt(index) {
  if (props.inline) addInlineElement(index)
  else addElement(index)
}

// ===== 统一的动效参数 =====
// 高度、交换与透明度节奏和翻译键内部的列表共用 utils/listMotion.js
const INSERT_MS = HEIGHT_MS
const EDITOR_MS = HEIGHT_MS
/** 新增行要等编辑区内部先完成一次布局（自动高度）再量，否则动画结束时会有余量跳变 */
const INSERT_SETTLE_FRAMES = 2

function rowNodeOf(key) {
  return listEl.value?.querySelector(`[data-el-key="${key}"]`) || null
}

/** 行前的插入间隙：新增/删除时一起折叠，整体高度才不会多出一截 14px 的瞬间跳变 */
function gapOf(node) {
  const prev = node.previousElementSibling
  return prev?.classList?.contains('el-gap') ? prev : null
}

function animateGap(gap, from, to, duration) {
  if (!gap) return
  gap.style.overflow = 'hidden'
  gap.animate([{ height: `${from}px` }, { height: `${to}px` }], {
    duration,
    easing: HEIGHT_EASE,
  })
}


// ===== 上下交换：主动元素压在上层、短暂变淡，被换位的元素原地让路 =====
const rowSwap = createRowSwap()

async function moveWithSwap(index, dir) {
  const target = dir === 'up' ? index - 1 : index + 1
  if (target < 0 || target >= data.value.length) return
  const fromNode = rowNodeOf(getElementKey(data.value[index]))
  const toNode = rowNodeOf(getElementKey(data.value[target]))
  if (!fromNode || !toNode) {
    moveElement(index, dir)
    return
  }
  const fromTopBefore = fromNode.getBoundingClientRect().top
  const toTopBefore = toNode.getBoundingClientRect().top
  moveElement(index, dir)
  await nextTick()
  rowSwap.play(fromNode, toNode, fromTopBefore, toTopBefore)
}

function move(index, dir) {
  // 两种布局都走同一套位置交换动画：紧凑布局的行更高、操作栏另起一行，FLIP 按实际矩形算，不受影响
  if (!reduceMotion.value) moveWithSwap(index, dir)
  else moveElement(index, dir)
}

// ===== 新增：整条从 0 高度展开，下面的行被自然顶下去 =====
/** 本次新增的那条：它的编辑区让位给行高度动画，避免两层高度动画互相裁剪 */
let insertingKey = null

async function animateInsert(node) {
  if (reduceMotion.value) {
    insertingKey = null
    return
  }
  const box = boxMetrics(node)
  const gap = gapOf(node)
  const gapHeight = gap ? gap.offsetHeight : 0
  // 先同步收起（含内边距与描边），等待期间不会露出未动画的整行
  collapseBox(node)
  void node.offsetHeight
  // 编辑区里的文本域要一帧之后才把自动高度算稳，这两帧等的是它的最终高度
  await nextFrames(INSERT_SETTLE_FRAMES)
  const contentHeight = node.isConnected ? node.scrollHeight : 0
  const height = contentHeight + box.padTop + box.padBottom + box.borderTop + box.borderBottom
  if (height <= 0) {
    // 量不到高度就撤销临时的收起，别把整行留在 0 高度上
    restoreBox(node)
    insertingKey = null
    return
  }
  animateGap(gap, 0, gapHeight, INSERT_MS)
  const anim = node.animate(
    [
      {
        height: '0px',
        paddingTop: '0px',
        paddingBottom: '0px',
        borderTopWidth: '0px',
        borderBottomWidth: '0px',
        opacity: 0,
      },
      expandBoxKeyframe(height, box, 1),
    ],
    { duration: INSERT_MS, easing: HEIGHT_EASE },
  )
  anim.finished
    .catch(() => {})
    .finally(() => {
      restoreBox(node)
      if (insertingKey) insertingKey = null
    })
}

watch(lastAddedEl, async (el) => {
  if (!el || !data.value.includes(el)) return
  const key = getElementKey(el)
  // 先打标记再等渲染：编辑区的入场动画据此让位，保证同一时刻只有一层高度在动
  insertingKey = key
  await nextTick()
  const node = rowNodeOf(key)
  if (!node) {
    insertingKey = null
    return
  }
  animateInsert(node)
  followRowScroll(node, INSERT_MS)
})

// ===== 删除：整条收起到相邻行下面，同时渐隐，整体高度跟着塌回去 =====
let removingKey = null

function animateRemove(node, done) {
  if (reduceMotion.value) {
    done()
    return
  }
  const height = node.offsetHeight
  if (height <= 0) {
    done()
    return
  }
  const box = boxMetrics(node)
  const gap = gapOf(node)
  const gapHeight = gap ? gap.offsetHeight : 0
  animateGap(gap, gapHeight, 0, REMOVE_MS)
  node.style.overflow = 'hidden'
  const anim = node.animate(
    [
      {
        height: `${height}px`,
        paddingTop: `${box.padTop}px`,
        paddingBottom: `${box.padBottom}px`,
        borderTopWidth: `${box.borderTop}px`,
        borderBottomWidth: `${box.borderBottom}px`,
        opacity: 1,
        transform: 'translateY(0)',
      },
      {
        height: '0px',
        paddingTop: '0px',
        paddingBottom: '0px',
        borderTopWidth: '0px',
        borderBottomWidth: '0px',
        opacity: 0,
        transform: 'translateY(-6px)',
      },
    ],
    { duration: REMOVE_MS, easing: HEIGHT_EASE },
  )
  anim.finished.catch(() => {}).finally(done)
}

function removeElement(index) {
  // 第一次点击只进入确认态，交给 composable 处理
  if (deleteConfirmIdx.value !== index) {
    deleteElement(index)
    return
  }
  const element = data.value[index]
  const key = element ? getElementKey(element) : null
  const node = key ? rowNodeOf(key) : null
  if (!key || !node || removingKey) {
    deleteElement(index)
    return
  }
  removingKey = key
  animateRemove(node, () => {
    removingKey = null
    deleteElement(index)
  })
}

// ===== 就地编辑：外层高度展开，内部内容统一渐显 =====
function enterEditor(el, done) {
  const inner = el.firstElementChild
  const rowKey = el.closest('[data-el-key]')?.dataset.elKey
  // 新增那条的编辑区：展开交给整行的高度动画，这一层直接到位
  if (reduceMotion.value || (rowKey && rowKey === insertingKey)) {
    done()
    return
  }
  // 先同步收起：等待期间不会露出未动画的内容；两帧后文本域的自动高度才稳定，那时量才是最终高度
  el.style.overflow = 'clip'
  el.style.height = '0px'
  void el.offsetHeight
  nextFrames(INSERT_SETTLE_FRAMES).then(() => {
    if (!el.isConnected) {
      el.style.height = ''
      el.style.overflow = ''
      done()
      return
    }
    const height = el.scrollHeight
    inner?.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 180,
      delay: 70,
      easing: 'ease-out',
      fill: 'backwards',
    })
    const anim = el.animate([{ height: '0px' }, { height: `${height}px` }], {
      duration: EDITOR_MS,
      easing: HEIGHT_EASE,
    })
    anim.finished
      .catch(() => {})
      .finally(() => {
        el.style.height = ''
        el.style.overflow = ''
        done()
      })
  })
}

function leaveEditor(el, done) {
  if (reduceMotion.value) {
    done()
    return
  }
  const height = el.offsetHeight
  if (height <= 0) {
    done()
    return
  }
  el.style.overflow = 'clip'
  el.animate(
    [
      { height: `${height}px`, opacity: 1 },
      { height: '0px', opacity: 0 },
    ],
    { duration: 180, easing: 'cubic-bezier(0.4, 0, 1, 1)' },
  )
    .finished.catch(() => {})
    .finally(done)
}

// 新增或展开编辑区时行高在动画里长出来，滚动范围跟着变大：等动画结束再滚会明显滞后，
// 提前滚又会停在半路。这里在动画期间逐帧按当前行底重算目标，行长高多少就往下跟多少。
let scrollRaf = 0

/** 最近的可滚动祖先：桌面端是卡片内的 list-view，移动端整块元素区共用一个滚动容器 */
function scrollHostOf(node) {
  for (let el = node.parentElement; el && el !== document.body; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el)
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1) return el
  }
  return null
}

function followRowScroll(node, duration) {
  cancelAnimationFrame(scrollRaf)
  scrollRaf = 0
  const view = scrollHostOf(node)
  if (!view || reduceMotion.value) {
    node.scrollIntoView({ block: 'nearest' })
    return
  }
  const started = performance.now()
  let written = -1
  const tick = () => {
    scrollRaf = 0
    if (!node.isConnected) return
    // 跟随期间用户自己滚了就让位，别把视图拽回去
    if (written >= 0 && Math.abs(view.scrollTop - written) > 2) return
    const viewRect = view.getBoundingClientRect()
    const rowBottom = node.getBoundingClientRect().bottom - viewRect.top + view.scrollTop
    const maxTop = Math.max(0, view.scrollHeight - view.clientHeight)
    // 行底落在可视区底部上方 8px 即可；行比可视区还高时同样贴底，展开的编辑区才能整块露出来
    const desired = Math.min(maxTop, Math.max(0, rowBottom + 8 - view.clientHeight))
    const diff = desired - view.scrollTop
    if (diff > 0.5) {
      // 距离远时限速，避免一帧跳到目标；距离近时按比例收敛，跟着行高平滑推进
      view.scrollTop += Math.min(diff, Math.max(3, Math.min(48, diff * 0.35)))
      written = view.scrollTop
    }
    const elapsed = performance.now() - started
    if ((elapsed < duration + 140 || diff > 1) && elapsed < 1200) {
      scrollRaf = requestAnimationFrame(tick)
    }
  }
  scrollRaf = requestAnimationFrame(tick)
}

watch(inlineIdx, (index) => {
  if (index === null || !props.inline) return
  nextTick(() => {
    const key = getElementKey(data.value[index])
    const node = rowNodeOf(key)
    if (!node) return
    followRowScroll(node, key === insertingKey ? INSERT_MS : EDITOR_MS)
  })
})

onBeforeUnmount(() => {
  rowSwap.cancel()
  cancelAnimationFrame(scrollRaf)
  scrollRaf = 0
  insertingKey = null
  removingKey = null
})
</script>

<template>
  <div ref="listEl" class="el-list" :class="{ 'el-list--inline': inline }">
    <template v-for="(el, i) in data" :key="getElementKey(el)">
      <div v-if="inline" class="el-gap" @click="insertAt(i)">
        <span class="el-gap-plus"><NIcon :component="Add16Filled" :size="10" /></span>
      </div>

      <div
        class="el-row"
        :class="{
          'el-row--active': isEditing(i),
          'el-row--error': rowErrors(i).length > 0,
        }"
        :data-el-key="getElementKey(el)"
        :tabindex="inline ? 0 : undefined"
        @click="onRowClick(i)"
        @keydown.enter="onRowKey($event, i)"
        @keydown.space="onRowKey($event, i)"
      >
        <div class="el-head">
          <span v-if="inline" class="el-order">{{ i + 1 }}</span>
          <span class="el-badge-slot" :class="{ 'el-badge-slot--off': isEditing(i) }">
            <span class="el-badge" :class="getElTypeClass(el)">
              {{ getElTypeLabel(el) }}
            </span>
          </span>
          <span class="el-text">{{ getElPreviewText(el) }}</span>
          <div class="el-actions" @click.stop>
            <AppButton
              v-if="!inline"
              variant="text"
              size="xs"
              icon-only
              :icon="Add16Filled"
              label="在此之前插入"
              @click="insertAt(i)"
            />
            <AppButton
              variant="text"
              size="xs"
              icon-only
              :icon="ArrowUp24Regular"
              label="上移"
              :disabled="i === 0"
              @click="move(i, 'up')"
            />
            <AppButton
              variant="text"
              size="xs"
              icon-only
              :icon="ArrowDown24Regular"
              label="下移"
              :disabled="i === data.length - 1"
              @click="move(i, 'down')"
            />
            <AppButton
              variant="text"
              size="xs"
              icon-only
              :icon="Copy24Regular"
              label="复制"
              @click="copyElement(i)"
            />
            <AppButton
              v-if="!inline"
              variant="text"
              size="xs"
              icon-only
              :icon="Edit24Filled"
              label="编辑"
              @click="editElement(i)"
            />
            <AppButton
              variant="text"
              size="xs"
              icon-only
              :icon="Delete24Regular"
              :label="deleteConfirmIdx === i ? '再次点击确认删除' : '删除'"
              :class="{ 'confirm-destructive': deleteConfirmIdx === i }"
              @click="removeElement(i)"
            />
          </div>
        </div>

        <div class="el-err" :class="{ 'el-err--on': rowErrors(i).length > 0 }">
          <span class="el-err-inner">{{ rowErrors(i).map(e => e.msg).join(' · ') }}</span>
        </div>

        <Transition :css="false" @enter="enterEditor" @leave="leaveEditor">
          <div v-if="isEditing(i)" class="el-editor" @click.stop>
            <div class="el-editor-inner">
              <RawJsonInlineEditor :el="el" @click.stop />
            </div>
          </div>
        </Transition>
      </div>
    </template>

    <div v-if="inline && data.length > 0" class="el-gap" @click="insertAt(data.length)">
      <span class="el-gap-plus"><NIcon :component="Add16Filled" :size="10" /></span>
    </div>

    <!-- 空状态 -->
    <div v-if="data.length === 0" class="el-empty">
      <template v-if="inline">
        <p class="el-empty-text">还没有元素</p>
        <AppButton variant="text" size="sm" :icon="BookOpen48Regular" @click="loadExample">
          载入示例
        </AppButton>
      </template>
      <span v-else>还没有元素</span>
    </div>
  </div>
</template>

<style scoped>
.el-list { display: flex; flex-direction: column; }
/* 桌面端列表撑满滚动区高度，空状态才能垂直居中 */
.el-list--inline { min-height: 100%; }

/* ===== 元素行 ===== */
.el-row {
  padding: 8px 8px 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card);
  transition:
    border-color 0.15s ease,
    background-color 0.4s ease,
    box-shadow 0.15s ease;
}
.el-list--inline .el-row { cursor: pointer; }
.el-list--inline .el-row:hover { border-color: var(--border-strong); }
.el-list--inline .el-row:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 1px;
}
.el-row--active {
  border-color: var(--muted-foreground);
  box-shadow: var(--shadow-sm);
  cursor: default;
}
.el-row--error { border-color: color-mix(in srgb, var(--destructive) 55%, var(--border)); }

/* 行内错误行：用网格 0fr→1fr 收放，出现/消失时下面的行不会被顶跳 */
.el-err {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition: grid-template-rows 0.22s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s ease;
}
.el-err--on { grid-template-rows: 1fr; opacity: 1; }
.el-err-inner {
  overflow: hidden;
  padding-top: 5px;
  font-size: 12px;
  line-height: 1.5;
  letter-spacing: 0.2px;
  color: var(--destructive);
}

.el-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  /* 行内预览文字只读：拖拽、双击都不该把文字选进去 */
  user-select: none;
  -webkit-user-select: none;
}
.el-order {
  flex-shrink: 0;
  width: 16px;
  text-align: right;
  font-size: 11px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  color: var(--muted-foreground);
  transition: color 0.4s ease;
}

/* 类型标记：每种类型一个色相；编辑时整列收掉，右侧文本跟着位移 */
.el-badge-slot {
  flex-shrink: 0;
  display: grid;
  /* minmax(0, …) 才能真正收到 0：网格轨道的自动最小尺寸会被类型标记的内边距撑住 */
  grid-template-columns: minmax(0, 1fr);
  transition:
    grid-template-columns 0.2s cubic-bezier(0.2, 0, 0, 1),
    margin-right 0.2s cubic-bezier(0.2, 0, 0, 1);
}
.el-badge-slot--off {
  grid-template-columns: minmax(0, 0fr);
  /* 抵掉一个 gap，文本才会贴着前面的序号，而不是留下双倍间距 */
  margin-right: -8px;
}
.el-badge {
  min-width: 0;
  overflow: hidden;
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.2px;
  line-height: 1.4;
  white-space: nowrap;
  transition:
    opacity 0.16s ease,
    transform 0.2s cubic-bezier(0.2, 0, 0, 1),
    padding 0.2s cubic-bezier(0.2, 0, 0, 1),
    background-color 0.4s ease,
    color 0.4s ease;
}
.el-badge-slot--off .el-badge {
  padding-left: 0;
  padding-right: 0;
  opacity: 0;
  transform: translateX(-6px);
}

.el-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: 13px;
  letter-spacing: 0.01em;
  color: var(--foreground);
  transition: color 0.4s ease;
}
.el-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  opacity: 1;
  transition: opacity 0.15s ease;
}
/* 桌面端只在悬停/编辑时露出操作，行内常态保持干净；键盘聚焦时同样露出 */
.el-list--inline .el-actions { opacity: 0; }
.el-list--inline .el-row:hover .el-actions,
.el-list--inline .el-row--active .el-actions,
.el-list--inline .el-actions:focus-within {
  opacity: 1;
}

/* ===== 就地编辑区：外层高度由 JS 展开，内部只做渐显 ===== */
.el-editor {
  /* clip 而不是 hidden：hidden 仍是可编程滚动容器，自动聚焦会让它内部滚出一截，
     展开动画里内容就会横向错位、分割线迟到。clip 不产生滚动容器 */
  overflow: clip;
}
.el-editor-inner { padding-top: 10px; }

/* ===== 行间插入点：常态不占视觉，悬停才浮出细线与加号 ===== */
.el-gap {
  position: relative;
  height: 14px;
  flex-shrink: 0;
  opacity: 0;
  cursor: pointer;
  transition: opacity 0.15s ease;
}
@media (hover: hover) {
  .el-gap:hover { opacity: 1; }
}
.el-gap::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 2px;
  margin-top: -1px;
  border-radius: 1px;
  background: var(--muted-foreground);
}
.el-gap-plus {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  corner-shape: round;
  background: var(--foreground);
  color: var(--background);
  transform: translate(-50%, -50%);
}

/* ===== 空状态 ===== */
.el-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 36px 16px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  color: var(--muted-foreground);
  font-size: 13px;
  transition: color 0.4s ease, border-color 0.4s ease;
}
.el-empty-text { margin: 0; }
/* 空列表时整块撑满列表区，提示垂直居中；面板本身已是卡片，不再套一层虚线框 */
.el-list--inline .el-empty {
  flex: 1;
  border: none;
}

/* 紧凑布局沿用改造前的排法：类型与内容一行、操作另起一行右对齐 */
@media (max-width: 480px) {
  .el-row { padding: 10px 12px; }
  .el-head { flex-wrap: wrap; row-gap: 8px; }
  .el-actions {
    flex: 0 0 100%;
    justify-content: flex-end;
  }
  .el-gap { display: none; }
}
</style>

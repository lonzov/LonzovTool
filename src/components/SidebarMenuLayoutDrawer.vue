<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { NDrawer, NDrawerContent, NIcon } from 'naive-ui'
import { ReOrderDotsVertical20Regular } from '@vicons/fluent'
import AppButton from './ui/AppButton.vue'
import SheetHandle from './ui/SheetHandle.vue'
import { SIDEBAR_FIXED_ITEM_MAP, SIDEBAR_MORE_ITEM } from '../config/sidebarFixedItems.js'
import {
  resetSidebarMenuLayout,
  setSidebarMenuLayout,
  sidebarMenuLayout,
} from '../composables/useSidebarMenuLayout.js'
import { useIsMobile } from '../composables/useIsMobile.js'
import { useMobileSheet } from '../composables/useMobileSheet.js'
import { usePWAInstall } from '../composables/usePWAInstall'
import { createDragSortable } from '../utils/sortable.js'

/**
 * 侧边栏固定栏的布局调整：抽屉里按侧边栏的最终形态列出所有入口，
 * 拖到「更多」行下方即收进该分组，拖回上方即放回一级。
 * 改动即时生效，抽屉只是编辑器本身，不做二次确认。
 */
const props = defineProps({
  show: { type: Boolean, default: false },
})
const emit = defineEmits(['update:show'])

const { isMobile } = useIsMobile()
const { mobile, sheetPlacement, sheetWidth, sheetHeight, sheetHeaderStyle, sheetStyle } =
  useMobileSheet(isMobile, {
    width: 400,
    desktopStyle: {
      background: 'var(--background)',
      borderLeft: '1px solid var(--border)',
      boxShadow: 'var(--shadow-drawer)',
    },
  })

// 与侧边栏同序：常驻入口在前，「更多」分组行其后，折进分组的入口缩进排在它之后。
// 侧边栏不渲染的入口（已装成 PWA 的安装项）这里也不出现，保持两边看到的是同一份菜单
const { isInstalled } = usePWAInstall()
const rows = computed(() => {
  const { level1, more } = sidebarMenuLayout.value
  const toRow = (key, nested) => {
    const item = SIDEBAR_FIXED_ITEM_MAP.get(key)
    if (!item || (item.key === 'pwa-install' && isInstalled.value)) return null
    return { ...item, nested }
  }
  return [
    ...level1.map((key) => toRow(key, false)).filter(Boolean),
    { ...SIDEBAR_MORE_ITEM, group: true },
    ...more.map((key) => toRow(key, true)).filter(Boolean),
  ]
})

const hasMoreChildren = computed(() => rows.value.some((row) => row.nested))

const listEl = ref(null)
let sortable = null

function destroySortable() {
  sortable?.destroy()
  sortable = null
}

/** 以「更多」行为界：它之前的是常驻入口，之后的是折进「更多」的入口 */
function readLayout(list) {
  const level1 = []
  const more = []
  let bucket = level1
  for (const node of list?.children || []) {
    if (node.dataset.more !== undefined) {
      bucket = more
      continue
    }
    if (node.dataset.key) bucket.push(node.dataset.key)
  }
  return { level1, more }
}

function handleDragEnd(event) {
  const next = readLayout(listEl.value)

  // Sortable 直接改了 DOM，而 Vue 的虚拟 DOM 并不知道：先原地挪回去，顺序只由数据驱动。
  // 否则 keyed diff 会按旧顺序计算节点移动，与外部改过的 DOM 打架
  const { item, from, oldIndex } = event
  from.insertBefore(item, from.children[oldIndex] || null)

  const current = sidebarMenuLayout.value
  if (next.level1.join() === current.level1.join() && next.more.join() === current.more.join()) return
  setSidebarMenuLayout(next)
}

function setupSortable() {
  destroySortable()
  if (!listEl.value) return

  sortable = createDragSortable(listEl.value, {
    // 「更多」行不带 key，Sortable 不会把它当成可拖条目
    draggable: '[data-key]',
    handle: '.menu-row__handle',
    animation: 150,
    // 不能设 delay：Sortable 的延迟拖拽在指针位移越过阈值时直接放弃本次拖拽，
    // 触屏按下几乎必然带位移，设了延迟等于触摸屏永远拖不动
    ghostClass: 'menu-row--ghost',
    chosenClass: 'menu-row--chosen',
    onEnd: handleDragEnd,
  })
}

// 抽屉内容的挂载时机由 Naive 的显示指令决定，容器 ref 可能比开关晚一帧才有值
watch(
  [() => props.show, listEl],
  ([show, list], [prevShow, prevList]) => {
    if (!show || !list) {
      destroySortable()
      return
    }
    if (prevShow === show && prevList === list) return
    setupSortable()
  },
  { flush: 'post' },
)

onBeforeUnmount(destroySortable)
</script>

<template>
  <NDrawer
    :show="show"
    :placement="sheetPlacement"
    :width="sheetWidth"
    :height="sheetHeight"
    :style="sheetStyle"
    :z-index="2100"
    :auto-focus="false"
    @update:show="emit('update:show', $event)"
  >
    <SheetHandle v-if="mobile" :show="show" @close="emit('update:show', false)" />
    <NDrawerContent
      title="侧边栏菜单"
      closable
      :body-content-style="{ padding: '0' }"
      :footer-style="{ padding: '0' }"
      :header-style="sheetHeaderStyle"
    >
      <div class="layout-body">
        <ul ref="listEl" class="menu-list">
          <li
            v-for="row in rows"
            :key="row.key"
            class="menu-row"
            :class="{ 'menu-row--nested': row.nested, 'menu-row--group': row.group }"
            :data-key="row.group ? undefined : row.key"
            :data-more="row.group ? '' : undefined"
          >
            <NIcon :component="row.icon" :size="18" class="menu-row__icon" />
            <span class="menu-row__label">{{ row.label }}</span>
            <span v-if="!row.group" class="menu-row__handle" aria-hidden="true">
              <NIcon :component="ReOrderDotsVertical20Regular" :size="16" />
            </span>
          </li>
          <li v-if="!hasMoreChildren" class="menu-drop-hint">拖到这里</li>
        </ul>
      </div>

      <template #footer>
        <div class="layout-actions">
          <AppButton variant="outline" size="lg" block @click="resetSidebarMenuLayout">
            恢复默认
          </AppButton>
          <AppButton variant="solid" size="lg" block @click="emit('update:show', false)">
            完成
          </AppButton>
        </div>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
/* 抽屉里复刻侧边栏固定栏的菜单形态：40px 行高、18px 图标、4px 圆角高亮，
   只在行尾多一个拖拽把手，让用户对着自己熟悉的菜单直接调顺序与归属 */
.layout-body {
  padding: 20px 16px 16px;
}

.menu-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.menu-row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 8px 0 16px;
  border-radius: var(--radius-xs);
  color: var(--muted-foreground);
  font-size: 0.875rem;
  line-height: 1.4;
  transition: background-color 0.2s ease, color var(--duration-theme) var(--ease-theme);
}

.menu-row + .menu-row {
  margin-top: 6px;
}

/* 折进「更多」的入口按二级缩进，与侧边栏展开后的样子一致 */
.menu-row--nested {
  padding-left: 48px;
}

.menu-row:hover {
  background: var(--accent);
  color: var(--foreground);
}

/* 「更多」是分组行：不可拖、不可点，不给悬停反馈 */
.menu-row--group {
  cursor: default;
}

.menu-row--group:hover {
  background: transparent;
  color: var(--muted-foreground);
}

.menu-row--ghost {
  opacity: 0.35;
}

.menu-row--chosen {
  background: var(--accent);
  color: var(--foreground);
}

.menu-row__icon {
  flex-shrink: 0;
  color: inherit;
  transition: color var(--duration-theme) var(--ease-theme);
}

.menu-row__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 行尾把手：撑满行高做触摸落点，长按不弹系统菜单 */
.menu-row__handle {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 32px;
  height: 100%;
  color: var(--muted-foreground);
  cursor: grab;
  touch-action: none;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
  transition: color var(--duration-theme) var(--ease-theme);
}

.menu-row__handle:active {
  cursor: grabbing;
  color: var(--foreground);
}

/* 「更多」分组为空时的落点提示，左边界对齐二级入口 */
.menu-drop-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  margin-top: 6px;
  margin-left: 48px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-xs);
  color: var(--muted-foreground);
  font-size: 0.8125rem;
}

/* 底部操作与列表内容共用同一条左右边线，两个按钮等分填满整行 */
.layout-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  width: 100%;
  padding: 12px 16px 16px;
}
</style>

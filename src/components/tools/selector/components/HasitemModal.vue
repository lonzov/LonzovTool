<template>
  <NConfigProvider :theme="isDark ? darkTheme : null" :theme-overrides="isDark ? darkOverrides : undefined">
    <NModal
      v-model:show="showHasitemModal"
      preset="card"
      :title="modalTitle"
      :style="modalStyle"
      :segmented="{ content: true, footer: 'soft' }"
      content-scrollable
      @after-enter="onModalEntered"
      @after-leave="onAfterLeave"
    >
      <div v-if="contentVisible" @click.stop>
        <!-- 模式切换胶囊 -->
        <div ref="tabContainerRef" class="tab-container">
          <div class="tab-indicator" :class="{ locked: indicatorLocked }" :style="indicatorStyle"></div>
          <button
            class="tab-item"
            :class="{ active: !hasitemEditIsArray }"
            @click="switchMode(false)"
          >
            单物品 {...}
          </button>
          <button
            class="tab-item"
            :class="{ active: hasitemEditIsArray }"
            @click="switchMode(true)"
          >
            多物品 [{...}, {...}]
          </button>
        </div>

        <div class="hasitem-items-list">
          <div v-if="hasitemEditItems.length === 0" class="hasitem-empty">暂无物品，请添加</div>
          <div v-for="(it, ii) in hasitemEditItems" :key="ii" class="hasitem-item-row">
            <span class="hasitem-item-label"
              >物品 {{ hasitemEditIsArray ? '#' + (ii + 1) : '' }}</span
            >
            <div class="hasitem-item-fields">
              <div class="hi-field"><label class="hi-label">item</label><NInput v-model:value="it.item" size="tiny" placeholder="物品ID" /></div>
              <div class="hi-field hi-field--half"><label class="hi-label">data</label><NInput v-model:value="it.data" size="tiny" placeholder="数据值" /></div>
              <div class="hi-field hi-field--half"><label class="hi-label">location</label><NInput v-model:value="it.location" size="tiny" placeholder="槽位ID" /></div>
              <div class="hi-field hi-field--half"><label class="hi-label">slot</label><NInput v-model:value="it.slot" size="tiny" placeholder="槽位数值" /></div>
              <div class="hi-field hi-field--half"><label class="hi-label">quantity</label><NInput v-model:value="it.quantity" size="tiny" placeholder="数量" /></div>
            </div>
            <button
              v-if="hasitemEditIsArray || hasitemEditItems.length > 1"
              class="code-act-btn code-act-btn--danger-sm"
              title="删除此物品"
              @click="removeHasitemSubItem(ii)"
            >
              <NIcon :component="Delete24Filled" :size="14" />
            </button>
          </div>
        </div>
        <button
          v-if="(!hasitemEditIsArray && hasitemEditItems.length === 0) || hasitemEditIsArray"
          class="add-hasitem-sub-btn"
          @click="addHasitemSubItem"
        >
          <NIcon :component="Add16Filled" :size="12" />
          <span>添加物品</span>
        </button>
      </div>

      <template #footer>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="onCancel">取消</button>
          <button class="btn btn-fill" @click="onSave">保存</button>
        </div>
      </template>
    </NModal>
  </NConfigProvider>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { NModal, NConfigProvider, NInput, NIcon, darkTheme } from 'naive-ui'
import { Add16Filled, Delete24Filled } from '@vicons/fluent'
import { useTheme } from '../../../../composables/useTheme.js'
import {
  hasitemEditId,
  hasitemEditItems,
  hasitemEditIsArray,
  hasitemEditIsAdd,
} from '../composables/useState.js'
import {
  closeHasitemEditor,
  saveHasitemEditor,
  closeHasitemAddModal,
  saveHasitemAddModal,
  addHasitemSubItem,
  removeHasitemSubItem,
  cleanupHasitemModal,
} from '../composables/useParams.js'
import { useModalContent } from '../composables/useModalContent.js'

const { isDark } = useTheme()

const darkOverrides = {
  common: { neutralModal: '#191919' },
  Card: { colorModal: '#191919' },
}

const { contentVisible, onAfterLeave } = useModalContent(hasitemEditId, cleanupHasitemModal)

const isCompact = ref(false)
let _mq
function _onMqChange(e) { isCompact.value = e.matches }
onMounted(() => {
  _mq = window.matchMedia('(max-width: 640px)')
  isCompact.value = _mq.matches
  _mq.addEventListener('change', _onMqChange)
})
onUnmounted(() => {
  if (_mq) _mq.removeEventListener('change', _onMqChange)
})

const modalStyle = computed(() => ({
  maxWidth: '620px',
  width: 'calc(100% - 32px)',
  maxHeight: isCompact.value ? '670px' : 'calc(100vh - 48px)',
  borderRadius: '16px',
  cornerShape: 'squircle',
}))

const showHasitemModal = computed({
  get: () => !!hasitemEditId.value,
  set: (v) => {
    if (!v) {
      if (hasitemEditIsAdd.value) closeHasitemAddModal()
      else closeHasitemEditor()
    }
  },
})

const modalTitle = computed(() => hasitemEditIsAdd.value ? '添加 hasitem 物品项' : '编辑 hasitem 物品项')

function onCancel() {
  if (hasitemEditIsAdd.value) closeHasitemAddModal()
  else closeHasitemEditor()
}

function onSave() {
  if (hasitemEditIsAdd.value) saveHasitemAddModal()
  else saveHasitemEditor()
}

// ========== 模式切换胶囊 ==========
const tabContainerRef = ref(null)
const indicatorStyle = ref({ width: '0px', transform: 'translateX(0px)', opacity: '0' })
const indicatorLocked = ref(false)

const PADDING = 4

function switchMode(isArray) {
  hasitemEditIsArray.value = isArray
}

/** 数学预计算：两 tab 均为 flex:1，各占一半宽度，无需测量 DOM */
function calcIndicator(instant = false) {
  const container = tabContainerRef.value
  if (!container) return
  const cw = container.getBoundingClientRect().width
  if (cw <= 0) return
  const tabWidth = (cw - PADDING * 2) / 2

  if (instant) indicatorLocked.value = true

  if (hasitemEditIsArray.value) {
    indicatorStyle.value = {
      width: tabWidth + 'px',
      transform: `translateX(${tabWidth}px)`,
      opacity: '1',
    }
  } else {
    indicatorStyle.value = {
      width: tabWidth + 'px',
      transform: 'translateX(0px)',
      opacity: '1',
    }
  }

  if (instant) {
    nextTick(() => { indicatorLocked.value = false })
  }
}

watch(hasitemEditIsArray, () => {
  nextTick(() => requestAnimationFrame(calcIndicator))
})

// 模态框打开时预计算（instant 模式：禁用过渡，瞬间到位）
watch(hasitemEditId, (id) => {
  if (id) nextTick(() => requestAnimationFrame(() => calcIndicator(true)))
})

// 入场动画结束后兜底
function onModalEntered() {
  nextTick(() => requestAnimationFrame(calcIndicator))
}
</script>

<style scoped>
/* ========== 模式切换胶囊 ========== */
.tab-container {
  position: relative;
  display: flex;
  width: 100%;
  background: var(--bg-sub);
  border-radius: 50px;
  padding: 4px;
  user-select: none;
  margin-bottom: 14px;
  box-sizing: border-box;
  transition: background-color 0.4s ease;
}

.tab-indicator {
  position: absolute;
  top: 4px;
  height: calc(100% - 8px);
  background: var(--bg-card);
  border-radius: 50px;
  transition:
    transform 0.28s cubic-bezier(0.2, 0, 0, 1),
    width 0.28s cubic-bezier(0.2, 0, 0, 1);
  z-index: 1;
  pointer-events: none;
}

.tab-indicator.locked {
  transition: none !important;
}

[data-theme='dark'] .tab-container {
  background: var(--bg-color);
}
[data-theme='dark'] .tab-indicator {
  background: var(--bg-sub);
}

.tab-item {
  position: relative;
  z-index: 2;
  flex: 1;
  padding: 7px 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-tertiary);
  cursor: pointer;
  border: none;
  background: none;
  outline: none;
  transition: color 0.2s ease;
  white-space: nowrap;
  text-align: center;
  font-family: inherit;
}

.tab-item:hover {
  color: var(--text-primary);
}

.tab-item.active {
  color: var(--text-primary);
}

.tab-item.active:hover {
  color: var(--text-primary);
}

.hasitem-empty {
  font-size: 12px;
  color: var(--text-tertiary);
  font-style: italic;
  padding: 12px 0;
  transition: color 0.4s ease;
}
.hasitem-items-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.hasitem-item-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-sub);
  transition:
    background-color 0.4s ease,
    border-color 0.4s ease;
}
.hasitem-item-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  min-width: 50px;
  padding-top: 6px;
  transition: color 0.4s ease;
}
.hasitem-item-fields {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.hi-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 100px;
}
.hi-field--half {
  min-width: 70px;
  max-width: 110px;
}
.hi-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  transition: color 0.4s ease;
}

.code-act-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 5px;
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    background-color 0.12s ease,
    color 0.12s ease;
}
.code-act-btn:hover {
  background: var(--bg-sub);
  color: var(--text-primary);
}
.code-act-btn--danger-sm {
  color: #dc2626;
}
.code-act-btn--danger-sm:hover {
  background: rgba(220, 38, 38, 0.1);
}

.add-hasitem-sub-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  margin-top: 12px;
  border: 1px dashed var(--border-color);
  background: transparent;
  color: var(--text-tertiary);
  font-size: 11px;
  font-family: inherit;
  border-radius: 5px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    background-color 0.15s ease;
}
.add-hasitem-sub-btn:hover {
  border-color: var(--text-secondary);
  color: var(--text-primary);
  background: var(--bg-sub);
}

/* 页脚操作按钮 */
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 8px;
}

.btn {
  height: 34px;
  padding: 0 20px;
  border-radius: 17px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  border: none;
}

/* fill - 全填充主按钮 */
[data-theme="light"] .btn-fill {
  background: #1A1A1A;
  color: #fff;
}

[data-theme="dark"] .btn-fill {
  background: #fff;
  color: #1A1A1A;
}

.btn-fill:hover { opacity: 0.85; }

/* outline - 描边次要按钮 */
.btn-outline {
  border: 1.5px solid currentColor;
}

[data-theme="light"] .btn-outline {
  background: #fff;
  color: #1A1A1A;
}

[data-theme="light"] .btn-outline:hover {
  background: #E8E8E8;
}

[data-theme="dark"] .btn-outline {
  background: transparent;
  color: rgba(255, 255, 255, 0.87);
}

[data-theme="dark"] .btn-outline:hover {
  background: rgba(255, 255, 255, 0.08);
}
</style>

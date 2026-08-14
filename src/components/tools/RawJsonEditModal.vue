<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { NModal, NConfigProvider, NIcon, NSelect } from 'naive-ui'
import { darkTheme } from 'naive-ui'
import { Delete24Regular, ArrowUp24Regular, ArrowDown24Regular, Add24Regular, Edit24Filled } from '@vicons/fluent'
import { useTheme } from '../../composables/useTheme'
import {
  showEditModal, editIdx,
  editType, formText, formSelector, formScoreObj, formScoreName,
  formTranslateKey, withMode, withRawtext, tempWith,
  nestedIdx, nestedType, nestedText, nestedSelector, nestedScoreObj, nestedScoreName,
  nestedTranslateKey, nestedWith,
  closeEditModal, saveElement, addWithParam, removeWithParam,
  startNestedEdit, saveNestedEdit, cancelNestedEdit, deleteWithEl, moveWithEl,
  addNestedWithParam, removeNestedWithParam,
  withParamConfirmIdx, withElConfirmIdx, nestedWithParamConfirmIdx,
  getElTypeLabel, getElPreviewText,
} from '../../composables/useRawJsonEditor.js'

const { isDark } = useTheme()

const darkOverrides = {
  common: { neutralModal: '#191919' },
  Card: { colorModal: '#191919' },
}

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
  maxWidth: '520px',
  width: 'calc(100% - 32px)',
  maxHeight: isCompact.value ? 'calc(100vh - 120px)' : 'calc(100vh - 48px)',
  borderRadius: '16px',
  cornerShape: 'squircle',
}))

const typeOptions = [
  { label: '文本 (text)', value: 'text' },
  { label: '选择器 (selector)', value: 'selector' },
  { label: '记分板 (score)', value: 'score' },
  { label: '翻译键 (translate)', value: 'translate' },
]

const withModeOptions = [
  { label: '[...] 列表', value: 'array' },
  { label: '{...} 对象', value: 'object' },
]

function nestedElLabel(el) {
  return getElTypeLabel(el)
}
function nestedElPreview(el) {
  return getElPreviewText(el)
}

function onModalClose() {
  if (nestedIdx.value !== null) {
    cancelNestedEdit()
    return false
  }
}

// ========== 编辑器内容变化高度动画（类型/模式切换、增删元素等） ==========
const formWrapRef = ref(null)
let heightAnimEnd = null

watch(
  [
    nestedIdx, editType, nestedType, withMode,
    () => tempWith.value.length,
    () => withRawtext.value.length,
    () => nestedWith.value.length,
  ],
  () => {
  const el = formWrapRef.value
  if (!el || !showEditModal.value) return

  // 中止上一轮残留的动画
  if (heightAnimEnd) {
    el.removeEventListener('transitionend', heightAnimEnd)
    heightAnimEnd = null
  }
  el.style.transition = ''
  el.style.height = ''
  el.style.overflow = ''

  // 1) 锁定旧高度（watch 在 pre 阶段运行，DOM 仍是旧分支）
  const cap = getAvailableHeight(el)
  const fromHeight = Math.min(el.scrollHeight, cap)
  el.style.height = fromHeight + 'px'
  el.style.overflow = 'hidden'

  // 2) 等新分支渲染后再测量并过渡
  nextTick(() => {
    requestAnimationFrame(() => {
      el.style.transition = 'none'
      el.style.height = ''
      const newCap = getAvailableHeight(el)
      const toHeight = Math.min(el.scrollHeight, newCap)

      if (Math.abs(fromHeight - toHeight) < 2) {
        resetWrapStyle(el)
        return
      }

      el.style.height = fromHeight + 'px'
      void el.offsetHeight
      el.style.transition = 'height 0.3s cubic-bezier(0.2, 0, 0, 1)'
      el.style.height = toHeight + 'px'

      const onEnd = (e) => {
        if (e.propertyName !== 'height') return
        resetWrapStyle(el)
        el.removeEventListener('transitionend', onEnd)
        heightAnimEnd = null
      }
      heightAnimEnd = onEnd
      el.addEventListener('transitionend', onEnd)
    })
  })
})

function resetWrapStyle(el) {
  el.style.height = ''
  el.style.overflow = ''
  el.style.transition = ''
}

/** 计算卡片可用内容区高度 = 卡片总高 − 标题栏 − 按钮栏 − 内容 padding */
function getAvailableHeight(el) {
  const card = el.closest('.n-card')
  if (!card) return Infinity

  const header = card.querySelector(':scope > .n-card-header')
  const footer = card.querySelector(':scope > .n-card-footer')
  const headerH = header ? header.getBoundingClientRect().height : 68
  const footerH = footer ? footer.getBoundingClientRect().height : 83

  const scrollContent = el.closest('.n-scrollbar-content')
  let padTop = 20
  let padBottom = 20
  if (scrollContent) {
    const cs = getComputedStyle(scrollContent)
    padTop = parseFloat(cs.paddingTop) || 20
    padBottom = parseFloat(cs.paddingBottom) || 20
  }

  return card.clientHeight - headerH - footerH - padTop - padBottom
}
</script>

<template>
  <NConfigProvider :theme="isDark ? darkTheme : null" :theme-overrides="isDark ? darkOverrides : undefined">
    <NModal
      v-model:show="showEditModal"
      preset="card"
      :title="nestedIdx !== null ? '编辑 With 元素' : (editIdx !== null ? '编辑元素' : '添加元素')"
      :style="modalStyle"
      :segmented="{ content: true, footer: 'soft' }"
      content-scrollable
      @esc="nestedIdx !== null ? cancelNestedEdit() : closeEditModal()"
      @mask-click="nestedIdx !== null ? cancelNestedEdit() : closeEditModal()"
      @close="onModalClose"
    >
      <!-- 高度过渡动画载体：nestedIdx 切换时只替换其内部内容，本层始终存在 -->
      <div ref="formWrapRef" class="edit-form-wrap">
      <!-- ========== 嵌套编辑器：编辑 with.rawtext 内元素 ========== -->
      <template v-if="nestedIdx !== null">
        <div class="edit-form">
          <div class="edit-field">
            <label class="edit-label">类型</label>
            <NSelect v-model:value="nestedType" :options="typeOptions" size="small" />
          </div>

          <div v-if="nestedType === 'text'" class="edit-field">
            <label class="edit-label">内容</label>
            <textarea v-model="nestedText" class="edit-textarea" rows="3" placeholder="文本内容" spellcheck="false" />
          </div>

          <div v-if="nestedType === 'selector'" class="edit-field">
            <label class="edit-label">选择器</label>
            <input v-model="nestedSelector" type="text" class="edit-input" placeholder="@p" />
          </div>

          <template v-if="nestedType === 'score'">
            <div class="edit-field-row">
              <div class="edit-field edit-field-half">
                <label class="edit-label">记分项</label>
                <input v-model="nestedScoreObj" type="text" class="edit-input" placeholder="money" />
              </div>
              <div class="edit-field edit-field-half">
                <label class="edit-label">目标</label>
                <input v-model="nestedScoreName" type="text" class="edit-input" placeholder="@s" />
              </div>
            </div>
          </template>

          <template v-if="nestedType === 'translate'">
            <div class="edit-field">
              <label class="edit-label">键名</label>
              <input v-model="nestedTranslateKey" type="text" class="edit-input" placeholder="tile.stone.name" />
            </div>
            <div class="edit-field">
              <label class="edit-label">With 参数</label>
              <div class="with-list">
                <div v-if="nestedWith.length === 0" class="with-empty">无参数</div>
                <div v-for="(_w, wi) in nestedWith" :key="wi" class="with-row">
                  <input v-model="nestedWith[wi]" type="text" class="edit-input with-input" :placeholder="`参数 ${wi + 1}`" />
                  <button class="btn-minor" :class="{ 'btn-delete-confirmed': nestedWithParamConfirmIdx === wi }" :title="nestedWithParamConfirmIdx === wi ? '再次点击确认删除' : '删除'" @click="removeNestedWithParam(wi)">
                    <NIcon :component="Delete24Regular" :size="14" />
                  </button>
                </div>
              </div>
              <button class="btn-minor" @click="addNestedWithParam">添加参数</button>
            </div>
          </template>
        </div>
      </template>

      <!-- ========== 主编辑器 ========== -->
      <template v-else>
        <div class="edit-form">
          <!-- 类型选择 -->
          <div class="edit-field">
            <label class="edit-label">类型</label>
            <NSelect v-model:value="editType" :options="typeOptions" size="small" />
          </div>

          <!-- text 表单 -->
          <div v-if="editType === 'text'" class="edit-field">
            <label class="edit-label">内容</label>
            <textarea
              v-model="formText"
              class="edit-textarea"
              rows="4"
              placeholder="支持 § 颜色代码，使用 \n 换行"
              spellcheck="false"
            />
          </div>

          <!-- selector 表单 -->
          <div v-if="editType === 'selector'" class="edit-field">
            <label class="edit-label">选择器</label>
            <input v-model="formSelector" type="text" class="edit-input" placeholder="@p" />
          </div>

          <!-- score 表单 -->
          <template v-if="editType === 'score'">
            <div class="edit-field-row">
              <div class="edit-field edit-field-half">
                <label class="edit-label">记分项</label>
                <input v-model="formScoreObj" type="text" class="edit-input" placeholder="money" />
              </div>
              <div class="edit-field edit-field-half">
                <label class="edit-label">目标</label>
                <input v-model="formScoreName" type="text" class="edit-input" placeholder="@s" />
              </div>
            </div>
          </template>

          <!-- translate 表单 -->
          <template v-if="editType === 'translate'">
            <div class="edit-field">
              <label class="edit-label">键名</label>
              <input v-model="formTranslateKey" type="text" class="edit-input" placeholder="tile.stone.name" />
            </div>
            <div class="edit-field">
              <label class="edit-label">With 类型</label>
              <NSelect v-model:value="withMode" :options="withModeOptions" size="small" />
            </div>

            <!-- With [...] 列表模式 -->
            <div v-if="withMode === 'array'" class="edit-field">
              <label class="edit-label">With 参数</label>
              <div class="with-list">
                <div v-if="tempWith.length === 0" class="with-empty">无参数</div>
                <div v-for="(_w, wi) in tempWith" :key="wi" class="with-row">
                  <input
                    v-model="tempWith[wi]"
                    type="text"
                    class="edit-input with-input"
                    :placeholder="`参数 ${wi + 1}`"
                  />
                  <button class="btn-delete" :class="{ 'btn-delete-confirmed': withParamConfirmIdx === wi }" :title="withParamConfirmIdx === wi ? '再次点击确认删除' : '删除'" @click="removeWithParam(wi)">
                    <NIcon :component="Delete24Regular" :size="14" />
                  </button>
                </div>
              </div>
              <button class="btn-minor btn-add" @click="addWithParam">
                <NIcon :component="Add24Regular" :size="14" />
                <span>添加参数</span>
              </button>
            </div>

            <!-- With {...} 对象模式 -->
            <div v-if="withMode === 'object'" class="edit-field">
              <label class="edit-label">With Rawtext 元素</label>
              <div class="with-list">
                <div v-if="withRawtext.length === 0" class="with-empty">无元素，请添加</div>
                <div v-for="(el, ei) in withRawtext" :key="ei" class="with-el-row">
                  <span class="with-el-badge">{{ nestedElLabel(el) }}</span>
                  <span class="with-el-preview">{{ nestedElPreview(el) }}</span>
                  <div class="with-el-actions">
                    <button class="btn-minor" :disabled="ei === 0" @click="moveWithEl(ei, 'up')">
                      <NIcon :component="ArrowUp24Regular" :size="14" />
                    </button>
                    <button class="btn-minor" :disabled="ei === withRawtext.length - 1" @click="moveWithEl(ei, 'down')">
                      <NIcon :component="ArrowDown24Regular" :size="14" />
                    </button>
                    <button class="btn-minor" @click="startNestedEdit(ei)">
                      <NIcon :component="Edit24Filled" :size="14" />
                    </button>
                    <button class="btn-minor" :class="{ 'btn-delete-confirmed': withElConfirmIdx === ei }" :title="withElConfirmIdx === ei ? '再次点击确认删除' : '删除'" @click="deleteWithEl(ei)">
                      <NIcon :component="Delete24Regular" :size="14" />
                    </button>
                  </div>
                </div>
              </div>
              <button class="btn-minor btn-add" @click="startNestedEdit(null)">
                <NIcon :component="Add24Regular" :size="14" />
                <span>添加元素</span>
              </button>
            </div>
          </template>
        </div>
      </template>
      </div>

      <!-- 统一 footer -->
      <template #footer>
        <div v-if="nestedIdx !== null" class="modal-actions">
          <button class="btn btn-outline" @click="cancelNestedEdit">取消</button>
          <button class="btn btn-fill" @click="saveNestedEdit">确认</button>
        </div>
        <div v-else class="modal-actions">
          <button class="btn btn-outline" @click="closeEditModal">取消</button>
          <button class="btn btn-fill" @click="saveElement">保存</button>
        </div>
      </template>
    </NModal>
  </NConfigProvider>
</template>

<style scoped>
.edit-form-wrap { transition: height 0.3s cubic-bezier(0.2, 0, 0, 1); }
.edit-form { display: flex; flex-direction: column; gap: 14px; }
.edit-field { display: flex; flex-direction: column; gap: 4px; }
.edit-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.edit-label {
  font-size: 11px; font-weight: 600; color: var(--text-tertiary);
  text-transform: uppercase; letter-spacing: 0.5px;
  transition: color 0.4s ease;
}
.edit-input {
  width: 100%; padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-sub);
  color: var(--text-primary);
  font-size: 13px;
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  outline: none; box-sizing: border-box;
  transition: border-color 0.3s ease, background-color 0.4s ease, color 0.4s ease;
}
.edit-input:focus { border-color: var(--text-secondary); }
.edit-textarea {
  width: 100%; padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-sub);
  color: var(--text-primary);
  font-size: 13px;
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  outline: none; resize: vertical; box-sizing: border-box;
  transition: border-color 0.3s ease, background-color 0.4s ease, color 0.4s ease;
}
.edit-textarea:focus { border-color: var(--text-secondary); }

.with-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 6px; }
.with-empty { font-size: 12px; color: var(--text-tertiary); font-style: italic; transition: color 0.4s ease; }
.with-row { display: flex; gap: 6px; align-items: center; }
.with-input { flex: 1; }

.with-el-row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px;
  background: var(--bg-sub);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  transition: background-color 0.4s ease, border-color 0.4s ease;
}
.with-el-badge {
  font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;
  background: var(--bg-sub); color: var(--text-secondary);
  flex-shrink: 0;
  letter-spacing: 0.5px;
  transition: color 0.4s ease;
}
.with-el-preview {
  flex: 1; font-size: 12px; color: var(--text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  transition: color 0.4s ease;
}
.with-el-actions {
  display: flex; gap: 2px; flex-shrink: 0;
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

/* minor - 表单内小按钮 */
.btn-minor {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 9px 10px;
  border: none; background: transparent;
  color: var(--text-secondary);
  font-size: 12px; font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
  transition: background-color 0.15s ease, color 0.15s ease;
}

[data-theme="light"] .btn-minor:hover {
  background: rgba(0, 0, 0, 0.06);
}

[data-theme="dark"] .btn-minor {
  color: rgba(255, 255, 255, 0.87);
}

[data-theme="dark"] .btn-minor:hover {
  background: rgba(255, 255, 255, 0.08);
}

.btn-minor:active { transform: scale(0.97); }
.btn-minor:disabled { opacity: 0.3; cursor: default; }
.btn-minor:disabled:hover { background: transparent; }

/* add - 带加号的新增按钮（内部布局照抄 add-btn：图标+span，gap 5px；仅降低高度） */
.btn-minor.btn-add {
  gap: 5px;
  padding: 6px 10px;
}

/* delete - 列表模式元素条尾部删除按钮（独立于 btn-minor，撑满元素条高度） */
.btn-delete {
  display: inline-flex; align-items: center; justify-content: center;
  align-self: stretch;
  flex-shrink: 0;
  width: 34px;
  padding: 0;
  border: none; background: transparent;
  color: var(--text-secondary);
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
  transition: background-color 0.15s ease, color 0.15s ease;
}

[data-theme="light"] .btn-delete:hover {
  background: rgba(0, 0, 0, 0.06);
}

[data-theme="dark"] .btn-delete {
  color: rgba(255, 255, 255, 0.87);
}

[data-theme="dark"] .btn-delete:hover {
  background: rgba(255, 255, 255, 0.08);
}

.btn-delete:active { transform: scale(0.97); }

.btn-delete-confirmed,
.btn-delete-confirmed:hover {
  background: #dc2626 !important;
  color: #fff !important;
}
[data-theme="dark"] .btn-delete-confirmed,
[data-theme="dark"] .btn-delete-confirmed:hover {
  background: #dc2626 !important;
  color: #fff !important;
}

@media (max-width: 480px) {
  .edit-field-row { grid-template-columns: 1fr; }
}
</style>

<style>
/* NSelect 下拉菜单描边 */
.n-select-menu {
  border: 1px solid var(--border-color) !important;
}
</style>

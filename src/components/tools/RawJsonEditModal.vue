<script setup>
import { ref, watch, nextTick } from 'vue'
import { NIcon, NSelect } from 'naive-ui'
import { Delete24Regular, ArrowUp24Regular, ArrowDown24Regular, Add24Regular, Edit24Filled } from '@vicons/fluent'
import AppModal, { MODAL_CARD_CHROME_HEIGHT } from '../ui/AppModal.vue'
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

/** 卡片可用内容区高度 = 卡片总高 − 标题栏 − 按钮栏 − 内容 padding */
function getAvailableHeight(el) {
  const card = el.closest('.app-modal')
  if (!card) return Infinity
  return card.clientHeight - MODAL_CARD_CHROME_HEIGHT
}
</script>

<template>
  <AppModal
    v-model:show="showEditModal"
    :title="nestedIdx !== null ? '编辑 With 元素' : (editIdx !== null ? '编辑元素' : '添加元素')"
    :max-width="520"
    content-scrollable
    :mask-closable="false"
    :actions="nestedIdx !== null
      ? [
        { text: '取消', variant: 'outline', onClick: cancelNestedEdit },
        { text: '确认', variant: 'fill', onClick: saveNestedEdit },
      ]
      : [
        { text: '取消', variant: 'outline', onClick: closeEditModal },
        { text: '保存', variant: 'fill', onClick: saveElement },
      ]"
    @esc="nestedIdx !== null ? cancelNestedEdit() : closeEditModal()"
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
                <span v-if="nestedWith[wi] === ''" class="with-empty-tag" title="这一行是空参数，仍会占用一个槽位">空</span>
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
                <span v-if="tempWith[wi] === ''" class="with-empty-tag" title="这一行是空参数，仍会占用一个槽位">空</span>
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
  </AppModal>
</template>

<style scoped>
.edit-form-wrap { transition: height 0.3s cubic-bezier(0.2, 0, 0, 1); }
.edit-form { display: flex; flex-direction: column; gap: 14px; }
.edit-field { display: flex; flex-direction: column; gap: 4px; }
.edit-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.edit-label {
  font-size: 11px; font-weight: 600; color: var(--subtle-foreground);
  text-transform: uppercase; letter-spacing: 0.5px;
  transition: color 0.4s ease;
}
.edit-input {
  width: 100%; padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--muted);
  color: var(--foreground);
  font-size: 13px;
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  outline: none; box-sizing: border-box;
  transition: border-color 0.3s ease, background-color 0.4s ease, color 0.4s ease;
}
.edit-input:focus { border-color: var(--muted-foreground); }
.edit-textarea {
  width: 100%; padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--muted);
  color: var(--foreground);
  font-size: 13px;
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  outline: none; resize: vertical; box-sizing: border-box;
  transition: border-color 0.3s ease, background-color 0.4s ease, color 0.4s ease;
}
.edit-textarea:focus { border-color: var(--muted-foreground); }

.with-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 6px; }
.with-empty { font-size: 12px; color: var(--subtle-foreground); font-style: italic; transition: color 0.4s ease; }
.with-row { display: flex; gap: 6px; align-items: center; }
.with-input { flex: 1; }
.with-empty-tag {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  font-size: 10px; font-weight: 700; line-height: 1.4;
  color: var(--subtle-foreground);
  background: var(--muted);
  border: 1px solid var(--border);
  transition: color 0.4s ease, background-color 0.4s ease, border-color 0.4s ease;
}

.with-el-row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px;
  background: var(--muted);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  transition: background-color 0.4s ease, border-color 0.4s ease;
}
.with-el-badge {
  font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: var(--radius-xs);
  background: var(--muted); color: var(--muted-foreground);
  flex-shrink: 0;
  letter-spacing: 0.5px;
  transition: color 0.4s ease;
}
.with-el-preview {
  flex: 1; font-size: 12px; color: var(--foreground);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  transition: color 0.4s ease;
}
.with-el-actions {
  display: flex; gap: 2px; flex-shrink: 0;
}

/* minor - 表单内小按钮 */
.btn-minor {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 9px 10px;
  border: none; background: transparent;
  color: var(--muted-foreground);
  font-size: 12px; font-weight: 500;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: inherit;
  transition: background-color 0.15s ease, color 0.15s ease;
}

/* 深色下小按钮取满亮度文字，与浅色的次要灰拉开层级 */
[data-theme="dark"] .btn-minor {
  color: var(--foreground);
}

.btn-minor:hover {
  background: var(--accent);
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
  color: var(--muted-foreground);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: inherit;
  transition: background-color 0.15s ease, color 0.15s ease;
}

/* 深色下删除按钮取满亮度文字，与浅色的次要灰拉开层级 */
[data-theme="dark"] .btn-delete {
  color: var(--foreground);
}

.btn-delete:hover {
  background: var(--accent);
}

.btn-delete:active { transform: scale(0.97); }

.btn-delete-confirmed,
.btn-delete-confirmed:hover {
  background: var(--destructive) !important;
  color: var(--destructive-foreground) !important;
}

@media (max-width: 480px) {
  .edit-field-row { grid-template-columns: 1fr; }
}
</style>


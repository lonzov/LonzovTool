<script setup>
import { computed, onBeforeUnmount, ref, watch, nextTick } from 'vue'
import { NSelect } from 'naive-ui'
import { Delete24Regular, ArrowUp24Regular, ArrowDown24Regular, Add24Regular, Edit24Filled } from '@vicons/fluent'
import AppButton from '../ui/AppButton.vue'
import AppModal from '../ui/AppModal.vue'
import { animateRowIn, animateRowOut, createRowSwap } from '../../utils/listMotion.js'
import { getModalContentHeight } from '../../utils/modalHeight.js'
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
  getElTypeClass, getElTypeLabel, getElPreviewText, getElementKey,
  buildEditElement, validateElement,
} from '../../composables/useRawJsonEditor.js'

/** 弹窗内对草稿值即时校验：失焦后标红，保存前就能看到哪一项不合规 */
const touchedFields = ref(new Set())
const draftIssues = computed(() => validateElement(buildEditElement()))

watch(showEditModal, (visible) => {
  if (visible) touchedFields.value = new Set()
})
watch(editType, () => { touchedFields.value = new Set() })

function markTouched(field) {
  touchedFields.value = new Set(touchedFields.value).add(field)
}

function fieldError(field) {
  if (!touchedFields.value.has(field)) return ''
  return draftIssues.value.find(issue => issue.field === field)?.msg || ''
}

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

// ========== with.rawtext 元素条的过渡 ==========
// 与桌面端就地编辑同一套节奏：新增展开、删除收起、上下移动用位移互换
const withListRef = ref(null)
const rowSwap = createRowSwap()

function rowNodeOf(el) {
  if (!el) return null
  return withListRef.value?.querySelector(`[data-el-key="${getElementKey(el)}"]`) || null
}

/** 只有新增才会有入场动画：编辑已有元素时行没有增减 */
async function onSaveNestedEdit() {
  const isNew = nestedIdx.value === -1
  saveNestedEdit()
  if (!isNew) return
  await nextTick()
  const added = withRawtext.value[withRawtext.value.length - 1]
  const node = rowNodeOf(added)
  if (node) await animateRowIn(node)
}

async function onMoveWithEl(index, dir) {
  const list = withRawtext.value
  const target = dir === 'up' ? index - 1 : index + 1
  if (target < 0 || target >= list.length) return
  const fromNode = rowNodeOf(list[index])
  const toNode = rowNodeOf(list[target])
  const fromTopBefore = fromNode?.getBoundingClientRect().top
  const toTopBefore = toNode?.getBoundingClientRect().top
  moveWithEl(index, dir)
  if (!fromNode || !toNode) return
  await nextTick()
  rowSwap.play(fromNode, toNode, fromTopBefore, toTopBefore)
}

/** 第一次点击只进入确认态，第二次点击先收起再删 */
async function onDeleteWithEl(index) {
  if (withElConfirmIdx.value !== index) {
    deleteWithEl(index)
    return
  }
  await animateRowOut(rowNodeOf(withRawtext.value[index]))
  deleteWithEl(index)
}

onBeforeUnmount(() => rowSwap.cancel())

function onModalClose() {
  if (nestedIdx.value !== null) {
    cancelNestedEdit()
    return false
  }
}

/**
 * 所有关闭途径（关闭按钮 / 遮罩 / Esc）统一走这里。
 * 不挂 @esc：NModal 的 onEsc 不受 eventEffectNotPerformed 约束，下拉菜单
 * 吃掉 Esc 时照样回调，会把正在编辑的内容一起关掉；closeOnEsc 那条路才带判断。
 */
function onShowChange(visible) {
  if (visible) {
    showEditModal.value = true
    return
  }
  if (nestedIdx.value !== null) cancelNestedEdit()
  else closeEditModal()
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
  const cap = getModalContentHeight(el)
  const fromHeight = Math.min(el.scrollHeight, cap)
  el.style.height = fromHeight + 'px'
  el.style.overflow = 'hidden'

  // 2) 等新分支渲染后再测量并过渡
  nextTick(() => {
    requestAnimationFrame(() => {
      el.style.transition = 'none'
      el.style.height = ''
      const newCap = getModalContentHeight(el)
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

</script>

<template>
  <AppModal
    :show="showEditModal"
    :title="nestedIdx !== null ? '编辑 With 元素' : (editIdx !== null ? '编辑元素' : '添加元素')"
    :max-width="520"
    :auto-focus="false"
    content-scrollable
    :mask-closable="false"
    :actions="nestedIdx !== null
      ? [
        { text: '取消', variant: 'outline', onClick: cancelNestedEdit },
        { text: '确认', variant: 'fill', onClick: onSaveNestedEdit },
      ]
      : [
        { text: '取消', variant: 'outline', onClick: closeEditModal },
        { text: '保存', variant: 'fill', onClick: saveElement },
      ]"
    :before-close="onModalClose"
    @update:show="onShowChange"
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
                <AppButton
                  variant="text"
                  size="xs"
                  icon-only
                  :icon="Delete24Regular"
                  :label="nestedWithParamConfirmIdx === wi ? '再次点击确认删除' : '删除'"
                  :class="{ 'confirm-destructive': nestedWithParamConfirmIdx === wi }"
                  @click="removeNestedWithParam(wi)"
                />
              </div>
            </div>
            <AppButton variant="text" size="xs" :icon="Add24Regular" @click="addNestedWithParam">
              添加参数
            </AppButton>
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
            :class="{ 'edit-control--error': fieldError('text') }"
            rows="4"
            placeholder="支持 § 颜色代码，使用 \n 换行"
            spellcheck="false"
            @blur="markTouched('text')"
          />
          <p v-if="fieldError('text')" class="edit-error">{{ fieldError('text') }}</p>
        </div>

        <!-- selector 表单 -->
        <div v-if="editType === 'selector'" class="edit-field">
          <label class="edit-label">选择器</label>
          <input
            v-model="formSelector"
            type="text"
            class="edit-input"
            :class="{ 'edit-control--error': fieldError('selector') }"
            placeholder="@p"
            @blur="markTouched('selector')"
          />
          <p v-if="fieldError('selector')" class="edit-error">{{ fieldError('selector') }}</p>
        </div>

        <!-- score 表单 -->
        <template v-if="editType === 'score'">
          <div class="edit-field-row">
            <div class="edit-field edit-field-half">
              <label class="edit-label">记分项</label>
              <input
                v-model="formScoreObj"
                type="text"
                class="edit-input"
                :class="{ 'edit-control--error': fieldError('score.objective') }"
                placeholder="money"
                @blur="markTouched('score.objective')"
              />
              <p v-if="fieldError('score.objective')" class="edit-error">{{ fieldError('score.objective') }}</p>
            </div>
            <div class="edit-field edit-field-half">
              <label class="edit-label">目标</label>
              <input
                v-model="formScoreName"
                type="text"
                class="edit-input"
                :class="{ 'edit-control--error': fieldError('score.name') }"
                placeholder="@s"
                @blur="markTouched('score.name')"
              />
              <p v-if="fieldError('score.name')" class="edit-error">{{ fieldError('score.name') }}</p>
            </div>
          </div>
        </template>

        <!-- translate 表单 -->
        <template v-if="editType === 'translate'">
          <div class="edit-field">
            <label class="edit-label">键名</label>
            <input
              v-model="formTranslateKey"
              type="text"
              class="edit-input"
              :class="{ 'edit-control--error': fieldError('translate') }"
              placeholder="tile.stone.name"
              @blur="markTouched('translate')"
            />
            <p v-if="fieldError('translate')" class="edit-error">{{ fieldError('translate') }}</p>
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
                  :class="{ 'edit-control--error': fieldError('with') }"
                  :placeholder="`参数 ${wi + 1}`"
                  @blur="markTouched('with')"
                />
                <span v-if="tempWith[wi] === ''" class="with-empty-tag" title="这一行是空参数，仍会占用一个槽位">空</span>
                <AppButton
                  variant="text"
                  size="xs"
                  icon-only
                  :icon="Delete24Regular"
                  :label="withParamConfirmIdx === wi ? '再次点击确认删除' : '删除'"
                  :class="{ 'confirm-destructive': withParamConfirmIdx === wi }"
                  @click="removeWithParam(wi)"
                />
              </div>
            </div>
            <AppButton variant="text" size="xs" :icon="Add24Regular" @click="addWithParam">
              添加参数
            </AppButton>
          </div>

          <!-- With {...} 对象模式 -->
          <div v-if="withMode === 'object'" class="edit-field">
            <label class="edit-label">With Rawtext 元素</label>
            <div ref="withListRef" class="with-list">
              <div v-if="withRawtext.length === 0" class="with-empty">无元素</div>
              <div
                v-for="(el, ei) in withRawtext"
                :key="getElementKey(el)"
                :data-el-key="getElementKey(el)"
                class="with-el-row"
              >
                <span class="with-el-badge" :class="getElTypeClass(el)">{{ nestedElLabel(el) }}</span>
                <span class="with-el-preview">{{ nestedElPreview(el) }}</span>
                <div class="with-el-actions">
                  <AppButton
                    variant="text"
                    size="xs"
                    icon-only
                    :icon="ArrowUp24Regular"
                    label="上移"
                    :disabled="ei === 0"
                    @click="onMoveWithEl(ei, 'up')"
                  />
                  <AppButton
                    variant="text"
                    size="xs"
                    icon-only
                    :icon="ArrowDown24Regular"
                    label="下移"
                    :disabled="ei === withRawtext.length - 1"
                    @click="onMoveWithEl(ei, 'down')"
                  />
                  <AppButton
                    variant="text"
                    size="xs"
                    icon-only
                    :icon="Edit24Filled"
                    label="编辑"
                    @click="startNestedEdit(ei)"
                  />
                  <AppButton
                    variant="text"
                    size="xs"
                    icon-only
                    :icon="Delete24Regular"
                    :label="withElConfirmIdx === ei ? '再次点击确认删除' : '删除'"
                    :class="{ 'confirm-destructive': withElConfirmIdx === ei }"
                    @click="onDeleteWithEl(ei)"
                  />
                </div>
              </div>
            </div>
            <AppButton variant="text" size="xs" :icon="Add24Regular" @click="startNestedEdit(null)">
              添加元素
            </AppButton>
          </div>
        </template>
      </div>
    </template>
    </div>
  </AppModal>
</template>

<style scoped>
.edit-form-wrap { transition: height 0.3s cubic-bezier(0.2, 0, 0, 1); }

/* 减少动态效果：切换元素类型时表单区伸缩直接到位 */
html[data-motion='reduced'] .edit-form-wrap { transition: none !important; }
.edit-form { display: flex; flex-direction: column; gap: 16px; }
.edit-field { display: flex; flex-direction: column; gap: 4px; }
.edit-error {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  letter-spacing: 0.2px;
  color: var(--destructive);
}
.edit-input.edit-control--error,
.edit-textarea.edit-control--error { border-color: var(--destructive); }
.edit-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.edit-label {
  font-size: 12px; font-weight: 400; color: var(--muted-foreground);
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
.with-empty { font-size: 12px; color: var(--muted-foreground); transition: color 0.4s ease; }
.with-row { display: flex; gap: 6px; align-items: center; }
.with-input { flex: 1; }
.with-empty-tag {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  font-size: 11px; font-weight: 500; line-height: 1.4;
  color: var(--muted-foreground);
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
  font-size: 11px; font-weight: 500; padding: 1px 6px; border-radius: var(--radius-xs);
  flex-shrink: 0;
  transition: background-color 0.4s ease, color 0.4s ease;
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

@media (max-width: 480px) {
  .edit-field-row { grid-template-columns: 1fr; }
}
</style>


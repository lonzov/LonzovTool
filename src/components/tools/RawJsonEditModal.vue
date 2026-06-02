<script setup>
import { NModal, NConfigProvider, NIcon, NSelect } from 'naive-ui'
import { darkTheme } from 'naive-ui'
import { Delete24Regular } from '@vicons/fluent'
import { useTheme } from '../../composables/useTheme'
import {
  showEditModal, editIdx,
  editType, formText, formSelector, formScoreObj, formScoreName,
  formTranslateKey, tempWith,
  closeEditModal, saveElement, addWithParam, removeWithParam,
} from '../../composables/useRawJsonEditor.js'

const { isDark } = useTheme()

const darkOverrides = {
  common: { neutralModal: '#191919' },
  Card: { colorModal: '#191919' },
}
</script>

<template>
  <NConfigProvider :theme="isDark ? darkTheme : null" :theme-overrides="isDark ? darkOverrides : undefined">
    <NModal
      v-model:show="showEditModal"
      preset="card"
      :title="editIdx !== null ? '编辑元素' : '添加元素'"
      :style="{ maxWidth: '480px', width: 'calc(100% - 32px)', maxHeight: 'calc(100vh - 48px)', borderRadius: '16px' }"
      :segmented="{ content: true, footer: 'soft' }"
      content-scrollable
      @esc="closeEditModal"
      @mask-click="closeEditModal"
    >
      <div class="edit-form">
        <!-- 类型选择 -->
        <div class="edit-field">
          <label class="edit-label">类型</label>
          <NSelect
            v-model:value="editType"
            :options="[
              { label: '文本 (text)', value: 'text' },
              { label: '选择器 (selector)', value: 'selector' },
              { label: '记分板 (score)', value: 'score' },
              { label: '翻译键 (translate)', value: 'translate' },
            ]"
            size="small"
          />
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
                <button class="btn-minor" @click="removeWithParam(wi)">
                  <NIcon :component="Delete24Regular" :size="14" />
                </button>
              </div>
            </div>
            <button class="btn-minor" @click="addWithParam">添加参数</button>
          </div>
        </template>
      </div>

      <template #footer>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="closeEditModal">取消</button>
          <button class="btn btn-fill" @click="saveElement">保存</button>
        </div>
      </template>
    </NModal>
  </NConfigProvider>
</template>

<style scoped>
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

/* 页脚操作按钮 (与 UpdateDialog 一致) */
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

/* minor - 表单内小按钮（添加参数 / 删除参数） */
.btn-minor {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 4px 10px;
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

@media (max-width: 480px) {
  .edit-field-row { grid-template-columns: 1fr; }
}
</style>

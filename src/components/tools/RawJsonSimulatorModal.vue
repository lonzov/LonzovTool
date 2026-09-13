<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { NModal, NConfigProvider, NIcon } from 'naive-ui'
import { darkTheme } from 'naive-ui'
import { Add16Filled, Delete24Regular } from '@vicons/fluent'
import { useTheme } from '../../composables/useTheme'
import { useHeightTransition } from '../../composables/useHeightTransition.js'
import {
  simPlayer, simMissing, simTagsText, simScores,
  showSimModal, simScoreConfirmIdx,
  closeSimModal, addSimScore, removeSimScore, resetSimulator, triggerSimSave,
} from '../../composables/useRawJsonSimulator.js'

const { isDark } = useTheme()

// 增删记分板行、说明文案换行等都会改变高度，统一交给它做过渡
const animWrap = ref(null)
const animInner = ref(null)
useHeightTransition({ show: showSimModal, inner: animInner, wrap: animWrap })

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
  maxWidth: '560px',
  width: 'calc(100% - 32px)',
  maxHeight: isCompact.value ? 'calc(100vh - 120px)' : 'calc(100vh - 110px)',
  borderRadius: '16px',
  cornerShape: 'squircle',
}))
</script>

<template>
  <NConfigProvider :theme="isDark ? darkTheme : null" :theme-overrides="isDark ? darkOverrides : undefined">
    <NModal
      v-model:show="showSimModal"
      preset="card"
      title="预览模拟器"
      :style="modalStyle"
      :segmented="{ content: true, footer: 'soft' }"
      content-scrollable
    >
      <div ref="animWrap" class="modal-anim">
        <div ref="animInner">
          <p class="sim-hint">
            预览里的 <code>selector</code> 和 <code>score</code> 元素需要知道「谁在看这条消息」才能求值。
            这里填的就是那套模拟数据——只影响预览，不会写进 JSON。
          </p>

          <div class="sim-field">
            <label class="sim-label">玩家名</label>
            <input v-model="simPlayer" type="text" class="sim-input" placeholder="Steve" @input="triggerSimSave" />
            <span class="sim-field-hint">@s / @p / @a / @e 都会取这个值</span>
          </div>

          <div class="sim-field">
            <label class="sim-label">缺失分值</label>
            <input v-model="simMissing" type="text" class="sim-input" placeholder="0" @input="triggerSimSave" />
            <span class="sim-field-hint">记分板查不到该玩家/计分项时显示的兜底值</span>
          </div>

          <div class="sim-field">
            <label class="sim-label">实体标签</label>
            <input v-model="simTagsText" type="text" class="sim-input" placeholder="vip, admin" @input="triggerSimSave" />
            <span class="sim-field-hint">逗号分隔。用于 @e[tag=vip] 这类带标签过滤的选择器</span>
          </div>

          <div class="sim-field">
            <label class="sim-label">记分板</label>
            <div class="sim-score-list">
              <div v-if="simScores.length === 0" class="sim-empty">暂无记分板数据</div>
              <div v-for="(row, i) in simScores" :key="i" class="sim-score-row">
                <input v-model="row.player" type="text" class="sim-input sim-score-input" placeholder="玩家" @input="triggerSimSave" />
                <input v-model="row.objective" type="text" class="sim-input sim-score-input" placeholder="计分项" @input="triggerSimSave" />
                <input v-model="row.score" type="text" class="sim-input sim-score-value" placeholder="0" @input="triggerSimSave" />
                <button
                  class="sim-icon-btn"
                  :class="{ 'sim-icon-btn--danger': simScoreConfirmIdx === i }"
                  :title="simScoreConfirmIdx === i ? '再次点击确认删除' : '删除'"
                  @click="removeSimScore(i)"
                >
                  <NIcon :component="Delete24Regular" :size="14" />
                </button>
              </div>
            </div>
            <button class="sim-add-btn" @click="addSimScore">
              <NIcon :component="Add16Filled" :size="14" />
              <span>添加记分板项</span>
            </button>
            <span class="sim-field-hint">
              既用于 <code>score</code> 元素求值，也用于 <code>@p[scores={{ a=1 }}]</code> 这类条件选择器。
              没有列出的计分项一律视为「条件不成立」，该参数会被移出参数表。
            </span>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="resetSimulator">重置</button>
          <button class="btn btn-fill" @click="closeSimModal">完成</button>
        </div>
      </template>
    </NModal>
  </NConfigProvider>
</template>

<style scoped>
/* 高度过渡容器：外层高度由 useHeightTransition 接管，内层高度自适应 */
.modal-anim {
  overflow: hidden;
  transition: height 260ms cubic-bezier(0.4, 0, 0.2, 1);
}

.sim-hint {
  margin: 0 0 16px; padding: 10px 12px;
  font-size: 12px; line-height: 1.6; color: var(--text-secondary);
  background: var(--bg-sub); border-radius: 8px;
  transition: color 0.4s ease, background-color 0.4s ease;
}
.sim-hint code {
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: 11px; padding: 1px 4px; border-radius: 4px;
  background: var(--bg-card); color: var(--text-primary);
  transition: background-color 0.4s ease, color 0.4s ease;
}

.sim-field { margin-bottom: 14px; }
/* 高度过渡容器形成了 BFC，末尾 margin 不再塌陷出去，会白白多出一截高度 */
.sim-field:last-child { margin-bottom: 0; }
.sim-label {
  display: block; margin-bottom: 4px;
  font-size: 11px; font-weight: 600; color: var(--text-tertiary);
  text-transform: uppercase; letter-spacing: 0.5px;
  transition: color 0.4s ease;
}
.sim-field-hint {
  display: block; margin-top: 4px;
  font-size: 10px; line-height: 1.6; color: var(--text-tertiary);
  transition: color 0.4s ease;
}
.sim-field-hint code {
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: 10px; padding: 1px 3px; border-radius: 3px;
  background: var(--bg-sub); color: var(--text-secondary);
  transition: background-color 0.4s ease, color 0.4s ease;
}
.sim-input {
  width: 100%; height: 34px; padding: 0 12px;
  border: 1px solid var(--border-color); border-radius: 8px;
  background: var(--bg-sub); color: var(--text-primary);
  font-size: 13px; font-family: inherit; outline: none; box-sizing: border-box;
  transition: border-color 0.3s ease, background-color 0.4s ease, color 0.4s ease;
}
.sim-input:focus { border-color: var(--text-secondary); }

.sim-score-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 6px; }
.sim-empty { font-size: 12px; color: var(--text-tertiary); font-style: italic; transition: color 0.4s ease; }
.sim-score-row { display: flex; gap: 6px; align-items: center; }
.sim-score-input { flex: 1; }
.sim-score-value { width: 88px; flex: none; }

.sim-icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; padding: 0; flex: none;
  border: none; border-radius: 6px; background: transparent;
  color: var(--text-secondary); cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease;
}
.sim-icon-btn:hover { background: var(--bg-sub); color: var(--text-primary); }
/* 二次点击确认删除（与 .btn-delete-confirmed / .act-delete-confirmed 一致） */
.sim-icon-btn--danger,
.sim-icon-btn--danger:hover {
  background: #dc2626 !important;
  color: #fff !important;
}
[data-theme="dark"] .sim-icon-btn--danger,
[data-theme="dark"] .sim-icon-btn--danger:hover {
  background: #dc2626 !important;
  color: #fff !important;
}

.sim-add-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 6px 10px;
  border: 1px dashed var(--border-color); border-radius: 8px;
  background: transparent; cursor: pointer;
  font-size: 12px; font-family: inherit; color: var(--text-secondary);
  transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
}
.sim-add-btn:hover { color: var(--text-primary); border-color: var(--text-secondary); background: var(--bg-sub); }

/* 页脚操作按钮 (与 UpdateDialog 一致) */
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  align-items: center;
  width: 100%;
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

[data-theme="light"] .btn-fill {
  background: #1A1A1A;
  color: #fff;
}

[data-theme="dark"] .btn-fill {
  background: #fff;
  color: #1A1A1A;
}

.btn-fill:hover { opacity: 0.85; }

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

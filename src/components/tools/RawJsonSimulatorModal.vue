<script setup>
import { ref } from 'vue'
import { NIcon, NTabPane, NTabs } from 'naive-ui'
import AppModal from '../ui/AppModal.vue'
import { Add16Filled, Delete24Regular } from '@vicons/fluent'
import {
  simPlayer, simMissing, simTagsText, simScores,
  showSimModal, simScoreConfirmIdx,
  closeSimModal, addSimScore, removeSimScore, resetSimulator, triggerSimSave,
} from '../../composables/useRawJsonSimulator.js'
import { confirmDialog } from '../../composables/useConfirm.js'

/** 重置会丢掉全部模拟数据，先确认；没有可直接撤销的编辑栈 */
async function onReset() {
  const confirmed = await confirmDialog({
    title: '重置预览模拟器',
    message: '玩家名、实体标签与记分板都会恢复默认。',
    confirmText: '确认重置',
    danger: true,
  })
  if (confirmed) resetSimulator()
}

const activeTab = ref('identity')

// 关闭按钮 / 遮罩 / Esc 统一走 closeSimModal（内含落盘），Esc 的展开下拉判断交给 NModal
function onShowChange(visible) {
  if (visible) showSimModal.value = true
  else closeSimModal()
}
</script>

<template>
  <AppModal
    :show="showSimModal"
    title="预览模拟器"
    description="只影响预览，不会写进命令"
    :max-width="520"
    :max-height-offset="110"
    content-scrollable
    animated
    :auto-focus="false"
    :actions="[
      { text: '重置', variant: 'outline', onClick: onReset },
      { text: '完成', variant: 'fill', onClick: closeSimModal },
    ]"
    @update:show="onShowChange"
  >
    <NTabs v-model:value="activeTab" type="line" animated class="sim-tabs">
      <NTabPane name="identity" tab="玩家属性">
        <div class="sim-pane">
          <div class="sim-field">
            <label class="sim-label">玩家名</label>
            <input v-model="simPlayer" type="text" class="sim-input" placeholder="Steve" @input="triggerSimSave" />
            <span class="sim-field-hint">@s、@p、@a、@e 取此值</span>
          </div>

          <div class="sim-field">
            <label class="sim-label">实体标签</label>
            <input v-model="simTagsText" type="text" class="sim-input" placeholder="vip, admin" @input="triggerSimSave" />
            <span class="sim-field-hint">逗号分隔，用于 @e[tag=vip]</span>
          </div>
        </div>
      </NTabPane>

      <NTabPane name="scores" tab="记分板">
        <div class="sim-pane">
          <div class="sim-field">
            <label class="sim-label">缺失分值</label>
            <input v-model="simMissing" type="text" class="sim-input" placeholder="0" @input="triggerSimSave" />
            <span class="sim-field-hint">查不到计分项时显示的值</span>
          </div>

          <div class="sim-field">
            <label class="sim-label">条目</label>
            <div class="sim-score-list">
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
              <span>添加条目</span>
            </button>
            <span class="sim-field-hint">未列出的计分项视为条件不成立</span>
          </div>
        </div>
      </NTabPane>
    </NTabs>
  </AppModal>
</template>

<style scoped>
/* 两组内容高度不同，留出下限，切标签时弹窗不跟着跳 */
.sim-pane { display: flex; flex-direction: column; gap: 18px; min-height: 214px; }
.sim-tabs :deep(.n-tab-pane) { padding-top: 18px; }

.sim-field { margin-bottom: 18px; }
/* 高度过渡容器形成了 BFC，末尾 margin 不再塌陷出去，会白白多出一截高度 */
.sim-field:last-child { margin-bottom: 0; }
.sim-label {
  display: block; margin-bottom: 6px;
  font-size: 12px; font-weight: 400; color: var(--muted-foreground);
  transition: color 0.4s ease;
}
.sim-field-hint {
  display: block; margin-top: 6px;
  font-size: 12px; line-height: 1.5; color: var(--muted-foreground);
  transition: color 0.4s ease;
}
.sim-field-hint code {
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: 11px; padding: 1px 3px; border-radius: var(--radius-xs);
  background: var(--muted); color: var(--muted-foreground);
  transition: background-color 0.4s ease, color 0.4s ease;
}
.sim-input {
  width: 100%; height: 34px; padding: 0 12px;
  border: 1px solid var(--border); border-radius: var(--radius-md);
  background: var(--muted); color: var(--foreground);
  font-size: 13px; font-family: inherit; outline: none; box-sizing: border-box;
  transition: border-color 0.3s ease, background-color 0.4s ease, color 0.4s ease;
}
.sim-input:focus { border-color: var(--muted-foreground); }

.sim-score-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 6px; }
.sim-score-row { display: flex; gap: 6px; align-items: center; }
.sim-score-input { flex: 1; }
.sim-score-value { width: 88px; flex: none; }

.sim-icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; padding: 0; flex: none;
  border: none; border-radius: var(--radius-sm); background: transparent;
  color: var(--muted-foreground); cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease;
}
.sim-icon-btn:hover { background: var(--muted); color: var(--foreground); }
/* 二次点击确认删除：红色态由全局 .confirm-destructive 提供 */
.sim-icon-btn--danger,
.sim-icon-btn--danger:hover {
  background: var(--destructive);
  color: var(--destructive-foreground);
}

.sim-add-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 6px 10px;
  border: 1px dashed var(--border); border-radius: var(--radius-md);
  background: transparent; cursor: pointer;
  font-size: 12px; font-family: inherit; color: var(--muted-foreground);
  transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
}
.sim-add-btn:hover { color: var(--foreground); border-color: var(--muted-foreground); background: var(--muted); }
</style>

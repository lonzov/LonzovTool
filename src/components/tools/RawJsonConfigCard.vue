<script setup>
import { NSelect } from 'naive-ui'
import {
  cmdType, titlePos, targetSel, targetCustom,
  isTitle, triggerSave, onTargetSelChange,
} from '../../composables/useRawJsonEditor.js'

defineProps({
  /** 嵌在设置抽屉/面板里时去掉自成一张卡的底色与描边，交给外层分组 */
  flat: { type: Boolean, default: false },
})
</script>

<template>
  <div class="config-card" :class="{ 'config-card--flat': flat }">
    <div class="config-grid">
      <div class="config-field">
        <label class="config-label">指令类型</label>
        <NSelect
          v-model:value="cmdType"
          :options="[
            { label: '/tellraw', value: 'tellraw' },
            { label: '/titleraw', value: 'titleraw' },
          ]"
          size="small"
          class="config-select"
          @update:value="triggerSave"
        />
      </div>
      <div v-if="isTitle" class="config-field">
        <label class="config-label">显示位置</label>
        <NSelect
          v-model:value="titlePos"
          :options="[
            { label: 'actionbar', value: 'actionbar' },
            { label: 'title', value: 'title' },
            { label: 'subtitle', value: 'subtitle' },
          ]"
          size="small"
          class="config-select"
          @update:value="triggerSave"
        />
      </div>
      <div class="config-field config-field-target">
        <label class="config-label">目标</label>
        <div class="target-row">
          <NSelect
            v-model:value="targetSel"
            :options="[
              { label: '@s (执行者)', value: '@s' },
              { label: '@a (所有玩家)', value: '@a' },
              { label: '@r (随机玩家)', value: '@r' },
              { label: '@p (最近玩家)', value: '@p' },
              { label: '@n (最近实体)', value: '@n' },
              { label: '@e (所有实体)', value: '@e' },
              { label: '自定义', value: 'custom' },
            ]"
            size="small"
            class="target-select"
            :class="{ 'target-select--full': targetSel !== 'custom' }"
            @update:value="onTargetSelChange"
          />
          <input
            v-if="targetSel === 'custom'"
            v-model="targetCustom"
            type="text"
            class="target-input"
            placeholder="@a[tag=vip]"
            @input="triggerSave"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.config-card {
  background: var(--card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  padding: 16px;
  transition: background-color 0.4s ease, border-color 0.4s ease;
}
.config-card--flat {
  padding: 0;
  border: none;
  background: transparent;
}
.config-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.config-field-target {
  grid-column: 1 / -1;
}
.config-label {
  display: block;
  font-size: 12px;
  font-weight: 400;
  color: var(--muted-foreground);
  margin-bottom: 6px;
  transition: color 0.4s ease;
}
.config-select { width: 100%; }
.target-row { display: flex; gap: 8px; align-items: center; }
.target-select { flex-shrink: 0; width: 140px; }
.target-select--full { flex: 1; width: auto; }
.target-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--muted);
  color: var(--foreground);
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: 13px;
  outline: none;
  transition: border-color 0.3s ease, background-color 0.4s ease, color 0.4s ease;
}
.target-input:focus { border-color: var(--muted-foreground); }

@media (max-width: 480px) {
  .config-grid { grid-template-columns: 1fr; }
  .config-field-target { grid-column: 1; }
  .target-row { flex-direction: column; }
  .target-select { width: 100%; }
  .target-select--full { width: 100%; }
}
</style>

<script setup>
import { NSelect } from 'naive-ui'
import {
  cmdType, titlePos, targetSel, targetCustom,
  isTitle, targetValue, triggerSave, onTargetSelChange,
} from '../../composables/useRawJsonEditor.js'
</script>

<template>
  <div class="config-card">
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
          <div v-else class="target-show">{{ targetValue }}</div>
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
  font-size: 11px;
  font-weight: 600;
  color: var(--subtle-foreground);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
  transition: color 0.4s ease;
}
.config-select { width: 100%; }
.target-row { display: flex; gap: 8px; align-items: center; }
.target-select { flex-shrink: 0; width: 140px; }
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
.target-show {
  flex: 1;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  background: var(--muted);
  color: var(--muted-foreground);
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: 13px;
  transition: background-color 0.4s ease, color 0.4s ease;
}

@media (max-width: 480px) {
  .config-grid { grid-template-columns: 1fr; }
  .config-field-target { grid-column: 1; }
  .target-row { flex-direction: column; }
  .target-select { width: 100%; }
}
</style>

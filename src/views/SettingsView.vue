<script setup>
import { computed } from 'vue'
import { NSelect, NConfigProvider, darkTheme } from 'naive-ui'
import { useTheme } from '../composables/useTheme'

const { themeMode, setThemeMode, isDark } = useTheme()

const themeOptions = [
  { value: 'auto', label: '跟随系统' },
  { value: 'light', label: '浅色模式' },
  { value: 'dark', label: '深色模式' },
]

const themeValue = computed({
  get: () => themeMode.value,
  set: (val) => setThemeMode(val),
})
</script>

<template>
  <div>
    <NConfigProvider :theme="isDark ? darkTheme : null" style="display: contents">
      <div class="settings-container">
        <h1 class="settings-h1">设置</h1>

        <!-- 外观 -->
        <section class="settings-section">
          <h2 class="settings-h2">外观</h2>
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-title">主题模式</span>
              <p class="setting-desc">设置全站的深浅色模式</p>
            </div>
            <div class="setting-control">
              <NSelect
                v-model:value="themeValue"
                :options="themeOptions"
                placement="bottom-end"
                size="medium"
                class="settings-select"
              />
            </div>
          </div>
        </section>

        <!-- 后续板块在此添加 -->
      </div>
    </NConfigProvider>
  </div>
</template>

<style scoped>
.settings-container {
  max-width: 1200px;
  padding-top: 24px;
}

.settings-h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 1.5rem;
  letter-spacing: -0.02em;
  transition: color 0.4s ease;
}

.settings-section {
  margin-bottom: 1rem;
}

.settings-h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: color-mix(in srgb, var(--text-primary) 87%, transparent);
  margin: 0 0 1rem;
  letter-spacing: -0.01em;
  transition: color 0.4s ease;
}

/* 设置行 */
.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1.5rem 0;
  gap: 3rem;
  border-bottom: 1px solid var(--border-color);
  transition: border-color 0.4s ease;
}

.setting-row:last-child {
  border-bottom: none;
}

.setting-info {
  flex: 1;
  min-width: 0;
}

.setting-title {
  display: block;
  font-size: 1.125rem;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
  transition: color 0.4s ease;
}

.setting-desc {
  font-size: 0.95rem;
  color: color-mix(in srgb, var(--text-primary) 87%, transparent);
  line-height: 1.5;
  margin: 0;
  transition: color 0.4s ease;
}

.setting-control {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding-top: 0.25rem;
  min-width: 0;
}

.settings-select {
  min-width: 140px;
}

/* 响应式 */
@media (max-width: 768px) {
  .settings-h1 {
    font-size: 1.5rem;
    margin-bottom: 1.25rem;
  }

  .settings-h2 {
    font-size: 1.25rem;
  }

  .setting-row {
    flex-direction: column;
    gap: 1rem;
    padding: 1.25rem 0;
  }

  .setting-control {
    width: 100%;
  }

  .settings-select {
    width: 100%;
  }
}
</style>

<style>
/* NSelect 触发器 — 胶囊圆角、不换行、focus 不变色 */
.settings-select .n-base-selection,
.settings-select .n-base-selection-label {
  border-radius: 100px !important;
}

.settings-select .n-base-selection-label {
  white-space: nowrap !important;
}

.settings-select .n-base-selection {
  --n-border: 1px solid var(--border-color) !important;
  --n-border-hover: 1px solid var(--border-color) !important;
  --n-border-focus: 1px solid var(--border-color) !important;
  --n-border-active: 1px solid var(--border-color) !important;
  --n-box-shadow-focus: none !important;
  --n-box-shadow-active: none !important;
}

/* NSelect 下拉面板 */
.n-select-menu {
  --n-option-color-hover: var(--bg-sub) !important;
  border: 1px solid var(--border-color) !important;
}

[data-theme='dark'] .n-select-menu {
  --n-option-color-hover: #2A2A2A !important;
}

[data-theme='light'] .n-select-menu,
html:not([data-theme='dark']) .n-select-menu {
  box-shadow:
    0 3px 6px -4px rgba(0, 0, 0, 0.16),
    0 6px 16px 0 rgba(0, 0, 0, 0.12),
    0 9px 28px 8px rgba(0, 0, 0, 0.08) !important;
}

[data-theme='dark'] .n-select-menu {
  box-shadow:
    0 3px 6px -4px rgba(0, 0, 0, 0.48),
    0 6px 12px 0 rgba(0, 0, 0, 0.36),
    0 9px 18px 8px rgba(0, 0, 0, 0.24) !important;
}
</style>

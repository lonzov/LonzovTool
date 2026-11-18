<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { NIcon, NInputNumber, NSelect, NSwitch, useMessage } from 'naive-ui'
import { ChevronUp16Regular, Settings24Regular } from '@vicons/fluent'
import AppButton from '../../components/ui/AppButton.vue'
import { consoleFetch } from '../consoleRequest.js'

const SETTINGS_URL = '/api/v1/console/system/settings/feishu'
const NOTIFICATIONS_URL = '/api/v1/console/system/settings/notifications'
const PERIOD_OPTIONS = [
  { label: '每分钟', value: 60 },
  { label: '每 5 分钟', value: 300 },
  { label: '每 15 分钟', value: 900 },
  { label: '每小时', value: 3600 },
  { label: '每天', value: 86400 },
]
const MODE_OPTIONS = [
  { label: '关闭', value: 'off' },
  { label: '即时推送', value: 'instant' },
  { label: '摘要推送', value: 'digest' },
]

const message = useMessage()
const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const pendingLoading = ref(false)
const pendingSaving = ref(false)

const COLLAPSED_KEY = 'console-system-settings-collapsed'
const savedCollapsed = (() => {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
})()
const collapsed = ref(savedCollapsed?.feishu ?? false)
const pendingCollapsed = ref(savedCollapsed?.pending ?? false)

function toggleCollapsed(key) {
  if (key === 'feishu') {
    collapsed.value = !collapsed.value
  } else {
    pendingCollapsed.value = !pendingCollapsed.value
  }
  try {
    localStorage.setItem(
      COLLAPSED_KEY,
      JSON.stringify({
        feishu: collapsed.value,
        pending: pendingCollapsed.value,
      }),
    )
  } catch {
    // 隐私模式下 localStorage 不可写时只影响持久化，不影响当前折叠。
  }
}

const form = ref({
  enabled: true,
  windowSeconds: 3600,
  limit: 3,
})
const pendingForm = ref({
  mode: 'off',
  digestHours: 4,
})

let saveTimer = null
let saveVersion = 0
let pendingSaveTimer = null
let pendingSaveVersion = 0

function applyPayload(payload) {
  form.value = {
    enabled: payload.enabled,
    windowSeconds: payload.window_seconds,
    limit: payload.limit,
  }
}

async function load() {
  loading.value = true
  try {
    applyPayload(await consoleFetch(SETTINGS_URL))
  } catch (e) {
    message.error(e?.message || '读取飞书告警设置失败')
  } finally {
    loading.value = false
  }
}

function applyPending(payload) {
  pendingForm.value = {
    mode: payload.mode,
    digestHours: payload.digest_hours,
  }
}

async function loadPending() {
  pendingLoading.value = true
  try {
    applyPending(await consoleFetch(NOTIFICATIONS_URL))
  } catch (e) {
    message.error(e?.message || '读取待办通知设置失败')
  } finally {
    pendingLoading.value = false
  }
}

async function persistPending(patch) {
  const version = ++pendingSaveVersion
  pendingSaving.value = true
  try {
    const payload = await consoleFetch(NOTIFICATIONS_URL, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    if (version === pendingSaveVersion) applyPending(payload)
  } catch (e) {
    message.error(e?.message || '待办通知设置保存失败，已恢复原值')
    await loadPending()
  } finally {
    if (version === pendingSaveVersion) pendingSaving.value = false
  }
}

function savePendingNow(patch) {
  if (pendingSaveTimer) {
    clearTimeout(pendingSaveTimer)
    pendingSaveTimer = null
  }
  persistPending(patch)
}

function savePendingDebounced(patch) {
  if (pendingSaveTimer) clearTimeout(pendingSaveTimer)
  pendingSaveTimer = setTimeout(() => {
    pendingSaveTimer = null
    persistPending(patch)
  }, 400)
}

function onModeChange(value) {
  pendingForm.value.mode = value
  savePendingNow({ mode: value })
}

function onDigestHoursChange(value) {
  if (value === null) return
  pendingForm.value.digestHours = value
  savePendingDebounced({ digest_hours: value })
}

async function persist(patch) {
  const version = ++saveVersion
  saving.value = true
  try {
    const payload = await consoleFetch(SETTINGS_URL, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    if (version === saveVersion) applyPayload(payload)
  } catch (e) {
    message.error(e?.message || '设置保存失败，已恢复原值')
    await load()
  } finally {
    if (version === saveVersion) saving.value = false
  }
}

function saveNow(patch) {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  persist(patch)
}

function saveDebounced(patch) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    persist(patch)
  }, 400)
}

// 卸载后定时器仍会补发一次 PATCH，用户看不到却已改到服务端
onBeforeUnmount(() => {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (pendingSaveTimer) {
    clearTimeout(pendingSaveTimer)
    pendingSaveTimer = null
  }
})

function onToggle(value) {
  form.value.enabled = value
  saveNow({ enabled: value })
}

function onPeriodChange(value) {
  form.value.windowSeconds = value
  saveNow({ window_seconds: value })
}

function onLimitChange(value) {
  if (value === null) return
  form.value.limit = value
  saveDebounced({ limit: value })
}

async function testSend() {
  if (testing.value) return
  testing.value = true
  try {
    const payload = await consoleFetch(`${SETTINGS_URL}/test`, { method: 'POST' })
    message.success(payload.detail || '测试消息已发送')
  } catch (e) {
    message.error(e?.message || '测试发送失败')
  } finally {
    testing.value = false
  }
}

onMounted(async () => {
  await Promise.all([load(), loadPending()])
})
</script>

<template>
  <div class="settings-container">
    <section class="settings-card">
      <div
        class="card-header"
        :class="{ 'card-header--collapsed': collapsed }"
        role="button"
        tabindex="0"
        :aria-expanded="!collapsed"
        @click="toggleCollapsed('feishu')"
        @keydown.enter.prevent="toggleCollapsed('feishu')"
        @keydown.space.prevent="toggleCollapsed('feishu')"
      >
        <span class="section-title">
          <NIcon :component="Settings24Regular" size="18" class="section-icon" />
          飞书告警
        </span>
        <NIcon
          :component="ChevronUp16Regular"
          size="16"
          class="chevron-icon"
          :class="{ 'chevron-icon--rotated': collapsed }"
        />
      </div>
      <Transition name="collapse">
        <div v-show="!collapsed" class="card-body">
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-title">启用飞书通知</span>
              <p class="setting-desc">关闭后不再发送飞书告警，也不会发送新投稿、反馈和摘要通知</p>
            </div>
            <div class="setting-control">
              <NSwitch
                :value="form.enabled"
                :loading="loading"
                @update:value="onToggle"
              />
            </div>
          </div>
          <div class="setting-row setting-row--limit">
            <div class="setting-info">
              <span class="setting-title">同类告警上限</span>
              <p class="setting-desc">同一类告警在每个周期内最多发送的条数；相同内容不会重复占用额度</p>
            </div>
            <div class="setting-control setting-control--limit">
              <NSelect
                :value="form.windowSeconds"
                :options="PERIOD_OPTIONS"
                :disabled="loading"
                class="period-select"
                @update:value="onPeriodChange"
              />
              <NInputNumber
                :value="form.limit"
                :min="1"
                :max="1000"
                :disabled="loading"
                @update:value="onLimitChange"
              />
              <span class="limit-unit">条</span>
            </div>
          </div>
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-title">测试发送</span>
              <p class="setting-desc">使用当前配置发送一条测试消息，每 5 分钟最多成功发送 3 次</p>
            </div>
            <div class="setting-control">
              <AppButton
                variant="outline"
                size="sm"
                :loading="testing"
                :disabled="testing || saving || loading"
                @click="testSend"
              >
                发送测试
              </AppButton>
            </div>
          </div>
        </div>
      </Transition>
    </section>

    <section class="settings-card">
      <div
        class="card-header"
        :class="{ 'card-header--collapsed': pendingCollapsed }"
        role="button"
        tabindex="0"
        :aria-expanded="!pendingCollapsed"
        @click="toggleCollapsed('pending')"
        @keydown.enter.prevent="toggleCollapsed('pending')"
        @keydown.space.prevent="toggleCollapsed('pending')"
      >
        <span class="section-title">
          <NIcon :component="Settings24Regular" size="18" class="section-icon" />
          待办通知
        </span>
        <NIcon
          :component="ChevronUp16Regular"
          size="16"
          class="chevron-icon"
          :class="{ 'chevron-icon--rotated': pendingCollapsed }"
        />
      </div>
      <Transition name="collapse">
        <div v-show="!pendingCollapsed" class="card-body">
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-title">推送方式</span>
              <p class="setting-desc">控制新投稿和新反馈的飞书提醒方式</p>
            </div>
            <div class="setting-control">
              <NSelect
                :value="pendingForm.mode"
                :options="MODE_OPTIONS"
                :disabled="pendingLoading || pendingSaving"
                class="mode-select"
                @update:value="onModeChange"
              />
            </div>
          </div>
          <div
            class="setting-row setting-row--digest"
            :class="{ 'setting-row--inactive': pendingForm.mode !== 'digest' }"
          >
            <div class="setting-info">
              <span class="setting-title">摘要周期</span>
              <p class="setting-desc">仅摘要推送时生效，没有待处理内容时不推送</p>
            </div>
            <div class="setting-control">
              <NInputNumber
                :value="pendingForm.digestHours"
                :min="1"
                :max="24"
                :disabled="pendingLoading || pendingSaving || pendingForm.mode !== 'digest'"
                class="digest-input"
                @update:value="onDigestHoursChange"
              />
              <span class="limit-unit">小时</span>
            </div>
          </div>
        </div>
      </Transition>
    </section>
  </div>
</template>

<style scoped>
.settings-container {
  max-width: 1200px;
}

.settings-card {
  padding-top: 15px;
  padding-bottom: 15px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--card);
  transition: background-color 0.4s ease, border-color 0.4s ease;
}

.settings-card + .settings-card {
  margin-top: 1rem;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  color: var(--foreground);
  font-size: 0.92rem;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
  transition: color 0.4s ease, opacity 0.2s;
}

.card-header:hover {
  opacity: 0.85;
}

.card-header:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: -2px;
  border-radius: var(--radius-lg);
}

.card-header--collapsed {
  border-bottom: none;
}

.section-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.section-icon {
  color: var(--muted-foreground);
  flex-shrink: 0;
  transition: color 0.4s ease;
}

.chevron-icon {
  color: var(--subtle-foreground);
  transition: transform 0.25s ease, color 0.4s ease;
}

.chevron-icon--rotated {
  transform: rotate(180deg);
}

.card-body {
  overflow: hidden;
}

.collapse-enter-active,
.collapse-leave-active {
  transition: max-height 0.3s ease, opacity 0.25s ease;
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  max-height: 0;
  opacity: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  max-height: 500px;
  opacity: 1;
}

.setting-row {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  padding: 14px 20px;
}

.setting-row + .setting-row::before {
  position: absolute;
  top: 0;
  right: 20px;
  left: 20px;
  height: 1px;
  background: var(--border);
  content: '';
  transition: background-color 0.4s ease;
}

.setting-row--inactive .setting-info,
.setting-row--inactive .setting-control {
  opacity: 0.4;
  transition: opacity 0.2s ease;
}

.setting-info {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  min-height: 44px;
}

.setting-title {
  display: block;
  color: var(--foreground);
  font-size: 0.9rem;
  font-weight: 500;
}

.setting-desc {
  margin: 3px 0 0;
  color: var(--subtle-foreground);
  font-size: 0.8rem;
  line-height: 1.45;
}

.setting-control {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 10px;
}

.setting-control--limit :deep(.n-input-number) {
  width: 130px;
}

.period-select {
  width: 148px;
}

.mode-select {
  width: 148px;
}

.digest-input {
  width: 110px;
}

.limit-unit {
  color: var(--muted-foreground);
  font-size: 0.85rem;
}

@media (max-width: 768px) {
  .card-header {
    padding: 12px 16px;
  }

  .setting-row {
    gap: 1rem;
    padding: 12px 16px;
  }

  .setting-row + .setting-row::before {
    right: 16px;
    left: 16px;
  }

  .setting-row--limit {
    align-items: stretch;
    flex-direction: column;
  }

  .setting-control--limit {
    justify-content: flex-start;
  }

  .period-select {
    width: 132px;
  }

  .mode-select {
    width: 132px;
  }

  .digest-input {
    width: 110px;
  }

  .setting-control--limit :deep(.n-input-number) {
    width: 110px;
  }
}
</style>

<script setup>
import { computed, h, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NDrawer,
  NDrawerContent,
  NDropdown,
  NIcon,
  NInput,
  NInputNumber,
  NRadio,
  NRadioGroup,
  useMessage,
} from 'naive-ui'
import {
  Alert16Regular,
  ChevronDown20Regular,
  DocumentText20Regular,
} from '@vicons/fluent'
import AppButton from '../../components/ui/AppButton.vue'
import SheetHandle from '../../components/ui/SheetHandle.vue'
import { useIsMobile } from '../../composables/useIsMobile.js'
import { useMobileSheet } from '../../composables/useMobileSheet.js'
import { consoleFetch } from '../consoleRequest.js'

const TEMPLATES_URL = '/api/v1/console/notifications/templates'
const SETTINGS_URL = '/api/v1/console/notifications/settings'
const FEISHU_TAB = 'feishu'

const props = defineProps({
  show: { type: Boolean, default: false },
  defaultTab: { type: String, default: 'submission_approved' },
})
const emit = defineEmits(['update:show'])

const router = useRouter()
const route = useRoute()
const message = useMessage()
const { isMobile } = useIsMobile()
const { mobile, sheetPlacement, sheetWidth, sheetHeight, sheetHeaderStyle, sheetStyle } =
  useMobileSheet(isMobile, { width: 760 })

/* 抽屉是页面级浮层：换页后收起，免得它继续盖在新页面上 */
watch(
  () => route.fullPath,
  () => {
    if (props.show) emit('update:show', false)
  },
)

const items = ref([])
const drafts = ref({})
const loading = ref(false)
const errorText = ref('')
const savingEvent = ref('')
const active = ref(props.defaultTab)

const setting = ref({
  mode: 'off',
  digest_hours: 4,
  last_digest_at: 0,
  feishu_configured: false,
  email_configured: false,
})
const settingSaving = ref(false)

const activeItem = computed(() =>
  items.value.find((item) => item.event === active.value) || null,
)
const isFeishu = computed(() => active.value === FEISHU_TAB)
const navItems = computed(() => [
  ...items.value.map((item) => ({ ...item, icon: DocumentText20Regular })),
  { event: FEISHU_TAB, label: '飞书通知', icon: Alert16Regular },
])
const mobileOptions = computed(() =>
  navItems.value.map((item) => ({
    key: item.event,
    label: item.label,
    icon: () => h(NIcon, { component: item.icon, size: 16 }),
  })),
)
const activeLabel = computed(
  () => navItems.value.find((item) => item.event === active.value)?.label || '选择模板',
)
const activeIcon = computed(
  () =>
    navItems.value.find((item) => item.event === active.value)?.icon ||
    DocumentText20Regular,
)

function selectTab(key) {
  active.value = key
}

function formatTime(value) {
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  return new Date(seconds * 1000).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

async function loadTemplates() {
  const payload = await consoleFetch(TEMPLATES_URL)
  items.value = Array.isArray(payload?.items) ? payload.items : []
  const next = {}
  for (const item of items.value) {
    next[item.event] = { subject: item.subject, body: item.body }
  }
  drafts.value = next
  if (!items.value.some((item) => item.event === active.value) && !isFeishu.value) {
    active.value = items.value[0]?.event || FEISHU_TAB
  }
}

async function loadSetting() {
  const payload = await consoleFetch(SETTINGS_URL)
  setting.value = {
    mode: payload?.mode || 'off',
    digest_hours: Number(payload?.digest_hours) || 4,
    last_digest_at: Number(payload?.last_digest_at) || 0,
    feishu_configured: Boolean(payload?.feishu_configured),
    email_configured: Boolean(payload?.email_configured),
  }
}

async function loadAll() {
  loading.value = true
  errorText.value = ''
  try {
    await Promise.all([loadTemplates(), loadSetting()])
  } catch (e) {
    if (e?.code === 'unauthorized') {
      emit('update:show', false)
      router.replace({ path: '/console/login', query: { redirect: router.currentRoute.value.fullPath } })
      return
    }
    errorText.value = e?.message || '读取失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

async function saveTemplate() {
  const item = activeItem.value
  const draft = drafts.value[active.value]
  if (!item || !draft) return
  if (!draft.subject.trim() || !draft.body.trim()) {
    message.error('主题与正文都不能为空')
    return
  }
  savingEvent.value = item.event
  try {
    const updated = await consoleFetch(`${TEMPLATES_URL}/${item.event}`, {
      method: 'PATCH',
      body: JSON.stringify({ subject: draft.subject, body: draft.body }),
    })
    Object.assign(item, updated)
    drafts.value[item.event] = { subject: updated.subject, body: updated.body }
    message.success('已保存')
  } catch (e) {
    if (e?.code === 'unauthorized') {
      emit('update:show', false)
      router.replace({ path: '/console/login', query: { redirect: router.currentRoute.value.fullPath } })
      return
    }
    message.error(e?.message || '保存失败，请稍后重试')
  } finally {
    savingEvent.value = ''
  }
}

async function saveSetting() {
  const hours = Number(setting.value.digest_hours)
  if (setting.value.mode === 'digest' && (!Number.isInteger(hours) || hours < 1 || hours > 24)) {
    message.error('摘要周期必须是 1–24 的整数')
    return
  }
  settingSaving.value = true
  try {
    const payload = await consoleFetch(SETTINGS_URL, {
      method: 'PATCH',
      body: JSON.stringify({
        mode: setting.value.mode,
        digest_hours: hours || 4,
      }),
    })
    setting.value = {
      mode: payload?.mode || 'off',
      digest_hours: Number(payload?.digest_hours) || 4,
      last_digest_at: Number(payload?.last_digest_at) || 0,
      feishu_configured: Boolean(payload?.feishu_configured),
      email_configured: Boolean(payload?.email_configured),
    }
    message.success('已保存')
  } catch (e) {
    if (e?.code === 'unauthorized') {
      emit('update:show', false)
      router.replace({ path: '/console/login', query: { redirect: router.currentRoute.value.fullPath } })
      return
    }
    message.error(e?.message || '保存失败，请稍后重试')
  } finally {
    settingSaving.value = false
  }
}

watch(
  () => props.show,
  (visible) => {
    if (!visible) return
    active.value = props.defaultTab
    loadAll()
  },
)
</script>

<template>
  <NDrawer
    :show="show"
    :placement="sheetPlacement"
    :width="sheetWidth"
    :height="sheetHeight"
    :style="sheetStyle"
    :z-index="2100"
    :auto-focus="false"
    @update:show="emit('update:show', $event)"
  >
    <SheetHandle v-if="mobile" :show="show" @close="emit('update:show', false)" />
    <NDrawerContent
      title="通知设置"
      closable
      :body-content-style="{ padding: '0' }"
      :header-style="sheetHeaderStyle"
    >
      <div class="settings-drawer" :class="{ 'settings-drawer--mobile': isMobile }">
        <div v-if="isMobile" class="mobile-switcher">
          <NDropdown
            trigger="click"
            placement="bottom-start"
            :options="mobileOptions"
            :z-index="2200"
            @select="selectTab"
          >
            <button class="mobile-select-trigger" type="button" aria-haspopup="listbox">
              <span class="mobile-select-main">
                <NIcon :component="activeIcon" :size="16" />
                <span class="mobile-select-label">{{ activeLabel }}</span>
              </span>
              <NIcon :component="ChevronDown20Regular" :size="16" class="mobile-select-chevron" />
            </button>
          </NDropdown>
        </div>

        <nav v-else class="settings-nav" role="tablist" aria-label="通知设置">
          <button
            v-for="item in navItems"
            :key="item.event"
            class="nav-item"
            :class="{ 'nav-item--on': active === item.event }"
            type="button"
            role="tab"
            :aria-selected="active === item.event"
            @click="active = item.event"
          >
            <NIcon :component="item.icon" :size="16" class="nav-icon" />
            <span>{{ item.label }}</span>
          </button>
        </nav>

        <section class="settings-main">
          <p v-if="errorText" class="page-error" role="alert">{{ errorText }}</p>

          <template v-if="isFeishu">
            <h3 class="main-title">飞书通知</h3>

            <div class="form-stack">
              <div class="field">
                <span class="field-label">推送方式</span>
                <NRadioGroup v-model:value="setting.mode" class="mode-group" :disabled="settingSaving">
                  <NRadio value="off">关闭</NRadio>
                  <NRadio value="instant">即时推送</NRadio>
                  <NRadio value="digest">摘要推送</NRadio>
                </NRadioGroup>
              </div>

              <div v-if="setting.mode === 'digest'" class="field">
                <span class="field-label">摘要周期</span>
                <div class="inline-control">
                  <NInputNumber
                    v-model:value="setting.digest_hours"
                    :min="1"
                    :max="24"
                    :show-button="false"
                    :disabled="settingSaving"
                    style="width: 64px"
                  />
                  <span class="unit">小时</span>
                </div>
                <p class="field-hint">没有待处理内容时不推送。</p>
              </div>

              <p v-if="!setting.feishu_configured" class="status-note status-note--warn">
                飞书通知尚未配置，开启后也不会发出消息。
              </p>
              <p v-if="!setting.email_configured" class="status-note status-note--warn">
                通知邮箱尚未配置，结果通知邮件将无法发送。
              </p>
              <p v-if="setting.last_digest_at" class="status-note">
                上次摘要：{{ formatTime(setting.last_digest_at) }}
              </p>
            </div>

            <footer class="main-actions">
              <AppButton
                variant="solid"
                size="lg"
                :loading="settingSaving"
                :disabled="settingSaving"
                @click="saveSetting"
              >
                保存设置
              </AppButton>
            </footer>
          </template>

          <template v-else-if="activeItem">
            <h3 class="main-title">{{ activeItem.label }}</h3>

            <div class="form-stack">
              <label class="field">
                <span class="field-label">主题</span>
                <NInput
                  v-model:value="drafts[active].subject"
                  maxlength="200"
                  show-count
                  placeholder="邮件主题"
                />
              </label>

              <label class="field">
                <span class="field-label">正文</span>
                <NInput
                  v-model:value="drafts[active].body"
                  type="textarea"
                  :autosize="{ minRows: 10, maxRows: 20 }"
                  maxlength="5000"
                  show-count
                  placeholder="邮件正文，支持换行"
                />
              </label>

              <div class="variables">
                <span class="variables-label">可用变量</span>
                <code v-for="name in activeItem.variables" :key="name" class="variable">{{
                  '{' + name + '}'
                }}</code>
              </div>
            </div>

            <footer class="main-actions">
              <AppButton
                variant="solid"
                size="lg"
                :loading="savingEvent === activeItem.event"
                :disabled="!!savingEvent"
                @click="saveTemplate"
              >
                保存模板
              </AppButton>
            </footer>
          </template>

          <p v-else class="empty-hint">{{ loading ? '读取中…' : '没有可编辑的通知模板' }}</p>
        </section>
      </div>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.settings-drawer {
  display: flex;
  height: calc(100dvh - 57px);
  min-height: 0;
}

.settings-nav {
  display: flex;
  flex: 0 0 176px;
  flex-direction: column;
  gap: 2px;
  padding: 12px 10px;
  border-right: 1px solid var(--border);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--foreground);
  font-family: inherit;
  font-size: 0.875rem;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.nav-item:hover {
  background: var(--muted);
}

.nav-item--on {
  background: var(--accent);
  font-weight: 600;
}

.nav-icon {
  flex-shrink: 0;
  color: var(--muted-foreground);
}

.nav-item--on .nav-icon {
  color: var(--foreground);
}

.settings-main {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  --settings-main-x: 24px;
  padding: 20px var(--settings-main-x) 18px;
  overflow-y: auto;
}

.main-title {
  margin: 0 0 18px;
  color: var(--foreground);
  font-size: 1.02rem;
  font-weight: 600;
  line-height: 1.4;
}

.page-error {
  margin: 0 0 12px;
  color: var(--danger);
  font-size: 0.8125rem;
}

.form-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.field-label {
  color: var(--foreground);
  font-size: 0.8125rem;
  font-weight: 500;
}

.field-hint {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 0.75rem;
  line-height: 1.45;
}

.inline-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.unit {
  color: var(--muted-foreground);
  font-size: 0.8125rem;
}

.mode-group :deep(.n-radio__label) {
  color: var(--foreground);
}

.variables {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.variables-label {
  color: var(--muted-foreground);
  font-size: 0.75rem;
}

.variable {
  padding: 1px 6px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--muted);
  color: var(--foreground);
  font-size: 0.75rem;
}

.status-note {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 0.75rem;
  line-height: 1.5;
}

.status-note--warn {
  color: var(--warning);
}

.main-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: auto;
  margin-right: calc(var(--settings-main-x) * -1);
  margin-left: calc(var(--settings-main-x) * -1);
  padding: 14px var(--settings-main-x) 0;
  border-top: 1px solid var(--border);
}

.main-actions :deep(.app-btn) {
  min-width: 112px;
}

.empty-hint {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 0.8125rem;
}

.settings-drawer--mobile {
  height: auto;
  flex-direction: column;
}

.mobile-switcher {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}

.mobile-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  height: 38px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  corner-shape: round;
  background: var(--card);
  color: var(--foreground);
  font-family: inherit;
  font-size: 0.875rem;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.mobile-select-trigger:hover {
  background: var(--muted);
}

.mobile-select-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.mobile-select-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-select-chevron {
  flex-shrink: 0;
  color: var(--muted-foreground);
}

.settings-drawer--mobile .settings-main {
  --settings-main-x: 16px;
  padding: 18px var(--settings-main-x) 16px;
  overflow-y: visible;
}

.settings-drawer--mobile .main-actions {
  margin-top: 20px;
}

.settings-drawer--mobile .main-actions .app-btn {
  width: 100%;
}
</style>

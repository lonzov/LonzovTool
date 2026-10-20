<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NForm, NFormItem, NIcon, NInput, useMessage } from 'naive-ui'
import {
  ArrowClockwise24Regular,
  Desktop24Regular,
  Key24Regular,
  PersonCircle24Regular,
  SignOut24Regular,
} from '@vicons/fluent'
import AppModal from '../../components/ui/AppModal.vue'
import { confirmDialog } from '../../composables/useConfirm.js'
import { consoleFetch } from '../consoleRequest.js'
import { useConsoleAuth } from '../consoleAuth.js'
import { describeDevice } from '../deviceLabel.js'

const SESSIONS_URL = '/api/v1/console/sessions'
const PASSWORD_URL = '/api/v1/console/password'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const { account, mustChangePassword, verify } = useConsoleAuth()

const passwordModal = ref(false)
const passwordForm = ref({ current: '', next: '' })
const passwordError = ref('')
const passwordSaving = ref(false)

const sessions = ref([])
const sessionsLoading = ref(false)
const sessionsError = ref('')
const revokingId = ref(0)
const revokingOthers = ref(false)

const roles = computed(() => account.value?.roles || [])
const devices = computed(() =>
  sessions.value.map((session) => ({ ...session, device: describeDevice(session.user_agent) })),
)

function formatTime(timestamp) {
  if (!timestamp) return '—'
  return new Date(timestamp * 1000).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function gotUnauthorized(e) {
  if (e?.code !== 'unauthorized') return false
  router.replace({ path: '/console/login', query: { redirect: route.fullPath } })
  return true
}

function openPasswordModal() {
  passwordForm.value = { current: '', next: '' }
  passwordError.value = ''
  passwordModal.value = true
}

async function loadSessions() {
  sessionsLoading.value = true
  sessionsError.value = ''
  try {
    const payload = await consoleFetch(SESSIONS_URL)
    sessions.value = payload?.items || []
  } catch (e) {
    if (gotUnauthorized(e)) return
    sessionsError.value = e?.message || '读取失败，请稍后重试'
  } finally {
    sessionsLoading.value = false
  }
}

onMounted(loadSessions)

async function changePassword() {
  passwordError.value = ''
  if (!passwordForm.value.current || !passwordForm.value.next) {
    passwordError.value = '请填写当前密码与新密码'
    return
  }

  passwordSaving.value = true
  try {
    await consoleFetch(PASSWORD_URL, {
      method: 'POST',
      body: JSON.stringify({
        current_password: passwordForm.value.current,
        new_password: passwordForm.value.next,
      }),
    })
    passwordForm.value = { current: '', next: '' }
    passwordModal.value = false
    message.success('密码已修改，其他设备上的会话已退出')
    // 临时密码标记由服务端清除，这里顺带把 /me 的状态（含权限与账号信息）拉回最新
    try {
      await verify()
    } catch (e) {
      if (gotUnauthorized(e)) return
      message.warning('密码已修改，但账号状态未能刷新，请重新进入控制台确认')
    }
    await loadSessions()
  } catch (e) {
    if (gotUnauthorized(e)) return
    passwordError.value = e?.message || '修改失败，请稍后重试'
  } finally {
    passwordSaving.value = false
  }
}

async function revoke(session) {
  if (session.current) return

  const confirmed = await confirmDialog({
    title: '撤销会话',
    message: `撤销后该设备需要重新登录。\n${session.device.label} · ${session.last_ip || session.created_ip || '未知地址'}`,
    confirmText: '撤销',
    danger: true,
  })
  if (!confirmed) return

  revokingId.value = session.id
  try {
    await consoleFetch(`${SESSIONS_URL}/${session.id}`, { method: 'DELETE' })
    message.success('已撤销该会话')
    await loadSessions()
  } catch (e) {
    if (gotUnauthorized(e)) return
    message.error(e?.message || '撤销失败，请稍后重试')
  } finally {
    revokingId.value = 0
  }
}

async function revokeOthers() {
  const others = sessions.value.filter((session) => !session.current)
  if (!others.length) return

  const confirmed = await confirmDialog({
    title: '下线其他设备',
    message: `将撤销 ${others.length} 个其他设备的会话，只保留当前这一台。`,
    confirmText: '全部下线',
    danger: true,
  })
  if (!confirmed) return

  revokingOthers.value = true
  try {
    const result = await consoleFetch(`${SESSIONS_URL}/revoke-others`, { method: 'POST' })
    message.success(`已下线 ${result?.revoked ?? 0} 个设备`)
    await loadSessions()
  } catch (e) {
    if (gotUnauthorized(e)) return
    message.error(e?.message || '下线失败，请稍后重试')
  } finally {
    revokingOthers.value = false
  }
}
</script>

<template>
  <div class="account-page">
    <section class="account-section">
      <header class="section-head">
        <div class="head-main">
          <h2 class="section-title">
            <NIcon :component="PersonCircle24Regular" :size="16" class="section-icon" />
            账号信息
          </h2>
          <p class="section-desc">登录身份与当前挂载的角色</p>
        </div>
      </header>

      <div class="section-row">
        <div class="row-main">
          <span class="row-label">邮箱</span>
          <span class="row-value">{{ account?.email || account?.name || '—' }}</span>
        </div>
      </div>

      <div class="section-row">
        <div class="row-main">
          <span class="row-label">角色</span>
          <span class="row-value row-value--tags">
            <span v-for="role in roles" :key="role" class="role-tag">{{ role }}</span>
            <span v-if="!roles.length">无角色，权限来自单点授权</span>
          </span>
        </div>
      </div>
    </section>

    <section class="account-section">
      <header class="section-head">
        <div class="head-main">
          <h2 class="section-title">
            <NIcon :component="Key24Regular" :size="16" class="section-icon" />
            安全
          </h2>
          <p class="section-desc">登录密码与当前账号的凭据状态</p>
        </div>
      </header>

      <div class="section-row">
        <div class="row-main">
          <span class="row-label">密码</span>
          <span class="row-value">
            <template v-if="mustChangePassword">
              临时密码，待修改
              <span class="row-badge">需处理</span>
            </template>
            <template v-else>已设置</template>
          </span>
        </div>
        <div class="row-action">
          <button
            class="app-btn app-btn--outline app-btn--sm app-btn--rect"
            type="button"
            @click="openPasswordModal"
          >
            修改密码
          </button>
        </div>
      </div>
    </section>

    <section class="account-section">
      <header class="section-head section-head--plain">
        <div class="head-main">
          <h2 class="section-title">
            <NIcon :component="Desktop24Regular" :size="16" class="section-icon" />
            登录设备
          </h2>
          <p class="section-desc">看到不认识的设备就直接下线它</p>
        </div>
        <div class="section-head-extra">
          <button
            class="icon-btn"
            type="button"
            title="刷新"
            :disabled="sessionsLoading"
            @click="loadSessions"
          >
            <NIcon :component="ArrowClockwise24Regular" :size="16" />
          </button>
          <button
            class="app-btn app-btn--outline app-btn--sm"
            type="button"
            :disabled="revokingOthers || sessions.length < 2"
            @click="revokeOthers"
          >
            下线其他设备
          </button>
        </div>
      </header>

      <p v-if="sessionsError" class="inline-hint inline-hint--error">{{ sessionsError }}</p>
      <p v-else-if="!devices.length" class="inline-hint">
        {{ sessionsLoading ? '读取中…' : '没有有效会话' }}
      </p>

      <div v-else class="device-list">
        <article v-for="session in devices" :key="session.id" class="device-card">
          <span class="device-icon">
            <NIcon :component="Desktop24Regular" :size="18" />
          </span>

          <div class="device-main">
            <p class="device-title">
              <span class="device-name">{{ session.device.label }}</span>
              <span v-if="session.current" class="device-tag">当前设备</span>
            </p>
            <p class="device-meta">
              {{ session.last_ip || session.created_ip || '未知地址' }}
            </p>
            <p class="device-meta device-meta--dim">
              最近活动 {{ formatTime(session.last_used_at || session.created_at) }} ·
              登录于 {{ formatTime(session.created_at) }}
            </p>
          </div>

          <button
            class="app-btn app-btn--outline app-btn--sm"
            type="button"
            :disabled="session.current || revokingId === session.id"
            :title="session.current ? '当前设备请用右上角「退出」结束' : `撤销该设备（原始 UA：${session.user_agent || '未知'}）`"
            @click="revoke(session)"
          >
            <NIcon :component="SignOut24Regular" :size="14" />
            <span class="btn-label">下线</span>
          </button>
        </article>
      </div>
    </section>

    <AppModal
      v-model:show="passwordModal"
      title="修改密码"
      :max-width="420"
      :auto-focus="false"
      :actions="[
        { text: '取消', variant: 'outline', onClick: () => (passwordModal = false) },
        {
          text: passwordSaving ? '提交中…' : '修改密码',
          variant: 'fill',
          disabled: passwordSaving,
          onClick: changePassword,
        },
      ]"
    >
      <NForm label-placement="top">
        <NFormItem label="当前密码">
          <NInput
            v-model:value="passwordForm.current"
            type="password"
            show-password-on="click"
            maxlength="1024"
            autocomplete="current-password"
            placeholder="请输入当前使用的密码"
          />
        </NFormItem>
        <NFormItem label="新密码">
          <NInput
            v-model:value="passwordForm.next"
            type="password"
            show-password-on="click"
            maxlength="1024"
            autocomplete="new-password"
            placeholder="不能与当前密码相同"
          />
        </NFormItem>
        <p class="form-note">修改成功后，其他设备上的会话会一并退出。</p>
        <p v-if="passwordError" class="form-error">{{ passwordError }}</p>
      </NForm>
    </AppModal>
  </div>
</template>

<style scoped>
/* 类名不要用 console-account：那是页头账号胶囊的类名，父组件的 scoped 样式会命中
   子组件根节点，整页会被套上胶囊的圆角与描边 */
.account-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
  min-width: 0;
}

.account-section {
  padding: 16px 18px 4px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  transition: background-color 0.4s ease, border-color 0.4s ease;
}

.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}

/* 标题与说明合成左组，右上角操作与标题同一行 */
.head-main {
  flex: 1 1 auto;
  min-width: 0;
}

/* 下面紧接的是设备卡片，标题区不再画分隔线 */
.section-head--plain {
  padding-bottom: 4px;
  border-bottom: none;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  color: var(--foreground);
  font-size: 0.95rem;
  font-weight: 600;
  transition: color 0.4s ease;
}

.section-desc {
  margin: 3px 0 0;
  color: var(--subtle-foreground);
  font-size: 0.78rem;
  line-height: 1.5;
  transition: color 0.4s ease;
}

.section-head-extra {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 22px;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: var(--radius-full);
  corner-shape: round;
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
  transition: color 0.2s ease, background-color 0.2s ease;
}

.icon-btn:hover:not(:disabled) {
  background: var(--accent);
  color: var(--foreground);
}

.icon-btn:disabled {
  cursor: default;
  opacity: 0.5;
}

/* 一行 = 左侧「标签 + 值」+ 行末操作；标签在上、值在下，值用与邮箱同级的前景色 */
.section-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
}

.section-row + .section-row {
  border-top: 1px solid var(--border);
}

.row-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.row-label {
  color: var(--subtle-foreground);
  font-size: 0.74rem;
  transition: color 0.4s ease;
}

.row-value {
  /* 值比标签更亮更大，左对齐时会显得往前凸，往回收一点点做视觉补偿 */
  padding-left: 3px;
  color: var(--foreground);
  font-size: 0.86rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
  transition: color 0.4s ease;
}

.row-value--tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.row-badge {
  margin-left: 6px;
  padding: 0 7px;
  border-radius: var(--radius-full);
  corner-shape: round;
  background: color-mix(in srgb, var(--warning) 16%, transparent);
  color: var(--warning);
  font-size: 0.68rem;
}

.row-action {
  flex-shrink: 0;
}

.role-tag {
  padding: 1px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  corner-shape: round;
  color: var(--foreground);
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  font-size: 0.7rem;
  transition: color 0.4s ease, border-color 0.4s ease;
}

/* ===== 设备卡片 ===== */
.device-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 0;
}

.device-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.device-card:hover {
  border-color: var(--border-strong);
}

.device-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: var(--radius-md);
  background: var(--muted);
  color: var(--muted-foreground);
}

.device-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.device-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  min-width: 0;
}

.device-name {
  color: var(--foreground);
  font-size: 0.86rem;
  font-weight: 500;
  transition: color 0.4s ease;
}

.device-tag {
  padding: 0 7px;
  border-radius: var(--radius-full);
  corner-shape: round;
  background: color-mix(in srgb, var(--success) 14%, transparent);
  color: var(--success);
  font-size: 0.68rem;
}

.device-meta {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 0.74rem;
  overflow-wrap: anywhere;
  transition: color 0.4s ease;
}

.device-meta--dim {
  color: var(--subtle-foreground);
}

.form-note {
  margin: 0 0 10px;
  color: var(--subtle-foreground);
  font-size: 0.74rem;
  line-height: 1.6;
}

.form-error {
  margin: 0 0 10px;
  color: var(--destructive);
  font-size: 0.78rem;
}

.inline-hint {
  margin: 0;
  padding: 14px 0;
  color: var(--subtle-foreground);
  font-size: 0.8rem;
}

.inline-hint--error {
  color: var(--destructive);
}

@media (width <= 720px) {
  .section-row {
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 10px;
  }

  .device-card {
    align-items: flex-start;
    flex-wrap: wrap;
  }
}
</style>

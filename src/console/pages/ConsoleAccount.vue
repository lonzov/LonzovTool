<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
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
import InputOtp from '../../components/ui/InputOtp.vue'
import { confirmDialog } from '../../composables/useConfirm.js'
import { consoleFetch } from '../consoleRequest.js'
import { useConsoleAuth } from '../consoleAuth.js'
import { describeDevice } from '../deviceLabel.js'
import { checkPasswordLength, checkPasswordRemote } from '../passwordStrength.js'
import { RESEND_COOLDOWN_SECONDS, useResendCountdown } from '../useResendCountdown.js'

const SESSIONS_URL = '/api/v1/console/sessions'
const PASSWORD_URL = '/api/v1/console/password'
const TWO_FACTOR_ENABLE_URL = '/api/v1/console/2fa/email/enable'
const TWO_FACTOR_VERIFY_URL = '/api/v1/console/2fa/email/verify'
const TWO_FACTOR_DISABLE_URL = '/api/v1/console/2fa/email/disable'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const { account, mustChangePassword, verify } = useConsoleAuth()

const passwordModal = ref(false)
const passwordForm = ref({ current: '', next: '' })
const passwordError = ref('')
const passwordSaving = ref(false)

const twoFactorEnabled = computed(() => account.value?.twoFactorEnabled === true)

const enableModal = ref(false)
const enableCode = ref('')
const enableCheck = ref({ status: '', message: '' })
const enableError = ref('')
const enableSaving = ref(false)
const enableRequesting = ref(false)
const enableOtpRef = ref(null)
const {
  remaining: enableResendSeconds,
  start: startEnableResend,
  reset: resetEnableResend,
} = useResendCountdown()

const disableModal = ref(false)
const disablePassword = ref('')
const disableCheck = ref({ status: '', message: '' })
const disableError = ref('')
const disableSaving = ref(false)

// 重填验证码即撤掉上一次的报错；报错后值会被清空，空值不该反过来触发清空
watch(enableCode, (val) => {
  if (val && enableCheck.value.status) enableCheck.value = { status: '', message: '' }
})

const sessions = ref([])
const sessionsLoading = ref(false)
const sessionsError = ref('')
const revokingId = ref(0)
const revokingOthers = ref(false)

const roles = computed(() => account.value?.roles || [])
const passwordLengthCheck = computed(() => checkPasswordLength(passwordForm.value.next))
// 新旧相同是本地就能判的关系，不用等网络；服务端也会再拒一次
const passwordSameCheck = computed(() => {
  const { current, next } = passwordForm.value
  if (!current || !next || current !== next) return { status: '', message: '', blocked: false }
  return { status: 'error', message: '新密码不能与当前密码相同', blocked: true }
})
// 服务端结论只显示在密码输入框下方，与表单级错误分开
const passwordServerCheck = ref({ status: '', message: '' })
const currentPasswordError = ref({ status: '', message: '' })
const passwordSubmitted = ref(false)

// 当前密码框：必填与"密码不正确"都就近显示
const currentPasswordCheck = computed(() => {
  if (passwordSubmitted.value && !passwordForm.value.current) {
    return { status: 'error', message: '请填写当前密码' }
  }
  return currentPasswordError.value
})
const passwordCheck = computed(() => {
  if (passwordSubmitted.value && !passwordForm.value.next) {
    return { status: 'error', message: '请填写新密码', blocked: true }
  }
  const local = passwordLengthCheck.value.blocked ? passwordLengthCheck.value : passwordSameCheck.value
  return {
    status: local.status || passwordServerCheck.value.status,
    message: local.message || passwordServerCheck.value.message,
    blocked: local.blocked,
  }
})

watch(
  () => [passwordForm.value.current, passwordForm.value.next],
  () => {
    passwordServerCheck.value = { status: '', message: '' }
  },
)
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
  passwordSubmitted.value = false
  currentPasswordError.value = { status: '', message: '' }
  passwordServerCheck.value = { status: '', message: '' }
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
  passwordSubmitted.value = true
  currentPasswordError.value = { status: '', message: '' }
  passwordServerCheck.value = { status: '', message: '' }
  if (!passwordForm.value.current || !passwordForm.value.next) return
  if (passwordCheck.value.blocked) return

  passwordSaving.value = true
  try {
    const verdict = await checkPasswordRemote(
      passwordForm.value.next,
      account.value?.email || '',
    )
    if (!verdict.ok) {
      passwordServerCheck.value = { status: 'error', message: verdict.reason }
      return
    }
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
    if (e?.code === 'current_password_incorrect') {
      currentPasswordError.value = { status: 'error', message: e.message || '当前密码不正确' }
    } else if (e?.code === 'password_unchanged') {
      passwordServerCheck.value = { status: 'error', message: e.message || '新密码不能与当前密码相同' }
    } else {
      passwordError.value = e?.message || '修改失败，请稍后重试'
    }
  } finally {
    passwordSaving.value = false
  }
}

/** 开启弹窗出现时验证码已经发出，重发按钮先按住一个冷却窗口 */
function openEnableModal(seconds) {
  enableCode.value = ''
  enableCheck.value = { status: '', message: '' }
  enableError.value = ''
  enableModal.value = true
  startEnableResend(seconds)
}

async function requestEnableCode() {
  if (enableRequesting.value) return
  enableRequesting.value = true
  try {
    await consoleFetch(TWO_FACTOR_ENABLE_URL, { method: 'POST' })
    openEnableModal()
  } catch (e) {
    if (gotUnauthorized(e)) return
    // 冷却期内重复请求说明上一封验证码还在有效期内，直接进弹窗，只把重发按钮按住
    if (e?.code === 'resend_too_soon') {
      openEnableModal(e.retryAfterSeconds || RESEND_COOLDOWN_SECONDS)
      return
    }
    message.error(e?.message || '验证码发送失败，请稍后重试')
  } finally {
    enableRequesting.value = false
  }
}

async function resendEnableCode() {
  if (enableResendSeconds.value > 0 || enableRequesting.value) return
  enableRequesting.value = true
  try {
    await consoleFetch(TWO_FACTOR_ENABLE_URL, { method: 'POST' })
    enableCheck.value = { status: '', message: '' }
    startEnableResend()
  } catch (e) {
    if (gotUnauthorized(e)) return
    if (e?.code === 'resend_too_soon') {
      if (e.retryAfterSeconds > 0) startEnableResend(e.retryAfterSeconds)
      message.warning(e.message || '验证码刚发出，请稍后重试')
      return
    }
    message.error(e?.message || '验证码发送失败，请稍后重试')
  } finally {
    enableRequesting.value = false
  }
}

async function submitEnable() {
  enableCheck.value = { status: '', message: '' }
  enableError.value = ''
  if (!/^\d{6}$/.test(enableCode.value)) {
    enableCheck.value = { status: 'error', message: '请输入 6 位验证码' }
    return
  }

  enableSaving.value = true
  try {
    await consoleFetch(TWO_FACTOR_VERIFY_URL, {
      method: 'POST',
      body: JSON.stringify({ code: enableCode.value }),
    })
    enableModal.value = false
    resetEnableResend()
    message.success('两步验证已开启')
    await refreshAccount()
  } catch (e) {
    if (gotUnauthorized(e)) return
    if (e?.code === 'invalid_code') {
      const remaining = e?.meta?.remaining
      enableCheck.value = {
        status: 'error',
        message:
          Number.isInteger(remaining) && remaining > 0
            ? `验证码错误，还可尝试 ${remaining} 次`
            : '验证码错误，请重新输入',
      }
      enableCode.value = ''
      // 等本轮提交的禁用态解除再聚焦，否则光标进不去输入框
      nextTick(() => enableOtpRef.value?.focus())
    } else {
      enableError.value = e?.message || '开启失败，请稍后重试'
    }
  } finally {
    enableSaving.value = false
  }
}

function openDisableModal() {
  disablePassword.value = ''
  disableCheck.value = { status: '', message: '' }
  disableError.value = ''
  disableModal.value = true
}

async function submitDisable() {
  disableCheck.value = { status: '', message: '' }
  disableError.value = ''
  if (!disablePassword.value) {
    disableCheck.value = { status: 'error', message: '请输入当前密码' }
    return
  }

  disableSaving.value = true
  try {
    await consoleFetch(TWO_FACTOR_DISABLE_URL, {
      method: 'POST',
      body: JSON.stringify({ password: disablePassword.value }),
    })
    disableModal.value = false
    message.success('两步验证已关闭')
    await refreshAccount()
  } catch (e) {
    if (gotUnauthorized(e)) return
    if (e?.code === 'current_password_incorrect') {
      disableCheck.value = { status: 'error', message: e.message || '当前密码不正确' }
    } else {
      disableError.value = e?.message || '关闭失败，请稍后重试'
    }
  } finally {
    disableSaving.value = false
  }
}

/** 开关成功后让 `/me` 把账号状态拉回最新；刷新失败不影响已经生效的变更，只提示用户复核 */
async function refreshAccount() {
  try {
    await verify()
  } catch (e) {
    if (gotUnauthorized(e)) return
    message.warning('操作已生效，但账号状态未能刷新，请重新进入控制台确认')
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

      <div class="section-row">
        <div class="row-main">
          <span class="row-label">两步验证</span>
          <span class="row-value" :class="{ 'row-value--subtle': !twoFactorEnabled }">
            {{ twoFactorEnabled ? '已开启' : '未开启' }}
          </span>
        </div>
        <div class="row-action">
          <button
            v-if="twoFactorEnabled"
            class="app-btn app-btn--outline app-btn--sm app-btn--rect"
            type="button"
            @click="openDisableModal"
          >
            关闭
          </button>
          <button
            v-else
            class="app-btn app-btn--outline app-btn--sm app-btn--rect"
            type="button"
            :disabled="enableRequesting"
            @click="requestEnableCode"
          >
            开启两步验证
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
        <NFormItem
          label="当前密码"
          :validation-status="currentPasswordCheck.status || undefined"
          :feedback="currentPasswordCheck.message || undefined"
        >
          <NInput
            v-model:value="passwordForm.current"
            type="password"
            show-password-on="click"
            maxlength="1024"
            autocomplete="current-password"
            placeholder="请输入当前使用的密码"
          />
        </NFormItem>
        <NFormItem
          label="新密码"
          :validation-status="passwordCheck.status || undefined"
          :feedback="passwordCheck.message || undefined"
        >
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

    <AppModal
      v-model:show="enableModal"
      title="开启两步验证"
      :max-width="420"
      :auto-focus="false"
      :actions="[
        { text: '取消', variant: 'outline', onClick: () => (enableModal = false) },
        {
          text: enableSaving ? '提交中…' : '确认开启',
          variant: 'fill',
          disabled: enableSaving,
          onClick: submitEnable,
        },
      ]"
    >
      <NForm label-placement="top">
        <p class="form-note">
          验证码已发送至 {{ account?.email || '你的邮箱' }}，10 分钟内有效。
        </p>
        <NFormItem
          label="验证码"
          :validation-status="enableCheck.status || undefined"
          :feedback="enableCheck.message || undefined"
        >
          <InputOtp
            ref="enableOtpRef"
            v-model:value="enableCode"
            :status="enableCheck.status"
            :autofocus="false"
            :disabled="enableSaving"
          />
        </NFormItem>
        <div class="form-inline-action">
          <button
            class="app-btn app-btn--text app-btn--sm"
            type="button"
            :disabled="enableResendSeconds > 0 || enableRequesting"
            @click="resendEnableCode"
          >
            {{ enableResendSeconds > 0 ? `重新发送（${enableResendSeconds}s）` : '重新发送验证码' }}
          </button>
        </div>
        <p v-if="enableError" class="form-error">{{ enableError }}</p>
      </NForm>
    </AppModal>

    <AppModal
      v-model:show="disableModal"
      title="关闭两步验证"
      :max-width="420"
      :auto-focus="false"
      :actions="[
        { text: '取消', variant: 'outline', onClick: () => (disableModal = false) },
        {
          text: disableSaving ? '提交中…' : '确认关闭',
          variant: 'fill',
          disabled: disableSaving,
          onClick: submitDisable,
        },
      ]"
    >
      <NForm label-placement="top">
        <NFormItem
          label="当前密码"
          :validation-status="disableCheck.status || undefined"
          :feedback="disableCheck.message || undefined"
        >
          <NInput
            v-model:value="disablePassword"
            type="password"
            show-password-on="click"
            maxlength="1024"
            autocomplete="current-password"
            placeholder="请输入当前使用的密码"
          />
        </NFormItem>
        <p class="form-note">关闭后登录只校验密码，账号安全性会随之下降。</p>
        <p v-if="disableError" class="form-error">{{ disableError }}</p>
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

/* 「未开启」不是异常，只是次级状态，用次级前景色而不是警告色 */
.row-value--subtle {
  color: var(--muted-foreground);
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

/* 文字按钮自带内边距，右侧负回去与表单内容的右边缘对齐 */
.form-inline-action {
  display: flex;
  justify-content: flex-end;
  margin: 0 -14px 10px 0;
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

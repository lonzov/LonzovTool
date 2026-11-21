<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NForm, NFormItem, NIcon, NInput, NSwitch, useMessage } from 'naive-ui'
import {
  ArrowClockwise24Regular,
  Desktop24Regular,
  Key24Regular,
  PersonCircle24Regular,
  SignOut24Regular,
} from '@vicons/fluent'
import AppButton from '../../components/ui/AppButton.vue'
import AppModal from '../../components/ui/AppModal.vue'
import InputOtp from '../../components/ui/InputOtp.vue'
import SensitiveActionModal from '../components/SensitiveActionModal.vue'
import { confirmDialog } from '../../composables/useConfirm.js'
import { submitOnEnter } from '../enterSubmit.js'
import { consoleFetch } from '../consoleRequest.js'
import { useConsoleAuth } from '../consoleAuth.js'
import { describeDevice } from '../deviceLabel.js'
import { checkPasswordLength, checkPasswordRemote } from '../passwordStrength.js'
import { useSensitiveTrust } from '../useSensitiveTrust.js'
import { prepareCreationOptions, registrationCredentialJSON } from '../webauthn.js'

const SESSIONS_URL = '/api/v1/console/sessions'
const PASSWORD_URL = '/api/v1/console/password'
const TOTP_SETUP_URL = '/api/v1/console/2fa/totp/setup'
const TOTP_VERIFY_URL = '/api/v1/console/2fa/totp/verify'
const TOTP_DISABLE_URL = '/api/v1/console/2fa/totp/disable'
const TOTP_RECOVERY_URL = '/api/v1/console/2fa/totp/recovery'
const PASSKEYS_URL = '/api/v1/console/2fa/passkeys'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const { account, mustChangePassword, verify } = useConsoleAuth()
const { ensureTrust } = useSensitiveTrust()

const passwordModal = ref(false)
const passwordForm = ref({ next: '' })
const passwordSaving = ref(false)

const totpEnabled = computed(() => account.value?.totpEnabled === true)
const recoveryGeneratedText = computed(() => {
  const stamp = account.value?.totpRecoveryGeneratedAt || 0
  if (!stamp) return '尚未生成恢复码'
  return `生成于 ${new Date(stamp * 1000).toLocaleString('zh-CN')}`
})

/* ===== 通行密钥 ===== */
const passkeys = ref([])
const passkeysLoading = ref(false)
const passkeyBusy = ref(false)
const passkeyModal = ref(false)
const passkeySupported = computed(
  () => typeof window !== 'undefined' && !!window.PublicKeyCredential,
)

function openPasskeyModal() {
  passkeyModal.value = true
  loadPasskeys()
}

async function loadPasskeys() {
  passkeysLoading.value = true
  try {
    const payload = await consoleFetch(PASSKEYS_URL)
    passkeys.value = Array.isArray(payload?.items) ? payload.items : []
  } catch (e) {
    if (gotUnauthorized(e)) return
    message.error(e?.message || '读取通行密钥失败，请稍后重试')
  } finally {
    passkeysLoading.value = false
  }
}

async function startPasskeyRegistration() {
  if (!passkeySupported.value) {
    message.error('当前浏览器不支持通行密钥')
    return
  }
  passkeyBusy.value = true
  try {
    const options = await consoleFetch(`${PASSKEYS_URL}/options`, {
      method: 'POST',
      headers: authHeaders(),
    })
    const credential = await navigator.credentials.create({
      publicKey: prepareCreationOptions(options.public_key),
    })
    if (!credential) throw new Error('empty credential')
    const device = describeDevice(navigator.userAgent)
    const payload = await consoleFetch(PASSKEYS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: options.token,
        credential: registrationCredentialJSON(credential),
        name: device.label || '通行密钥',
      }),
    })
    pendingVerifyToken.value = ''
    passkeys.value = Array.isArray(payload?.items) ? payload.items : []
    await refreshAccount()
    message.success('通行密钥已添加')
  } catch (e) {
    if (gotUnauthorized(e)) return
    if (e?.name === 'NotAllowedError') {
      message.warning('已取消添加通行密钥')
    } else if (e?.name === 'NotSupportedError') {
      message.error('当前设备不支持通行密钥')
    } else {
      message.error(e?.message || '添加通行密钥失败，请稍后重试')
    }
  } finally {
    passkeyBusy.value = false
  }
}

async function removePasskey(id) {
  if (!id) return
  passkeyBusy.value = true
  try {
    const payload = await consoleFetch(`${PASSKEYS_URL}/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    pendingVerifyToken.value = ''
    passkeys.value = Array.isArray(payload?.items) ? payload.items : []
    await refreshAccount()
    message.success('已移除通行密钥')
  } catch (e) {
    if (gotUnauthorized(e)) return
    message.error(e?.message || '移除通行密钥失败，请稍后重试')
  } finally {
    passkeyBusy.value = false
  }
}

/* ===== 敏感操作的身份确认 ===== */
const sensitiveModal = ref(false)
const pendingAction = ref('')
const pendingVerifyToken = ref('')
const pendingPasskeyId = ref(0)

function askVerify(action, passkeyId = 0) {
  pendingAction.value = action
  pendingVerifyToken.value = ''
  pendingPasskeyId.value = passkeyId
  sensitiveModal.value = true
}

function onVerified(token) {
  pendingVerifyToken.value = token
  const action = pendingAction.value
  pendingAction.value = ''
  if (action === 'totp-enable') startTotpSetup()
  else if (action === 'totp-disable') runTotpDisable()
  else if (action === 'recovery') runRecoveryRegenerate()
  else if (action === 'passkey-add') startPasskeyRegistration()
  else if (action === 'passkey-delete') removePasskey(pendingPasskeyId.value)
  else if (action === 'password') {
    passwordForm.value = { next: '' }
    passwordSubmitted.value = false
    passwordServerCheck.value = { status: '', message: '' }
    passwordModal.value = true
  }


}

function authHeaders() {
  return { 'X-Verify-Token': pendingVerifyToken.value }
}

/* ===== 动态口令验证器 ===== */
const totpModal = ref(false)
const totpStep = ref('scan')
const totpSecret = ref('')
const totpQr = ref('')
const totpCode = ref('')
const totpCodes = ref([])
const totpCheck = ref({ status: '', message: '' })
const totpBusy = ref(false)

const recoveryModal = ref(false)
const recoveryCodes = ref([])

function resetTotpWizard() {
  totpStep.value = 'scan'
  totpSecret.value = ''
  totpQr.value = ''
  totpCode.value = ''
  totpCodes.value = []
  totpCheck.value = { status: '', message: '' }
}

function closeTotpModal() {
  totpModal.value = false
  resetTotpWizard()
}

async function startTotpSetup() {
  resetTotpWizard()
  totpModal.value = true
  totpBusy.value = true
  try {
    const payload = await consoleFetch(TOTP_SETUP_URL, {
      method: 'POST',
      headers: authHeaders(),
    })
    totpSecret.value = payload?.secret || ''
    if (payload?.uri) {
      try {
        const QRCode = (await import('qrcode')).default
        totpQr.value = await QRCode.toDataURL(payload.uri, { margin: 1, width: 168 })
      } catch {
        // 出不了二维码就让用户手填密钥，不阻塞流程
        totpQr.value = ''
      }
    }
  } catch (e) {
    message.error(e?.message || '获取密钥失败，请稍后重试')
  } finally {
    totpBusy.value = false
  }
}

async function confirmTotp() {
  if (!/^\d{6}$/.test(totpCode.value) || totpBusy.value) return
  totpBusy.value = true
  try {
    const payload = await consoleFetch(TOTP_VERIFY_URL, {
      method: 'POST',
      body: JSON.stringify({ code: totpCode.value }),
    })
    totpCodes.value = Array.isArray(payload?.recovery_codes) ? payload.recovery_codes : []
    totpStep.value = 'codes'
    await refreshAccount()
  } catch (e) {
    totpCheck.value = { status: 'error', message: e?.message || '验证码不正确' }
    totpCode.value = ''
  } finally {
    totpBusy.value = false
  }
}

async function runTotpDisable() {
  try {
    await consoleFetch(TOTP_DISABLE_URL, { method: 'POST', headers: authHeaders() })
    message.success('动态口令验证器已关闭，请重新登录')
    // 关闭会推高会话版本：本页会话随即失效，回登录页重新登录
    router.replace({ path: '/console/login', query: { redirect: '/console/account' } })
  } catch (e) {
    if (gotUnauthorized(e)) return
    message.error(e?.message || '关闭失败，请稍后重试')
  }
}

async function runRecoveryRegenerate() {
  try {
    const payload = await consoleFetch(TOTP_RECOVERY_URL, {
      method: 'POST',
      headers: authHeaders(),
    })
    recoveryCodes.value = Array.isArray(payload?.recovery_codes) ? payload.recovery_codes : []
    recoveryModal.value = true
    await refreshAccount()
  } catch (e) {
    if (gotUnauthorized(e)) return
    message.error(e?.message || '重新生成失败，请稍后重试')
  }
}

/** 恢复码下载：开头写清用途与保管要求，空一行后再列码。 */
function downloadRecoveryCodes(codes) {
  if (!codes.length) return
  const header = [
    '小舟工具箱 动态口令恢复码',
    '',
    '这些恢复码用于在手机丢失、无法使用身份验证器时登录控制台。',
    '每一枚只能使用一次，登录后会立即作废。',
    '请离线保存：不要放进聊天软件、邮箱草稿或任何会被同步的笔记。',
    '建议打印一份放在安全的地方；泄露等同于泄露登录权限。',
    '如果怀疑恢复码已外泄，请立刻在「我的账号」里重新生成。',
    '',
    '',
  ].join('\n')
  const body = codes.join('\n')
  const blob = new Blob([`${header}${body}\n`], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'lonzovtool-backup-codes.txt'
  anchor.click()
  URL.revokeObjectURL(url)
}

/* 两步验证是强制的：允许开关先真的拨到关闭位置，停顿一下再弹回去。
   立刻赋值回 true 会让动画来不及发生，看起来像"点了没反应"。 */
const masterSwitchOn = ref(true)
const masterSwitchPinging = ref(false)
let masterSwitchTimer = null

function onMasterSwitch(value) {
  if (value) return
  masterSwitchOn.value = false
  masterSwitchPinging.value = true
  message.warning('本账号具有编辑权限，为了保护网站内容安全，无法关闭此功能')

  // 停顿够一次完整的开关动画再复位，用户才看得到"关掉又被打开"
  masterSwitchTimer = window.setTimeout(() => {
    masterSwitchOn.value = true
    masterSwitchPinging.value = false
    masterSwitchTimer = null
  }, 420)
}

onBeforeUnmount(() => {
  if (masterSwitchTimer) window.clearTimeout(masterSwitchTimer)
})

function onTotpSwitch(value) {
  askVerify(value ? 'totp-enable' : 'totp-disable')
}

async function copyTextValue(value, container) {
  if (!value) return
  const { copyText } = await import('../../utils/clipboard.js')
  const ok = await copyText(value, { container })
  if (ok) message.success('已复制')
  else message.error('复制失败，请手动选中')
}

/** 会话时间戳按本地时区展示，空值统一显示破折号 */
function formatTime(timestamp) {
  const seconds = Number(timestamp)
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

function gotUnauthorized(e) {
  if (e?.code !== 'unauthorized') return false
  router.replace({ path: '/console/login', query: { redirect: route.fullPath } })
  return true
}

const sessions = ref([])
const sessionsLoading = ref(false)
const sessionsError = ref('')
const revokingId = ref(0)
const revokingOthers = ref(false)

/* 登录设备会出现在截图与录屏里：来源 IP 只保留首尾两段，中间两段一律打码 */
function maskIp(ip) {
  const text = (ip || '').trim()
  if (!text) return ''
  if (text.includes(':')) {
    const groups = text.split(':')
    if (groups.length < 4) return text
    return `${groups[0]}:*:*:${groups[groups.length - 1]}`
  }
  const parts = text.split('.')
  if (parts.length !== 4) return text
  return `${parts[0]}.*.*.${parts[3]}`
}

/* 设备信息由 UA 推出来：服务端只存原始 UA，解释放在前端，排障时 title 里仍留着原文 */
const devices = computed(() =>
  sessions.value.map((session) => ({
    ...session,
    device: describeDevice(session.user_agent),
    ip: maskIp(session.last_ip || session.created_ip),
  })),
)

/* 地点取最后来源地，旧会话回落到签发地；两者都没有时返回空串 */
function sessionRegion(session) {
  return session.last_region || session.created_region || ''
}

const roles = computed(() => account.value?.roles || [])
const passwordLengthCheck = computed(() => checkPasswordLength(passwordForm.value.next))

const passwordServerCheck = ref({ status: '', message: '' })
const passwordSubmitted = ref(false)

const passwordCheck = computed(() => {
  if (passwordSubmitted.value && !passwordForm.value.next) {
    return { status: 'error', message: '请填写新密码', blocked: true }
  }
  const local = passwordLengthCheck.value
  if (local.blocked) return local
  return passwordServerCheck.value
})

/* 输入框下方的提示：本地长度检查优先，其次服务端强度结论 */
const passwordFieldStatus = computed(() => {
  if (passwordSubmitted.value && !passwordForm.value.next) return 'error'
  const local = passwordLengthCheck.value
  if (local.blocked) return 'error'
  return passwordServerCheck.value.status || ''
})
const passwordFieldMessage = computed(() => {
  if (passwordSubmitted.value && !passwordForm.value.next) return '请填写新密码'
  const local = passwordLengthCheck.value
  if (local.blocked) return local.message
  return passwordServerCheck.value.message || ''
})

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

onMounted(() => {
  loadSessions()
  loadPasskeys()
})

async function changePassword() {
  passwordSubmitted.value = true
  passwordServerCheck.value = { status: '', message: '' }
  if (!passwordForm.value.next) return
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
      headers: authHeaders(),
      body: JSON.stringify({ new_password: passwordForm.value.next }),
    })
    pendingVerifyToken.value = ''
    passwordForm.value = { next: '' }
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
    if (e?.code === 'password_unchanged') {
      passwordServerCheck.value = { status: 'error', message: e.message || '新密码不能与当前密码相同' }
    } else {
      message.error(e?.message || '修改失败，请稍后重试')
    }
  } finally {
    passwordSaving.value = false
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
    message: `撤销后该设备需要重新登录。\n${session.device.label} · ${session.ip || '未知地址'}`,
    confirmText: '撤销',
    danger: true,
  })
  if (!confirmed) return
  if (!(await ensureTrust())) return

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

  // 撤销会话属于敏感但可回滚的操作：先要一次短时信任
  if (!(await ensureTrust())) return
  await runRevokeOthers()
}

async function runRevokeOthers() {
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
        <div class="section-title-row">
          <NIcon :component="PersonCircle24Regular" :size="16" class="section-icon" />
          <h2 class="section-title">账号信息</h2>
        </div>
        <p class="section-desc">登录身份与当前挂载的角色</p>
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
        <div class="section-title-row">
          <NIcon :component="Key24Regular" :size="16" class="section-icon" />
          <h2 class="section-title">安全</h2>
        </div>
        <p class="section-desc">登录密码与当前账号的凭据状态</p>
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
          <AppButton variant="text" size="sm" @click="askVerify('password')">
            修改密码
          </AppButton>
        </div>
      </div>

      <div class="section-row">
        <div class="row-main">
          <span class="row-title">两步验证 (2FA)</span>
          <span class="row-desc">登录时需输入额外验证码，有效防止账号被盗用。</span>
        </div>
        <div class="row-action">
          <NSwitch
            :value="masterSwitchOn"
            :loading="masterSwitchPinging"
            @update:value="onMasterSwitch"
          />
        </div>
      </div>

      <div class="section-row">
        <div class="row-main">
          <span class="row-title">动态口令验证器</span>
          <span class="row-desc">
            用手机上的身份验证器 App 生成 6 位动态码，登录与敏感操作都需要它
          </span>
        </div>
        <div class="row-action">
          <NSwitch :value="totpEnabled" @update:value="onTotpSwitch" />
        </div>
      </div>

      <div v-if="totpEnabled" class="section-row">
        <div class="row-main">
          <span class="row-title">恢复码</span>
          <span class="row-desc">{{ recoveryGeneratedText }}</span>
        </div>
        <div class="row-action">
          <AppButton variant="text" size="sm" @click="askVerify('recovery')">
            重新生成
          </AppButton>
        </div>
      </div>

      <div class="section-row">
        <div class="row-main">
          <span class="row-title">通行密钥</span>
          <span class="row-desc">
            {{
              passkeys.length
                ? `已添加 ${passkeys.length} 枚，可在管理中查看或移除`
                : '使用指纹、面容或设备 PIN 登录'
            }}
          </span>
        </div>
        <div class="row-action">
          <AppButton variant="outline" size="sm" @click="openPasskeyModal">
            管理
          </AppButton>
        </div>
      </div>
    </section>

    <section class="account-section">
      <header class="section-head section-head--plain">
        <div class="section-title-row">
          <NIcon :component="Desktop24Regular" :size="16" class="section-icon" />
          <h2 class="section-title">登录设备</h2>
        </div>
        <div class="section-head-extra">
          <AppButton
            variant="outline"
            size="xs"
            icon-only
            label="刷新"
            :icon="ArrowClockwise24Regular"
            :disabled="sessionsLoading"
            @click="loadSessions"
          />
          <AppButton
            variant="outline"
            size="sm"
            :disabled="revokingOthers || sessions.length < 2"
            @click="revokeOthers"
          >
            下线其他设备
          </AppButton>
        </div>
        <p class="section-desc">看到不认识的设备就直接下线它</p>
      </header>

      <p v-if="sessionsError" class="inline-hint inline-hint--error" role="alert">{{ sessionsError }}</p>
      <p v-else-if="!devices.length" class="inline-hint">
        {{ sessionsLoading ? '读取中…' : '没有有效会话' }}
      </p>

      <div v-else class="device-list">
        <article v-for="session in devices" :key="session.id" class="device-card">
          <span class="device-icon">
            <NIcon :component="Desktop24Regular" :size="18" />
          </span>

          <div class="device-main">
            <p class="device-line">
              <span class="device-name">{{ session.device.label }}</span>
              <span v-if="session.current" class="device-tag">当前设备</span>
            </p>
            <p class="device-ip">
              {{ session.ip || '未知地址' }}
            </p>
            <div class="device-meta">
              <span v-if="sessionRegion(session)" class="meta-item">
                <span class="meta-label">地点</span>
                <span class="meta-value">{{ sessionRegion(session) }}</span>
              </span>
              <span class="meta-item">
                <span class="meta-label">最近活动</span>
                <span class="meta-value">
                  {{ formatTime(session.last_used_at || session.created_at) }}
                </span>
              </span>
              <span class="meta-item">
                <span class="meta-label">登录于</span>
                <span class="meta-value">{{ formatTime(session.created_at) }}</span>
              </span>
            </div>
          </div>

          <AppButton
            class="device-action"
            variant="outline"
            size="sm"
            shape="rect"
            :icon="SignOut24Regular"
            :aria-label="`下线 ${session.device.label}`"
            :disabled="session.current || revokingId === session.id"
            :title="session.current ? '当前设备请用右上角「退出」结束' : `撤销该设备（原始 UA：${session.user_agent || '未知'}）`"
            @click="revoke(session)"
          >
            下线
          </AppButton>
        </article>
      </div>
    </section>

    <AppModal
      v-model:show="passwordModal"
      title="修改密码"
      description="设置新密码后，其他设备上的会话会立即失效"
      :max-width="440"
      :auto-focus="false"
      :actions="[
        { text: '取消', variant: 'outline', onClick: () => (passwordModal = false) },
        {
          text: passwordSaving ? '提交中…' : '保存新密码',
          variant: 'fill',
          disabled: passwordSaving,
          onClick: changePassword,
        },
      ]"
    >
      <NForm label-placement="top" @keydown.enter="submitOnEnter($event, changePassword)">
        <NFormItem
          label="新密码"
          :validation-status="passwordFieldStatus"
          :feedback="passwordFieldMessage"
        >
          <NInput
            v-model:value="passwordForm.next"
            type="password"
            show-password-on="click"
            maxlength="1024"
            autocomplete="new-password"
            placeholder="至少 8 位，建议混合大小写、数字与符号"
          />
        </NFormItem>
      </NForm>
    </AppModal>


    <AppModal
      v-model:show="totpModal"
      title="开启动态口令验证器"
      description="用身份验证器 App 扫描二维码，再输入它显示的 6 位动态码"
      :max-width="440"
      :auto-focus="false"
      :actions="
        totpStep === 'scan'
          ? [
              { text: '取消', variant: 'outline', onClick: closeTotpModal },
              {
                text: totpBusy ? '验证中…' : '确认开启',
                variant: 'fill',
                disabled: totpBusy || !/^\d{6}$/.test(totpCode),
                onClick: confirmTotp,
              },
            ]
          : [{ text: '我已保存', variant: 'fill', onClick: closeTotpModal }]
      "
    >
      <NForm
        v-if="totpStep === 'scan'"
        label-placement="top"
        @keydown.enter="submitOnEnter($event, confirmTotp)"
      >
        <div class="totp-qr">
          <img v-if="totpQr" :src="totpQr" alt="动态口令二维码" width="168" height="168" />
          <code class="totp-secret">{{ totpSecret }}</code>
          <AppButton variant="text" size="sm" @click="copyTextValue(totpSecret, $event.currentTarget)">
            复制密钥
          </AppButton>
        </div>
        <NFormItem
          label="验证器显示的 6 位动态码"
          :validation-status="totpCheck.status || undefined"
          :feedback="totpCheck.message || undefined"
        >
          <InputOtp
            v-model:value="totpCode"
            :status="totpCheck.status"
            :autofocus="false"
            :disabled="totpBusy"
          />
        </NFormItem>
      </NForm>

      <div v-else class="totp-codes">
        <p class="form-note">
          下面 8 枚恢复码只显示这一次，手机丢失时用它们登录。请立刻下载或抄到安全的地方。
        </p>
        <ul class="totp-code-list">
          <li v-for="code in totpCodes" :key="code">{{ code }}</li>
        </ul>
        <AppButton variant="outline" size="sm" @click="downloadRecoveryCodes(totpCodes)">
          下载恢复码
        </AppButton>
      </div>
    </AppModal>

    <AppModal
      v-model:show="passkeyModal"
      title="通行密钥"
      description="使用指纹、面容或设备 PIN 登录；添加后可在登录与敏感操作时使用"
      :max-width="520"
      :auto-focus="false"
      :actions="[{ text: '关闭', variant: 'outline', onClick: () => (passkeyModal = false) }]"
    >
      <div class="passkey-manage">
        <div class="passkey-manage-head">
          <p class="passkey-manage-hint">
            已添加 {{ passkeys.length }} 枚通行密钥
          </p>
          <AppButton
            variant="solid"
            size="sm"
            :disabled="!passkeySupported || passkeyBusy"
            :loading="passkeyBusy"
            @click="askVerify('passkey-add')"
          >
            添加通行密钥
          </AppButton>
        </div>

        <p v-if="passkeysLoading" class="passkey-empty">读取中…</p>
        <p v-else-if="!passkeys.length" class="passkey-empty">
          还没有添加通行密钥。添加后，登录时可使用此设备的指纹、面容或 PIN 完成验证。
        </p>
        <ul v-else class="passkey-list">
          <li v-for="passkey in passkeys" :key="passkey.id" class="passkey-item">
            <div class="passkey-item-main">
              <span class="passkey-item-name">{{ passkey.name || '通行密钥' }}</span>
              <span class="passkey-item-meta">
                添加于 {{ formatTime(passkey.created_at) }}
                <template v-if="passkey.last_used_at">
                  · 最近使用 {{ formatTime(passkey.last_used_at) }}
                </template>
              </span>
            </div>
            <AppButton
              variant="text"
              size="sm"
              :disabled="passkeyBusy"
              @click="askVerify('passkey-delete', passkey.id)"
            >
              移除
            </AppButton>
          </li>
        </ul>

        <p v-if="!passkeySupported" class="passkey-warning">
          当前浏览器不支持通行密钥，请使用最新版 Chrome、Edge、Safari 或 Firefox。
        </p>
      </div>
    </AppModal>

    <SensitiveActionModal v-model:show="sensitiveModal" @verified="onVerified" />

    <AppModal
      v-model:show="recoveryModal"
      title="新的恢复码"
      description="旧的恢复码已全部作废；这些只显示这一次"
      :max-width="460"
      :auto-focus="false"
      :actions="[
        { text: '复制', variant: 'outline', onClick: () => copyTextValue(recoveryCodes.join('\n')) },
        { text: '下载', variant: 'outline', onClick: () => downloadRecoveryCodes(recoveryCodes) },
        { text: '我已保存', variant: 'fill', onClick: () => (recoveryModal = false) },
      ]"
    >
      <ul class="totp-code-list">
        <li v-for="code in recoveryCodes" :key="code">{{ code }}</li>
      </ul>
      <p class="form-note">
        手机丢失时用其中任意一枚登录；每枚只能用一次。请离线保存，不要放进聊天软件或同步笔记。
      </p>
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
  container-type: inline-size;
  padding: 16px 18px 4px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  transition: background-color 0.4s ease, border-color 0.4s ease;
}

.section-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}

.section-title-row {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  grid-column: 1;
  grid-row: 1;
}


/* 下面紧接的是设备卡片，标题区不再画分隔线 */
.section-head--plain {
  padding-bottom: 4px;
  border-bottom: none;
}

.section-icon {
  flex-shrink: 0;
  color: var(--muted-foreground);
  transition: color 0.4s ease;
}

.section-title {
  margin: 0;
  color: var(--foreground);
  font-size: 0.95rem;
  font-weight: 600;
  transition: color 0.4s ease;
}

.section-desc {
  grid-column: 1 / -1;
  grid-row: 2;
  margin: 0;
  color: var(--subtle-foreground);
  font-size: 0.78rem;
  line-height: 1.5;
  transition: color 0.4s ease;
}

.section-head-extra {
  grid-column: 2;
  grid-row: 1;
  display: flex;
  align-items: center;
  gap: 8px;
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
  flex: 1;
  min-width: 0;
}

.row-label {
  color: var(--subtle-foreground);
  font-size: 0.75rem;
  transition: color 0.4s ease;
}

/* 带说明的行：标题承担主要信息，字号与颜色对齐设置页的 .setting-title */
.row-title {
  color: var(--foreground);
  font-size: 0.9rem;
  font-weight: 500;
  line-height: 1.4;
  transition: color 0.4s ease;
}

.row-desc {
  display: block;
  margin-top: 3px;
  color: var(--subtle-foreground);
  font-size: 0.8rem;
  line-height: 1.45;
  transition: color 0.4s ease;
}

.passkey-manage {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.passkey-manage-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.passkey-manage-hint {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 0.82rem;
  line-height: 1.5;
}

.passkey-empty {
  margin: 0;
  padding: 18px 14px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  color: var(--subtle-foreground);
  font-size: 0.8rem;
  line-height: 1.6;
}

.passkey-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.passkey-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card);
}

.passkey-item-main {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.passkey-item-name {
  color: var(--foreground);
  font-size: 0.86rem;
  font-weight: 500;
  line-height: 1.4;
}

.passkey-item-meta {
  color: var(--subtle-foreground);
  font-size: 0.78rem;
  line-height: 1.45;
}

.passkey-warning {
  margin: 0;
  color: var(--destructive);
  font-size: 0.78rem;
  line-height: 1.5;
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
  font-size: 0.75rem;
}

.row-action {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.role-tag {
  padding: 1px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  corner-shape: round;
  color: var(--foreground);
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  font-size: 0.75rem;
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
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.device-card:hover {
  border-color: var(--border-strong);
}

.device-action:hover:not(:disabled) {
  background: color-mix(in srgb, var(--destructive) 8%, transparent);
  border-color: color-mix(in srgb, var(--destructive) 35%, transparent);
  color: var(--destructive);
}

.device-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: var(--radius-md);
  background: var(--muted);
  color: var(--muted-foreground);
}

.device-main {
  min-width: 0;
}

.device-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
  margin: 0;
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
  font-size: 0.75rem;
}

.device-ip {
  margin: 2px 0 0;
  color: var(--muted-foreground);
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: 0.75rem;
  overflow-wrap: anywhere;
}

.device-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  margin-top: 6px;
  color: var(--muted-foreground);
  font-size: 0.75rem;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.meta-item + .meta-item::before {
  content: '·';
  color: var(--subtle-foreground);
}

.meta-label {
  color: var(--subtle-foreground);
}

.meta-value {
  color: var(--muted-foreground);
}


.totp-qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.totp-qr img {
  border-radius: var(--radius-md);
  background: var(--card);
}

.totp-secret {
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  background: var(--muted);
  color: var(--muted-foreground);
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  overflow-wrap: anywhere;
}

.totp-codes {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.totp-code-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 12px;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  list-style: none;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.8125rem;
  color: var(--foreground);
}

.form-note {
  margin: 0 0 10px;
  color: var(--subtle-foreground);
  font-size: 0.75rem;
  line-height: 1.6;
}

/* 文字按钮自带内边距，右侧负回去与表单内容的右边缘对齐 */
.form-inline-action {
  display: flex;
  justify-content: flex-end;
  margin: 0 -14px 10px 0;
}

.inline-hint {
  margin: 0;
  padding: 8px 0;
  color: var(--subtle-foreground);
  font-size: 0.8rem;
}

.inline-hint--error {
  color: var(--destructive);
}

/* 窄屏只收间距与字号，不改对齐方式：一改就会出现"720 上下按钮位置跳一下" */
@container (width <= 620px) {
  .section-row {
    gap: 12px;
  }

  .section-head {
    gap: 3px 10px;
  }

  /* 图标与操作按钮一起顶对齐到首行，形成稳定上边缘 */
  .device-card {
    align-items: start;
    gap: 10px;
    padding: 12px;
  }

  .device-icon {
    width: 34px;
    height: 34px;
  }

  .device-name {
    font-size: 0.84rem;
  }

  .device-meta {
    font-size: 0.75rem;
  }

  /* 时间改成 label/value 两列，行尾不再留孤零零的分隔点 */
  .device-meta {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    margin-top: 8px;
  }

  .meta-item {
    display: contents;
  }

  .meta-item + .meta-item::before {
    content: none;
  }

  /* 设备多时按钮文字最占地方：窄屏只留图标，语义交给 aria-label */
  .device-action {
    justify-self: end;
    justify-content: center;
    width: 30px;
    height: 30px;
    padding: 0;
    margin-top: -1px;
  }

  .device-action :deep(.app-btn__label) {
    display: none;
  }
}

@media (width <= 560px) {
  .passkey-manage-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .passkey-item {
    align-items: flex-start;
  }
}
</style>

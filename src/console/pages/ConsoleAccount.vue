<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NForm, NFormItem, NIcon, NInput, NSwitch, useMessage } from 'naive-ui'
import {
  ArrowClockwise24Regular,
  Desktop24Regular,
  Key24Regular,
  PersonCircle24Regular,
  SignOut24Regular,
} from '@vicons/fluent'
import AppModal from '../../components/ui/AppModal.vue'
import InputOtp from '../../components/ui/InputOtp.vue'
import SensitiveActionModal from '../components/SensitiveActionModal.vue'
import { confirmDialog } from '../../composables/useConfirm.js'
import { consoleFetch } from '../consoleRequest.js'
import { useConsoleAuth } from '../consoleAuth.js'
import { describeDevice } from '../deviceLabel.js'
import { checkPasswordLength, checkPasswordRemote } from '../passwordStrength.js'

const SESSIONS_URL = '/api/v1/console/sessions'
const PASSWORD_URL = '/api/v1/console/password'
const TOTP_SETUP_URL = '/api/v1/console/2fa/totp/setup'
const TOTP_VERIFY_URL = '/api/v1/console/2fa/totp/verify'
const TOTP_DISABLE_URL = '/api/v1/console/2fa/totp/disable'
const TOTP_RECOVERY_URL = '/api/v1/console/2fa/totp/recovery'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const { account, mustChangePassword, verify } = useConsoleAuth()

const passwordModal = ref(false)
const passwordForm = ref({ next: '' })
const passwordError = ref('')
const passwordSaving = ref(false)

const totpEnabled = computed(() => account.value?.totpEnabled === true)
const recoveryGeneratedText = computed(() => {
  const stamp = account.value?.totpRecoveryGeneratedAt || 0
  if (!stamp) return '尚未生成恢复码'
  return `生成于 ${new Date(stamp * 1000).toLocaleString('zh-CN')}`
})

/* ===== 敏感操作的身份确认 ===== */
const sensitiveModal = ref(false)
const pendingAction = ref('')
const pendingVerifyToken = ref('')

function askVerify(action) {
  pendingAction.value = action
  pendingVerifyToken.value = ''
  sensitiveModal.value = true
}

function onVerified(token) {
  pendingVerifyToken.value = token
  const action = pendingAction.value
  pendingAction.value = ''
  if (action === 'totp-enable') startTotpSetup()
  else if (action === 'totp-disable') runTotpDisable()
  else if (action === 'recovery') runRecoveryRegenerate()
  else if (action === 'password') {
    passwordForm.value = { next: '' }
    passwordError.value = ''
    passwordSubmitted.value = false
    passwordServerCheck.value = { status: '', message: '' }
    passwordModal.value = true
  }
  else if (action === 'revoke-others') runRevokeOthers()
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
const totpError = ref('')
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
  totpError.value = ''
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
    totpError.value = e?.message || '获取密钥失败，请稍后重试'
  } finally {
    totpBusy.value = false
  }
}

async function confirmTotp() {
  if (!/^\d{6}$/.test(totpCode.value) || totpBusy.value) return
  totpBusy.value = true
  totpError.value = ''
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

/* 开关组件只是入口：真正动作要过一次身份确认 */
function onMasterSwitch(value) {
  if (value) return
  // 前端摆设：账号涉及编辑权限，两步验证不允许关闭
  message.warning('账号涉及网站编辑权限，为了安全所以不允许关闭两步验证')
}

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
    // 设备信息由 UA 推出来，服务端只存原始 UA，不在库里做解释
    sessions.value = (payload?.items || []).map((item) => ({
      ...item,
      device: describeDevice(item.user_agent),
    }))
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
      passwordError.value = e?.message || '修改失败，请稍后重试'
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

  // 撤销会话属于敏感操作：先过一次身份确认
  askVerify('revoke-others')
}

async function runRevokeOthers() {
  revokingOthers.value = true
  try {
    const result = await consoleFetch(`${SESSIONS_URL}/revoke-others`, {
      method: 'POST',
      headers: authHeaders(),
    })
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
            @click="askVerify('password')"
          >
            修改密码
          </button>
        </div>
      </div>

      <div class="section-row">
        <div class="row-main">
          <span class="row-label">两步验证 (2FA)</span>
          <span class="row-desc">账号涉及网站编辑权限，为保障安全已强制开启，不允许关闭</span>
        </div>
        <div class="row-action">
          <NSwitch :value="true" @update:value="onMasterSwitch" />
        </div>
      </div>

      <div class="section-row">
        <div class="row-main">
          <span class="row-label">动态口令验证器</span>
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
          <span class="row-label">恢复码</span>
          <span class="row-desc">{{ recoveryGeneratedText }}</span>
        </div>
        <div class="row-action">
          <button
            class="app-btn app-btn--text app-btn--sm"
            type="button"
            @click="askVerify('recovery')"
          >
            重新生成
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
      <NForm label-placement="top">
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
        <p v-if="passwordError" class="form-error">{{ passwordError }}</p>
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
      <NForm v-if="totpStep === 'scan'" label-placement="top">
        <div class="totp-qr">
          <img v-if="totpQr" :src="totpQr" alt="动态口令二维码" width="168" height="168" />
          <code class="totp-secret">{{ totpSecret }}</code>
          <button
            class="app-btn app-btn--text app-btn--sm"
            type="button"
            @click="copyTextValue(totpSecret, $event.currentTarget)"
          >
            复制密钥
          </button>
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
        <p v-if="totpError" class="form-error">{{ totpError }}</p>
      </NForm>

      <div v-else class="totp-codes">
        <p class="form-note">
          下面 8 枚恢复码只显示这一次，手机丢失时用它们登录。请立刻下载或抄到安全的地方。
        </p>
        <ul class="totp-code-list">
          <li v-for="code in totpCodes" :key="code">{{ code }}</li>
        </ul>
        <button
          class="app-btn app-btn--outline app-btn--sm"
          type="button"
          @click="downloadRecoveryCodes(totpCodes)"
        >
          下载恢复码
        </button>
      </div>
    </AppModal>

    <AppModal
      v-model:show="totpDisableModal"
      title="关闭身份验证器"
      :max-width="420"
      :auto-focus="false"
      :actions="[
        { text: '取消', variant: 'outline', onClick: () => (totpDisableModal = false) },
        {
          text: totpDisableBusy ? '提交中…' : '确认关闭',
          variant: 'fill',
          disabled: totpDisableBusy,
          onClick: submitTotpDisable,
        },
      ]"
    >
      <NForm label-placement="top">
        <NFormItem label="当前密码">
          <NInput
            v-model:value="totpDisablePassword"
            type="password"
            show-password-on="click"
            maxlength="1024"
            autocomplete="current-password"
            placeholder="请输入当前使用的密码"
          />
        </NFormItem>
        <p class="form-note">关闭后所有设备需要重新登录，恢复码一并作废。</p>
        <p v-if="totpDisableError" class="form-error">{{ totpDisableError }}</p>
      </NForm>
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

.row-desc {
  display: block;
  margin-top: 2px;
  color: var(--muted-foreground);
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

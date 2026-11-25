<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { NInput, useMessage } from 'naive-ui'
import { ArrowClockwise24Regular } from '@vicons/fluent'
import AppButton from '../../components/ui/AppButton.vue'
import AppModal from '../../components/ui/AppModal.vue'
import InputOtp from '../../components/ui/InputOtp.vue'
import ConsoleSpin from './ConsoleSpin.vue'
import { consoleFetch } from '../../console/consoleRequest.js'
import { submitOnEnter } from '../enterSubmit.js'
import { useResendCountdown } from '../../console/useResendCountdown.js'
import { authenticationCredentialJSON, prepareRequestOptions } from '../webauthn.js'

/**
 * 敏感操作的身份确认。
 *
 * 改密码、开关动态口令、重置他人密码这类动作仅凭一个活着的会话不该能完成：
 * 会话可能是被偷的。这里把"确认是本人"做成统一的模态框，验证通过后交出一张
 * 一次性凭证，由调用方带进真正的请求。
 *
 * 可用方式完全由服务端决定（`GET /verify/options`）：
 * 账号开了任意两步验证就不再给"密码"这一项，避免偷到密码的人直接过关。
 */
const props = defineProps({
  show: { type: Boolean, default: false },
  /** 标题下方的说明，默认就是敏感操作的通用提示 */
  description: { type: String, default: '为了账号的安全，请先确认是你本人' },
})

const emit = defineEmits(['update:show', 'verified'])
const message = useMessage()

const OPTIONS_URL = '/api/v1/console/verify/options'
const SEND_URL = '/api/v1/console/verify/email/send'
const VERIFY_URL = '/api/v1/console/verify'

const METHOD_LABEL = {
  password: '密码',
  email: '邮箱验证码',
  totp: '动态口令',
  passkey: '通行密钥',
}

const methods = ref([])
const method = ref('')
const optionsLoading = ref(true)
const maskedEmail = ref('')
const password = ref('')
const code = ref('')
const codeSent = ref(false)
const sending = ref(false)
const busy = ref(false)
const check = ref({ status: '', message: '' })
const passkeyToken = ref('')
const passkeyOptions = ref(null)
const otpRef = ref(null)
const { remaining, start: startCountdown, reset: resetCountdown } = useResendCountdown()

const onlyOne = computed(() => methods.value.length <= 1)
const canSubmit = computed(() => {
  if (busy.value || !method.value) return false
  if (method.value === 'password') return password.value.length > 0
  if (method.value === 'passkey') return !!passkeyOptions.value
  return /^\d{6}$/.test(code.value)
})

function reset() {
  methods.value = []
  method.value = ''
  optionsLoading.value = true
  maskedEmail.value = ''
  password.value = ''
  code.value = ''
  codeSent.value = false
  sending.value = false
  busy.value = false
  check.value = { status: '', message: '' }
  passkeyToken.value = ''
  passkeyOptions.value = null
  resetCountdown()
}

async function loadOptions() {
  try {
    const payload = await consoleFetch(OPTIONS_URL)
    methods.value = Array.isArray(payload?.methods) ? payload.methods : []
    maskedEmail.value = payload?.masked_email || ''
    passkeyToken.value = payload?.passkey_token || ''
    passkeyOptions.value = payload?.passkey_options || null
    const emailCodeSent =
      payload?.email_code_sent === true && methods.value.includes('email')
    // 关掉弹窗再打开时，服务端会告诉这个邮箱是否已有待验证码；
    // 有就直接回到邮箱验证码输入，并恢复冷却，不要求用户重发一封。
    method.value = emailCodeSent ? 'email' : methods.value[0] || ''
    codeSent.value = emailCodeSent
    if (emailCodeSent) {
      const wait = Number(payload?.email_resend_after) || 0
      if (wait > 0) startCountdown(wait)
      nextTick(() => otpRef.value?.focus())
    } else if (method.value === 'totp') {
      nextTick(() => otpRef.value?.focus())
    }
  } catch (e) {
    message.error(e?.message || '读取验证方式失败，请稍后重试')
  } finally {
    optionsLoading.value = false
  }
}

watch(
  () => props.show,
  (open) => {
    if (open) {
      reset()
      loadOptions()
    }
  },
)

function choose(next) {
  if (busy.value || sending.value) return
  method.value = next
  code.value = ''
  password.value = ''
  check.value = { status: '', message: '' }
  if (next === 'totp') nextTick(() => otpRef.value?.focus())
}

async function sendCode() {
  if (sending.value || remaining.value > 0) return
  sending.value = true
  try {
    await consoleFetch(SEND_URL, { method: 'POST' })
    codeSent.value = true
    startCountdown()
    nextTick(() => otpRef.value?.focus())
  } catch (e) {
    if (e?.code === 'resend_too_soon' || e?.code === 'rate_limited') {
      if (e.retryAfterSeconds > 0) startCountdown(e.retryAfterSeconds)
    }
    message.error(e?.message || '验证码发送失败，请稍后重试')
  } finally {
    sending.value = false
  }
}

async function submit() {
  if (!canSubmit.value) return
  busy.value = true
  check.value = { status: '', message: '' }
  try {
    let credential = method.value === 'password' ? password.value : code.value.trim()
    let token = ''
    if (method.value === 'passkey') {
      if (!window.PublicKeyCredential || !navigator.credentials) {
        throw new Error('passkey_unsupported')
      }
      const assertion = await navigator.credentials.get({
        publicKey: prepareRequestOptions(passkeyOptions.value),
      })
      if (!assertion) throw new Error('passkey_cancelled')
      credential = JSON.stringify(authenticationCredentialJSON(assertion))
      token = passkeyToken.value
    }
    const payload = await consoleFetch(VERIFY_URL, {
      method: 'POST',
      body: JSON.stringify({ method: method.value, credential, token }),
    })
    emit('verified', payload?.token || '')
    emit('update:show', false)
  } catch (e) {
    if (e?.message === 'passkey_unsupported') {
      message.error('当前设备不支持通行密钥')
    } else if (e?.name === 'NotAllowedError' || e?.message === 'passkey_cancelled') {
      message.warning('通行密钥验证已取消')
    } else if (e?.code === 'invalid_code' || e?.code === 'totp_invalid' || e?.code === 'current_password_incorrect') {
      check.value = { status: 'error', message: e.message || '验证不通过' }
      if (method.value !== 'password') {
        code.value = ''
        nextTick(() => otpRef.value?.focus())
      }
    } else {
      message.error(e?.message || '验证失败，请稍后重试')
    }
  } finally {
    busy.value = false
  }
}

const actions = computed(() => [
  { text: '取消', variant: 'outline', onClick: () => emit('update:show', false) },
  {
    text: busy.value ? '验证中…' : '确认',
    variant: 'fill',
    disabled: busy.value || !canSubmit.value,
    onClick: submit,
  },
])
</script>

<template>
  <AppModal
    :show="show"
    title="验证身份"
    :description="description"
    :max-width="420"
    :auto-focus="false"
    animated
    content-scrollable
    :actions="actions"
    @update:show="emit('update:show', $event)"
  >
    <div class="verify-body" @keydown.enter="submitOnEnter($event, submit)">
    <ConsoleSpin v-if="optionsLoading" :min-height="132" />
    <template v-else>
    <!-- 只有一种方式时不显示切换器，避免"只有一个选项还要点一下" -->
    <div v-if="!onlyOne" class="method-tabs" role="tablist">
      <button
        v-for="item in methods"
        :key="item"
        class="method-tab"
        :class="{ 'method-tab--on': method === item }"
        type="button"
        role="tab"
        :aria-selected="method === item"
        :disabled="busy || sending"
        @click="choose(item)"
      >
        {{ METHOD_LABEL[item] || item }}
      </button>
    </div>

    <div v-if="method === 'password'" class="field">
      <label class="field-label" for="verify-password">当前密码</label>
      <NInput
        id="verify-password"
        v-model:value="password"
        type="password"
        show-password-on="click"
        maxlength="1024"
        autocomplete="current-password"
        placeholder="请输入当前密码"
        :disabled="busy"
        @keydown.enter="submitOnEnter($event, submit)"
      />
    </div>

    <div v-else-if="method === 'email'" class="field">
      <div class="field-row">
        <NInput
          v-model:value="code"
          maxlength="6"
          placeholder="6 位验证码"
          :disabled="busy"
          @keydown.enter="submitOnEnter($event, submit)"
        />
        <AppButton
          class="send-btn"
          variant="outline"
          shape="rect"
          :icon="ArrowClockwise24Regular"
          :disabled="sending || remaining > 0"
          @click="sendCode"
        >
          {{ sending ? '发送中…' : remaining > 0 ? `${remaining}s` : codeSent ? '重新发送' : '发送' }}
        </AppButton>
      </div>
      <p class="field-hint">
        {{ codeSent ? `验证码已发送至 ${maskedEmail || '你的邮箱'}` : `验证码将发送至 ${maskedEmail || '你的邮箱'}` }}
      </p>
    </div>

    <div v-else-if="method === 'totp'" class="field">
      <InputOtp
        ref="otpRef"
        v-model:value="code"
        :status="check.status"
        :autofocus="false"
        :disabled="busy"
        @keydown.enter="submitOnEnter($event, submit)"
      />
      <p class="field-hint">打开手机上的身份验证器 App，输入它当前显示的 6 位动态码</p>
    </div>

    <div v-else-if="method === 'passkey'" class="field">
      <p class="field-hint">
        点击下方确认后，使用此设备上的指纹、面容或系统 PIN 完成身份验证。
      </p>
    </div>

    <p v-if="check.message" class="field-error">{{ check.message }}</p>
    </template>
    </div>
  </AppModal>
</template>

<style scoped>
.method-tabs {
  display: inline-flex;
  gap: 4px;
  margin-bottom: 14px;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--muted);
}

.method-tab {
  padding: 4px 12px;
  border: none;
  border-radius: calc(var(--radius-md) - 3px);
  background: transparent;
  color: var(--muted-foreground);
  font-family: inherit;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: color 0.2s ease, background-color 0.2s ease;
}

.method-tab:hover:not(:disabled) {
  color: var(--foreground);
}

.method-tab--on {
  background: var(--card);
  color: var(--foreground);
  box-shadow: var(--shadow-sm);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.send-btn {
  flex-shrink: 0;
}

.field-label {
  color: var(--muted-foreground);
  font-size: 0.8125rem;
}

.field-hint {
  margin: 0;
  color: var(--subtle-foreground);
  font-size: 0.75rem;
}

.field-error {
  margin: 8px 0 0;
  color: var(--destructive);
  font-size: 0.78rem;
}

</style>

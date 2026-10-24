<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { NIcon, NInput } from 'naive-ui'
import { ArrowClockwise24Regular } from '@vicons/fluent'
import AppModal from '../../components/ui/AppModal.vue'
import InputOtp from '../../components/ui/InputOtp.vue'
import { consoleFetch } from '../../console/consoleRequest.js'
import { useResendCountdown } from '../../console/useResendCountdown.js'

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

const OPTIONS_URL = '/api/v1/console/verify/options'
const SEND_URL = '/api/v1/console/verify/email/send'
const VERIFY_URL = '/api/v1/console/verify'

const METHOD_LABEL = {
  password: '密码',
  email: '邮箱验证码',
  totp: '动态口令',
}

const methods = ref([])
const method = ref('')
const maskedEmail = ref('')
const password = ref('')
const code = ref('')
const codeSent = ref(false)
const sending = ref(false)
const busy = ref(false)
const error = ref('')
const check = ref({ status: '', message: '' })
const otpRef = ref(null)
const { remaining, start: startCountdown, reset: resetCountdown } = useResendCountdown()

const onlyOne = computed(() => methods.value.length <= 1)
const canSubmit = computed(() => {
  if (busy.value || !method.value) return false
  if (method.value === 'password') return password.value.length > 0
  if (method.value === 'totp') return /^\d{6}$/.test(code.value)
  return /^\d{6}$/.test(code.value)
})

function reset() {
  methods.value = []
  method.value = ''
  maskedEmail.value = ''
  password.value = ''
  code.value = ''
  codeSent.value = false
  sending.value = false
  busy.value = false
  error.value = ''
  check.value = { status: '', message: '' }
  resetCountdown()
}

async function loadOptions() {
  try {
    const payload = await consoleFetch(OPTIONS_URL)
    methods.value = Array.isArray(payload?.methods) ? payload.methods : []
    maskedEmail.value = payload?.masked_email || ''
    method.value = methods.value[0] || ''
    if (method.value === 'totp') nextTick(() => otpRef.value?.focus())
  } catch (e) {
    error.value = e?.message || '读取验证方式失败，请稍后重试'
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
  error.value = ''
  if (next === 'totp') nextTick(() => otpRef.value?.focus())
}

async function sendCode() {
  if (sending.value || remaining.value > 0) return
  sending.value = true
  error.value = ''
  try {
    await consoleFetch(SEND_URL, { method: 'POST' })
    codeSent.value = true
    startCountdown()
    nextTick(() => otpRef.value?.focus())
  } catch (e) {
    if (e?.code === 'resend_too_soon' || e?.code === 'rate_limited') {
      if (e.retryAfterSeconds > 0) startCountdown(e.retryAfterSeconds)
    }
    error.value = e?.message || '验证码发送失败，请稍后重试'
  } finally {
    sending.value = false
  }
}

async function submit() {
  if (!canSubmit.value) return
  busy.value = true
  error.value = ''
  check.value = { status: '', message: '' }
  try {
    const credential = method.value === 'password' ? password.value : code.value.trim()
    const payload = await consoleFetch(VERIFY_URL, {
      method: 'POST',
      body: JSON.stringify({ method: method.value, credential }),
    })
    emit('verified', payload?.token || '')
    emit('update:show', false)
  } catch (e) {
    if (e?.code === 'invalid_code' || e?.code === 'totp_invalid' || e?.code === 'current_password_incorrect') {
      check.value = { status: 'error', message: e.message || '验证不通过' }
      if (method.value !== 'password') {
        code.value = ''
        nextTick(() => otpRef.value?.focus())
      }
    } else {
      error.value = e?.message || '验证失败，请稍后重试'
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
    :actions="actions"
    @update:show="emit('update:show', $event)"
  >
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
        @keyup.enter="submit"
      />
    </div>

    <div v-else-if="method === 'email'" class="field">
      <div class="field-row">
        <NInput
          v-model:value="code"
          maxlength="6"
          placeholder="6 位验证码"
          :disabled="busy"
          @keyup.enter="submit"
        />
        <button
          class="app-btn app-btn--outline app-btn--rect send-btn"
          type="button"
          :disabled="sending || remaining > 0"
          @click="sendCode"
        >
          <NIcon :component="ArrowClockwise24Regular" :size="13" />
          {{ sending ? '发送中…' : remaining > 0 ? `${remaining}s` : codeSent ? '重新发送' : '发送' }}
        </button>
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
      />
      <p class="field-hint">打开手机上的身份验证器 App，输入它当前显示的 6 位动态码</p>
    </div>

    <p v-if="check.message" class="field-error">{{ check.message }}</p>
    <p v-if="error" class="form-error">{{ error }}</p>
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
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 34px;
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

.form-error {
  margin: 10px 0 0;
  color: var(--destructive);
  font-size: 0.78rem;
}
</style>

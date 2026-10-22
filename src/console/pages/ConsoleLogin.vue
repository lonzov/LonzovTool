<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NCheckbox, NForm, NIcon } from 'naive-ui'
import { ArrowClockwise24Regular, ChevronLeft24Regular, Eye24Regular, EyeOff24Regular } from '@vicons/fluent'
import InputOtp from '../../components/ui/InputOtp.vue'
import { ConsoleApiError, useConsoleAuth } from '../consoleAuth.js'
import { useResendCountdown } from '../useResendCountdown.js'
import { useGeetestChallenge } from '../../composables/useGeetestChallenge.js'

const route = useRoute()
const router = useRouter()
const { login, submitTwoFactor, resendTwoFactorCode } = useConsoleAuth()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const error = ref('')
const submitting = ref(false)

/* 人机验证每次登录都要过一遍，验证通过才真正发请求：
   一次性凭证由极验自己的回调给，页面只负责把它塞进请求体 */
let captchaResult = null

const {
  state: captchaState,
  open: openCaptcha,
  reset: resetCaptcha,
} = useGeetestChallenge({
  onSuccess: (result) => {
    captchaResult = result
    submitCredentials()
  },
  onCancel: () => {
    captchaResult = null
  },
  onError: () => {
    captchaResult = null
    error.value = '人机验证出错了，请刷新页面重试'
  },
})

/* 第二步的 challenge 只留在内存：它等于「密码已经通过」，落盘就是在本地留一把可重放的钥匙。
   任何离开第二步的路径都要清掉它，别让下一次提交带上作废的凭证 */
const challenge = ref('')
const maskedEmail = ref('')
const code = ref('')
const codeCheck = ref({ status: '', message: '' })
const rememberDevice = ref(false)
const resending = ref(false)
const otpRef = ref(null)
const isCodeStep = computed(() => !!challenge.value)
const { remaining: resendSeconds, start: startResend, reset: resetResend } = useResendCountdown()

/* 登录被拒的原因分三类：账密错误、账号本身不可用、账号没有任何控制台权限。
   后两类服务端也会给文案，但账号状态属于高频排障场景，这里单独把话说明白 */
const LOGIN_ERROR_TEXT = {
  account_disabled: '账号已被停用，请联系管理员恢复',
  no_permission: '该账号没有控制台权限，请联系管理员分配角色',
}

/* 这两个错误下 challenge 已经作废，留在第二步只会让用户反复试同一个死码 */
const CODE_ABORT_TEXT = {
  challenge_invalid: '验证已失效，请重新登录',
  code_attempts_exhausted: '验证码尝试次数已用完，请重新登录',
}

/* 限流是服务端状态，只有真被限流时才提示，并给出 Retry-After 里的确切等待时间 */
const lockoutSeconds = ref(0)
let lockoutTimer = null

const canSubmit = computed(
  () => !!email.value.trim() && !!password.value && !submitting.value && lockoutSeconds.value === 0,
)
const canSubmitCode = computed(() => /^\d{6}$/.test(code.value) && !submitting.value)

/* 剩这么多机会时开始提醒，再晚就只剩最后一次了 */
const ATTEMPTS_WARN_AT = 5

const codeSentText = computed(() =>
  maskedEmail.value ? `验证码已发送至 ${maskedEmail.value}` : '验证码已发送至你的邮箱',
)
const submitText = computed(() => {
  if (isCodeStep.value) return submitting.value ? '验证中…' : '验证'
  return submitting.value ? '登录中…' : '登录'
})

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds} 秒`
  return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`
}

/**
 * 账密失败的文案在这里组织：服务端只给「还剩几次」这个数字。
 * 剩得多就不打扰用户，进入倒数才开始提醒。
 */
function describeLoginFailure(failure) {
  const text = LOGIN_ERROR_TEXT[failure.code] || failure.message
  const remaining = failure.meta?.attempts_remaining
  const showRemaining =
    failure.code === 'invalid_credentials' &&
    Number.isInteger(remaining) &&
    remaining > 0 &&
    remaining <= ATTEMPTS_WARN_AT

  return showRemaining ? `${text}，还可尝试 ${remaining} 次` : text
}

const lockoutText = computed(() =>
  lockoutSeconds.value > 0
    ? `登录尝试过于频繁，请在 ${formatDuration(lockoutSeconds.value)} 后重试`
    : '',
)

function startLockout(seconds) {
  stopLockout()
  lockoutSeconds.value = seconds
  lockoutTimer = setInterval(() => {
    lockoutSeconds.value -= 1
    if (lockoutSeconds.value <= 0) stopLockout()
  }, 1000)
}

function stopLockout() {
  if (lockoutTimer) clearInterval(lockoutTimer)
  lockoutTimer = null
  lockoutSeconds.value = 0
}

onBeforeUnmount(stopLockout)

// 改动任一字段即撤掉上一次的报错，避免"改完了错误还挂着"
watch([email, password], () => {
  error.value = ''
})

function resolveRedirect() {
  return typeof route.query.redirect === 'string' ? route.query.redirect : '/console'
}

function enterCodeStep(result) {
  challenge.value = result.challenge
  maskedEmail.value = result.maskedEmail
  code.value = ''
  codeCheck.value = { status: '', message: '' }
  // 免验证是这台设备的一次性授权选择，每次进第二步都从「不勾选」开始
  rememberDevice.value = false
  error.value = ''
  // 验证码刚发出去，重发按钮先按住一个冷却窗口
  startResend()
}

function backToCredentials(text) {
  challenge.value = ''
  maskedEmail.value = ''
  code.value = ''
  codeCheck.value = { status: '', message: '' }
  rememberDevice.value = false
  resetResend()
  error.value = text
}

function handleSubmit() {
  return isCodeStep.value ? submitCode() : startLogin()
}

/* 第一步：先过表单与闸门，再唤人机验证；验证通过的回调里才发登录请求 */
function startLogin() {
  if (!canSubmit.value) return
  error.value = ''
  captchaResult = null
  if (captchaState.value === 'failed') {
    error.value = '人机验证组件加载失败，请刷新页面重试'
    return
  }
  if (!openCaptcha()) {
    error.value = '人机验证还没准备好，请稍等片刻'
  }
}

async function submitCredentials() {
  if (!canSubmit.value) return
  error.value = ''
  submitting.value = true
  try {
    const result = await login(email.value, password.value, captchaResult)
    if (result?.need2fa) {
      if (!result.challenge) {
        error.value = '验证码下发失败，请重新登录'
        return
      }
      enterCodeStep(result)
      return
    }
    router.replace(resolveRedirect())
  } catch (e) {
    if (e instanceof ConsoleApiError && e.code === 'rate_limited') {
      // 服务端给出等待时间才倒计时；拿不到就只展示文案，不做假倒计时
      if (e.retryAfterSeconds > 0) startLockout(e.retryAfterSeconds)
      error.value = e.retryAfterSeconds > 0 ? '' : e.message
    } else if (e instanceof ConsoleApiError && e.code === 'captcha_failed') {
      // 一次性凭证已经作废，重过一次验证；提示文案由服务端给，避免两处口径分叉
      resetCaptcha()
      captchaResult = null
      error.value = e.message || '人机验证未通过，请重试'
    } else if (e instanceof ConsoleApiError) {
      error.value = describeLoginFailure(e)
    } else {
      error.value = '登录失败，请稍后重试'
    }
  } finally {
    submitting.value = false
  }
}

async function submitCode() {
  if (!canSubmitCode.value) return
  codeCheck.value = { status: '', message: '' }
  submitting.value = true
  try {
    await submitTwoFactor(challenge.value, code.value, rememberDevice.value)
    router.replace(resolveRedirect())
  } catch (e) {
    handleCodeFailure(e)
  } finally {
    submitting.value = false
  }
}

/** 验证码错误就近挂在输入框下方；凭证或次数作废则退回第一步，别让人对着死码重试 */
function handleCodeFailure(failure) {
  if (!(failure instanceof ConsoleApiError)) {
    error.value = '验证失败，请稍后重试'
    return
  }
  if (failure.code === 'invalid_code') {
    const remaining = failure.meta?.remaining
    codeCheck.value = {
      status: 'error',
      message:
        Number.isInteger(remaining) && remaining > 0
          ? `验证码错误，还可尝试 ${remaining} 次`
          : '验证码错误，请重新输入',
    }
    code.value = ''
    // 报错后光标退回输入框，省掉用户再点一次；等本轮提交的禁用态解除再聚焦
    nextTick(() => otpRef.value?.focus())
    return
  }
  if (CODE_ABORT_TEXT[failure.code]) {
    backToCredentials(CODE_ABORT_TEXT[failure.code])
    return
  }
  error.value = failure.message || '验证失败，请稍后重试'
}

// 改动验证码即撤掉上一次的报错。报错后值会被清空，空值不该反过来触发清空，故只认非空变更
watch(code, (val) => {
  if (val && codeCheck.value.status) codeCheck.value = { status: '', message: '' }
})

async function handleResend() {
  if (resendSeconds.value > 0 || resending.value) return
  resending.value = true
  try {
    await resendTwoFactorCode(challenge.value)
    startResend()
    codeCheck.value = { status: '', message: '' }
  } catch (e) {
    if (e instanceof ConsoleApiError && (e.code === 'resend_too_soon' || e.code === 'rate_limited')) {
      // 服务端还有剩余冷却就按它给的时间按住按钮，拿不到就只提示不编造倒计时
      if (e.retryAfterSeconds > 0) startResend(e.retryAfterSeconds)
      error.value = e.message || '验证码刚发出，请稍后重试'
      return
    }
    if (e instanceof ConsoleApiError && CODE_ABORT_TEXT[e.code]) {
      backToCredentials(CODE_ABORT_TEXT[e.code])
      return
    }
    error.value = e?.message || '验证码发送失败，请稍后重试'
  } finally {
    resending.value = false
  }
}
</script>

<template>
  <div class="console-login">
    <div class="login-stack">
      <button v-if="isCodeStep" class="back-link" type="button" @click="backToCredentials('')">
        <NIcon :component="ChevronLeft24Regular" :size="14" />
        <span>返回上一步</span>
      </button>

      <NForm class="login-card" label-placement="top" @submit.prevent="handleSubmit">
        <div class="card-header">
          <h1 class="card-title">{{ isCodeStep ? '两步验证' : '控制台登录' }}</h1>
          <p class="card-desc">
            {{ isCodeStep ? codeSentText : '仅拥有控制台权限的账号可登录' }}
          </p>
        </div>

        <div class="card-body">
          <template v-if="isCodeStep">
            <div class="field">
              <div class="code-label-row">
                <span class="field-label">输入验证码</span>
                <button
                  class="app-btn app-btn--outline app-btn--rect resend-btn"
                  type="button"
                  :disabled="resendSeconds > 0 || resending"
                  @click="handleResend"
                >
                  <NIcon :component="ArrowClockwise24Regular" :size="13" />
                  <span>{{ resendSeconds > 0 ? `重新发送 ${resendSeconds}` : '重新发送' }}</span>
                </button>
              </div>
              <InputOtp
                ref="otpRef"
                v-model:value="code"
                :status="codeCheck.status"
                :autofocus="true"
                :disabled="submitting"
              />
              <p v-if="codeCheck.message" class="field-error">{{ codeCheck.message }}</p>
            </div>

            <NCheckbox
              v-model:checked="rememberDevice"
              class="remember-option"
              :disabled="submitting"
            >
              30 天内在此设备免验证
            </NCheckbox>
          </template>

          <template v-else>
            <div class="field">
              <label class="field-label" for="console-email">邮箱</label>
              <input
                id="console-email"
                v-model="email"
                class="field-input"
                type="email"
                autocomplete="email"
                spellcheck="false"
                placeholder="请输入邮箱地址"
                :disabled="submitting"
              />
            </div>

            <div class="field">
              <label class="field-label" for="console-password">密码</label>
              <div class="field-control">
                <input
                  id="console-password"
                  v-model="password"
                  class="field-input field-input--action"
                  :type="showPassword ? 'text' : 'password'"
                  autocomplete="current-password"
                  placeholder="请输入密码"
                  :disabled="submitting"
                  @keyup.enter="handleSubmit"
                />
                <button
                  class="field-action"
                  type="button"
                  :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                  @click="showPassword = !showPassword"
                >
                  <NIcon :component="showPassword ? EyeOff24Regular : Eye24Regular" :size="16" />
                </button>
              </div>
            </div>
          </template>

          <p v-if="lockoutText" class="login-lockout" role="alert">{{ lockoutText }}</p>
          <p v-else-if="error" class="login-error" role="alert">{{ error }}</p>
        </div>

        <div class="card-footer">
          <button
            class="login-submit"
            type="submit"
            :disabled="isCodeStep ? !canSubmitCode : !canSubmit"
          >
            {{ submitText }}
          </button>
          <p v-if="isCodeStep" class="card-note">
            没收到？检查垃圾邮件，或稍等片刻后重新发送。
          </p>
        </div>
      </NForm>
    </div>
  </div>
</template>

<style scoped>
.console-login {
  max-width: 1200px;
  padding-top: 24px;
}

/* 卡片与卡外的返回入口共用一条 360px 的中缝，返回才会和卡片左边缘对齐 */
.login-stack {
  max-width: 360px;
  margin: 3vh auto 0;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-bottom: 10px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--muted-foreground);
  font-size: 0.78rem;
  font-family: inherit;
  line-height: 1.4;
  cursor: pointer;
  transition: color 0.2s ease;
}

.back-link:hover {
  color: var(--foreground);
}

.login-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  /* 页脚分割线要贴到卡片边缘，故不在卡片上留内边距 */
  overflow: hidden;
  transition: background-color 0.4s ease, border-color 0.4s ease;
}

.card-header {
  padding: 18px 18px 0;
}

.card-title {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
  color: var(--foreground);
  margin: 0;
  transition: color 0.4s ease;
}

.card-desc {
  font-size: 0.86rem;
  line-height: 1.5;
  color: var(--muted-foreground);
  margin: 4px 0 0;
  overflow-wrap: anywhere;
  transition: color 0.4s ease;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 18px 18px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 0.86rem;
  font-weight: 500;
  color: var(--foreground);
  transition: color 0.4s ease;
}

/* 标签与重发按钮同一行：重发是次要操作，靠右与标签基线对齐 */
.code-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

/* 重发按钮与「输入验证码」同一行：高度对齐文字行高（22px），行内密度才像 shadcn 那样紧凑 */
.resend-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px;
  /* 圆角取 xs：sm 在 squircle 缩放后会接近胶囊 */
  border-radius: var(--radius-xs);
  border-color: var(--border-strong);
  background: var(--muted);
  color: var(--foreground);
  font-size: 0.75rem;
  line-height: 1;
}

.resend-btn:hover:not(:disabled) {
  background: var(--accent);
}

.field-error {
  margin: 0;
  color: var(--destructive);
  font-size: 0.78rem;
  line-height: 1.45;
  transition: color 0.4s ease;
}

.field-control {
  position: relative;
  display: flex;
  align-items: center;
}

.field-input {
  width: 100%;
  height: 36px;
  padding: 0 10px;
  box-sizing: border-box;
  background: var(--input-background);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--foreground);
  font-size: 0.82rem;
  font-family: inherit;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, color 0.4s ease,
    background-color 0.4s ease;
}

.field-input::placeholder {
  color: var(--subtle-foreground);
}

.field-input:focus {
  outline: none;
  border-color: var(--ring);
  box-shadow: 0 0 0 2px var(--accent);
}

.field-input:disabled {
  color: var(--disabled-foreground);
  cursor: not-allowed;
}

.field-input--action {
  padding-right: 32px;
}

/* 免验证是可选操作，字号收到卡片的紧凑尺度（配色仍由 Naive 主题负责） */
.remember-option {
  font-size: 0.82rem;
}

.field-action {
  position: absolute;
  right: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--subtle-foreground);
  cursor: pointer;
  transition: color 0.2s ease;
}

.field-action:hover {
  color: var(--foreground);
}

.login-error,
.login-lockout {
  font-size: 0.78rem;
  line-height: 1.45;
  margin: 0;
  transition: color 0.4s ease;
}

.login-error {
  color: var(--destructive);
}

/* 限流是状态而非字段错误，用警告色与错误区分开 */
.login-lockout {
  color: var(--warning);
}

.card-footer {
  padding: 14px 18px 16px;
  border-top: 1px solid var(--border);
  transition: border-color 0.4s ease;
}

.card-note {
  margin: 10px 0 0;
  color: var(--muted-foreground);
  font-size: 0.78rem;
  line-height: 1.5;
  text-align: center;
  transition: color 0.4s ease;
}

.login-submit {
  width: 100%;
  height: 36px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--primary);
  color: var(--primary-foreground);
  font-size: 0.86rem;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.login-submit:hover:not(:disabled) {
  opacity: 0.88;
}

.login-submit:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* 紧凑是为桌面端的观感服务，触屏上把控件放大回可点尺寸 */
@media (max-width: 560px) {
  .login-stack {
    margin-top: 2vh;
  }

  .field-input,
  .login-submit {
    height: 36px;
  }
}
</style>

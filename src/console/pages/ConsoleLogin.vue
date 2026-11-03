<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NCheckbox, NForm, NIcon } from 'naive-ui'
import { ArrowClockwise24Regular, ChevronLeft24Regular, Eye24Regular, EyeOff24Regular } from '@vicons/fluent'
import InputOtp from '../../components/ui/InputOtp.vue'
import { ConsoleApiError, useConsoleAuth } from '../consoleAuth.js'
import { useResendCountdown } from '../useResendCountdown.js'
import { useGeetestChallenge } from '../../composables/useGeetestChallenge.js'
import TurnstileFallback from '../../components/TurnstileFallback.vue'

const route = useRoute()
const router = useRouter()
const { login, submitTwoFactor, resendTwoFactorCode } = useConsoleAuth()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const error = ref('')
const submitting = ref(false)

/* 人机验证每次登录都要过一遍，验证通过才真正发请求：
   一次性凭证由极验自己的回调给，页面只负责把它塞进请求体。
   极验不可用时服务端会回 captcha_fallback_required，此时改用 Turnstile。 */
let captchaResult = null
let fallbackTicket = ''
const turnstileVisible = ref(false)
const turnstileRef = ref(null)

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
/* 第二段的方式由用户选：服务端只列出可用项，选完才决定发不发信、输什么码 */
const methods = ref([])
const method = ref('')
const sendingCode = ref(false)
const codeSent = ref(false)

const METHOD_LABEL = {
  totp: '身份验证器',
  email: '邮箱验证码',
  recovery: '恢复码',
}

const availableMethods = computed(() =>
  methods.value.filter((item) => item === 'totp' || item === 'email'),
)
/* 只剩一种方式时不用选，直接进入该方式；两种都有才让用户点 */
const needMethodChoice = computed(() => !method.value && availableMethods.value.length > 1)
const isRecovery = computed(() => method.value === 'recovery')
const canSendCode = computed(
  () => !sendingCode.value && resendSeconds.value === 0 && !!challenge.value,
)
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
  totp_not_enabled: '该账号没有开启身份验证器，请换一种方式',
}

/* 这些错误留在第二步：清空输入让用户重试，但不作废 challenge */
const CODE_RETRY_TEXT = {
  invalid_code: '验证码不正确，请重新输入',
  code_not_sent: '请先发送验证码',
  totp_invalid: '动态码不正确，请查看验证器后重新输入',
  totp_replayed: '这枚动态码已经用过，请等下一枚',
  recovery_invalid: '恢复码无效或已使用',
}

/* 限流是服务端状态，只有真被限流时才提示，并给出 Retry-After 里的确切等待时间 */
const lockoutSeconds = ref(0)
let lockoutTimer = null

const canSubmit = computed(
  () => !!email.value.trim() && !!password.value && !submitting.value && lockoutSeconds.value === 0,
)
const canSubmitCode = computed(() => {
  if (submitting.value || !method.value) return false
  if (isRecovery.value) return code.value.trim().length >= 8
  return /^\d{6}$/.test(code.value)
})

/* 剩这么多机会时开始提醒，再晚就只剩最后一次了 */
const ATTEMPTS_WARN_AT = 5

const codeSentText = computed(() => {
  if (method.value === 'totp') return '打开身份验证器，输入当前显示的 6 位动态码'
  if (method.value === 'recovery') return '输入一枚恢复码（形如 abc12-def34）'
  if (method.value === 'email') {
    if (!codeSent.value && resendSeconds.value > 0) {
      return `发送验证码过于频繁，请 ${formatDuration(resendSeconds.value)} 后重试`
    }
    if (!codeSent.value) return maskedEmail.value ? `验证码将发送至 ${maskedEmail.value}` : '验证码将发送至你的邮箱'
    return maskedEmail.value ? `验证码已发送至 ${maskedEmail.value}` : '验证码已发送至你的邮箱'
  }
  return '请选择一种验证方式'
})
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
  methods.value = Array.isArray(result.methods) ? result.methods : ['email']
  codeSent.value = false
  // 只有一种方式时没有"选择"可言；两种都有就等用户点
  method.value = availableMethods.value.length === 1 ? availableMethods.value[0] : ''
  code.value = ''
  codeCheck.value = { status: '', message: '' }
  // 免验证是这台设备的一次性授权选择，每次进第二步都从「不勾选」开始
  rememberDevice.value = false
  error.value = ''

  // 服务端会把该邮箱仍在生效的发信冷却带过来；先恢复倒计时，避免进入验证码页
  // 就立刻撞一次 429。没有冷却且只有邮箱一种方式时才自动发信。
  const wait = Number(result.emailResendAfter) || 0
  if (wait > 0) startResend(wait)
  else resetResend()
  if (method.value === 'email' && wait === 0) sendCode()
}

function backToCredentials(text) {
  challenge.value = ''
  maskedEmail.value = ''
  methods.value = []
  method.value = ''
  codeSent.value = false
  code.value = ''
  codeCheck.value = { status: '', message: '' }
  rememberDevice.value = false
  resetResend()
  error.value = text
}

async function chooseMethod(next) {
  if (submitting.value || sendingCode.value) return
  method.value = next
  code.value = ''
  codeCheck.value = { status: '', message: '' }
  error.value = ''
  if (next === 'email') await sendCode()
  if (next !== 'recovery') nextTick(() => otpRef.value?.focus())
}

/** 发送验证码：初次发送与重发是同一个接口，冷却由服务端判定 */
async function sendCode() {
  if (!canSendCode.value) return
  sendingCode.value = true
  error.value = ''
  try {
    await resendTwoFactorCode(challenge.value)
    codeSent.value = true
    startResend()
  } catch (e) {
    if (e instanceof ConsoleApiError && (e.code === 'resend_too_soon' || e.code === 'rate_limited')) {
      if (e.retryAfterSeconds > 0) startResend(e.retryAfterSeconds)
      error.value = e.message || '验证码刚刚发过，请稍后再试'
      return
    }
    if (e instanceof ConsoleApiError && CODE_ABORT_TEXT[e.code]) {
      backToCredentials(CODE_ABORT_TEXT[e.code])
      return
    }
    error.value = e?.message || '验证码发送失败，请稍后再试'
  } finally {
    sendingCode.value = false
  }
}

function handleSubmit() {
  return isCodeStep.value ? submitCode() : startLogin()
}

/* 第一步：先过表单与闸门，再唤人机验证；验证通过的回调里才发登录请求 */
function startLogin() {
  if (!canSubmit.value) return
  error.value = ''
  captchaResult = null
  fallbackTicket = ''
  turnstileVisible.value = false
  if (captchaState.value === 'failed') {
    error.value = '人机验证组件加载失败，请刷新页面重试'
    return
  }
  if (!openCaptcha()) {
    error.value = '人机验证还没准备好，请稍等片刻'
  }
}

async function submitCredentials(turnstileToken = '') {
  if (!canSubmit.value) return
  error.value = ''
  submitting.value = true
  try {
    const fallback = turnstileToken
      ? { turnstileToken, fallbackToken: fallbackTicket }
      : null
    const result = await login(email.value, password.value, captchaResult, fallback)
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
    } else if (e instanceof ConsoleApiError && e.code === 'captcha_fallback_required') {
      // 极验不可用：拿服务端签发的票据换 Turnstile，不把这次请求当失败
      const ticket = e.meta?.fallback_token || ''
      if (!ticket) {
        error.value = '备用验证不可用，请稍后重试'
        return
      }
      fallbackTicket = ticket
      turnstileVisible.value = true
      error.value = ''
    } else if (e instanceof ConsoleApiError && e.code === 'captcha_fallback_invalid') {
      turnstileVisible.value = false
      fallbackTicket = ''
      resetCaptcha()
      captchaResult = null
      error.value = e.message || '备用验证已失效，请重新登录'
    } else if (e instanceof ConsoleApiError && e.code === 'captcha_failed') {
      if (e.meta?.provider === 'turnstile') {
        // Turnstile 失败后 token 已作废，留在弹窗里让用户重新完成
        turnstileRef.value?.reset()
        turnstileVisible.value = true
        error.value = e.message || '备用验证未通过，请重试'
        return
      }
      // 极验凭证已经作废，重过一次验证；提示文案由服务端给，避免两处口径分叉
      resetCaptcha()
      captchaResult = null
      fallbackTicket = ''
      error.value = e.message || '人机验证未通过，请重试'
    } else if (e instanceof ConsoleApiError && e.code === 'captcha_unavailable') {
      turnstileVisible.value = false
      error.value = e.message || '暂时无法完成人机验证，请稍后重试'
    } else if (e instanceof ConsoleApiError) {
      error.value = describeLoginFailure(e)
    } else {
      error.value = '登录失败，请稍后重试'
    }
  } finally {
    submitting.value = false
  }
}

function onTurnstileSuccess(token) {
  turnstileVisible.value = false
  submitCredentials(token)
}

function closeTurnstile() {
  turnstileVisible.value = false
  fallbackTicket = ''
}

async function submitCode() {
  if (!canSubmitCode.value) return
  codeCheck.value = { status: '', message: '' }
  submitting.value = true
  try {
    await submitTwoFactor(challenge.value, code.value, rememberDevice.value, method.value)
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
  if (CODE_RETRY_TEXT[failure.code]) {
    // 留在第二步：清空输入并重新聚焦，让用户直接再试一次
    codeCheck.value = {
      status: 'error',
      message: CODE_RETRY_TEXT[failure.code],
    }
    code.value = ''
    nextTick(() => otpRef.value?.focus())
    return
  }
  error.value = failure.message || '验证失败，请稍后重试'
}

// 改动验证码即撤掉上一次的报错。报错后值会被清空，空值不该反过来触发清空，故只认非空变更
watch(code, (val) => {
  if (val && codeCheck.value.status) codeCheck.value = { status: '', message: '' }
})

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
            <!-- 方式选择：两种方式都可用时才出现，选完才决定发不发信、输什么码 -->
            <div v-if="needMethodChoice" class="method-picker">
              <button
                v-for="item in availableMethods"
                :key="item"
                class="method-option"
                type="button"
                :disabled="submitting || sendingCode"
                @click="chooseMethod(item)"
              >
                <span class="method-name">{{ METHOD_LABEL[item] }}</span>
                <span class="method-desc">
                  {{ item === 'totp' ? '用手机上的身份验证器 App' : '发送 6 位验证码到邮箱' }}
                </span>
              </button>
              <button
                class="method-link"
                type="button"
                :disabled="submitting"
                @click="chooseMethod('recovery')"
              >
                手机不在身边？用恢复码
              </button>
            </div>

            <div v-else-if="method === 'email'" class="field">
              <div class="code-label-row">
                <span class="field-label">输入验证码</span>
                <button
                  class="app-btn app-btn--outline app-btn--rect resend-btn"
                  type="button"
                  :disabled="!canSendCode"
                  @click="sendCode"
                >
                  <NIcon :component="ArrowClockwise24Regular" :size="13" />
                  <span>
                    {{
                      sendingCode
                        ? '发送中…'
                        : resendSeconds > 0
                          ? `${resendSeconds}s 后重试`
                          : codeSent
                            ? '重新发送'
                            : '发送验证码'
                    }}
                  </span>
                </button>
              </div>
              <InputOtp
                ref="otpRef"
                v-model:value="code"
                :status="codeCheck.status"
                :autofocus="true"
                :disabled="submitting || sendingCode"
              />
              <p v-if="codeCheck.message" class="field-error">{{ codeCheck.message }}</p>
            </div>

            <div v-else-if="method === 'totp'" class="field">
              <span class="field-label">输入动态码</span>
              <InputOtp
                ref="otpRef"
                v-model:value="code"
                :status="codeCheck.status"
                :autofocus="true"
                :disabled="submitting"
              />
              <p v-if="codeCheck.message" class="field-error">{{ codeCheck.message }}</p>
              <button class="method-link" type="button" :disabled="submitting" @click="chooseMethod('email')">
                改用邮箱验证码
              </button>
            </div>

            <div v-else-if="method === 'recovery'" class="field">
              <label class="field-label" for="console-recovery">输入恢复码</label>
              <input
                id="console-recovery"
                v-model="code"
                class="field-input"
                type="text"
                autocomplete="one-time-code"
                spellcheck="false"
                placeholder="abc12-def34"
                :disabled="submitting"
              />
              <p v-if="codeCheck.message" class="field-error">{{ codeCheck.message }}</p>
              <button class="method-link" type="button" :disabled="submitting" @click="chooseMethod('totp')">
                改用身份验证器
              </button>
            </div>

            <NCheckbox
              v-if="method && !isRecovery"
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
          <p v-if="isCodeStep && method === 'email'" class="card-note">
            没收到？检查垃圾邮件，或稍等片刻后重新发送。
          </p>
        </div>
      </NForm>
    </div>

    <TurnstileFallback
      ref="turnstileRef"
      :show="turnstileVisible"
      action="login"
      description="极验服务暂时不可用，请完成下方备用验证后继续登录。"
      @update:show="turnstileVisible = $event"
      @success="onTurnstileSuccess"
      @close="closeTurnstile"
    />
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
/* 方式选择：两张等宽按钮 + 一个低调的备用入口 */
.method-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
}

.method-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card);
  color: var(--foreground);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.method-option:hover:not(:disabled) {
  border-color: var(--border-strong);
  background: var(--accent);
}

.method-option:disabled {
  opacity: 0.6;
  cursor: default;
}

.method-name {
  font-size: 0.875rem;
  font-weight: 500;
}

.method-desc {
  color: var(--muted-foreground);
  font-size: 0.78rem;
}

.method-link {
  align-self: flex-start;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--muted-foreground);
  font-family: inherit;
  font-size: 0.78rem;
  text-decoration: underline;
  cursor: pointer;
  transition: color 0.2s ease;
}

.method-link:hover:not(:disabled) {
  color: var(--foreground);
}

.method-link:disabled {
  opacity: 0.6;
  cursor: default;
}

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

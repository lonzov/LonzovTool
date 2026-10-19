<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NIcon } from 'naive-ui'
import { Eye24Regular, EyeOff24Regular } from '@vicons/fluent'
import { ConsoleApiError, useConsoleAuth } from '../consoleAuth.js'

const route = useRoute()
const router = useRouter()
const { login } = useConsoleAuth()

const username = ref('')
const password = ref('')
const showPassword = ref(false)
const error = ref('')
const submitting = ref(false)

/* 限流是服务端状态，只有真被限流时才提示，并给出 Retry-After 里的确切等待时间 */
const lockoutSeconds = ref(0)
let lockoutTimer = null

const canSubmit = computed(
  () => !!username.value.trim() && !!password.value && !submitting.value && lockoutSeconds.value === 0,
)

/* 剩这么多机会时开始提醒，再晚就只剩最后一次了 */
const ATTEMPTS_WARN_AT = 5

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds} 秒`
  return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`
}

/**
 * 账密失败的文案在这里组织：服务端只给「还剩几次」这个数字。
 * 剩得多就不打扰用户，进入倒数才开始提醒。
 */
function describeLoginFailure(failure) {
  const remaining = failure.meta?.attempts_remaining
  const showRemaining =
    failure.code === 'invalid_credentials' &&
    Number.isInteger(remaining) &&
    remaining > 0 &&
    remaining <= ATTEMPTS_WARN_AT

  return showRemaining ? `${failure.message}，还可尝试 ${remaining} 次` : failure.message
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
watch([username, password], () => {
  error.value = ''
})

async function handleSubmit() {
  if (!canSubmit.value) return
  error.value = ''
  submitting.value = true
  try {
    await login(username.value, password.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/console'
    router.replace(redirect)
  } catch (e) {
    if (e instanceof ConsoleApiError && e.code === 'rate_limited') {
      // 服务端给出等待时间才倒计时；拿不到就只展示文案，不做假倒计时
      if (e.retryAfterSeconds > 0) startLockout(e.retryAfterSeconds)
      error.value = e.retryAfterSeconds > 0 ? '' : e.message
    } else if (e instanceof ConsoleApiError) {
      error.value = describeLoginFailure(e)
    } else {
      error.value = '登录失败，请稍后重试'
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="console-login">
    <form class="login-card" @submit.prevent="handleSubmit">
      <div class="card-header">
        <h1 class="card-title">控制台登录</h1>
        <p class="card-desc">仅管理员账号可进入控制台</p>
      </div>

      <div class="card-body">
        <div class="field">
          <label class="field-label" for="console-username">账号</label>
          <input
            id="console-username"
            v-model="username"
            class="field-input"
            type="text"
            autocomplete="username"
            placeholder="请输入管理员账号"
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

        <p v-if="lockoutText" class="login-lockout" role="alert">{{ lockoutText }}</p>
        <p v-else-if="error" class="login-error" role="alert">{{ error }}</p>
      </div>

      <div class="card-footer">
        <button class="login-submit" type="submit" :disabled="!canSubmit">
          {{ submitting ? '登录中…' : '登录' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.console-login {
  max-width: 1200px;
  padding-top: 24px;
}

.login-card {
  max-width: 360px;
  margin: 3vh auto 0;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  /* 页脚分割线要贴到卡片边缘，故不在卡片上留内边距 */
  overflow: hidden;
  transition: background-color 0.4s ease, border-color 0.4s ease;
}

.card-header {
  padding: 16px 16px 0;
}

.card-title {
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.4;
  color: var(--foreground);
  margin: 0;
  transition: color 0.4s ease;
}

.card-desc {
  font-size: 0.78rem;
  line-height: 1.45;
  color: var(--muted-foreground);
  margin: 3px 0 0;
  transition: color 0.4s ease;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--foreground);
  transition: color 0.4s ease;
}

.field-control {
  position: relative;
  display: flex;
  align-items: center;
}

.field-input {
  width: 100%;
  height: 32px;
  padding: 0 9px;
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
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  transition: border-color 0.4s ease;
}

.login-submit {
  width: 100%;
  height: 32px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--primary);
  color: var(--primary-foreground);
  font-size: 0.82rem;
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
  .login-card {
    margin-top: 2vh;
  }

  .field-input,
  .login-submit {
    height: 36px;
  }
}
</style>

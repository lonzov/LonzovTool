import { computed, ref } from 'vue'
import { ConsoleApiError, consoleFetch, setUnauthorizedHandler } from './consoleRequest.js'

/**
 * 控制台会话状态。
 *
 * 凭证是服务端下发的 HttpOnly Cookie，前端读不到也不需要保存，本地只留账号名与邮箱，
 * 用于展示与路由守卫的体验层判断。会话是否有效一律由 `GET /api/v1/console/me` 判定：
 * 本地痕迹可以伪造，Cookie 上的令牌不能（契约见后端仓库 docs/api.md）。
 *
 * 权限清单与临时密码标记只存内存，不进 localStorage：授权被回收后本地缓存会继续
 * 渲染出点下去就 403 的按钮。
 *
 * 请求与错误映射在 consoleRequest.js，这里只管状态。
 */

const ACCOUNT_KEY = 'console_account'
const LOGIN_URL = '/api/v1/console/login'
const LOGIN_2FA_URL = '/api/v1/console/login/2fa'
const LOGIN_2FA_RESEND_URL = '/api/v1/console/login/2fa/resend'
const ME_URL = '/api/v1/console/me'
const LOGOUT_URL = '/api/v1/console/logout'

function normalizeAccount(info) {
  if (!info || typeof info !== 'object') return null
  const name = typeof info.name === 'string' ? info.name : ''
  const email = typeof info.email === 'string' ? info.email : ''
  if (!name && !email) return null
  return {
    name,
    email,
    roles: Array.isArray(info.roles) ? info.roles.filter((role) => typeof role === 'string') : [],
    totpEnabled: info.totp_enabled === true,
    totpRecoveryGeneratedAt: Number(info.totp_recovery_generated_at) || 0,
  }
}

function readAccount() {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(ACCOUNT_KEY)
    if (!raw) return null
    return normalizeAccount(JSON.parse(raw))
  } catch {
    return null
  }
}

function writeAccount(value) {
  account.value = value
  try {
    if (value) {
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ name: value.name, email: value.email }))
    } else {
      localStorage.removeItem(ACCOUNT_KEY)
    }
  } catch {
    // storage unavailable
  }
}

const account = ref(readAccount())
const permissions = ref([])
const mustChangePassword = ref(false)
/** 权限清单要到 `/me` 回来才可信，导航与页面闸门都以它为前提 */
const permissionsReady = ref(false)
const isAuthenticated = computed(() => !!account.value)

// 会话在别处失效（401）时同步清掉本地痕迹，守卫随即把人挡回登录页
setUnauthorizedHandler(resetSession)

function resetSession() {
  writeAccount(null)
  permissions.value = []
  mustChangePassword.value = false
  permissionsReady.value = false
}

function rememberSession(payload) {
  const info = normalizeAccount(payload?.account)
  writeAccount(info)
  permissions.value = Array.isArray(payload?.permissions) ? payload.permissions : []
  mustChangePassword.value = !!payload?.account?.must_change_password
  permissionsReady.value = true
}

/**
 * 登录有两种正常结局：直接下发会话，或账号开了两步验证时只返回一次性 challenge。
 * 后者绝不能当成功处理 —— 那时没有任何会话，本地记住账号会让路由守卫直接放行。
 * challenge 由调用方留在组件内存里（等同「密码已通过」的凭证，不落盘）。
 */
async function login(email, password, captcha = null, fallback = null) {
  const address = (email || '').trim()
  if (!address || !password) {
    throw new ConsoleApiError('missing_credentials', '请填写邮箱与密码')
  }

  // 人机验证的一次性凭证：服务端每次登录都要校验，缺了直接 403。
  // 降级重试只带 Turnstile token 与服务端签发的票据，不再带已作废的极验结果。
  const body = { email: address, password }
  if (fallback?.turnstileToken) {
    body.turnstile_token = fallback.turnstileToken
    body.fallback_token = fallback.fallbackToken || ''
  } else if (captcha) {
    body.lot_number = captcha.lot_number
    body.captcha_output = captcha.captcha_output
    body.pass_token = captcha.pass_token
    body.gen_time = captcha.gen_time
  }

  const payload = await consoleFetch(LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (payload?.need_2fa) {
    return {
      need2fa: true,
      challenge: typeof payload.challenge === 'string' ? payload.challenge : '',
      maskedEmail: typeof payload.masked_email === 'string' ? payload.masked_email : '',
      // 可用方式由服务端列出，具体选哪个在登录页完成
      methods: Array.isArray(payload.methods) ? payload.methods.filter((m) => typeof m === 'string') : [],
    }
  }

  rememberSession(payload)
  return { need2fa: false, payload }
}

/**
 * 用 challenge 换会话：成功时与直接登录拿到同一份会话响应。
 * remember 为真时服务端额外下发该设备的长期豁免 Cookie，30 天内这台设备登录不再走验证码。
 */
async function submitTwoFactor(challenge, code, remember = false, method = 'email') {
  if (!challenge) {
    throw new ConsoleApiError('challenge_invalid', '验证已失效，请重新登录')
  }
  if (!code) {
    throw new ConsoleApiError('missing_code', '请填写验证码')
  }

  const payload = await consoleFetch(LOGIN_2FA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // method 由用户在选择栏里点出来，服务端只按这种方式校验
    body: JSON.stringify({ challenge, code, method, remember: remember === true }),
  })
  rememberSession(payload)
  return payload
}

/**
 * 发送/重发邮箱验证码。首次发送也走这里：用户在第二段选了"验证码"才会真的发信。
 * 冷却由服务端判定，60 秒内的重复请求返回 429 resend_too_soon。
 */
async function resendTwoFactorCode(challenge) {
  if (!challenge) {
    throw new ConsoleApiError('challenge_invalid', '验证已失效，请重新登录')
  }

  return consoleFetch(LOGIN_2FA_RESEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challenge }),
  })
}

/** 进入控制台或改完密码后向服务端确认会话、刷新权限与临时密码标记 */
async function verify() {
  const payload = await consoleFetch(ME_URL)
  rememberSession(payload)
  return payload
}

async function logout() {
  try {
    await consoleFetch(LOGOUT_URL, { method: 'POST' })
  } finally {
    // 解绑是本地最终动作：服务端请求失败也不该把用户留在登录态里
    resetSession()
  }
}

export function useConsoleAuth() {
  return {
    account,
    permissions,
    mustChangePassword,
    permissionsReady,
    isAuthenticated,
    login,
    submitTwoFactor,
    resendTwoFactorCode,
    verify,
    logout,
  }
}

export { ConsoleApiError }

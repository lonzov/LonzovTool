import { computed, ref } from 'vue'
import { ConsoleApiError, consoleFetch, setUnauthorizedHandler } from './consoleRequest.js'

/**
 * 控制台会话状态。
 *
 * 凭证是服务端下发的 HttpOnly Cookie，前端读不到也不需要保存，本地只留账号名与角色，
 * 用于展示与路由守卫的体验层判断。会话是否有效一律由 `GET /api/v1/console/me` 判定：
 * 本地痕迹可以伪造，Cookie 上的令牌不能（契约见后端仓库 docs/api.md）。
 *
 * 请求与错误映射在 consoleRequest.js，这里只管状态。
 */

const ACCOUNT_KEY = 'console_account'
const LOGIN_URL = '/api/v1/console/login'
const ME_URL = '/api/v1/console/me'
const LOGOUT_URL = '/api/v1/console/logout'

function readAccount() {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(ACCOUNT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && parsed.name ? parsed : null
  } catch {
    return null
  }
}

function writeAccount(value) {
  account.value = value
  try {
    if (value) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(value))
    else localStorage.removeItem(ACCOUNT_KEY)
  } catch {
    // storage unavailable
  }
}

const account = ref(readAccount())
const isAuthenticated = computed(() => !!account.value)

// 会话在别处失效（401）时同步清掉本地痕迹，守卫随即把人挡回登录页
setUnauthorizedHandler(() => writeAccount(null))

function rememberSession(payload) {
  writeAccount({ name: payload.user.name, role: payload.user.role })
}

async function login(username, password) {
  const name = (username || '').trim()
  if (!name || !password) {
    throw new ConsoleApiError('missing_credentials', '请填写账号与密码')
  }

  const payload = await consoleFetch(LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: name, password }),
  })
  rememberSession(payload)
  return payload
}

/** 进入控制台时向服务端确认会话仍然有效 */
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
    writeAccount(null)
  }
}

export function useConsoleAuth() {
  return { account, isAuthenticated, login, verify, logout }
}

export { ConsoleApiError }

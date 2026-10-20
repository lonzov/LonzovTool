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

async function login(email, password) {
  const address = (email || '').trim()
  if (!address || !password) {
    throw new ConsoleApiError('missing_credentials', '请填写邮箱与密码')
  }

  const payload = await consoleFetch(LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: address, password }),
  })
  rememberSession(payload)
  return payload
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
    verify,
    logout,
  }
}

export { ConsoleApiError }

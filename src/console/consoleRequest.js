/**
 * 控制台请求层：不依赖 Vue，可脱离组件单独验证错误映射。
 *
 * 同源自动带 Cookie，写操作回填 double-submit CSRF 头。
 */

/** 请求超时。CF 免费版对大陆不稳，网络卡住时不该让按钮一直转 */
const REQUEST_TIMEOUT_MS = 15000

/** 拿不到错误信封时按状态码兜底；前端只认 code，不看状态码 */
const STATUS_CODES = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  429: 'rate_limited',
}

/**
 * 带 code 的接口错误：调用方按 code 分支，message 只用于展示。
 * meta 是该错误特有的机器可读数据（如登录还剩几次机会），文案由调用方组织。
 * retryAfterSeconds 仅在服务端给出 Retry-After 时有值（目前用于登录限流）。
 */
export class ConsoleApiError extends Error {
  constructor(code, message, status = 0, retryAfterSeconds = 0, meta = null) {
    super(message)
    this.name = 'ConsoleApiError'
    this.code = code
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
    this.meta = meta
  }
}

/** 会话失效时的回调，由持有会话状态的一侧注册（见 consoleAuth） */
let unauthorizedHandler = null

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler
}

function readCookie(name) {
  if (typeof document === 'undefined' || !document.cookie) return ''
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : ''
}

function parseRetryAfter(response) {
  const raw = Number(response.headers.get('Retry-After'))
  return Number.isFinite(raw) && raw > 0 ? Math.ceil(raw) : 0
}

/**
 * 失败一律抛 ConsoleApiError，code 的优先级是「服务端错误信封 → HTTP 状态码 → 网络/超时」：
 * 信封里的 code 是契约的一部分，只有拿不到信封（网关拦截、离线、超时）时前端才自己兜底。
 */
export async function consoleFetch(path, options = {}) {
  // 上传大图比普通读写慢，允许调用方单独放宽超时；其余请求保持默认值
  const { timeoutMs = REQUEST_TIMEOUT_MS, ...fetchOptions } = options
  const method = (fetchOptions.method || 'GET').toUpperCase()
  const headers = { Accept: 'application/json', ...fetchOptions.headers }
  if (method !== 'GET' && method !== 'HEAD') {
    headers['X-CSRFToken'] = readCookie('csrftoken')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response
  try {
    response = await fetch(path, { ...fetchOptions, method, headers, signal: controller.signal })
  } catch {
    // 主动 abort 与服务端不可达都落到这里，对用户是同一件事：这次请求没发出去
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    throw new ConsoleApiError(
      offline ? 'offline' : 'network_error',
      offline ? '当前网络不可用，请检查网络后重试' : '无法连接服务器，请稍后重试',
    )
  } finally {
    clearTimeout(timer)
  }

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const code = payload?.error?.code || STATUS_CODES[response.status] || 'server_error'
    const message = payload?.error?.message || '服务暂时不可用，请稍后重试'
    if (code === 'unauthorized') unauthorizedHandler?.()
    throw new ConsoleApiError(
      code,
      message,
      response.status,
      parseRetryAfter(response),
      payload?.error?.meta || null,
    )
  }
  // 2xx 却不是 JSON：边缘质询页、网关页面都可能这样返回，绝不能把 null 交给调用方
  if (payload === null) {
    throw new ConsoleApiError('invalid_response', '服务返回了无法解析的内容，请稍后重试', response.status)
  }
  return payload
}

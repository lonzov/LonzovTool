import { getDiscreteMessage } from '../utils/discreteMessage.js'

/**
 * 客户端接口代次与「当前页面代码已过期」的处置。
 *
 * 后端下线旧接口后，旧壳子（SW 缓存的上一版页面）会继续请求已删除的路径并拿到
 * `410 endpoint_retired`，或在 `/versions` 里发现 `min_supported` 已高于自身代次。
 * 这类失败证明跑的是过期代码，不能像普通网络错误那样静默兜底（数据会永久停在旧版本），
 * 也不能强制刷新（用户可能正在填表单或使用工具页）。统一处置是一次提示 + 触发一次更新检查，
 * 由调用方随后停止轮询，不再对已淘汰的接口无限重试。
 *
 * 不做 Vue 组件依赖：请求层与站点数据轮询都要能用。
 */

/** 本前端产物对齐的接口代次。后端提高 min_supported 后，旧产物会走到过期分支。 */
const API_GENERATION = 'v1'

let outdated = false
let updateCheck = null

/** 把 v1 / 1 这类代次写法归一成数字；无法识别返回 null */
function generationNumber(value) {
  const match = String(value ?? '').trim().match(/^v?(\d+)$/i)
  return match ? Number(match[1]) : null
}

/**
 * `min_supported` 高于当前产物代次时返回 true。
 * 任一侧格式无法识别时按未过期处理：宁可少提示一次，也不要把正常客户端误判成过期。
 * @param {unknown} minSupported 接口公布的最低代次
 * @param {string} [current] 当前产物代次
 */
export function isApiGenerationOutdated(minSupported, current = API_GENERATION) {
  const min = generationNumber(minSupported)
  const own = generationNumber(current)
  if (min === null || own === null) return false
  return own < min
}

export function isClientOutdated() {
  return outdated
}

/** 由入口注册一次更新检查（复用 useSWUpdate 的更新弹窗链路） */
export function setClientUpdateCheck(check) {
  updateCheck = typeof check === 'function' ? check : null
}

/**
 * 标记当前页面代码已被接口淘汰。只提示并检查更新，不刷新页面；
 * 同一页面生命周期内只处理一次，避免轮询与连续请求反复打扰。
 * @param {string} reason 触发来源，仅用于日志排查
 */
export function markClientOutdated(reason) {
  if (outdated) return
  outdated = true
  console.warn(`[client] 当前页面版本已被接口淘汰（${reason}），停止轮询并检查更新`)
  try {
    updateCheck?.()
  } catch {
    // 更新检查失败不影响下面的提示
  }
  const message = getDiscreteMessage()
  message?.warning('当前页面版本过旧，请刷新页面后继续使用', {
    duration: 10000,
    closable: true,
  })
}

import { ref } from 'vue'
import { consoleFetch, setVerificationRequiredHandler } from './consoleRequest.js'

/**
 * 低敏感操作的短时信任。
 *
 * 服务端在身份确认成功后开启 3 小时窗口：这段时间里内容编辑、账号管理、设备下线都不再打断。
 * 信任是账号级、存在服务端的，这里只缓存到期时间用于"要不要弹窗"的判断——
 * 真正放行与否始终由接口决定，前端缓存失效最多多弹一次窗。
 */
const OPTIONS_URL = '/api/v1/console/verify/options'
const DEFAULT_DESCRIPTION = '为了账号的安全，请先确认是你本人'
const RECOVERY_DESCRIPTION = '需要重新确认身份后再操作'

const trustUntil = ref(0)
const modalOpen = ref(false)
const modalDescription = ref(DEFAULT_DESCRIPTION)
let loaded = false
// 同一时刻只保留一次确认：并发调用共享同一个 Promise，后发起的不会把先发起的 resolver 顶掉
let pending = null

function trusted() {
  return trustUntil.value * 1000 > Date.now()
}

async function refresh() {
  try {
    const payload = await consoleFetch(OPTIONS_URL)
    trustUntil.value = Number(payload?.trust_until) || 0
  } catch {
    // 读不到就当作未信任：后面该弹的窗照弹，不阻塞操作
  }
  loaded = true
}

function requestVerification(description) {
  if (pending) {
    if (description) modalDescription.value = description
    return pending.promise
  }
  modalDescription.value = description || DEFAULT_DESCRIPTION
  modalOpen.value = true
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  pending = { promise, resolve }
  return promise
}

/**
 * 确认可以继续写操作：返回 true 表示已信任（或刚验证通过），false 表示用户取消。
 * 信任窗口内直接返回，不打扰用户。
 */
async function ensureTrust() {
  if (trusted()) return true
  if (!loaded) await refresh()
  if (trusted()) return true
  return requestVerification(DEFAULT_DESCRIPTION)
}

/** 验证弹窗通过后回填信任窗口；token 由调用方按需带给一次性凭证接口。 */
function resolveVerification() {
  const done = pending
  pending = null
  refresh().then(() => {
    done?.resolve(true)
    modalDescription.value = DEFAULT_DESCRIPTION
  })
}

function cancelVerification() {
  const done = pending
  pending = null
  modalDescription.value = DEFAULT_DESCRIPTION
  done?.resolve(false)
}

/**
 * 服务端判定需要重新确认身份：本地信任可能已过期或已在服务端被提前作废。
 * 清本地窗口并打开确认弹窗，不重放失败的请求（重放会重复提交），用户确认后重试即可。
 */
function recoverVerification() {
  trustUntil.value = 0
  requestVerification(RECOVERY_DESCRIPTION)
}

setVerificationRequiredHandler(recoverVerification)

export function useSensitiveTrust() {
  return {
    modalOpen,
    modalDescription,
    refresh,
    ensureTrust,
    resolveVerification,
    cancelVerification,
  }
}

import { ref } from 'vue'
import { consoleFetch } from './consoleRequest.js'

/**
 * 低敏感操作的短时信任。
 *
 * 服务端在身份确认成功后开启 3 小时窗口：这段时间里内容编辑、账号管理、设备下线都不再打断。
 * 信任是账号级、存在服务端的，这里只缓存到期时间用于"要不要弹窗"的判断——
 * 真正放行与否始终由接口决定，前端缓存失效最多多弹一次窗。
 */
const OPTIONS_URL = '/api/v1/console/verify/options'

const trustUntil = ref(0)
const modalOpen = ref(false)
let resolver = null
let loaded = false

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

/**
 * 确认可以继续写操作：返回 true 表示已信任（或刚验证通过），false 表示用户取消。
 * 信任窗口内直接返回，不打扰用户。
 */
async function ensureTrust() {
  if (trusted()) return true
  if (!loaded) await refresh()
  if (trusted()) return true

  return new Promise((resolve) => {
    resolver = resolve
    modalOpen.value = true
  })
}

/** 验证弹窗通过后回填信任窗口；token 由调用方按需带给一次性凭证接口。 */
function resolveVerification() {
  const done = resolver
  resolver = null
  refresh().then(() => {
    if (done) done(true)
  })
}

function cancelVerification() {
  const done = resolver
  resolver = null
  if (done) done(false)
}

export function useSensitiveTrust() {
  return {
    trustUntil,
    modalOpen,
    trusted,
    refresh,
    ensureTrust,
    resolveVerification,
    cancelVerification,
  }
}

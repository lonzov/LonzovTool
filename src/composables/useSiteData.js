import { ref } from 'vue'
import toolsSnapshot from '../data/tools.json'
import parentMenusSnapshot from '../data/parentMenus.json'
import noticesSnapshot from '../data/notices.json'
import promoSnapshot from '../data/homePromo.json'
import downloadsSnapshot from '../data/downloads.json'

/**
 * 站点动态数据的唯一入口。
 *
 * 构建期内联的快照作为初始值；接入后端后由接口数据整体替换（契约见后端仓库 docs/api.md）。
 * 消费方一律从这里取数，不得直接 import 数据文件——运行时替换只覆盖这里，
 * 直接 import 的消费方会继续读到过期快照。
 *
 * 因此所有派生结果都必须在调用时计算。冻结在模块加载时的常量
 * （典型是站外域名白名单）会让运行时新收录的卡片被判为非法，且不会有任何报错。
 */
export const cardsData = ref(toolsSnapshot)
export const parentMenusData = ref(parentMenusSnapshot)
export const noticesData = ref(noticesSnapshot)
// 推广位：四档结构 { first, paid[], free, notice }；过期与隐藏由接口过滤，前端不再自己判断时间
export const promoData = ref(promoSnapshot)

// 打赏记录与共建者只在个别页面用到，快照仍按需加载：初值为 null，首次访问才动态 import。
// 接口一旦给出对应键就以接口数据为准，不再碰快照，因此加载前先看 ref。
export const donateRecordsData = ref(null)
export const contributorsData = ref(null)
// 下载页整页下发（含 Markdown 正文）：页面数量少，拆详情接口不划算
export const downloadsData = ref(downloadsSnapshot)

let donateRecordsSnapshot = null

export async function loadDonateRecords() {
  if (donateRecordsData.value) return donateRecordsData.value
  if (!donateRecordsSnapshot) {
    donateRecordsSnapshot = import('../data/donateRecords.json')
      .then((m) => m.default || m)
      .catch(() => [])
  }
  return donateRecordsData.value || (await donateRecordsSnapshot)
}

let contributorsSnapshot = null

export async function loadContributors() {
  if (contributorsData.value) return contributorsData.value
  if (!contributorsSnapshot) {
    contributorsSnapshot = import('../data/contributors.json')
      .then((m) => m.default || m)
      .catch(() => [])
  }
  return contributorsData.value || (await contributorsSnapshot)
}

/** 遍历卡片，命中即返回 visit 的返回值 */
function eachTool(visit) {
  for (const category of cardsData.value.categories) {
    for (const tool of category.tools) {
      const hit = visit(tool)
      if (hit) return hit
    }
  }
  return null
}

/** 仅站外链接参与域名比较，站内路径与非法 URL 一律返回 null */
function parseExternal(value) {
  if (!value || !/^https?:/i.test(value)) return null
  try {
    return new URL(value)
  } catch {
    return null
  }
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, '')
}

/** 按 id 反查卡片（站外嵌入标签靠 id 反查原始 URL） */
/** 按 slug 取下载页；找不到返回 null（路由已按快照生成，正常不会命中） */
export function getDownloadPage(slug) {
  return downloadsData.value.find((item) => item.slug === slug) || null
}

export function findToolById(id) {
  if (!id) return null
  return eachTool((tool) => (tool.id === id ? tool : null))
}

/** 按站外链接反查卡片，忽略末尾斜杠 */
export function findToolByExternalLink(url) {
  const target = stripTrailingSlash(url || '')
  if (!parseExternal(target)) return null
  return eachTool((tool) => {
    const link = parseExternal(tool.link)
    return link && stripTrailingSlash(tool.link) === target ? tool : null
  })
}

/** 按站内路径反查卡片，忽略末尾斜杠 */
export function findToolByPath(path) {
  const target = stripTrailingSlash(path || '')
  if (!target || /^https?:/i.test(target)) return null
  return eachTool((tool) => {
    if (/^https?:/i.test(tool.link)) return null
    return stripTrailingSlash(tool.link) === target ? tool : null
  })
}

/**
 * 站外域名白名单校验，决定 /embed/ 标签是否允许渲染，不在白名单内的转交 404。
 * 必须由当前数据派生而非模块级常量：数据运行时会被整体替换，
 * 冻结在构建时的白名单会让新批准的站外卡片其嵌入页直接 404。
 */
export function isExternalUrlAllowed(url) {
  const target = parseExternal(url)
  if (!target) return false
  return !!eachTool((tool) => {
    const link = parseExternal(tool.link)
    return link && link.hostname === target.hostname ? true : null
  })
}

// ===== 运行时同步 =====
// 轮询各资源的版本戳，只有变化的资源才重拉。间隔 10 分钟：/api/ 不参与 SW 缓存，
// 每次都是真实请求，而站点侧 fail2ban 的 CC 阈值是单 IP 300 秒内 30 次，不能轮询过密。
const VERSIONS_URL = '/api/v1/versions'
const VERSION_POLL_MS = 10 * 60 * 1000
// 资源键 → 接口路径 + 落地方式（形状见后端仓库 docs/api.md 的「站点数据（按资源拆分）」）
const RESOURCES = {
  cards: { url: '/api/v1/cards', apply: applyCards },
  menus: { url: '/api/v1/parent-menus', apply: (data) => (parentMenusData.value = data) },
  notices: { url: '/api/v1/notices', apply: (data) => (noticesData.value = data) },
  donations: { url: '/api/v1/donations', apply: (data) => (donateRecordsData.value = data) },
  contributors: { url: '/api/v1/contributors', apply: (data) => (contributorsData.value = data) },
  promo: { url: '/api/v1/promo', apply: (data) => (promoData.value = data) },
  downloads: { url: '/api/v1/downloads', apply: (data) => (downloadsData.value = data) },
}

/**
 * 卡片列表为空时一律不采信。
 *
 * 一个导航站没有任何卡片不是一种正常状态：只可能是库没导数据、迁移漏拷或接口发错了版本。
 * 运行时同步是整体替换，照单全收会让首页在访客眼里直接变成空站——比继续用旧快照糟糕得多。
 * 公告、推广为空是正常状态，不做这种保护。
 * @param {object} data 接口返回的卡片载荷
 * @returns {boolean} true 表示这份载荷不可信
 */
export function isCardsPayloadEmpty(data) {
  const categories = Array.isArray(data?.categories) ? data.categories : []
  if (!categories.length) return true
  // 分类还在、卡片全没了同样是空站，按同一类故障处理
  return categories.every(
    (category) => !Array.isArray(category?.tools) || category.tools.length === 0,
  )
}

let warnedEmptyCards = false

function applyCards(data) {
  if (isCardsPayloadEmpty(data)) {
    if (!warnedEmptyCards) {
      warnedEmptyCards = true
      console.warn('[siteData] 卡片接口返回空数据，已忽略并继续使用构建期快照')
    }
    return
  }
  cardsData.value = data
}

let syncedVersions = null
let pollTimer = null
let inflight = null

async function pullResource(key) {
  const resource = RESOURCES[key]
  if (!resource) return
  // 资源接口带 max-age 与 stale-while-revalidate：不强制确认的话，拿到的新版本戳
  // 配上的可能是浏览器缓存里的旧内容。no-cache 会带 ETag 问一次，没变就是 304。
  const res = await fetch(resource.url, {
    headers: { Accept: 'application/json' },
    cache: 'no-cache',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  resource.apply(await res.json())
}

/** 首次没有可比对的版本，直接拉全量，省掉一次往返 */
async function pullAll() {
  await Promise.all(Object.keys(RESOURCES).map((key) => pullResource(key)))
}

async function pullVersions() {
  const res = await fetch(VERSIONS_URL, {
    headers: { Accept: 'application/json' },
    cache: 'no-cache',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const versions = await res.json()

  if (syncedVersions === null) {
    await pullAll()
  } else {
    // 只有版本戳变了的资源才重拉：改一条公告不该顺带下载全部卡片
    const changed = Object.keys(RESOURCES).filter(
      (key) => String(versions?.[key]) !== String(syncedVersions?.[key]),
    )
    await Promise.all(changed.map((key) => pullResource(key)))
  }
  syncedVersions = versions
}

/**
 * 启动运行时同步。**必须由组件在 onMounted 里调用**：
 * vite-ssg 的预渲染会执行 setup，在 setup 顶层或模块加载时发请求会真打后端、
 * 甚至挂住预渲染，而这在 dev 下完全看不见。重复调用无副作用。
 *
 * 任何失败都静默：接口取不到就继续用构建期快照，站点必须保持完整可用。
 */
export function startSiteDataSync() {
  if (pollTimer) return
  const tick = () => {
    if (inflight) return
    inflight = pullVersions()
      .catch(() => {})
      .finally(() => (inflight = null))
  }
  tick()
  pollTimer = setInterval(tick, VERSION_POLL_MS)
}

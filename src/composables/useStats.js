import { ref } from 'vue'

const UMAMI_BASE = 'https://imamu.lonzov.top'
const SHARE_SLUG = 'FmUyTde668rZaCXX'

// ===== 模块级单例（跨组件共享同一份缓存和状态） =====
const CACHE_KEY = 'stats_cache'
const CACHE_TTL_MS = 30 * 60 * 1000
const memoryCache = new Map()

const stats = ref({
  todayPV: null,
  todayUV: null,
  yesterdayUV: null,
  monthUV: null,
  yearPV: null,
})

const loading = ref(true)
const lastUpdate = ref(null)  // 格式化后的更新时间字符串
const isMocked = ref(null)    // 是否估算数据

function readLocalCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw)
    if (!entry || typeof entry.ts !== 'number') return null
    return entry
  } catch { return null }
}

function writeLocalCache(data, ts) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts }))
  } catch { /* ignore */ }
}

function applyStatsData(data) {
  stats.value.todayPV = data.today_pv ?? null
  stats.value.todayUV = data.today_uv ?? null
  stats.value.yesterdayUV = data.yesterday_uv ?? null
  stats.value.monthUV = data.month_uv ?? null
  stats.value.yearPV = data.year_pv ?? null

  isMocked.value = data.is_mocked ?? null
  lastUpdate.value = data.last_update
    ? new Date(data.last_update * 1000).toLocaleString()
    : null

  console.log(
    `[访问统计] 最后更新: ${lastUpdate.value || '未知'} | 数据真实性: ${isMocked.value ? '估算数据' : '真实数据'}`
  )
}

async function requestShareToken() {
  const res = await fetch(`${UMAMI_BASE}/api/share/${SHARE_SLUG}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const { token, websiteId } = await res.json()
  if (!token || !websiteId) throw new Error('分享 token 无效')
  return { token, websiteId }
}

function requestRange(websiteId, token, startAt, endAt) {
  const url = `${UMAMI_BASE}/api/websites/${websiteId}/stats?startAt=${startAt}&endAt=${endAt}`
  return fetch(url, {
    headers: {
      'x-umami-share-token': token,
      'x-umami-share-context': '1',
      Accept: 'application/json',
    },
  }).then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  })
}

// Umami 只给区间聚合值，按浏览器本地时区切出今天/昨天/本月/今年
function getTimeRanges() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const dayStart = new Date(year, month, now.getDate()).getTime()
  const nextDayStart = new Date(year, month, now.getDate() + 1).getTime()
  const todayEnd = nextDayStart - 1
  const dayMs = nextDayStart - dayStart
  return {
    today: [dayStart, todayEnd],
    yesterday: [dayStart - dayMs, dayStart - 1],
    month: [new Date(year, month, 1).getTime(), todayEnd],
    year: [new Date(year, 0, 1).getTime(), todayEnd],
  }
}

async function requestStats() {
  const { token, websiteId } = await requestShareToken()
  const ranges = getTimeRanges()
  const [today, yesterday, month, year] = await Promise.all([
    requestRange(websiteId, token, ...ranges.today),
    requestRange(websiteId, token, ...ranges.yesterday),
    requestRange(websiteId, token, ...ranges.month),
    requestRange(websiteId, token, ...ranges.year),
  ])
  return {
    today_pv: today.pageviews,
    today_uv: today.visitors,
    yesterday_uv: yesterday.visitors,
    month_uv: month.visitors,
    year_pv: year.pageviews,
    is_mocked: false,
    last_update: Math.floor(Date.now() / 1000),
  }
}

let fetchPromise = null

async function fetchStats() {
  // 1. 先查内存缓存
  const mem = memoryCache.get(CACHE_KEY)
  if (mem && Date.now() - mem.ts < CACHE_TTL_MS) {
    applyStatsData(mem.data)
    loading.value = false
    return
  }

  // 2. 再查 localStorage 缓存
  const local = readLocalCache()
  if (local && Date.now() - local.ts < CACHE_TTL_MS) {
    applyStatsData(local.data)
    memoryCache.set(CACHE_KEY, { data: local.data, ts: local.ts })
    loading.value = false
    return
  }

  // 3. 缓存过期或不存在，先展示缓存数据（如有）
  if (local && local.data) {
    applyStatsData(local.data)
  }

  // 4. 请求 API 更新（去重：同一时刻只发一个请求）
  if (!fetchPromise) {
    fetchPromise = requestStats()
      .then(data => {
        applyStatsData(data)
        const now = Date.now()
        memoryCache.set(CACHE_KEY, { data, ts: now })
        writeLocalCache(data, now)
      })
      .catch(() => {
        // 若有缓存数据则继续使用，不抛错
      })
      .finally(() => {
        loading.value = false
        fetchPromise = null
      })
  }

  await fetchPromise
}

export function useStats() {
  return { stats, loading, lastUpdate, isMocked, fetchStats }
}

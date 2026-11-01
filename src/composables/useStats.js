import { ref } from 'vue'

/*
 * 站点统计的两套接口共用同一个 Umami 项目，但指标集合与限流策略不同：
 * 控制台用 /api/v1/stats，关于页用 /api/v1/about/stats，前端缓存也必须分开。
 */
const CACHE_TTL_MS = 30 * 60 * 1000

function createStatsStore({ url, cacheKey, label }) {
  const memoryCache = new Map()

  const stats = ref({
    todayPV: null,
    todayPvDelta: null,
    todayUV: null,
    todayUvDelta: null,
    yesterdayUV: null,
    yesterdayUvDelta: null,
    monthUV: null,
    monthUvDelta: null,
    yearPV: null,
    yearUV: null,
  })

  const loading = ref(true)
  const lastUpdate = ref(null)
  const isMocked = ref(null)

  function readLocalCache() {
    try {
      const raw = localStorage.getItem(cacheKey)
      if (!raw) return null
      const entry = JSON.parse(raw)
      if (!entry || typeof entry.ts !== 'number') return null
      return entry
    } catch { return null }
  }

  function writeLocalCache(data, ts) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ data, ts }))
    } catch { /* ignore */ }
  }

  function applyStatsData(data) {
    stats.value.todayPV = data.today_pv ?? null
    stats.value.todayPvDelta = data.today_pv_delta ?? null
    stats.value.todayUV = data.today_uv ?? null
    stats.value.todayUvDelta = data.today_uv_delta ?? null
    stats.value.yesterdayUV = data.yesterday_uv ?? null
    stats.value.yesterdayUvDelta = data.yesterday_uv_delta ?? null
    stats.value.monthUV = data.month_uv ?? null
    stats.value.monthUvDelta = data.month_uv_delta ?? null
    stats.value.yearPV = data.year_pv ?? null
    stats.value.yearUV = data.year_uv ?? null

    isMocked.value = data.is_mocked ?? null
    lastUpdate.value = data.last_update
      ? new Date(data.last_update * 1000).toLocaleString()
      : null

    console.log(
      `[${label}] 最后更新 ${lastUpdate.value || '未知'} | 数据真实性 ${isMocked.value ? '估算数据' : '真实数据'}`
    )
  }

  async function requestStats() {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }

  let fetchPromise = null

  async function fetchStats() {
    const mem = memoryCache.get(cacheKey)
    if (mem && Date.now() - mem.ts < CACHE_TTL_MS) {
      applyStatsData(mem.data)
      loading.value = false
      return
    }

    const local = readLocalCache()
    if (local && Date.now() - local.ts < CACHE_TTL_MS) {
      applyStatsData(local.data)
      memoryCache.set(cacheKey, { data: local.data, ts: local.ts })
      loading.value = false
      return
    }

    if (local && local.data) {
      applyStatsData(local.data)
    }

    if (!fetchPromise) {
      fetchPromise = requestStats()
        .then(data => {
          applyStatsData(data)
          const now = Date.now()
          memoryCache.set(cacheKey, { data, ts: now })
          writeLocalCache(data, now)
        })
        .catch(() => {
          // 有旧缓存就继续用，失败不升级为页面错误
        })
        .finally(() => {
          loading.value = false
          fetchPromise = null
        })
    }

    await fetchPromise
  }

  return { stats, loading, lastUpdate, isMocked, fetchStats }
}

const consoleStats = createStatsStore({
  url: '/api/v1/stats',
  cacheKey: 'stats_cache',
  label: '访问统计',
})

const aboutStats = createStatsStore({
  url: '/api/v1/about/stats',
  cacheKey: 'about_stats_cache',
  label: '关于页统计',
})

export function useStats() {
  return consoleStats
}

export function useAboutStats() {
  return aboutStats
}

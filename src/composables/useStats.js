import { ref } from 'vue'

/*
 * 站点统计的两套接口共用同一个 Umami 项目，但指标集合与限流策略不同：
 * 控制台用 /api/v1/stats，关于页用 /api/v1/about/stats，前端缓存也必须分开。
 */

/* 关于页的数字需要持续微增，缓存有效期压到 10 分钟并定时覆盖；控制台维持 30 分钟。 */
const CONSOLE_TTL_MS = 30 * 60 * 1000
const ABOUT_TTL_MS = 10 * 60 * 1000
const SIMULATE_TICK_MS = 1000

/*
 * 展示倍率：1 = 按真实速率（约每 60~120 秒一次浏览、每 3~4 分钟一次访客），
 * 调大只会让本地数字比真实值虚高，并在每 10 分钟回源时被覆盖回落。
 */
const DISPLAY_SPEED = 1

/* 新访客至少带来一次浏览；随后 2 分钟内浏览速率加倍，模拟停留后继续翻页 */
const PV_BOOST_WINDOW_MS = 2 * 60 * 1000
const PV_BOOST_FACTOR = 2

/*
 * 惯性估算的每小时基准量（次/小时），下标为 0~23 点。
 * 假期档 = 周末与寒暑假（1~2 月、7~8 月），量级约为工作日两倍。
 * 这张表只驱动展示层的平滑增长，不代表统计口径：每 10 分钟会被服务端数据整体覆盖。
 */
const HOURLY_WORKDAY = {
  uv: [5, 3, 2, 2, 2, 1, 2, 4, 3, 6, 4, 8, 10, 8, 6, 7, 9, 10, 14, 15, 18, 18, 14, 9],
  pv: [14, 8, 6, 6, 5, 3, 5, 10, 9, 15, 14, 22, 28, 17, 14, 22, 21, 25, 33, 45, 45, 45, 35, 23],
}

const HOURLY_HOLIDAY = {
  uv: [12, 7, 4, 3, 2, 2, 3, 6, 10, 21, 19, 34, 31, 26, 31, 28, 29, 26, 24, 25, 28, 26, 23, 17],
  pv: [34, 20, 12, 9, 8, 7, 10, 20, 38, 50, 62, 74, 76, 66, 84, 76, 76, 68, 56, 68, 74, 86, 68, 56],
}

/* 统计日与小时按北京时间切，与 Umami 的统计口径一致，访客在别的时区也不会算错日界 */
const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000

function chinaDate(ms) {
  return new Date(ms + CHINA_OFFSET_MS)
}

function chinaDayKey(ms) {
  const d = chinaDate(ms)
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`
}

function isHolidayProfile(ms) {
  const d = chinaDate(ms)
  const day = d.getUTCDay()
  const month = d.getUTCMonth()
  return day === 0 || day === 6 || month === 0 || month === 1 || month === 6 || month === 7
}

/* 相邻整点的基准量之间做平滑过渡，避免每到一个整点速率台阶式跳变 */
function hourlyRate(table, ms) {
  const d = chinaDate(ms)
  const hour = d.getUTCHours()
  const within = (d.getUTCMinutes() * 60 + d.getUTCSeconds()) / 3600
  const eased = within * within * (3 - 2 * within)
  const current = table[hour]
  const next = table[(hour + 1) % 24]
  return ((current + (next - current) * eased) / 3600) * DISPLAY_SPEED
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/* 当天 0 点到现在的累积量（基准曲线的解析积分），用作拿不到服务端数据时的起点 */
function daySoFar(table, ms) {
  const d = chinaDate(ms)
  const hour = d.getUTCHours()
  const within = (d.getUTCMinutes() * 60 + d.getUTCSeconds()) / 3600
  let total = 0
  for (let h = 0; h < hour; h++) {
    total += (table[h] + table[(h + 1) % 24]) / 2
  }
  const current = table[hour]
  const next = table[(hour + 1) % 24]
  total += current * within + (next - current) * ((within ** 3) - (within ** 4) / 2)
  return Math.round(total)
}

function dayParts(key) {
  const [year, month] = key.split('-').map(Number)
  return { year, month }
}

function createStatsStore({ url, cacheKey, label, ttl = CONSOLE_TTL_MS, simulate = false }) {
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

  /* anchor 是最近一次数据快照，pv/uv 是在它之上累加出的展示值 */
  const inertia = {
    timer: null,
    refreshTimer: null,
    last: 0,
    day: '',
    serverTs: 0,
    anchor: null,
    pv: 0,
    uv: 0,
    accPv: 0,
    accUv: 0,
    momPv: 1,
    momUv: 1,
    pvBoostUntil: 0,
  }

  /* 缓存要维持接口原样（snake_case），否则下次按服务端响应解析会全部读空 */
  let serverLastUpdate = null

  function readLocalCache() {
    try {
      const raw = localStorage.getItem(cacheKey)
      if (!raw) return null
      const entry = JSON.parse(raw)
      if (!entry || typeof entry.ts !== 'number') return null
      return entry
    } catch { return null }
  }

  /* ts 只记录服务端数据的时间，模拟值不刷新它，否则永远不会重新拉取 */
  function writeLocalCache(data, ts, simTs = ts, day = chinaDayKey(ts)) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ data, ts, simTs, day }))
    } catch { /* ignore */ }
  }

  function applyStatsData(data, ts = Date.now(), day = chinaDayKey(ts)) {
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
    serverLastUpdate = data.last_update ?? null
    lastUpdate.value = serverLastUpdate
      ? new Date(serverLastUpdate * 1000).toLocaleString()
      : null

    if (simulate) {
      inertia.anchor = {
        pv: data.today_pv ?? null,
        uv: data.today_uv ?? null,
        yearPV: data.year_pv ?? null,
        monthUV: data.month_uv ?? null,
      }
      inertia.pv = data.today_pv ?? 0
      inertia.uv = data.today_uv ?? 0
      inertia.accPv = 0
      inertia.accUv = 0
      inertia.momPv = 1
      inertia.momUv = 1
      inertia.pvBoostUntil = 0
      inertia.last = Date.now()
      inertia.serverTs = ts
      inertia.day = day
    }

    console.log(
      `[${label}] 最后更新 ${lastUpdate.value || '未知'} | 数据真实性 ${isMocked.value ? '估算数据' : '真实数据'}`
    )
  }

  async function requestStats() {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }

  function publishInertia() {
    const anchor = inertia.anchor
    if (!anchor || anchor.pv == null || anchor.uv == null) return
    const pvDelta = inertia.pv - anchor.pv
    const uvDelta = inertia.uv - anchor.uv
    stats.value.todayPV = inertia.pv
    stats.value.todayUV = inertia.uv
    if (anchor.yearPV != null) stats.value.yearPV = anchor.yearPV + pvDelta
    if (anchor.monthUV != null) stats.value.monthUV = anchor.monthUV + uvDelta
  }

  /* 缓存要维持接口原样（snake_case），否则下次按服务端响应解析会全部读空 */
  function snapshotStats() {
    return {
      today_pv: stats.value.todayPV,
      today_pv_delta: stats.value.todayPvDelta,
      today_uv: stats.value.todayUV,
      today_uv_delta: stats.value.todayUvDelta,
      yesterday_uv: stats.value.yesterdayUV,
      yesterday_uv_delta: stats.value.yesterdayUvDelta,
      month_uv: stats.value.monthUV,
      month_uv_delta: stats.value.monthUvDelta,
      year_pv: stats.value.yearPV,
      year_uv: stats.value.yearUV,
      is_mocked: isMocked.value,
      last_update: serverLastUpdate,
    }
  }

  function persistInertia() {
    const snapshot = snapshotStats()
    memoryCache.set(cacheKey, { data: snapshot, ts: inertia.serverTs, day: inertia.day })
    writeLocalCache(snapshot, inertia.serverTs, Date.now(), inertia.day)
  }

  /*
   * 无服务端数据或跨天时，用基准曲线补出当天至今的量作为起点；
   * 年 / 月沿用已展示的累积值，跨年、跨月时归零。
   */
  function seedInertia(now = Date.now()) {
    const table = isHolidayProfile(now) ? HOURLY_HOLIDAY : HOURLY_WORKDAY
    const pv = daySoFar(table.pv, now)
    const uv = daySoFar(table.uv, now)

    const prev = inertia.anchor
    const d = chinaDate(now)
    const old = inertia.day ? dayParts(inertia.day) : null
    const yearChanged = old ? old.year !== d.getUTCFullYear() : false
    const monthChanged = yearChanged || (old ? old.month !== d.getUTCMonth() : false)

    inertia.anchor = {
      pv,
      uv,
      yearPV: prev ? (yearChanged ? 0 : stats.value.yearPV) : null,
      monthUV: prev ? (monthChanged ? 0 : stats.value.monthUV) : null,
    }
    inertia.pv = pv
    inertia.uv = uv
    inertia.accPv = 0
    inertia.accUv = 0
    inertia.momPv = 1
    inertia.momUv = 1
    inertia.pvBoostUntil = 0
    inertia.last = now
    inertia.day = chinaDayKey(now)
    publishInertia()
    persistInertia()
  }

  function simulateTick() {
    const anchor = inertia.anchor
    if (!anchor || anchor.pv == null || anchor.uv == null) return

    const now = Date.now()

    /* 跨天后旧值属于前一天：本地按曲线重新起算，同时补拉当日数据 */
    if (chinaDayKey(now) !== inertia.day) {
      seedInertia(now)
      fetchStats({ force: true })
      return
    }

    const dt = inertia.last ? clamp((now - inertia.last) / 1000, 0, 60) : 1
    inertia.last = now

    /* 速率围绕基准值随机游走并缓慢回归，起步与收尾都不会突然贴到目标值 */
    inertia.momPv = clamp(inertia.momPv + (1 - inertia.momPv) * 0.05 + (Math.random() - 0.5) * 0.06, 0.55, 1.45)
    inertia.momUv = clamp(inertia.momUv + (1 - inertia.momUv) * 0.05 + (Math.random() - 0.5) * 0.06, 0.55, 1.45)

    const table = isHolidayProfile(now) ? HOURLY_HOLIDAY : HOURLY_WORKDAY
    const jitter = () => 0.65 + Math.random() * 0.7
    const pvBoost = now < inertia.pvBoostUntil ? PV_BOOST_FACTOR : 1
    inertia.accPv += hourlyRate(table.pv, now) * pvBoost * inertia.momPv * dt * jitter()
    inertia.accUv += hourlyRate(table.uv, now) * inertia.momUv * dt * jitter()

    const addPv = Math.floor(inertia.accPv)
    const addUv = Math.floor(inertia.accUv)

    /* 每个新访客至少带来一次浏览，并让之后 2 分钟内的浏览速率加倍 */
    let visitorPv = 0
    if (addUv > 0) {
      visitorPv = Math.max(0, addUv - addPv)
      inertia.pvBoostUntil = now + PV_BOOST_WINDOW_MS
    }
    if (addPv === 0 && addUv === 0) return

    inertia.accPv -= addPv
    inertia.accUv -= addUv
    inertia.pv += addPv + visitorPv
    inertia.uv += addUv
    publishInertia()
    persistInertia()
  }

  function startInertia() {
    if (!simulate || inertia.timer) return
    inertia.last = Date.now()
    inertia.timer = setInterval(simulateTick, SIMULATE_TICK_MS)
    inertia.refreshTimer = setInterval(() => fetchStats({ force: true }), ttl)
  }

  function stopInertia() {
    if (inertia.timer) clearInterval(inertia.timer)
    if (inertia.refreshTimer) clearInterval(inertia.refreshTimer)
    inertia.timer = null
    inertia.refreshTimer = null
  }

  let fetchPromise = null

  async function fetchStats({ force = false } = {}) {
    const now = Date.now()

    const readDay = (entry) => entry.day ?? chinaDayKey(entry.ts)

    if (!force) {
      const mem = memoryCache.get(cacheKey)
      if (mem && now - mem.ts < ttl) {
        applyStatsData(mem.data, mem.ts, readDay(mem))
        loading.value = false
        return
      }

      const local = readLocalCache()
      if (local && now - local.ts < ttl) {
        applyStatsData(local.data, local.ts, readDay(local))
        memoryCache.set(cacheKey, { data: local.data, ts: local.ts, day: readDay(local) })
        loading.value = false
        return
      }

      if (local && local.data) {
        applyStatsData(local.data, local.ts, readDay(local))
      }
    }

    if (!fetchPromise) {
      fetchPromise = requestStats()
        .then(data => {
          const ts = Date.now()
          const day = chinaDayKey(ts)
          applyStatsData(data, ts, day)
          memoryCache.set(cacheKey, { data, ts, day })
          writeLocalCache(data, ts, ts, day)
        })
        .catch(() => {
          // 有旧缓存就继续用，失败不升级为页面错误
        })
        .finally(() => {
          /* 接口不可达且没有任何缓存时，也要能从基准曲线起算，不让数字停住 */
          if (simulate && !inertia.anchor) seedInertia()
          loading.value = false
          fetchPromise = null
        })
    }

    await fetchPromise
  }

  return { stats, loading, lastUpdate, isMocked, fetchStats, startInertia, stopInertia }
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
  ttl: ABOUT_TTL_MS,
  simulate: true,
})

export function useStats() {
  return consoleStats
}

export function useAboutStats() {
  return aboutStats
}

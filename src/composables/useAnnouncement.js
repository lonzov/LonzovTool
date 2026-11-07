import { useLocalStats } from './useLocalStats.js'

export const ANNOUNCEMENTS_URL = '/api/v1/announcements'
export const PRIVACY_KEY = 'privacy_consent'
export const PRIVACY_NOTICE_KEY = 'privacy_notice_version'
export const VISITOR_KEY = 'lt_announcement_visitor'
export const DISMISS_KEY = 'lt_announcement_dismissals'
export const SESSION_DISMISS_KEY = 'lt_announcement_session_dismissals'

const MIN_SECONDS_CAP = 5
const HOURS_CAP = 8760

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 无痕模式或存储写满时只影响关闭记忆，不影响公告展示
  }
}

export function hasPrivacyConsent() {
  if (typeof localStorage === 'undefined') return false
  return !!localStorage.getItem(PRIVACY_KEY) && !!localStorage.getItem(PRIVACY_NOTICE_KEY)
}

export function ensureVisitorId() {
  if (typeof localStorage === 'undefined') return ''
  const existing = localStorage.getItem(VISITOR_KEY)
  if (existing) return existing
  let visitor
  try {
    visitor = crypto.randomUUID()
  } catch {
    visitor = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  }
  try {
    localStorage.setItem(VISITOR_KEY, visitor)
  } catch {
    return ''
  }
  return visitor
}

function readDismissals() {
  const value = readJson(DISMISS_KEY, {})
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function readSessionDismissals() {
  try {
    const value = JSON.parse(sessionStorage.getItem(SESSION_DISMISS_KEY) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

export function isDismissed(id) {
  if (!id) return false
  if (readSessionDismissals().includes(id)) return true
  const record = readDismissals()[id]
  if (!record) return false
  if (record.until === null) return true
  if (Number(record.until) > Date.now()) return true
  const all = readDismissals()
  delete all[id]
  writeJson(DISMISS_KEY, all)
  return false
}

export function rememberDismissal(announcement, override = {}) {
  const close = announcement?.close || {}
  const mode = override.remember && override.remember !== 'inherit'
    ? override.remember
    : close.remember || 'hours'
  if (mode === 'none') return
  if (mode === 'session') {
    const ids = readSessionDismissals()
    if (!ids.includes(announcement.id)) ids.push(announcement.id)
    try {
      sessionStorage.setItem(SESSION_DISMISS_KEY, JSON.stringify(ids))
    } catch {
      // ignore
    }
    return
  }
  const all = readDismissals()
  if (mode === 'forever') {
    all[announcement.id] = { until: null }
  } else {
    const sourceHours = override.remember === 'hours' ? override.hours : close.hours
    const hours = Math.max(1, Math.min(Number(sourceHours) || 12, HOURS_CAP))
    all[announcement.id] = { until: Date.now() + hours * 60 * 60 * 1000 }
  }
  writeJson(DISMISS_KEY, all)
}

export function getTotalSeconds(seconds) {
  const value = Number(seconds)
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.min(Math.floor(value), MIN_SECONDS_CAP)
}

function localConditionMatches(condition) {
  if (!condition || typeof condition !== 'object') return false
  const { stats } = useLocalStats()
  const operator = condition.operator
  let actual
  if (condition.type === 'navClicks') actual = stats.value.navClicks || 0
  else if (condition.type === 'toolOpens') actual = stats.value.toolOpens || 0
  else if (condition.type === 'daysSinceFirstOpen') {
    const first = Date.parse(stats.value.firstOpenAt || '')
    actual = Number.isNaN(first) ? 0 : Math.floor((Date.now() - first) / 86400000)
  } else if (condition.type === 'path') {
    actual = window.location.pathname
  } else {
    return false
  }

  if (condition.type === 'path') {
    if (operator === 'contains') return actual.includes(condition.value)
    return actual.replace(/\/+$/, '') === String(condition.value || '').replace(/\/+$/, '')
  }
  const expected = Number(condition.value)
  if (!Number.isFinite(expected)) return false
  if (operator === 'lte') return actual <= expected
  return actual >= expected
}

export function matchesConditions(announcement) {
  const conditions = Array.isArray(announcement?.conditions) ? announcement.conditions : []
  return conditions.every(localConditionMatches)
}

export async function fetchAnnouncements(visitorId) {
  const headers = { Accept: 'application/json' }
  if (visitorId) headers['X-Announcement-Visitor'] = visitorId
  const response = await fetch(ANNOUNCEMENTS_URL, { headers, cache: 'default' })
  if (!response.ok) return []
  const data = await response.json()
  return Array.isArray(data?.items) ? data.items : []
}

export function pickAnnouncement(items) {
  const sorted = [...items].sort((a, b) => (a.priority || 0) - (b.priority || 0))
  return sorted.find((item) => !isDismissed(item.id) && matchesConditions(item)) || null
}

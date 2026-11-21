import { ref } from 'vue'
import { consoleFetch } from './consoleRequest.js'

const ANALYTICS_URL = '/api/v1/console/system/settings/analytics'

/** 控制台内多个页面共用同一份 Umami 分享链接，避免各自重复请求 */
export const analyticsShareUrl = ref('')

let loaded = false
let pending = null

export async function loadAnalyticsShare({ force = false } = {}) {
  if (force) loaded = false
  if (loaded) return { share_url: analyticsShareUrl.value }
  if (pending) return pending

  pending = consoleFetch(ANALYTICS_URL)
    .then((payload) => {
      analyticsShareUrl.value = payload?.share_url || ''
      loaded = true
      return payload
    })
    .finally(() => {
      pending = null
    })
  return pending
}

export function setAnalyticsShareUrl(value) {
  analyticsShareUrl.value = value || ''
  loaded = true
}

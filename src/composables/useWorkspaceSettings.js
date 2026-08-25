import { ref } from 'vue'

// 站外卡片是否通过 iframe 嵌入到工作站标签页（默认关闭：仍按现在的方式在新标签页打开）
export const EXTERNAL_EMBED_KEY = 'workspace_embed_external'

// 深色模式下 iframe 遮罩模式：off / black / invert（默认黑色遮罩）
export const IFRAME_MASK_KEY = 'workspace_iframe_mask'
export const IFRAME_MASK_MODES = ['off', 'black', 'invert']

// 每个站点的深色滤镜开关：同一密钥内存 { 站点id: 0/1 }，无配置时取设置页默认
export const IFRAME_SITE_DARK_KEY = 'workspace_iframe_site_dark'

function loadSiteDarkMap() {
  try {
    if (typeof localStorage === 'undefined') return {}
    const raw = localStorage.getItem(IFRAME_SITE_DARK_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

// 读取某站点开关：无配置返回 null（交由调用方按设置页默认值处理）
export function getStoredSiteDark(host) {
  const map = loadSiteDarkMap()
  return Object.prototype.hasOwnProperty.call(map, host) ? map[host] === 1 : null
}

// 写入某站点开关：true→1，false→0
export function saveSiteDark(host, enabled) {
  const map = loadSiteDarkMap()
  map[host] = enabled ? 1 : 0
  try {
    localStorage.setItem(IFRAME_SITE_DARK_KEY, JSON.stringify(map))
  } catch {
    // storage unavailable
  }
}

function loadEmbedEnabled() {
  try {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(EXTERNAL_EMBED_KEY) === 'true'
  } catch {
    return false
  }
}

function loadIframeMask() {
  try {
    if (typeof localStorage === 'undefined') return 'black'
    const v = localStorage.getItem(IFRAME_MASK_KEY)
    return IFRAME_MASK_MODES.includes(v) ? v : 'black'
  } catch {
    return 'black'
  }
}

// 模块级共享状态：设置页与工具卡片/嵌入页读写同一份值
const embedEnabled = ref(loadEmbedEnabled())
const iframeMaskMode = ref(loadIframeMask())

export function useWorkspaceSettings() {
  function setEmbedEnabled(val) {
    embedEnabled.value = !!val
    try {
      localStorage.setItem(EXTERNAL_EMBED_KEY, String(embedEnabled.value))
    } catch {
      // storage unavailable
    }
  }

  function setIframeMaskMode(val) {
    if (!IFRAME_MASK_MODES.includes(val)) val = 'black'
    iframeMaskMode.value = val
    try {
      localStorage.setItem(IFRAME_MASK_KEY, val)
    } catch {
      // storage unavailable
    }
  }

  return { embedEnabled, setEmbedEnabled, iframeMaskMode, setIframeMaskMode }
}
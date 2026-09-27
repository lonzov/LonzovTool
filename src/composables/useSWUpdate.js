import { ref } from 'vue'

/* MarkdownRenderer 携带 markdown-it（~47K gz），仅在确定要弹更新弹窗时才拉取 */
export const loadMarkdown = () => import('../components/MarkdownRenderer.vue')

/**
 * 渲染器 chunk（构建产物 ~100KB）预取，5s 内未就绪就先弹窗：
 * 加载失败会自行 reject，无需靠超时兜底；上限只用于限制「慢而活着」的下载
 * 推迟弹窗的时长，与 changelog 的超时对齐，使弹窗最晚推迟时间收敛为 5s
 */
function preloadMarkdown() {
  return Promise.race([
    loadMarkdown().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ])
}

const showUpdateModal = ref(false)
const popupTitle = ref('')
const popupContent = ref('')
const popupVersionInfo = ref('')
const popupNewVersion = ref('')
const popupButtons = ref([])
/** 大版本更新（前两位版本号变化）→ 弹窗不可关闭，只能立即更新 */
const forceUpdate = ref(false)
/** 静默更新（小版本）已接管页面，但页面未重载 → UI 提示用户刷新 */
const silentUpdated = ref(false)
let pendingRegistration = null
let shouldReload = false
let pendingSilentUpdate = false

/**
 * 版本号比较（沿用 V2 逻辑）
 * 前两位版本差异（大版本，如 3.3 → 3.4、3.3 → 4.0）→ 'force'（强制更新）
 * 第三位版本差异（如 3.3.1 → 3.3.2）→ 'popup'（弹窗提示，可暂不更新）
 * 4+ 级版本差异 → 'auto'（静默更新）
 * 无差异 → 'none'
 */
function compareVersions(current, next) {
  const cur = current.replace(/^v/, '').split('.').map(Number)
  const nw = next.replace(/^v/, '').split('.').map(Number)
  const max = Math.max(cur.length, nw.length)
  for (let i = 0; i < max; i++) {
    const c = i < cur.length ? cur[i] : 0
    const n = i < nw.length ? nw[i] : 0
    if (n > c) {
      if (i <= 1) return 'force'
      return i === 2 ? 'popup' : 'auto'
    }
    if (n < c) return 'none'
  }
  return 'none'
}

/** 保存当前 SW 版本到 localStorage */
function saveCurrentVersion() {
  if (!navigator.serviceWorker?.controller) return
  const mc = new MessageChannel()
  mc.port1.onmessage = (e) => {
    localStorage.setItem('current_sw_version', e.data.version)
    console.log('[SW] Current version saved:', e.data.version)
  }
  navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' }, [mc.port2])
}

/** 从 SW 获取弹窗内容 */
function fetchPopupData(reg, currentVersion) {
  return new Promise((resolve) => {
    const mc = new MessageChannel()
    // 超时兜底：SW 无响应或 changelog 拉取失败时返回 null，弹窗退化为通用文案。
    // 实测 changelog.md（不缓存、始终走网络）TTFB 可达 1.8s，3s 余量在弱网下不够
    const timer = setTimeout(() => resolve(null), 5000)
    mc.port1.onmessage = (e) => {
      clearTimeout(timer)
      resolve(e.data.popupData || null)
    }
    reg.waiting.postMessage({ type: 'GET_POPUP_DATA', currentVersion }, [mc.port2])
  })
}

/** 处理检测到的更新 */
async function handleUpdate(reg) {
  if (!reg.waiting) return
  const mc = new MessageChannel()
  mc.port1.onmessage = async (e) => {
    const newVer = e.data.version
    const curVer = localStorage.getItem('current_sw_version') || 'v0.0.0'
    const type = compareVersions(curVer, newVer)
    console.log(`[SW] Version: ${curVer} → v${newVer} (${type})`)
    if (type === 'auto') {
      console.log('[SW] Auto-updating (minor), skipWaiting without reload')
      pendingSilentUpdate = true
      reg.waiting.postMessage('SKIP_WAITING')
    } else if (type === 'popup' || type === 'force') {
      // changelog 内容与渲染器 chunk 并行预取，两者都就绪再弹窗：
      // 弹窗一旦出现即是完整内容，不会先弹出再空着等资源
      const [data] = await Promise.all([
        fetchPopupData(reg, curVer),
        preloadMarkdown(),
      ])
      popupTitle.value = data?.title || '发现新版本'
      popupContent.value = data?.content || ''
      popupNewVersion.value = `v${newVer}`
      popupVersionInfo.value = `v${curVer} → v${newVer}`
      popupButtons.value = Array.isArray(data?.buttons) ? data.buttons : []
      forceUpdate.value = type === 'force'
      pendingRegistration = reg
      showUpdateModal.value = true
    }
  }
  reg.waiting.postMessage({ type: 'GET_VERSION' }, [mc.port2])
}

export function useSWUpdate() {
  async function initSW() {
    if (!('serviceWorker' in navigator)) return

    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      console.log('[SW] Registered:', reg.scope)

      // 监听新 SW 安装
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing
        if (!newSW) return
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            handleUpdate(reg)
          }
        })
      })

      // 已有等待中的 SW
      if (reg.waiting && navigator.serviceWorker.controller) {
        handleUpdate(reg)
      }

      // 保存当前版本
      if (navigator.serviceWorker.controller) {
        saveCurrentVersion()
      } else {
        navigator.serviceWorker.addEventListener('controllerchange', saveCurrentVersion, { once: true })
      }

      // 新 SW 接管时，根据需要刷新页面
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (shouldReload) {
          console.log('[SW] Controller changed, reloading...')
          window.location.reload()
        } else if (pendingSilentUpdate) {
          // 静默更新：新 SW 已接管，但页面仍是旧资源，交给 UI 提示用户刷新
          console.log('[SW] Silent update activated, page reload required')
          pendingSilentUpdate = false
          silentUpdated.value = true
        }
      })
    } catch (e) {
      console.warn('[SW] Registration failed:', e)
    }
  }

  /** 立即更新：skipWaiting + 刷新页面 */
  function applyUpdate() {
    console.log('[SW] Applying update (reload)')
    showUpdateModal.value = false
    if (pendingRegistration?.waiting) {
      shouldReload = true
      pendingRegistration.waiting.postMessage('SKIP_WAITING')
    }
  }

  /** 暂不更新：SW 保持 waiting 状态，下次访问自动生效（大版本强制更新时不允许） */
  function deferUpdate() {
    if (forceUpdate.value) return
    console.log('[SW] Update deferred, SW stays waiting. Will activate on next visit.')
    showUpdateModal.value = false
    // 不发送 SKIP_WAITING，SW 保持 waiting 状态
    // 用户关闭所有标签页后再次访问时，waiting SW 自然激活
    pendingRegistration = null
  }

  return { showUpdateModal, popupTitle, popupContent, popupVersionInfo, popupNewVersion, popupButtons, forceUpdate, silentUpdated, initSW, applyUpdate, deferUpdate }
}

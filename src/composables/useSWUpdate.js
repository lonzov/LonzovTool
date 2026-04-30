import { ref } from 'vue'

const showUpdateModal = ref(false)
const popupTitle = ref('')
const popupContent = ref('')
let pendingRegistration = null
let shouldReload = false

/**
 * 版本号比较（沿用 V2 逻辑）
 * 1-3 级版本差异 → 'popup'（弹窗提示）
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
    if (n > c) return i + 1 <= 3 ? 'popup' : 'auto'
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
function fetchPopupData(reg) {
  return new Promise((resolve) => {
    const mc = new MessageChannel()
    mc.port1.onmessage = (e) => {
      resolve(e.data.popupData || null)
    }
    // 超时兜底
    const timer = setTimeout(() => resolve(null), 3000)
    mc.port1.onmessage = (e) => {
      clearTimeout(timer)
      resolve(e.data.popupData || null)
    }
    reg.waiting.postMessage({ type: 'GET_POPUP_DATA' }, [mc.port2])
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
      reg.waiting.postMessage('SKIP_WAITING')
    } else if (type === 'popup') {
      // 从 SW 获取弹窗内容
      const data = await fetchPopupData(reg)
      popupTitle.value = data?.title || '发现新版本'
      if (data?.content) {
        popupContent.value = data.content + `<p style="font-size:13px;color:var(--n-text-color-3);margin-top:10px;">当前版本: v${curVer} → 最新版本: v${newVer}</p>`
      } else {
        popupContent.value = ''
      }
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

  /** 暂不更新：SW 保持 waiting 状态，下次访问自动生效 */
  function deferUpdate() {
    console.log('[SW] Update deferred, SW stays waiting. Will activate on next visit.')
    showUpdateModal.value = false
    // 不发送 SKIP_WAITING，SW 保持 waiting 状态
    // 用户关闭所有标签页后再次访问时，waiting SW 自然激活
    pendingRegistration = null
  }

  return { showUpdateModal, popupTitle, popupContent, initSW, applyUpdate, deferUpdate }
}

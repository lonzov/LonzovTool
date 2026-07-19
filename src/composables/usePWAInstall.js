import { ref, onMounted, onBeforeUnmount } from 'vue'

/**
 * PWA 安装状态管理与安装触发
 *
 * 处理不同系统/浏览器的安装逻辑：
 * - Chrome/Edge (Android/Desktop)：通过 beforeinstallprompt 触发原生安装弹窗
 * - iOS (Safari)：无法自动安装，需引导用户手动操作（分享 → 添加到主屏幕）
 * - OpenHarmony：同 iOS，手动安装
 * - 已安装为 PWA：标记为已安装，不再展示安装入口
 */
export function usePWAInstall() {
  const deferredPrompt = ref(null)
  const isInstallable = ref(false)
  const isInstalled = ref(false)
  const isIOS = ref(false)
  const isOpenHarmony = ref(false)

  // 检测是否已作为 PWA 安装运行
  function checkInstalled() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    )
  }

  // 检测平台
  function detectPlatform() {
    const ua = navigator.userAgent
    isIOS.value = /iPad|iPhone|iPod/.test(ua)
    isOpenHarmony.value = /OpenHarmony/i.test(ua)
  }

  /**
   * 触发安装流程
   * @returns {Promise<{type: string, outcome?: string}>}
   *   type: 'already-installed' | 'ios-manual' | 'openharmony-manual' | 'prompted' | 'unsupported'
   */
  function install() {
    // 已安装
    if (isInstalled.value) {
      return Promise.resolve({ type: 'already-installed' })
    }

    // iOS / OpenHarmony：只能手动安装
    if (isIOS.value || isOpenHarmony.value) {
      return Promise.resolve({ type: isIOS.value ? 'ios-manual' : 'openharmony-manual' })
    }

    // 标准 PWA 安装流程（Chrome/Edge 等）
    if (deferredPrompt.value) {
      const prompt = deferredPrompt.value
      prompt.prompt()
      return prompt.userChoice
        .then((choiceResult) => {
          deferredPrompt.value = null
          if (choiceResult.outcome === 'accepted') {
            isInstalled.value = true
            isInstallable.value = false
          }
          return { type: 'prompted', outcome: choiceResult.outcome }
        })
        .catch(() => {
          deferredPrompt.value = null
          return { type: 'unsupported' }
        })
    }

    // 无 deferredPrompt（浏览器不支持或条件不满足）
    return Promise.resolve({ type: 'unsupported' })
  }

  // beforeinstallprompt 事件处理
  function onBeforeInstallPrompt(e) {
    // iOS / OpenHarmony 不支持此事件，忽略
    if (isIOS.value || isOpenHarmony.value) return
    e.preventDefault()
    deferredPrompt.value = e
    isInstallable.value = true
  }

  // appinstalled 事件处理
  function onAppInstalled() {
    isInstalled.value = true
    isInstallable.value = false
    deferredPrompt.value = null
  }

  onMounted(() => {
    // 初始化检测（仅在客户端执行）
    detectPlatform()
    if (checkInstalled()) {
      isInstalled.value = true
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.removeEventListener('appinstalled', onAppInstalled)
  })

  return {
    isInstallable,
    isInstalled,
    isIOS,
    isOpenHarmony,
    install,
  }
}

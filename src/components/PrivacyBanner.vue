<script>
import { ref, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { NIcon, NModal, NCheckbox, NConfigProvider } from 'naive-ui'
import { darkTheme } from 'naive-ui'
import { WarningShield20Regular, Checkmark24Filled, Settings24Regular, Dismiss24Filled } from '@vicons/fluent'
import { useTheme } from '../composables/useTheme'
import { usePrivacyModal } from '../composables/usePrivacyModal'

export default {
  name: 'PrivacyBanner',
  components: { NIcon, NModal, NCheckbox, NConfigProvider },
  setup() {
    const STORAGE_KEY = 'privacy_consent'
    const router = useRouter()
    const { isDark } = useTheme()
    const { showCookieModal } = usePrivacyModal()

    // Cookie 设置：[必要(固定1), 分析]
    function parseConsent(raw) {
      if (!raw) return null
      if (raw === 'agreed') return [1, 1]
      try {
        return raw.split(',').map(Number)
      } catch {
        return null
      }
    }

    const stored = parseConsent(localStorage.getItem(STORAGE_KEY))

    // 兜底修复：必要 Cookie 位不应为 0，自动修正为 1
    if (stored && stored[0] !== 1) {
      stored[0] = 1
      localStorage.setItem(STORAGE_KEY, `${stored[0]},${stored[1]}`)
      console.log('[隐私控制] 冷知识：我没写必要位为 0 的逻辑，不用试了awa')
    }

    const hasConsent = !!stored
    const showBanner = ref(!hasConsent)

    const analyticsChecked = ref(stored ? stored[1] === 1 : false)

    if (hasConsent) {
      const [necessary, analytics] = stored
      if (analytics === 1) {
        console.log(`[隐私控制] 已有同意记录(必要:${necessary},分析:${analytics})，注入51la`)
        injectAnalytics()
      }
    } else {
      console.log('[隐私控制] 尚未同意暂不注入')
    }

    // 注入 51la 统计脚本
    function injectAnalytics() {
      if (document.getElementById('LA_COLLECT')) return

      const config = { id: "3Ltl0yXYWQcgbDgB", ck: "3Ltl0yXYWQcgbDgB", autoTrack: true, hashMode: true }
      const s = window
      const e = document
      const i = config
      const c = (e.location.protocol === "https:" ? "https://" : "http://") + "sdk.51.la/js-sdk-pro.min.js"
      const n = e.createElement("script")
      n.type = "text/javascript"
      n.setAttribute("charset", "UTF-8")
      n.async = true
      n.src = c
      n.id = "LA_COLLECT"
      i.d = n
      var o = function () { s.LA.ids.push(i) }

      if (s.LA) {
        if (s.LA.ids) o()
      } else {
        s.LA = config
        s.LA.ids = []
        o()
        const r = e.getElementsByTagName("script")[0]
        r.parentNode.insertBefore(n, r)
      }
    }

    // 保存设置并关闭横幅
    function applyConsent(analyticsEnabled) {
      localStorage.setItem(STORAGE_KEY, `1,${analyticsEnabled ? 1 : 0}`)
      showBanner.value = false
      showCookieModal.value = false

      if (analyticsEnabled) {
        console.log(`[隐私控制] 用户同意分析Cookie(必要:1,分析:1)，注入51la`)
        injectAnalytics()
      } else {
        console.log(`[隐私控制] 用户仅接受必要Cookie(必要:1,分析:0)`)
      }
    }

    function handleAgree() {
      analyticsChecked.value = true
      applyConsent(true)
    }

    function handleManageCookie() {
      showCookieModal.value = true
    }

    function handleSaveSettings() {
      applyConsent(analyticsChecked.value)
    }

    function handleAcceptAllInModal() {
      analyticsChecked.value = true
      applyConsent(true)
    }

    function handleCloseModal() {
      showCookieModal.value = false
    }

    // 手动创建模糊遮罩（NModal 自带遮罩不支持 backdrop-filter + 遮罩不够黑）
    watch(showCookieModal, (val) => {
      if (val) {
        nextTick(() => {
          const existing = document.getElementById('privacy-blur-overlay')
          if (!existing) {
            const overlay = document.createElement('div')
            overlay.id = 'privacy-blur-overlay'
            overlay.style.cssText = [
              'position: fixed',
              'top: 0',
              'left: 0',
              'right: 0',
              'bottom: 0',
              'z-index: 1000', // NModal 默认 z-index 是 2000，我们在下层
              '-webkit-backdrop-filter: blur(8px)',
              'backdrop-filter: blur(8px)',
              'background: rgba(0, 0, 0, 0.1)', // 半透明黑色滤镜，叠加 NModal 遮罩后整体更深
              'pointer-events: none', // 不阻挡点击，点击穿透到 NModal 遮罩
              'opacity: 0',
              'transition: opacity 0.3s ease'
            ].join(';')
            document.body.appendChild(overlay)
            // 下一帧触发进场动画
            requestAnimationFrame(() => {
              overlay.style.opacity = '1'
            })
          }
        })
      } else {
        const overlay = document.getElementById('privacy-blur-overlay')
        if (overlay) {
          overlay.style.opacity = '0'
          setTimeout(() => overlay.remove(), 300)
        }
      }
    })

    function handlePrivacyLink(e) {
      e.preventDefault()
      router.push('/docs/privacy')
    }

    return {
      showBanner,
      showCookieModal,
      necessaryChecked: ref(true),
      analyticsChecked,
      isDark,
      darkTheme,
      // 覆盖Naive弹窗背景色为主区域卡片同色（--bg-card: 浅色#FFFFFF, 深色#191919）
      darkOverrides: {
        common: { neutralModal: '#191919' },
        Card: { colorModal: '#191919' },
      },
      WarningShield20Regular,
      Checkmark24Filled,
      Settings24Regular,
      Dismiss24Filled,
      handleAgree,
      handleManageCookie,
      handleSaveSettings,
      handleAcceptAllInModal,
      handleCloseModal,
      handlePrivacyLink,
    }
  },
}
</script>

<template>
  <Transition name="privacy-banner">
    <div v-if="showBanner"
      class="privacy-banner"
      :style="{ zIndex: showCookieModal ? 999 : 10000 }"
    >
      <div class="banner-content">
        <NIcon :component="WarningShield20Regular" :size="18" class="banner-icon" />
        <span class="banner-text">
          在继续使用前，请先阅读并同意
          <a href="/docs/privacy" @click="handlePrivacyLink">隐私政策</a>
          ，若不同意请停止使用本站
        </span>
      </div>
      <div class="banner-actions">
        <button class="btn btn-agree" @click="handleAgree">
          <NIcon :component="Checkmark24Filled" :size="14" color="#1A1A1A" style="margin-right: 4px; vertical-align: -2px;" />
          接受全部
        </button>
        <button class="btn btn-manage" @click="handleManageCookie">
          <NIcon :component="Settings24Regular" :size="14" color="rgba(255, 255, 255, 0.87)" style="margin-right: 4px; vertical-align: -2px;" />
          管理cookie
        </button>
      </div>
    </div>
  </Transition>

  <!-- Cookie 管理弹窗 -->
  <NConfigProvider :theme="isDark ? darkTheme : null" :theme-overrides="isDark ? darkOverrides : undefined">
  <NModal
    v-model:show="showCookieModal"
    preset="card"
    :style="{ maxWidth: '540px', width: 'calc(100% - 32px)', borderRadius: '16px' }"
    title="Cookie 偏好设置"
    :bordered="false"
    closable
    :auto-focus="false"
    @close="handleCloseModal"
  >

    <div class="cookie-modal-desc">选择您希望启用的 Cookie 类型。必要 Cookie 无法禁用，因为它们对网站的正常运行至关重要。</div>

    <div class="cookie-sections">
      <!-- 必要 Cookie -->
      <div class="cookie-section">
        <div class="cookie-header">
          <NCheckbox :checked="true" disabled />
          <span class="cookie-title">必要 Cookie</span>
        </div>
        <div class="cookie-detail">
          这些 Cookie 对于网站的基本功能是必需的，无法禁用。
          <ul class="cookie-list">
            <li>Umami Analytics - 网站统计</li>
            <li>Cloudflare RUM - 性能监控</li>
          </ul>
        </div>
      </div>

      <!-- 分析 Cookie -->
      <div class="cookie-section">
        <div class="cookie-header">
          <NCheckbox v-model:checked="analyticsChecked" />
          <span class="cookie-title">分析 Cookie</span>
        </div>
        <div class="cookie-detail">
          这些 Cookie 帮助我们了解访问者如何使用网站，以便改进用户体验。
          <ul class="cookie-list">
            <li>51.la - 访问分析</li>
          </ul>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="modal-actions">
        <button class="btn btn-save" @click="handleSaveSettings">保存设置</button>
        <button class="btn btn-agree" @click="handleAcceptAllInModal">
          接受全部
        </button>
      </div>
    </template>
  </NModal>
  </NConfigProvider>
</template>

<style scoped>
.privacy-banner {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10000;
  max-width: 1200px;
  width: calc(100% - 48px);
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: rgba(24, 24, 24, 0.95);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.4);
  border-radius: 8px 8px 0 0;
}

.banner-content {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex: 1;
  min-width: 0;
  padding-right: 16px;
}

.banner-icon {
  flex-shrink: 0;
  color: #d48806;
  margin-top: 2px;
}

.banner-text {
  font-size: 15px;
  line-height: 1.5;
  color: #e8e8e8;
}

.banner-text a {
  color: rgba(232, 232, 232, 0.65);
  text-decoration: underline;
  font-weight: 600;
}

.banner-actions {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

.btn {
  height: 30px;
  padding: 0 14px;
  border-radius: 16px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  overflow: hidden;
  position: relative;
}

.btn-agree {
  background: #fff;
  color: #1A1A1A;
  border: none;
}

.btn-agree:hover {
  background: #E8E8E8;
}

.btn-manage {
  background: transparent;
  color: rgba(255, 255, 255, 0.87);
  border: 1px solid rgba(255, 255, 255, 0.87);
}

.btn-manage:hover {
  opacity: 1;
}

/* 弹窗样式 - Naive UI 深色协议适配 */
.cookie-modal-desc {
  font-size: 14px;
  line-height: 1.6;
  color: var(--n-text-color-2);
}

.cookie-sections {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cookie-section {
  border-bottom: 1px solid var(--n-divider-color);
  padding-bottom: 16px;
}

.cookie-section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.cookie-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cookie-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--n-text-color-1);
  line-height: 1.4;
}

.cookie-detail {
  margin-top: 8px;
  padding-left: 28px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--n-text-color-2);
}

.cookie-list {
  margin: 8px 0 0;
  padding-left: 20px;
  font-size: 13px;
  color: var(--n-text-color-2);
}

.cookie-list li {
  line-height: 1.8;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 8px;
}

/* 保存设置按钮 - 浅色黑底深色白底 */
.btn-save {
  height: 34px;
  padding: 0 20px;
  border-radius: 17px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  border: none;
}

/* 浅色模式：黑底白字 */
[data-theme="light"] .btn-save {
  background: #1A1A1A;
  color: #fff !important;
}

/* 深色模式：白底黑字（默认也是这个，因为弹窗深色时白底更合适） */
[data-theme="dark"] .btn-save {
  background: #fff;
  color: #1A1A1A !important;
}

.btn-save:hover {
  opacity: 0.85;
}

/* 弹窗内接受全部按钮 - 默认为空心描边 */
.modal-actions .btn-agree {
  height: 34px;
  padding: 0 20px;
  border-radius: 17px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  overflow: hidden;
  position: relative;
  border: 1.5px solid currentColor;
}

/* 浅色模式：白底黑字 + 黑描边（看起来像空心） */
[data-theme="light"] .modal-actions .btn-agree {
  background: #fff;
  color: #1A1A1A;
}

[data-theme="light"] .modal-actions .btn-agree:hover {
  background: #E8E8E8;
}

/* 深色模式：透明底 + 浅色文字 + 浅色描边（纯空心） */
[data-theme="dark"] .modal-actions .btn-agree {
  background: transparent;
  color: rgba(255, 255, 255, 0.87);
}

[data-theme="dark"] .modal-actions .btn-agree:hover {
  background: rgba(255, 255, 255, 0.08);
}

/* 横幅动画 */
.privacy-banner-enter-active,
.privacy-banner-leave-active {
  transition: transform 0.35s ease, opacity 0.35s ease;
}

.privacy-banner-enter-from {
  transform: translateX(-50%) translateY(100%);
  opacity: 0;
}

.privacy-banner-leave-to {
  transform: translateX(-50%) translateY(100%);
  opacity: 0;
}

/* 移动端适配 */
@media (max-width: 770px) {
  .privacy-banner {
    width: calc(100% - 32px);
    padding: 14px 16px;
    height: auto;
    min-height: 67px;
    flex-direction: column;
    gap: 12px;
  }

  .banner-content {
    justify-content: flex-start;
    text-align: left;
    padding-right: 0;
  }

  .banner-text {
    font-size: 13px;
  }

  .banner-actions {
    width: 100%;
    justify-content: center;
  }
}
</style>



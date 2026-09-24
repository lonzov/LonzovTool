<script>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { NIcon, NModal, NCheckbox } from 'naive-ui'
import { WarningShield20Regular, Checkmark24Filled, Settings24Regular, Dismiss24Filled } from '@vicons/fluent'
import { usePrivacyModal } from '../composables/usePrivacyModal'

export default {
  name: 'PrivacyBanner',
  components: { NIcon, NModal, NCheckbox },
  setup() {
    const STORAGE_KEY = 'privacy_consent'
    const router = useRouter()
    const { showCookieModal } = usePrivacyModal()

    // 隐私偏好：[必要(固定1), 分析, 回放]
    function parseConsent(raw) {
      if (!raw) return null
      if (raw === 'agreed') return [1, 1, 0]
      try {
        const bits = raw.split(',').map(Number)
        // 旧记录只有必要/分析两位，回放位补 0（新用途需重新授权）
        while (bits.length < 3) bits.push(0)
        return bits
      } catch {
        return null
      }
    }

    const stored = typeof localStorage !== 'undefined' ? parseConsent(localStorage.getItem(STORAGE_KEY)) : null

    // 兜底修复：必要位不应为 0，自动修正为 1
    if (stored && stored[0] !== 1) {
      stored[0] = 1
      try { localStorage.setItem(STORAGE_KEY, stored.join(',')) } catch { /* SSR safe */ }
    }

    const hasConsent = !!stored
    const showBanner = ref(!hasConsent)

    // 隐私政策/偏好更新公告：已同意过的用户若未记录本版本，再提示一次
    const NOTICE_VERSION = '260921'
    const NOTICE_KEY = 'privacy_notice_version'
    const noticeVersion = typeof localStorage !== 'undefined' ? localStorage.getItem(NOTICE_KEY) : null
    const showUpdateBanner = ref(hasConsent && noticeVersion !== NOTICE_VERSION)

    const analyticsChecked = ref(stored ? stored[1] === 1 : false)
    const replayChecked = ref(stored ? stored[2] === 1 : false)

    if (hasConsent) {
      const [necessary, analytics, replay] = stored
      console.log(`[隐私控制] 已有同意记录(必要:${necessary},分析:${analytics},回放:${replay})`)
      if (analytics === 1) {
        console.log('[隐私控制] 注入51la')
        injectAnalytics()
      }
      if (replay === 1) {
        console.log('[隐私控制] 注入Umami回放')
        injectReplay()
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

    // 注入 Umami 回放录制脚本（依赖主脚本 script.js 先建立会话）
    function injectReplay() {
      if (document.getElementById('umami-replay')) return

      const n = document.createElement('script')
      n.defer = true
      n.src = 'https://imamu.lonzov.top/recorder.js'
      n.setAttribute('data-website-id', '32b32d08-4710-482c-974d-390290f93229')
      n.setAttribute('data-sample-rate', '0.25')
      n.setAttribute('data-mask-level', 'strict')
      n.setAttribute('data-max-duration', '300000')
      n.id = 'umami-replay'
      document.head.appendChild(n)
    }

    // 保存设置并关闭横幅
    function applyConsent(analyticsEnabled, replayEnabled) {
      localStorage.setItem(STORAGE_KEY, `1,${analyticsEnabled ? 1 : 0},${replayEnabled ? 1 : 0}`)
      localStorage.setItem(NOTICE_KEY, NOTICE_VERSION)
      showBanner.value = false
      showUpdateBanner.value = false
      showCookieModal.value = false

      if (analyticsEnabled) {
        console.log(`[隐私控制] 用户同意分析Cookie(必要:1,分析:1,回放:${replayEnabled ? 1 : 0})，注入51la`)
        injectAnalytics()
      } else {
        console.log(`[隐私控制] 用户仅接受必要Cookie(必要:1,分析:0,回放:${replayEnabled ? 1 : 0})`)
      }
      if (replayEnabled) {
        console.log('[隐私控制] 注入Umami回放')
        injectReplay()
      }
    }

    function handleAgree() {
      analyticsChecked.value = true
      replayChecked.value = true
      applyConsent(true, true)
    }

    function handleManageCookie() {
      showCookieModal.value = true
    }

    function handleSaveSettings() {
      applyConsent(analyticsChecked.value, replayChecked.value)
    }

    function handleAcceptAllInModal() {
      analyticsChecked.value = true
      replayChecked.value = true
      applyConsent(true, true)
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
              'z-index: 1990', // 盖住移动端汉堡(1950)/菜单抽屉(1900)，仍低于 NModal 遮罩(≥2000)
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

    // 移动端弹窗高度响应式：60px 上下间距
    const isCompact = ref(false)
    let _mq
    function _onMqChange(e) { isCompact.value = e.matches }
    onMounted(() => {
      _mq = window.matchMedia('(max-width: 640px)')
      isCompact.value = _mq.matches
      _mq.addEventListener('change', _onMqChange)
    })
    onUnmounted(() => {
      if (_mq) _mq.removeEventListener('change', _onMqChange)
    })

    const modalStyle = computed(() => ({
      maxWidth: '540px',
      width: 'calc(100% - 32px)',
      maxHeight: isCompact.value ? 'calc(100vh - 120px)' : undefined,
      borderRadius: 'var(--radius-xl)',
    }))

    return {
      showBanner,
      showUpdateBanner,
      showCookieModal,
      necessaryChecked: ref(true),
      analyticsChecked,
      replayChecked,
      modalStyle,
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
          <a href="/docs/privacy/" @click="handlePrivacyLink">隐私政策</a>
          ，若不同意请停止使用本站
        </span>
      </div>
      <div class="banner-actions">
        <button class="btn btn-agree" @click="handleAgree">
          <NIcon :component="Checkmark24Filled" :size="14" color="var(--primary)" style="margin-right: 4px; vertical-align: -2px;" />
          接受全部
        </button>
        <button class="btn btn-manage" @click="handleManageCookie">
          <NIcon :component="Settings24Regular" :size="14" color="var(--primary-foreground)" style="margin-right: 4px; vertical-align: -2px;" />
          管理偏好
        </button>
      </div>
    </div>
  </Transition>

  <!-- 隐私政策/偏好更新提示（仅已同意过的用户） -->
  <Transition name="privacy-banner">
    <div v-if="showUpdateBanner"
      class="privacy-banner"
      :style="{ zIndex: showCookieModal ? 999 : 10000 }"
    >
      <div class="banner-content">
        <NIcon :component="WarningShield20Regular" :size="18" class="banner-icon" />
        <span class="banner-text">
          我们更新了
          <a href="/docs/privacy/" @click="handlePrivacyLink">隐私政策</a>
          和新的隐私偏好，请重新阅读并选择偏好
        </span>
      </div>
      <div class="banner-actions">
        <button class="btn btn-agree" @click="handleAgree">
          <NIcon :component="Checkmark24Filled" :size="14" color="var(--primary)" style="margin-right: 4px; vertical-align: -2px;" />
          接受全部
        </button>
        <button class="btn btn-manage" @click="handleManageCookie">
          <NIcon :component="Settings24Regular" :size="14" color="var(--primary-foreground)" style="margin-right: 4px; vertical-align: -2px;" />
          管理偏好
        </button>
      </div>
    </div>
  </Transition>

  <!-- 隐私偏好弹窗 -->
  <NModal
    v-model:show="showCookieModal"
    preset="card"
    :style="modalStyle"
    title="隐私偏好"
    :bordered="false"
    closable
    :auto-focus="false"
    content-scrollable
    @close="handleCloseModal"
  >

    <div class="cookie-modal-desc">选择您希望启用的服务类型。必要服务无法禁用，因为它们对网站的正常运行至关重要。</div>

    <div class="cookie-sections">
      <!-- 必要服务 -->
      <div class="cookie-section">
        <div class="cookie-header">
          <NCheckbox :checked="true" disabled />
          <span class="cookie-title">必要服务</span>
        </div>
        <div class="cookie-detail">
          这些服务对于网站的基本功能是必需的，无法禁用。
          <ul class="cookie-list">
            <li>Umami Analytics - 隐私友好的匿名统计，不使用Cookie</li>
            <li>Cloudflare RUM - 性能监控</li>
          </ul>
        </div>
      </div>

      <!-- 数据统计 -->
      <div class="cookie-section">
        <div class="cookie-header">
          <NCheckbox v-model:checked="analyticsChecked" />
          <span class="cookie-title">数据统计</span>
        </div>
        <div class="cookie-detail">
          更详细的统计访问数据（如访客留存、SEO分析），辅助运营决策。
          <ul class="cookie-list">
            <li>51.la - 访问分析</li>
          </ul>
        </div>
      </div>

      <!-- 回放统计 -->
      <div class="cookie-section">
        <div class="cookie-header">
          <NCheckbox v-model:checked="replayChecked" />
          <span class="cookie-title">回放统计</span>
        </div>
        <div class="cookie-detail">
          帮助我们了解访问者如何使用网站以及遇到的问题，以便改进用户体验。
          <ul class="cookie-list">
            <li>Umami Replay - 匿名化回放统计，页面文字与输入内容均在浏览器端遮蔽</li>
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
</template>

<style scoped>
.privacy-banner {
  /* 反色横幅：底走 --primary，文字走 --primary-foreground，随主题整体翻转 */
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
  background: color-mix(in srgb, var(--primary) 95%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.4);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
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
  /* 警告琥珀色：全站没有 warning token，保留固定值（在两套主题的反色底上都可读） */
  color: var(--warning);
  margin-top: 2px;
}

.banner-text {
  font-size: 15px;
  line-height: 1.5;
  color: var(--primary-foreground);
}

.banner-text a {
  color: color-mix(in srgb, var(--primary-foreground) 65%, transparent);
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
  border-radius: var(--radius-xl);
  corner-shape: round;
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
  background: var(--primary-foreground);
  color: var(--primary);
  border: none;
}

.btn-agree:hover {
  opacity: 0.85;
}

.btn-manage {
  background: transparent;
  color: var(--primary-foreground);
  border: 1px solid currentColor;
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

/* 保存设置按钮 - 实心主按钮（反色块，两套主题由 token 翻转） */
.btn-save {
  height: 34px;
  padding: 0 20px;
  border-radius: var(--radius-full);
  corner-shape: round;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  border: none;
  background: var(--primary);
  color: var(--primary-foreground) !important;
}

.btn-save:hover {
  opacity: 0.85;
}

/* 弹窗内接受全部按钮 - 空心描边（底与文字同卡片表面，只留一圈描边） */
.modal-actions .btn-agree {
  height: 34px;
  padding: 0 20px;
  border-radius: var(--radius-full);
  corner-shape: round;
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
  background: var(--card);
  color: var(--foreground);
}

.modal-actions .btn-agree:hover {
  background: var(--muted);
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



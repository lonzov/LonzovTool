<template>
  <div class="footer-top-divider"></div>
  <footer class="footer">
    <div class="footer-inner">
      <div class="footer-content">
        <div class="footer-section footer-info">
          <p class="footer-copyright">© 浪小舟 2025~{{ currentYear }} 保留所有权利.</p>
          <p class="footer-disclaimer">"Minecraft" 以及 "我的世界" 为 Mojang Synergies AB 的商标.</p>
          <p class="footer-third-party">第三方网站内容由其运营者负责，请自行判断，与本站无关.</p>
          <p class="footer-uptime">
            本站已运行 {{ uptime.years }}年 {{ uptime.months }}月 {{ uptime.days }}天
            <span
              v-if="swVersionShort"
              class="sw-version"
              :class="{ 'sw-version--expandable': swVersionExtra }"
              @click="toggleVersion"
            >| {{ swVersionShort }}<span v-if="showFull && swVersionExtra" class="sw-version-extra">{{ swVersionExtra }}</span></span>
          </p>

          <!-- 社交按钮行 -->
          <div class="social-buttons">
            <a
              v-for="btn in socialLinks"
              :key="btn.name"
              :href="btn.href"
              target="_blank"
              rel="noopener noreferrer"
              :title="btn.title"
              class="social-btn"
            >
              <component :is="btn.icon" size="16" class="social-btn-icon" />
            </a>
          </div>
        </div>
        <div class="footer-section">
          <h3 class="footer-title">友链推荐</h3>
          <ul class="footer-list">
            <li><a href="https://www.rainyun.com/lonzov_?s=tool_foot" target="_blank" rel="noopener noreferrer">雨云</a></li>
          </ul>
        </div>
        <div class="footer-section">
          <h3 class="footer-title">帮助支持</h3>
          <ul class="footer-list">
            <li><a href="/docs/" @click.prevent="$router.push('/docs/')">常见问题</a></li>
            <li><a href="https://stats.uptimerobot.com/E0cvH6yiGq" target="_blank" rel="noopener noreferrer">站点监控</a></li>
            <li><a href="/docs/privacy" @click.prevent="$router.push('/docs/privacy')">隐私政策</a></li>
            <li><a href="#" @click.prevent="handleUpdateCookie">更新 Cookie 选项</a></li>
          </ul>
        </div>
        <div class="footer-section">
          <h3 class="footer-title">联系我们</h3>
          <ul class="footer-list">
            <li><a href="mailto:i@lonzov.top" target="_blank" rel="noopener noreferrer">邮件</a></li>
            <li><a href="https://qm.qq.com/q/3EGIb5POqk" target="_blank" rel="noopener noreferrer">QQ 群</a></li>
            <li><a href="https://github.com/lonzov/lonzovtool/" target="_blank" rel="noopener noreferrer">GitHub</a></li>
          </ul>
        </div>
      </div>
    </div>
  </footer>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { usePrivacyModal } from '../composables/usePrivacyModal'
import { RiBilibiliLine, RiTiktokFill, RiQqFill, RiRssFill } from '@remixicon/vue'

const START_DATE = new Date(2025, 3, 15) // 2025-04-15

export default {
  name: 'AppFooter',
  setup() {
    const screenWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)

    function handleResize() {
      screenWidth.value = window.innerWidth
    }

    onMounted(() => window.addEventListener('resize', handleResize))
    onBeforeUnmount(() => window.removeEventListener('resize', handleResize))

    const breakpoint = computed(() => {
      if (screenWidth.value <= 480) return 'mobile'
      if (screenWidth.value <= 768) return 'tablet'
      return 'desktop'
    })

    // 当前年份（构建时写死上限）
    const currentYear = ref(new Date().getFullYear())

    // 运行时间
    function calcUptime() {
      const now = new Date()
      let years = now.getFullYear() - START_DATE.getFullYear()
      let months = now.getMonth() - START_DATE.getMonth()
      let days = now.getDate() - START_DATE.getDate()

      if (days < 0) {
        months--
        const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0)
        days += prevMonth.getDate()
      }
      if (months < 0) {
        years--
        months += 12
      }

      return { years, months, days: Math.max(0, days) }
    }

    const uptime = ref(calcUptime())

    let uptimeTimer = null
    onMounted(() => {
      // 每天刷新一次运行时间即可（跨天时天数变化）
      uptimeTimer = setInterval(() => {
        uptime.value = calcUptime()
      }, 24 * 60 * 60 * 1000)
    })
    onBeforeUnmount(() => {
      if (uptimeTimer) clearInterval(uptimeTimer)
    })

    // SW 缓存版本号
    const swVersionShort = ref('')
    const swVersionExtra = ref('')
    const showFull = ref(false)

    function parseSWVersion() {
      const raw = localStorage.getItem('current_sw_version')
      if (!raw) return
      const v = raw.startsWith('v') ? raw : 'v' + raw
      const parts = v.replace(/^v/, '').split('.')
      const short = parts.slice(0, 4).join('.')
      swVersionShort.value = 'v' + short
      if (parts.length > 4) {
        swVersionExtra.value = '.' + parts.slice(4).join('.')
      }
    }

    /** 直接从当前活跃的 SW 获取版本号，实时更新 */
    function fetchSWVersion() {
      if (!navigator.serviceWorker?.controller) return
      const mc = new MessageChannel()
      mc.port1.onmessage = (e) => {
        if (e.data?.version) {
          localStorage.setItem('current_sw_version', e.data.version)
          parseSWVersion()
        }
      }
      navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' }, [mc.port2])
    }

    function toggleVersion() {
      if (!swVersionExtra.value) return
      showFull.value = !showFull.value
    }

    onMounted(() => {
      parseSWVersion()
      // 监听 SW 控制器变更，实时同步版本号
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('controllerchange', fetchSWVersion)
      }
    })

    onBeforeUnmount(() => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', fetchSWVersion)
      }
    })

    const { openModal } = usePrivacyModal()

    function handleUpdateCookie() {
      openModal()
    }

    // 社交链接配置
    const socialLinks = [
      { name: 'bilibili', label: 'Bilibili', icon: RiBilibiliLine, href: 'https://space.bilibili.com/3494378672753456', title: '关注我们的 B 站频道' },
      { name: 'douyin', label: '抖音', icon: RiTiktokFill, href: 'https://www.douyin.com/user/MS4wLjABAAAADj8IaLSifYcIu5tcIOncHXGk_LjpeyRE7MJUV7xbIaK6A4Hijh1E--IiII91dFCn', title: '关注我们的抖音账号' },
      { name: 'qqgroup', label: 'QQ群', icon: RiQqFill, href: 'https://qm.qq.com/q/3EGIb5POqk', title: '加入 QQ 通知群' },
      { name: 'blog', label: '博客', icon: RiRssFill, href: 'https://blog.lonzov.top/', title: '博客' },
    ]

    return { breakpoint, currentYear, uptime, handleUpdateCookie, socialLinks, swVersionShort, swVersionExtra, showFull, toggleVersion }
  },
}
</script>

<style scoped>
.footer {
  --footer-padding-x: 24px;
  --footer-padding-y-top: 32px;
  --footer-padding-y-bottom: 32px;
  --footer-gap: 40px;
  --title-size: 18px;

  /* 卡片样式，与其他卡片一致 */
  width: 100%;
  box-sizing: border-box;
  margin-top: 24px;
  position: relative;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;

  /* 主题切换过渡动画 */
  transition: background-color 0.4s ease, border-color 0.4s ease;
}

/* ---- 断点：≥880 布局 4 ---- */
@media (min-width: 880px) {
  .footer-content {
    grid-template-columns: 260px 1fr 1fr 1fr;
  }
}

/* ---- 断点：879~660 布局 1,3 ---- */
@media (max-width: 879px) and (min-width: 660px) {
  .footer {
    --footer-padding-x: 20px;
    --footer-padding-y-top: 24px;
    --footer-padding-y-bottom: 24px;
    --footer-gap: 32px;
    --title-size: 16px;
  }
  .footer-content {
    grid-template-columns: 1fr 1fr 1fr;
  }
  .footer-info {
    grid-column: 1 / -1;
  }
}

/* ---- 断点：659~570 布局 2,2 ---- */
@media (max-width: 659px) and (min-width: 570px) {
  .footer {
    --footer-padding-x: 18px;
    --footer-padding-y-top: 22px;
    --footer-padding-y-bottom: 22px;
    --footer-gap: 28px;
    --title-size: 16px;
  }
  .footer-content {
    grid-template-columns: 240px 1fr;
  }
}

/* ---- 断点：≤569 布局 1,1,1,1 ---- */
@media (max-width: 569px) {
  .footer {
    --footer-padding-x: 16px;
    --footer-padding-y-top: 20px;
    --footer-padding-y-bottom: 20px;
    --footer-gap: 28px;
    --title-size: 16px;
  }
  .footer-content {
    grid-template-columns: 1fr;
  }
}

/* 内容居中容器 */
.footer-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--footer-padding-y-top) var(--footer-padding-x) var(--footer-padding-y-bottom);
}

/* 顶部水平分割线 */
.footer-top-divider {
  width: 80%;
  max-width: 960px;
  height: 1px;
  background: var(--border-color);
  margin: 64px auto 32px auto;
  transition: background-color 0.4s ease;
}

/* 内容标题下方的渐变分割线 */
.footer-title::after {
  content: '';
  position: absolute;
  bottom: -6px;
  left: 0;
  width: 44px;
  height: 1.7px;
  background: linear-gradient(to right, var(--text-primary), transparent);
  border-radius: 2px;
  opacity: 1;
  transition: opacity 0.4s ease;
}

/* Grid 布局，各断点硬编码 grid-template-columns */
.footer-content {
  display: grid;
  gap: var(--footer-gap);
}

/* 每一列 */
.footer-section {
  display: flex;
  flex-direction: column;
}

/* ---- 左侧信息区 ---- */
.footer-info {
  text-align: left;
}

.footer-copyright,
.footer-uptime,
.footer-third-party,
.footer-disclaimer {
  font-size: 13px;
  color: var(--text-tertiary);
  line-height: 1.8;
  margin: 0 0 4px 0;
}

/* 标题 */
.footer-title {
  font-size: var(--title-size);
  font-weight: 700;
  color: var(--text-primary);
  margin: -5px 0 17px 0;
  position: relative;
}

/* 列表 */
.footer-list {
  list-style: none;
  padding: 0;
  margin: 0;
  flex: 1;
}

.footer-list li {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 8px;
  transition: color 0.3s ease;
  cursor: pointer;
}

.footer-list a {
  color: inherit;
  text-decoration: none;
}

.footer-list a:hover {
  color: var(--text-primary);
}

/* ===== 社交按钮行 ===== */
.social-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
}

.social-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  background: #FFFFFF;
  border-radius: 8px;
  border: 1px solid #E0E0E0;
  color: var(--text-secondary);
  text-decoration: none;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 0 0 transparent;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

[data-theme="dark"] .social-btn {
  background: #191919;
  border-color: #2B2B2B;
}

.social-btn:hover {
  background: var(--bg-sub) !important;
  box-shadow: 0 0 7px rgba(128, 128, 128, 0.3) !important;
  color: var(--text-primary) !important;
}

.social-btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.sw-version--expandable {
  cursor: pointer;
  user-select: none;
}
.sw-version--expandable:hover {
  opacity: 0.8;
}
.sw-version-extra {
  transition: opacity 0.3s ease;
}
</style>

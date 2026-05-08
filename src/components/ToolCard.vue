<script>
import { h, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { NHighlight } from 'naive-ui'
import { useWorkspace } from '../composables/useWorkspace.js'
import { useMouseGlow } from '../composables/useMouseGlow.js'

export default {
  components: {
    NHighlight,
  },
  props: {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    logo: {
      type: String,
      default: '',
    },
    link: {
      type: String,
      default: '',
    },
    searchPatterns: {
      type: Array,
      default: () => [],
    },
  },
  setup() {
    const router = useRouter()
    const { openTab } = useWorkspace()
    const { subscribe: subGlow, unsubscribe: unsubGlow } = useMouseGlow()

    const imageError = ref(false)
    const imageLoaded = ref(false)
    const isLoading = ref(false)
    const isInViewport = ref(false)
    const retryCount = ref(0)
    const retryTimer = ref(null)
    const imgKey = ref(0)

    const isDark = ref(document.documentElement.getAttribute('data-theme') === 'dark')

    // 监听主题变化
    const observeTheme = () => {
      const observer = new MutationObserver(() => {
        isDark.value = document.documentElement.getAttribute('data-theme') === 'dark'
      })
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
      })
    }

    // 监听视口状态
    const checkViewport = (callback) => {
      const rect = callback().getBoundingClientRect()
      const viewportHeight = window.innerHeight
      // 视口内 + 视口下方一行（假设卡片高度约 86px）
      const threshold = viewportHeight + 86

      isInViewport.value = rect.top < threshold
    }

    onMounted(() => {
      observeTheme()
      // 初始检查视口
      const check = () => {
        const el = document.getElementById(`logo-container-${Date.now()}`)
        if (el) {
          const rect = el.getBoundingClientRect()
          const viewportHeight = window.innerHeight
          const threshold = viewportHeight + 86
          isInViewport.value = rect.top < threshold
        }
      }
      check()
      window.addEventListener('scroll', check, { passive: true })
      window.addEventListener('resize', check)
    })

    onUnmounted(() => {
      window.removeEventListener('scroll', checkViewport)
      window.removeEventListener('resize', checkViewport)
      if (retryTimer.value) clearTimeout(retryTimer.value)
    })

    return {
      imageError,
      imageLoaded,
      isLoading,
      isInViewport,
      retryCount,
      imgKey,
      isDark,
      openTab,
      router,
      subGlow,
      unsubGlow,
    }
  },
  data() {
    return {
      containerId: `logo-${Math.random().toString(36).substr(2, 9)}`,
      observer: null,
    }
  },
  mounted() {
    this.initIntersectionObserver()
    this.checkViewport()
    this.subGlow(this.handleGlow)
  },
  beforeUnmount() {
    if (this.observer) {
      this.observer.disconnect()
    }
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.unsubGlow(this.handleGlow)
  },
  methods: {
    initIntersectionObserver() {
      // 视口 + 下方一行（约 86px）
      const rootMargin = '0px 0px 86px 0px'

      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            this.isInViewport = entry.isIntersecting
          })
        },
        {
          rootMargin,
          threshold: 0,
        },
      )

      // 等待 DOM 渲染后观察元素
      this.$nextTick(() => {
        const el = document.getElementById(this.containerId)
        if (el && this.observer) {
          this.observer.observe(el)
        }
      })
    },
    checkViewport() {
      const el = document.getElementById(this.containerId)
      if (el) {
        const rect = el.getBoundingClientRect()
        const viewportHeight = window.innerHeight
        const threshold = viewportHeight + 86
        this.isInViewport = rect.top < threshold
      }
    },
    retryLoad() {
      if (this.retryTimer) clearTimeout(this.retryTimer)

      const delay = this.retryCount === 0 ? 0 : this.retryCount === 1 ? 1000 : -1
      if (delay < 0) {
        this.imageError = true
        this.isLoading = false
        return
      }

      this.retryTimer = setTimeout(() => {
        this.retryCount++
        this.isLoading = true
        this.imageError = false
        this.imageLoaded = false
        this.imgKey++
      }, delay)
    },
    handleImageLoad() {
      this.imageLoaded = true
      this.imageError = false
      this.isLoading = false
      this.retryCount = 0
      if (this.retryTimer) clearTimeout(this.retryTimer)
    },
    handleImageError() {
      if (this.retryCount < 2) {
        this.retryLoad()
      } else {
        this.imageError = true
        this.isLoading = false
        this.retryCount = 0
      }
    },
    handleGlow(mouseX, mouseY) {
      const el = this.$el
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = mouseX - rect.left
      const y = mouseY - rect.top
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2)
      // 阈值：卡片对角线的 1.8 倍范围
      const threshold = Math.sqrt(rect.width ** 2 + rect.height ** 2) * 1.8

      if (dist < threshold) {
        el.style.setProperty('--mouse-x', `${x}px`)
        el.style.setProperty('--mouse-y', `${y}px`)
        el.classList.add('glow-active')
      } else {
        el.classList.remove('glow-active')
      }
    },
  },
  watch: {
    logo() {
      // logo 变化时重置状态
      this.imageError = false
      this.imageLoaded = false
      this.isLoading = false
      this.retryCount = 0
      this.checkViewport()
    },
  },
  render() {
    const hasLogo = !!this.logo
    const shouldLoad = hasLogo && this.isInViewport && !this.imageError
    const showImage = hasLogo && this.imageLoaded && !this.imageError
    const showError = hasLogo && this.imageError
    const showSkeleton = hasLogo && !this.imageLoaded && !this.imageError

    // 渐变骨架屏
    const skeletonGradient = this.isDark
      ? 'linear-gradient(120deg, #232526 0%, #414345 100%)'
      : 'linear-gradient(120deg, #f0f2f5 0%, #e0e0e0 100%)'

    const isInternal = this.link.startsWith('/') && this.link !== '/'

    const cardStyle = {
      display: 'flex',
      alignItems: 'flex-start',
      padding: '12px 16px',
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      cursor: this.link ? 'pointer' : 'default',
      transition: 'all 0.3s ease',
      boxShadow: '0 0 0 transparent',
      transform: 'translateY(-1px)',
      minHeight: '86px',
      WebkitTapHighlightColor: 'transparent',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      position: 'relative',
      textDecoration: 'none',
      color: 'inherit',
    }

    return h(
      this.link ? 'a' : 'div',
      {
        class: 'tool-card',
        style: cardStyle,
        ...(this.link ? {
          href: this.link,
          target: isInternal ? '' : '_blank',
          rel: isInternal ? '' : 'noopener',
          onClick: (e) => {
            // 站内链接：拦截默认行为，走 SPA 路由（预渲染时 JS 未执行则正常跳转 <a>）
            if (isInternal) {
              e.preventDefault()
              const toolPath = this.link.replace(/\/$/, '') || '/'
              if (toolPath && toolPath !== '/') {
                // 下载页不入工作站标签
                if (!toolPath.startsWith('/down/')) {
                  this.openTab(toolPath, this.title)
                }
                this.router.push(toolPath)
              }
            }
            // 外部链接：不拦截，<a> 自带 target="_blank" 正常新窗口打开
          },
        } : {}),
      },
      [
        // 左侧 logo 区域
        h(
          'div',
          {
            id: this.containerId,
            class: 'tool-card-logo',
            style: {
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'var(--logo-gradient)',
              marginRight: '12px',
              flexShrink: 0,
              overflow: 'hidden',
              position: 'relative',
              transition: 'background 0.4s ease',
            },
          },
          [
            // Logo 图片容器
            h(
              'div',
              {
                class: 'tool-card-logo-inner',
                style: {
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  transition: 'transform 0.3s ease',
                },
              },
              [
                // 骨架屏扫光效果
                showSkeleton
                  ? h('div', {
                      class: 'skeleton-scan',
                      style: {
                        width: '100%',
                        height: '100%',
                        background: skeletonGradient,
                        backgroundSize: '200% 100%',
                        animation: 'skeleton-scan 3s infinite linear',
                      },
                    })
                  : null,
                // 图片
                shouldLoad
                  ? h('img', {
                      key: `logo-${this.imgKey}`,
                      src: this.logo,
                      alt: '',
                      crossorigin: 'anonymous',
                      style: {
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        display: showImage ? '' : 'none',
                      },
                      onLoad: this.handleImageLoad,
                      onError: this.handleImageError,
                    })
                  : null,
              ],
            ),
            // 错误占位符
            showError
              ? h(
                  'div',
                  {
                    style: {
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                  },
                  [
                    h(
                      'svg',
                      {
                        viewBox: '0 0 20 20',
                        style: {
                          width: '20px',
                          height: '20px',
                          fill: this.isDark ? '#4A4A4A' : '#B0B0B0',
                        },
                      },
                      [
                        h('path', {
                          d: 'M2.854 2.146a.5.5 0 1 0-.708.708l3.67 3.668a5.326 5.326 0 0 0-.463 1.724h-.07C3.468 8.246 2 9.758 2 11.623C2 13.488 3.47 15 5.282 15h9.01l2.854 2.854a.5.5 0 0 0 .708-.708l-15-15zM18 11.623a3.4 3.4 0 0 1-1.452 2.804l-9.49-9.49C7.808 4.353 8.792 4 10 4c2.817 0 4.415 1.923 4.647 4.246h.07c1.814 0 3.283 1.512 3.283 3.377z',
                        }),
                      ],
                    ),
                  ],
                )
              : null,
          ],
        ),
        // 右侧内容
        h(
          'div',
          {
            style: {
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              minWidth: 0,
            },
          },
          [
            // 标题 - 使用 NHighlight 高亮
            h(
              'div',
              {
                style: {
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: 'var(--text-primary)',
                  marginBottom: '6px',
                },
              },
              [
                h(NHighlight, {
                  text: this.title,
                  patterns: this.searchPatterns,
                  highlightStyle: {
                    backgroundColor: 'var(--highlight-bg, #fadb14)',
                    color: 'var(--highlight-color, #000)',
                    padding: '0 2px',
                    borderRadius: '2px',
                  },
                }),
              ],
            ),
            // 描述 - 使用 NHighlight 高亮
            h(
              'div',
              {
                style: {
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.4',
                },
              },
              [
                h(NHighlight, {
                  text: this.description,
                  patterns: this.searchPatterns,
                  highlightStyle: {
                    backgroundColor: 'var(--highlight-bg, #fadb14)',
                    color: 'var(--highlight-color, #000)',
                    padding: '0 2px',
                    borderRadius: '2px',
                  },
                }),
              ],
            ),
          ],
        ),
      ],
    )
  },
}
</script>

<style>
/* ---- Logo 渐变背景深浅色模式变量 ---- */
:root {
  --logo-gradient: linear-gradient(135deg, #f0f2f5 0%, #e0e0e0 100%);
}
[data-theme="dark"] {
  --logo-gradient: linear-gradient(135deg, #232526 0%, #414345 100%);
}
/* -------------------------------------- */

/* 卡片悬浮效果 */
.tool-card:hover {
  background: var(--bg-sub) !important;
  border-color: var(--border-color) !important;
  transform: translateY(-4px) !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15) !important;
}

/* 高光跟随边框效果 */
.tool-card::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  padding: 1px;
  background: radial-gradient(
    80px circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
    rgba(255, 255, 255, 0.65),
    transparent 60%
  );
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  -webkit-mask-composite: destination-out;
  opacity: 0;
  pointer-events: none;
  z-index: 10;
  transition: opacity 0.2s ease;
}

.tool-card.glow-active::before {
  opacity: 1;
}

/* 浅色模式：更亮的彩色高光 */
[data-theme="light"] .tool-card::before {
  background: radial-gradient(
    80px circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
    rgb(255, 255, 255),
    transparent 60%
  );
}

.tool-card:hover .tool-card-logo-inner {
  transform: scale(1.13) !important;
}

.tool-card-logo {
  transition: background 0.4s ease !important;
}
@keyframes skeleton-scan {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>

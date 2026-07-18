<script>
import { h, ref, onMounted, onUnmounted, Transition } from 'vue'
import { useRouter } from 'vue-router'
import { NHighlight, NIcon, useMessage } from 'naive-ui'
import { Star24Filled } from '@vicons/fluent'
import { useWorkspace } from '../composables/useWorkspace.js'
import { useMouseGlow, applyGlow } from '../composables/useMouseGlow.js'

export default {
  components: {
    NHighlight,
    NIcon,
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
    toolId: {
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
    const message = useMessage()

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
      message,
    }
  },
  data() {
    return {
      containerId: `logo-${Math.random().toString(36).substr(2, 9)}`,
      observer: null,
      isFavorite: false,
      longPressTimer: null,
      longPressed: false,
      touchFired: false,
      toggleLock: false,
    }
  },
  created() {
    // 在首次渲染前初始化收藏状态，避免三角标闪烁
    try {
      const favs = JSON.parse(localStorage.getItem('favorite_cards') || '[]')
      this.isFavorite = favs.includes(this.toolId || this.link || this.title)
    } catch {
      this.isFavorite = false
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
      applyGlow(this.$el, mouseX, mouseY)
    },
    checkFavoriteStatus() {
      try {
        const favs = JSON.parse(localStorage.getItem('favorite_cards') || '[]')
        this.isFavorite = favs.includes(this.toolId || this.link || this.title)
      } catch {
        this.isFavorite = false
      }
    },
    toggleFavorite(e) {
      if (e) e.preventDefault()
      // 防止长按同时触发 touch 计时器和 contextmenu 导致双击
      if (this.toggleLock) return
      this.toggleLock = true
      setTimeout(() => { this.toggleLock = false }, 400)

      const key = this.toolId || this.link || this.title
      try {
        const favs = JSON.parse(localStorage.getItem('favorite_cards') || '[]')
        const idx = favs.indexOf(key)
        if (idx > -1) {
          favs.splice(idx, 1)
          this.isFavorite = false
          localStorage.setItem('favorite_cards', JSON.stringify(favs))
          this.message.info('已取消收藏', { duration: 1500 })
        } else {
          favs.push(key)
          this.isFavorite = true
          localStorage.setItem('favorite_cards', JSON.stringify(favs))
          this.message.info('已收藏', { duration: 1500 })
        }
      } catch {
        /* ignore quota / parse errors */
      }
    },
    handleContextMenu(e) {
      e.preventDefault()
      this.toggleFavorite()
    },
    handleTouchStart() {
      if (this.touchFired) return
      this.longPressed = false
      this.longPressTimer = setTimeout(() => {
        this.toggleFavorite()
        this.longPressed = true
        this.touchFired = true
        this.longPressTimer = null
      }, 500)
    },
    handleTouchEnd() {
      this.touchFired = false
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer)
        this.longPressTimer = null
      }
    },
    handleTouchMove() {
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer)
        this.longPressTimer = null
      }
    },
  },
  watch: {
    toolId() {
      try {
        const favs = JSON.parse(localStorage.getItem('favorite_cards') || '[]')
        this.isFavorite = favs.includes(this.toolId || this.link || this.title)
      } catch {
        this.isFavorite = false
      }
    },
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
      WebkitTouchCallout: 'none',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      position: 'relative',
      textDecoration: 'none',
      color: 'inherit',
    }

    return h(
      this.link ? 'a' : 'div',
      {
        class: 'tool-card glow-border',
        style: cardStyle,
        onContextmenu: (e) => this.handleContextMenu(e),
        onTouchstart: this.handleTouchStart,
        onTouchend: () => this.handleTouchEnd(),
        onTouchmove: () => this.handleTouchMove(),
        ...(this.link ? {
          href: this.link,
          target: isInternal ? '' : '_blank',
          rel: isInternal ? '' : 'noopener',
          referrerpolicy: isInternal ? '' : 'origin',
          onClick: (e) => {
            // 长按收藏后阻止导航
            if (this.longPressed) {
              e.preventDefault()
              this.longPressed = false
              return
            }
            // Umami 事件上报
            if (this.toolId && window.umami) {
              window.umami.track(this.toolId)
            }
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
              cornerShape: 'squircle',
              background: 'var(--bg-card)',
              marginRight: '12px',
              flexShrink: 0,
              overflow: 'hidden',
              position: 'relative',
              transition: 'background-color 0.3s ease',
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
                      alt: this.title,
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
        // 收藏三角形标签
        h(
          Transition,
          { name: 'fav' },
          {
            default: () =>
              this.isFavorite
                ? h('div', { class: 'favorite-tag' }, [
                    h('div', { class: 'favorite-triangle' }),
                    h('div', { class: 'favorite-star' }, [
                      h(NIcon, { component: Star24Filled, size: 10, color: '#fff' }),
                    ]),
                  ])
                : null,
          },
        ),
      ],
    )
  },
}
</script>

<style>
/* ---- Logo 背景：跟随卡片背景色，纯色保证过渡动画 ---- */

/* 卡片悬浮效果 */
.tool-card:hover {
  background: var(--bg-sub) !important;
  border-color: var(--border-color) !important;
  transform: translateY(-4px) !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15) !important;
}

.tool-card:hover .tool-card-logo-inner {
  transform: scale(1.13) !important;
}

.tool-card-logo {
  transition: background-color 0.3s ease !important;
}

@supports (corner-shape: squircle) {
  .tool-card-logo {
    border-radius: 18px !important;
  }
}
@keyframes skeleton-scan {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* 收藏三角形标签 */
.favorite-tag {
  position: absolute;
  top: 0;
  right: 0;
  width: 20px;
  height: 20px;
  z-index: 5;
  pointer-events: none;
  overflow: hidden;
  border-radius: 0 8px 0 0;
}

.favorite-triangle {
  position: absolute;
  top: 0;
  right: 0;
  width: 100%;
  height: 100%;
  background: #f5c842;
  clip-path: polygon(0 0, 100% 0, 100% 100%);
}

.favorite-star {
  position: absolute;
  top: 1px;
  right: 1px;
  transform: rotate(45deg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

/* 收藏标签过渡动画 */
.fav-enter-active,
.fav-leave-active {
  transition: opacity 0.3s ease;
}

.fav-enter-from,
.fav-leave-to {
  opacity: 0;
}
</style>

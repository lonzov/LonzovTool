<script>
import { h, TransitionGroup, nextTick } from 'vue'
import { NIcon } from 'naive-ui'
import { MegaphoneLoud24Filled } from '@vicons/fluent'
import notices from '../data/notices.json'

export default {
  data() {
    return {
      notices: [],
      currentIndex: 0,
      timer: null,
      isAnimating: false,
      containerHeight: 36,
      nextHeight: 36,
      isMeasuring: false,
      isVisible: true,
      isIconHovered: false,
    }
  },
  mounted() {
    this.initNotices()
    window.addEventListener('resize', this.measureHeight)
    nextTick(() => {
      this.measureHeight()
    })
    // 监听视口可见性
    this.observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        this.isVisible = entry.isIntersecting
        if (this.isVisible && this.notices.length > 1) {
          this.startTimer()
        } else {
          this.stopTimer()
        }
      },
      { threshold: 0.1 },
    )
    nextTick(() => {
      const el = document.getElementById('notice-bar-container')
      if (el) {
        this.observer.observe(el)
      }
    })
  },
  beforeUnmount() {
    if (this.timer) {
      clearInterval(this.timer)
    }
    window.removeEventListener('resize', this.measureHeight)
    if (this.observer) {
      this.observer.disconnect()
    }
  },
  methods: {
    initNotices() {
      this.notices = [...notices].sort((a, b) => a.priority - b.priority)
      if (this.notices.length > 1) {
        this.startTimer()
      }
    },
    startTimer() {
      if (this.timer) return
      this.timer = setInterval(this.nextNotice, 4000)
    },
    stopTimer() {
      if (this.timer) {
        clearInterval(this.timer)
        this.timer = null
      }
    },
    nextNotice() {
      if (this.isAnimating) return
      this.isAnimating = true

      // 先测量下一条通知的高度
      this.measureNextHeight(() => {
        // 同时更新索引和高度
        this.currentIndex = (this.currentIndex + 1) % this.notices.length
        this.containerHeight = this.nextHeight

        setTimeout(() => {
          this.isAnimating = false
        }, 300)
      })
    },
    formatDate(dateStr) {
      const date = new Date(dateStr)
      const now = new Date()
      const diff = now - date
      const minutes = Math.floor(diff / 60000)
      const hours = Math.floor(diff / 3600000)
      const days = Math.floor(diff / 86400000)

      if (minutes < 60) {
        return `${minutes} 分钟前`
      } else if (hours < 24) {
        return `${hours} 小时前`
      } else if (days < 7) {
        return `${days} 天前`
      } else {
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const year = String(date.getFullYear()).slice(-2)
        const years = now.getFullYear() - date.getFullYear()
        if (years === 0 || (years === 1 && now.getMonth() < date.getMonth())) {
          return `${month}/${day}`
        }
        return `${year}/${month}/${day}`
      }
    },
    handleNoticeClick() {
      const notice = this.notices[this.currentIndex]
      if (notice && notice.link) {
        window.open(notice.link, '_blank')
      }
    },
    measureHeight() {
      if (this.isMeasuring) return
      this.isMeasuring = true
      nextTick(() => {
        const contentEl = document.getElementById('notice-content-text')
        if (contentEl) {
          const contentHeight = contentEl.offsetHeight
          this.containerHeight = 16 + contentHeight
          this.nextHeight = this.containerHeight
        }
        this.isMeasuring = false
      })
    },
    measureNextHeight(callback) {
      // 创建一个临时元素测量下一条通知的高度
      const tempContainer = document.createElement('div')
      tempContainer.style.cssText = `
        position: fixed;
        visibility: hidden;
        pointer-events: none;
        background: var(--bg-card);
        border-radius: 4px;
        display: flex;
        align-items: flex-start;
        padding: 8px 12px;
        font-size: 13px;
        width: ${document.getElementById('notice-bar-container')?.offsetWidth || 400}px;
      `

      const nextIndex = (this.currentIndex + 1) % this.notices.length
      const notice = this.notices[nextIndex]

      tempContainer.innerHTML = `
        <div style="color: var(--text-secondary); margin-right: 12px; flex-shrink: 0; display: flex; align-items: center; height: 20px;">
          <svg width="16" height="16" viewBox="0 0 512 512">
            <path fill="currentColor" d="M256 56C145.72 56 49.42 110.4 49.42 110.4v213.12s96.3 54.4 206.58 54.4 206.58-54.4 206.58-54.4V110.4S366.28 56 256 56z"/>
          </svg>
        </div>
        <div style="flex: 1; display: flex; flex-direction: column;">
          <div style="display: flex; align-items: flex-start; width: 100%;">
            <span id="temp-notice-content" style="white-space: normal; word-break: break-word; line-height: 1.5;">${notice.content}</span>
            <div style="margin-left: 16px; flex-shrink: 0; display: flex; align-items: center; height: 20px;">
              <span style="color: var(--text-tertiary); font-size: 12px; white-space: nowrap;">${this.formatDate(notice.date)}</span>
            </div>
          </div>
        </div>
      `

      document.body.appendChild(tempContainer)

      nextTick(() => {
        const contentEl = document.getElementById('temp-notice-content')
        if (contentEl) {
          const contentHeight = contentEl.offsetHeight
          this.nextHeight = 16 + contentHeight
        }
        document.body.removeChild(tempContainer)

        if (callback) {
          callback()
        }
      })
    },
  },
  render() {
    const notice = this.notices[this.currentIndex]
    if (!notice) return null
    const hasLink = notice && notice.link
    const dateStr = notice ? this.formatDate(notice.date) : ''
    const fullDate = notice ? new Date(notice.date).toLocaleString('zh-CN') : ''

    return h(
      'div',
      {
        id: 'notice-bar-container',
        ref: 'noticeBar',
        style: {
          background: 'var(--bg-card)',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'flex-start',
          padding: '8px 12px',
          marginBottom: '24px',
          fontSize: '13px',
          cursor: hasLink ? 'pointer' : 'default',
          transition:
            'height 0.35s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.4s ease, border-color 0.4s ease',
          height: this.containerHeight + 'px',
          overflow: 'hidden',
          border: '1px solid var(--border-color)',
        },
        onClick: this.handleNoticeClick,
        onMouseenter: () => {
          this.isIconHovered = true
        },
        onMouseleave: () => {
          this.isIconHovered = false
        },
      },
      [
        // 喇叭图标
        h(
          'div',
          {
            style: {
              color: 'var(--text-secondary)',
              marginRight: '12px',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              height: '20px',
              transition: 'transform 0.3s ease',
              transform: this.isIconHovered ? 'rotate(45deg)' : 'rotate(0deg)',
            },
          },
          [
            h(NIcon, {
              component: MegaphoneLoud24Filled,
              size: 16,
              color: 'var(--text-secondary)',
            }),
          ],
        ),
        // 通知内容区域
        h(
          'div',
          {
            style: {
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
            },
          },
          [
            h('div', { style: { position: 'relative' } }, [
              h(
                TransitionGroup,
                { name: 'notice-slide' },
                {
                  default: () =>
                    notice
                      ? [
                          h(
                            'div',
                            {
                              key: this.currentIndex,
                              style: {
                                display: 'flex',
                                alignItems: 'flex-start',
                                width: '100%',
                              },
                            },
                            [
                              // 通知内容 - 自动换行
                              h(
                                'span',
                                {
                                  id: 'notice-content-text',
                                  style: {
                                    whiteSpace: 'normal',
                                    wordBreak: 'break-word',
                                    lineHeight: '1.5',
                                    flex: 1,
                                    color: 'var(--text-primary)',
                                  },
                                },
                                notice.content,
                              ),
                              // 日期（带 Tooltip）- 靠右对齐
                              h(
                                'span',
                                {
                                  style: {
                                    color: 'var(--text-tertiary)',
                                    fontSize: '12px',
                                    marginLeft: '16px',
                                    flexShrink: 0,
                                    cursor: 'help',
                                    whiteSpace: 'nowrap',
                                  },
                                  title: fullDate,
                                },
                                dateStr,
                              ),
                            ],
                          ),
                        ]
                      : [],
                },
              ),
            ]),
          ],
        ),
      ],
    )
  },
}
</script>

<style>
.notice-slide-enter-active,
.notice-slide-leave-active {
  transition:
    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.notice-slide-enter-from {
  transform: translateY(100%);
  opacity: 0;
}

.notice-slide-enter-to {
  transform: translateY(0);
  opacity: 1;
}

.notice-slide-leave-from {
  transform: translateY(0);
  opacity: 1;
}

.notice-slide-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

/* 使用绝对定位避免布局跳动 */
.notice-slide-enter-active,
.notice-slide-leave-active {
  position: absolute;
  left: 0;
  right: 0;
}
</style>

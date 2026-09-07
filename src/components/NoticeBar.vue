<script>
import { nextTick } from 'vue'
import { NIcon, NTooltip } from 'naive-ui'
import { MegaphoneLoud24Filled, ChevronDown20Filled, Open20Filled } from '@vicons/fluent'
import noticesData from '../data/notices.json'

// 已读标记：存"已读到的最新公告 id"，出现更大 id 的新公告时红点重新点亮
const READ_KEY = 'notice_last_read_id'

const PAD_Y = 16 // 顶栏纵向 padding 合计，用于按内容反推容器高度

export default {
  name: 'NoticeBar',
  components: { NIcon, NTooltip },
  // 把图标组件暴露给 Options API 模板（模块级 import 不在实例作用域内）
  setup() {
    return { MegaphoneLoud24Filled, ChevronDown20Filled, Open20Filled }
  },
  data() {
    return {
      notices: [...noticesData].sort((a, b) => a.priority - b.priority),
      currentIndex: 0,
      timer: null,
      resumeTimer: null,
      isAnimating: false,
      headHeight: 44, // 顶栏高度（含纵向 padding），动画驱动
      expanded: false,
      hovering: false,
      isVisible: true,
      isMeasuring: false,
      reduceMotion: false,
      readMaxId: 0, // localStorage 已读记录
    }
  },
  computed: {
    hasMore() {
      return this.notices.length > 1
    },
    currentNotice() {
      return this.notices[this.currentIndex] || null
    },
    maxNoticeId() {
      return this.notices.reduce((max, n) => Math.max(max, n.id || 0), 0)
    },
    // 存在比已读记录更新的公告时才显示未读圆点
    showDot() {
      return this.hasMore && this.maxNoticeId > this.readMaxId
    },
    counterLabel() {
      return `${this.currentIndex + 1}/${this.notices.length}`
    },
    dateStr() {
      const n = this.currentNotice
      return n ? this.formatDate(n.date) : ''
    },
    fullDateStr() {
      const n = this.currentNotice
      return n ? new Date(n.date).toLocaleString('zh-CN') : ''
    },
    // 仅保留「展开」提示；展开中不显示 tooltip（避免再标注收起）
    triggerTip() {
      return `展开全部 ${this.notices.length} 条公告`
    },
    triggerLabel() {
      return this.expanded ? `收起公告列表，当前第 ${this.currentIndex + 1} 条` : `查看全部 ${this.notices.length} 条公告`
    },
  },
  mounted() {
    this.reduceMotion =
      typeof window !== 'undefined' &&
      !!window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // 读取已读记录
    try {
      this.readMaxId = parseInt(localStorage.getItem(READ_KEY) || '0', 10) || 0
    } catch {
      this.readMaxId = 0
    }

    // 测量初始高度并启动
    nextTick(() => this.measureHead())
    if (this.hasMore) this.reschedule()

    window.addEventListener('resize', this.onResize)

    // 视口可见性：离开视口暂停轮播，回到视口恢复
    this.observer = new IntersectionObserver(
      (entries) => {
        this.isVisible = entries[0].isIntersecting
        this.reschedule()
      },
      { threshold: 0.1 },
    )
    nextTick(() => {
      const el = document.getElementById('notice-bar')
      if (el) this.observer.observe(el)
    })

    // Esc 收起
    this.onKeydown = (e) => {
      if (e.key === 'Escape' && this.expanded) {
        this.collapse()
        this.$nextTick(() => this.$refs.trigger && this.$refs.trigger.focus())
      }
    }
    document.addEventListener('keydown', this.onKeydown)
  },
  beforeUnmount() {
    this.clearSchedulers()
    if (this.observer) this.observer.disconnect()
    window.removeEventListener('resize', this.onResize)
    if (this.onKeydown) document.removeEventListener('keydown', this.onKeydown)
  },
  methods: {
    // ---------- 轮播调度 ----------
    clearSchedulers() {
      if (this.timer) clearInterval(this.timer)
      if (this.resumeTimer) clearTimeout(this.resumeTimer)
      this.timer = null
      this.resumeTimer = null
    },
    reschedule() {
      // 展开中 / 鼠标悬停 / 离开视口 / 减少动效时暂停；解除暂停延迟 1s 再续播，避免立刻跳变
      this.clearSchedulers()
      const paused = this.expanded || this.hovering || !this.isVisible || this.reduceMotion
      if (paused || !this.hasMore) return
      this.resumeTimer = setTimeout(() => {
        this.resumeTimer = null
        if (!this.timer) {
          this.timer = setInterval(() => this.advance(), 4000)
        }
      }, 1000)
    },
    advance() {
      if (this.isAnimating || this.expanded || this.notices.length < 2) return
      this.isAnimating = true
      const next = (this.currentIndex + 1) % this.notices.length
      this.switchTo(next, () => {
        setTimeout(() => {
          this.isAnimating = false
        }, 320)
      })
    },
    // 切换到指定公告：先测出目标内容所需顶栏高度，再更新索引（高度动画与文字过渡同步）
    switchTo(index, done) {
      const n = this.notices[index]
      if (!n) return
      const headH = this.measureText(n.content, n.link)
      this.headHeight = headH
      this.currentIndex = index
      if (done) done()
    },

    // ---------- 展开 / 收起 ----------
    expand() {
      this.expanded = true
      this.markRead()
      this.reschedule()
      this.$nextTick(() => this.updateListFade())
    },
    collapse() {
      this.expanded = false
      this.reschedule()
    },
    toggle() {
      if (this.expanded) this.collapse()
      else this.expand()
    },

    // ---------- 点击行为 ----------
    openCurrent() {
      const n = this.currentNotice
      if (n && n.link) {
        window.open(n.link, '_blank')
        this.markRead()
      }
    },
    handleRowClick(index) {
      const n = this.notices[index]
      if (!n) return
      if (n.link) {
        // 带链接：新窗口打开（不再改变当前条）
        window.open(n.link, '_blank')
        this.markRead()
      } else {
        // 无链接：切换为当前公告，保持展开
        if (!this.isAnimating) {
          this.isAnimating = true
          this.switchTo(index, () => setTimeout(() => (this.isAnimating = false), 320))
        }
      }
    },

    // ---------- 已读 ----------
    markRead() {
      if (!this.showDot) return
      const maxId = this.maxNoticeId
      this.readMaxId = maxId
      try {
        localStorage.setItem(READ_KEY, String(maxId))
      } catch {
        /* 隐私模式等场景忽略 */
      }
    },

    // ---------- 高度测量 ----------
    onResize() {
      this.measureHead()
      this.updateListFade()
    },
    // 控制件基准高度：触发器 pill 存在时按其真实高度，否则按图标高度，避免顶栏裁掉 pill
    controlHeight() {
      const trigger = this.hasMore ? this.$refs.trigger : null
      if (trigger && trigger.offsetHeight) return trigger.offsetHeight
      return 20
    },
    // 当前内容高度：读取真实渲染的文本元素（其换行宽度与布局一致）
    measureHead() {
      if (this.isMeasuring) return
      this.isMeasuring = true
      nextTick(() => {
        // 量块级 .notice-item 的高度：内联 span 跨多行时 offsetHeight 只回单行高
        const textEl = document.getElementById('notice-content-text')
        const itemEl = textEl ? textEl.parentElement : null
        const textH = itemEl ? itemEl.offsetHeight : 0
        this.headHeight = Math.max(textH, this.controlHeight()) + PAD_Y
        this.isMeasuring = false
        this.updateListFade()
      })
    },
    // 用隐藏元素按"当前文本可用宽度"测量任意内容的行高，得到目标顶栏高度
    measureText(content, hasLink) {
      const holder = document.getElementById('notice-text-wrap')
      const width = (holder && holder.clientWidth) || 320
      const linkGap = hasLink ? 18 : 0 // 顶栏内容行尾的外链小图标会占位
      const temp = document.createElement('div')
      temp.style.cssText = [
        'position:fixed', 'visibility:hidden', 'pointer-events:none',
        'top:0', 'left:0',
        `width:${Math.max(width - linkGap, 80)}px`,
        'font-size:13px', 'line-height:1.5', 'word-break:break-word', 'white-space:normal',
      ].join(';')
      temp.textContent = content || ''
      document.body.appendChild(temp)
      const textH = temp.offsetHeight
      document.body.removeChild(temp)
      return Math.max(textH, this.controlHeight()) + PAD_Y
    },
    // 列表高度富余（可滚动）时加底部渐隐提示
    updateListFade() {
      this.$nextTick(() => {
        const list = this.$refs.list
        if (list) {
          list.classList.toggle('scrollable', list.scrollHeight - list.clientHeight > 4)
        }
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
    formatFullDate(dateStr) {
      return dateStr ? new Date(dateStr).toLocaleString('zh-CN') : ''
    },
  },
}
</script>

<template>
  <div
    id="notice-bar"
    class="notice-bar"
    :class="{ open: expanded }"
    @pointerenter="hovering = true; reschedule()"
    @pointerleave="hovering = false; reschedule()"
  >
    <!-- 顶栏 -->
    <div
      class="notice-head"
      :style="{ height: headHeight + 'px' }"
    >
      <div class="notice-icon" aria-hidden="true">
        <NIcon :component="MegaphoneLoud24Filled" :size="16" color="var(--text-secondary)" />
      </div>

      <!-- 当前公告内容：可点击打开链接（整块文本作为按钮，键盘可聚焦） -->
      <button
        type="button"
        class="notice-main"
        :disabled="!currentNotice || !currentNotice.link"
        :aria-label="currentNotice && currentNotice.link ? '打开公告链接' : '公告'"
        @click="openCurrent"
      >
        <div class="notice-swap-holder" id="notice-text-wrap">
          <TransitionGroup name="notice-slide" tag="div" class="notice-swap">
            <div v-if="currentNotice" :key="currentIndex" class="notice-item">
              <span id="notice-content-text">{{ currentNotice.content }}</span>
              <NIcon
                v-if="currentNotice.link"
                :component="Open20Filled"
                :size="13"
                color="var(--text-secondary)"
                class="notice-open-icon"
              />
            </div>
          </TransitionGroup>
        </div>
      </button>

      <span class="notice-date" :title="formatFullDate(currentNotice && currentNotice.date)">
        {{ dateStr }}
      </span>

      <!-- 查看全部触发器（仅多于一条时显示） -->
      <NTooltip v-if="hasMore" placement="bottom" :disabled="expanded">
        <template #trigger>
          <button
            ref="trigger"
            type="button"
            class="notice-trigger"
            :aria-expanded="expanded"
            :aria-controls="'notice-list'"
            :aria-label="triggerLabel"
            :title="triggerTip"
            @click.stop="toggle"
          >
            <span class="trigger-counter">{{ counterLabel }}</span>
            <span class="chevron" aria-hidden="true">
              <NIcon :component="ChevronDown20Filled" :size="14" />
            </span>
            <span v-if="showDot" class="trigger-dot" aria-hidden="true"></span>
          </button>
        </template>
        {{ triggerTip }}
      </NTooltip>
    </div>

    <!-- 展开面板：grid-rows 0fr→1fr 高度动画 -->
    <div class="notice-panel">
      <div class="panel-inner">
        <ul ref="list" id="notice-list" class="notice-list">
          <li v-for="(n, index) in notices" :key="n.id" class="notice-li">
            <button
              type="button"
              class="notice-row"
              :class="{ current: index === currentIndex }"
              :aria-pressed="index === currentIndex"
              @click="handleRowClick(index)"
            >
              <span class="row-text">{{ n.content }}</span>
              <NIcon
                v-if="n.link"
                :component="Open20Filled"
                :size="12"
                color="var(--text-tertiary)"
                class="row-open"
                aria-hidden="true"
              />
              <span class="row-date" :title="formatFullDate(n.date)">{{ formatDate(n.date) }}</span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notice-bar {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  margin: 0 0 24px;
  transition: background-color 0.4s ease, border-color 0.4s ease;
}

/* ===== 顶栏 ===== */
.notice-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 12px;
  font-size: 13px;
  overflow: hidden;
  transition: height 0.32s cubic-bezier(0.4, 0, 0.2, 1);
}

.notice-icon {
  flex: none;
  width: 16px;
  height: 20px;
  display: flex;
  align-items: center;
  color: var(--text-secondary);
  transition: transform 0.3s ease;
}

.notice-bar:hover .notice-icon {
  transform: rotate(45deg);
}

/* 当前公告文本（整块为可点击按钮） */
.notice-main {
  flex: 1;
  min-width: 0;
  display: block;
  padding: 0;
  border: none;
  background: transparent;
  font: inherit;
  color: var(--text-primary);
  text-align: left;
  cursor: default;
}

.notice-main:not(:disabled) {
  cursor: pointer;
}

.notice-main:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--text-primary) 45%, transparent);
  outline-offset: 2px;
  border-radius: 4px;
}

.notice-main:disabled {
  opacity: 1;
  -webkit-text-fill-color: currentColor; /* 防部分浏览器置灰 */
}

.notice-swap-holder {
  position: relative;
  width: 100%;
}

.notice-item {
  line-height: 1.5;
  word-break: break-word;
}

.notice-item .notice-open-icon {
  vertical-align: text-top;
  margin-left: 2px;
  position: relative;
  top: 2px;
}

/* 文本切换过渡（纵向滚动 + 淡入淡出） */
.notice-swap {
  position: relative;
}

.notice-slide-enter-active,
.notice-slide-leave-active {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.notice-slide-enter-from {
  transform: translateY(100%);
  opacity: 0;
}

.notice-slide-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

/* 日期（悬停显示完整时间） */
.notice-date {
  flex: none;
  align-self: flex-start;
  color: var(--text-tertiary);
  font-size: 12px;
  white-space: nowrap;
  line-height: 20px;
  cursor: help;
  margin-top: 1px;
}

/* 触发器：计数器 + chevron 的 pill 按钮 */
.notice-trigger {
  position: relative;
  flex: none;
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 7px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.notice-trigger:hover,
.notice-bar.open .notice-trigger {
  background: var(--bg-sub);
  color: var(--text-primary);
}

.notice-trigger:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--text-primary) 45%, transparent);
  outline-offset: 2px;
}

.chevron {
  display: inline-flex;
  transition: transform 0.25s ease;
}

.notice-bar.open .chevron {
  transform: rotate(180deg);
}

/* 未读红点 */
.trigger-dot {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #cc3333;
  box-shadow: 0 0 0 1px var(--bg-card);
  pointer-events: none;
}

/* ===== 展开面板 ===== */
.notice-panel {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.notice-bar.open .notice-panel {
  grid-template-rows: 1fr;
}

.panel-inner {
  min-height: 0;
  overflow: hidden;
  visibility: hidden;
  /* 收起时延后 0.3s 再隐藏，保证折叠动画全程内容可见；展开时立即显示（见 .open 覆盖） */
  transition: visibility 0s linear 0.3s;
}

.notice-bar.open .panel-inner {
  visibility: visible;
  transition-delay: 0s;
}

.notice-list {
  list-style: none;
  border-top: 1px solid var(--border-color);
  margin: 0;
  padding: 5px 7px 7px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  max-height: 300px;
  overflow-y: auto;
  transition: background-color 0.4s ease, border-color 0.4s ease;
}

/* 可滚动时：底部渐隐提示还有更多 */
.notice-list.scrollable {
  -webkit-mask-image: linear-gradient(#000 0, #000 calc(100% - 24px), transparent);
  mask-image: linear-gradient(#000 0, #000 calc(100% - 24px), transparent);
}

.notice-li {
  flex: none;
}

.notice-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  font: inherit;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}

.notice-row:hover {
  background: var(--bg-sub);
  color: var(--text-primary);
}

.notice-row:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--text-primary) 45%, transparent);
  outline-offset: -2px;
}

.notice-row.current {
  background: var(--bg-sub);
  color: var(--text-primary);
}

.row-text {
  flex: 1;
  min-width: 0;
  line-height: 1.5;
  word-break: break-word;
}

.row-open {
  flex: none;
  vertical-align: middle;
}

.row-date {
  flex: none;
  color: var(--text-tertiary);
  font-size: 12px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

/* 减少动效 */
@media (prefers-reduced-motion: reduce) {
  .notice-head,
  .notice-panel,
  .panel-inner,
  .chevron,
  .notice-icon {
    transition: none !important;
  }

  .notice-slide-enter-active,
  .notice-slide-leave-active {
    transition: none !important;
  }
}
</style>

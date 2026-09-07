<script>
import { nextTick } from 'vue'
import { NIcon, NTooltip } from 'naive-ui'
import { MegaphoneLoud24Filled, ChevronDown20Filled, Open20Filled } from '@vicons/fluent'
import noticesData from '../data/notices.json'

// 已读标记：存"已读到的最新公告 id"，出现更大 id 的新公告时红点重新点亮
const READ_KEY = 'notice_last_read_id'

const PAD_Y = 16 // 顶栏纵向 padding 合计，用于按内容反推容器高度
const PANEL_DURATION = 300 // 展开/收起高度动画时长(ms)

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
      isAnimating: false,
      headHeight: 44, // 顶栏高度（含纵向 padding），动画驱动
      expanded: false,
      isVisible: true,
      isMeasuring: false,
      reduceMotion: false,
      readMaxId: 0, // localStorage 已读记录
      triggerWidth: 38, // 触发器宽度 = 公告栏单行高度，mounted 后测量校准
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
    nextTick(() => {
      this.measureHead()
      // 触发器宽度 = 公告栏单行高度（含上下边框）
      this.triggerWidth = this.controlHeight() + PAD_Y + 2
    })
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
      this.timer = null
    },
    reschedule() {
      // 展开/悬停不再暂停轮播，仅离开视口或减少动效时停止
      this.clearSchedulers()
      if (!this.hasMore || !this.isVisible || this.reduceMotion) return
      this.timer = setInterval(() => this.advance(), 4000)
    },
    advance() {
      if (this.isAnimating || this.notices.length < 2) return
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
    },
    collapse() {
      this.expanded = false
    },
    toggle() {
      if (this.expanded) this.collapse()
      else this.expand()
    },

    // ---------- 展开面板过渡：高度 + 边框同步动画，收起结束后销毁 DOM ----------
    panelTransition() {
      const ease = 'cubic-bezier(0.4, 0, 0.2, 1)'
      return `height ${PANEL_DURATION}ms ${ease}, border-width ${PANEL_DURATION}ms ${ease}`
    },
    resetPanel(el) {
      el.style.height = ''
      el.style.borderTopWidth = ''
      el.style.borderBottomWidth = ''
      el.style.overflow = ''
      el.style.transition = ''
    },
    // 展开：height 0 → 内容高度，上下边框 0 → 1px
    onPanelEnter(el, done) {
      const target = el.offsetHeight
      el.style.height = '0px'
      el.style.borderTopWidth = '0px'
      el.style.borderBottomWidth = '0px'
      el.style.overflow = 'hidden'
      void el.offsetHeight
      if (this.reduceMotion) {
        this.resetPanel(el)
        done()
        return
      }
      el.style.transition = this.panelTransition()
      el.style.height = target + 'px'
      el.style.borderTopWidth = '1px'
      el.style.borderBottomWidth = '1px'
      el.addEventListener('transitionend', function handler(e) {
        if (e.target !== el || e.propertyName !== 'height') return
        el.removeEventListener('transitionend', handler)
        done()
      })
    },
    // 展开动画结束：恢复 auto 高度（响应式跟随），再测列表渐隐
    onPanelAfterEnter(el) {
      this.resetPanel(el)
      this.updateListFade()
    },
    // 收起：当前高度 → 0，上下边框 → 0，结束后 Vue 自动销毁 DOM
    onPanelLeave(el, done) {
      el.style.height = el.offsetHeight + 'px'
      el.style.overflow = 'hidden'
      void el.offsetHeight
      if (this.reduceMotion) {
        done()
        return
      }
      el.style.transition = this.panelTransition()
      el.style.height = '0px'
      el.style.borderTopWidth = '0px'
      el.style.borderBottomWidth = '0px'
      el.addEventListener('transitionend', function handler(e) {
        if (e.target !== el || e.propertyName !== 'height') return
        el.removeEventListener('transitionend', handler)
        done()
      })
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
      if (!n.link) return // 无链接行：不改写顶栏，当前高亮仅随轮播同步
      // 带链接：新窗口打开（不改变当前条）
      window.open(n.link, '_blank')
      this.markRead()
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
    // 单行内容基准高度：取图标高度（与单行文本、日期同高），避免顶栏裁掉内容
    controlHeight() {
      const icon = this.$refs.icon
      if (icon && icon.offsetHeight) return icon.offsetHeight
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
  <div class="notice-wrap">
    <div
      id="notice-bar"
      class="notice-bar"
      :class="{ open: expanded }"
    >
      <!-- 公告内容区 -->
      <div
        class="notice-head"
        :style="{ height: headHeight + 'px' }"
      >
        <div ref="icon" class="notice-icon" aria-hidden="true">
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
      </div>

      <!-- 展开触发器：与内容区同级的右侧竖条按钮（仅多于一条时显示） -->
      <NTooltip v-if="hasMore" placement="bottom" :disabled="expanded">
        <template #trigger>
          <button
            ref="trigger"
            type="button"
            class="notice-trigger"
            :style="{ width: triggerWidth + 'px' }"
            :aria-expanded="expanded"
            :aria-controls="'notice-list'"
            :aria-label="triggerLabel"
            :title="triggerTip"
            @click.stop="toggle"
          >
            <span class="chevron" aria-hidden="true">
              <NIcon :component="ChevronDown20Filled" :size="14" />
            </span>
            <span v-if="showDot" class="trigger-dot" aria-hidden="true"></span>
          </button>
        </template>
        {{ triggerTip }}
      </NTooltip>
    </div>

    <!-- 展开卡片：独立元素，折叠动画结束后销毁 DOM -->
    <Transition @enter="onPanelEnter" @after-enter="onPanelAfterEnter" @leave="onPanelLeave">
      <div v-if="expanded" ref="panel" class="notice-panel">
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
    </Transition>
  </div>
</template>

<style scoped>
.notice-wrap {
  margin: 0 0 24px;
}

.notice-bar {
  display: flex;
  align-items: stretch;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  transition: background-color 0.4s ease, border-color 0.4s ease;
}

/* ===== 公告内容区 ===== */
.notice-head {
  flex: 1;
  min-width: 0;
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

/* 触发器：右侧竖条按钮，宽度=单行高度（JS 设置），高度随公告栏拉伸，图标垂直居中 */
.notice-trigger {
  position: relative;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-left: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.4s ease;
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

/* 未读红点：压在公告栏右上角圆角处 */
.trigger-dot {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #cc3333;
  box-shadow: 0 0 0 1px var(--bg-card);
  pointer-events: none;
}

/* ===== 展开卡片：独立元素，高度由 JS 过渡驱动，折叠结束销毁 ===== */
.notice-panel {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  margin-top: 8px;
  transition: background-color 0.4s ease, border-color 0.4s ease;
}

.notice-list {
  list-style: none;
  margin: 0;
  padding: 5px 7px 7px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  max-height: 300px;
  overflow-y: auto;
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

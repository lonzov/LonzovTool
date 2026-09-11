<script>
import { NCarousel, NCarouselItem } from 'naive-ui'

// 图片索引独立在 src/data/homeAds.js（只含 JSON 结构的模块，动态导入、构建后为独立 chunk），
// 便于单独维护；分 first 首屏位 / paid 付费位 / free 免费位 / notice 公告位 四档，没配的档位或条目直接忽略、
// 后面的顺位顶上，四档都没配时仍显示 1 个灰底占位框。
// 加载前与图片加载失败的滑片用灰底图标占位顶位。单项结构 { id, image, title?, link? }
// 占位只放一条：避免首屏闪现多条才有的指示点与切换按钮
const PLACEHOLDER_SLIDES = [{ id: 1, image: '' }]

// 付费位先后顺序的跨访问记录（'1' 表示本次反转）
const PAID_ORDER_KEY = 'ad_paid_order_reversed'

// 缓存加载 Promise，避免重复请求该 chunk
let homeAdSlidesPromise = null
function loadHomeAdsConfig() {
  if (!homeAdSlidesPromise) {
    homeAdSlidesPromise = import('../data/homeAds.js')
      .then((mod) =>
        mod.default && typeof mod.default === 'object' && !Array.isArray(mod.default)
          ? mod.default
          : null,
      )
      .catch(() => null)
  }
  return homeAdSlidesPromise
}

// 读取上次的付费位顺序。存储不可用（无痕模式等）时按首次处理
function readPaidReversed() {
  try {
    return localStorage.getItem(PAID_ORDER_KEY) === '1'
  } catch {
    return false
  }
}

function writePaidReversed(reversed) {
  try {
    localStorage.setItem(PAID_ORDER_KEY, reversed ? '1' : '0')
  } catch {
    /* 写不进去就本次不记，不影响展示 */
  }
}

// 有效条目：配置了且带了 image。只写个空壳（image 为空）视为没配，直接忽略不占位
function isConfigured(item) {
  return Boolean(item && typeof item === 'object' && item.image)
}

/**
 * 分档配置 → 本次轮播顺序：首屏位 → 付费位 → 免费位 → 公告位（固定压尾）
 * 没配的档位/条目直接忽略，后面的顺位顶上（例：只配了 1 和 4 就是 1,4）；
 * 付费位价位相同，配满 2 个时来回换先后（本次 2,3 则下次 3,2），换完把记录翻转给下次；
 * 只配了 1 个或没配时不交替，也不翻转记录
 * @param {object} config homeAds.js 的三档配置
 * @returns {Array|null} 轮播滑片数组，配置非法时返回 null
 */
function resolveSlides(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null

  const list = []
  if (isConfigured(config.first)) list.push(config.first)

  const paid = (Array.isArray(config.paid) ? config.paid : []).filter(isConfigured)
  if (paid.length > 1) {
    const reversed = readPaidReversed()
    if (reversed) paid.reverse()
    writePaidReversed(!reversed)
  }
  list.push(...paid)

  if (isConfigured(config.free)) list.push(config.free)

  // 公告位：本站自己的公告，固定压尾，不参与付费位的交替
  if (isConfigured(config.notice)) list.push(config.notice)

  return list
}

export default {
  name: 'AdCarousel',
  components: { NCarousel, NCarouselItem },
  props: {
    // 自动轮播间隔(ms)
    interval: { type: Number, default: 4200 },
  },
  data() {
    return {
      reduceMotion: false,
      // 异步加载的分档配置拼成的滑片数组，加载完成前为空
      loadedSlides: [],
      // 加载失败的滑片（键为 slide.id || 索引），失败后回退灰底图标占位
      failedSlides: {},
    }
  },
  computed: {
    items() {
      return this.loadedSlides.length ? this.loadedSlides : PLACEHOLDER_SLIDES
    },
    canAutoplay() {
      return !this.reduceMotion && this.items.length > 1
    },
  },
  methods: {
    // 站内路由判定：以 "/" 开头（排除 "//" 协议相对地址）视为站内，走 SPA
    isInternalLink(link) {
      return typeof link === 'string' && link.charAt(0) === '/' && !link.startsWith('//')
    },
    // 点击滑片：站内阻止默认整页跳转、改走 vue-router；站外放行，由 target="_blank" 新标签页打开
    handleSlideClick(e, slide) {
      const link = slide && slide.link
      if (!link || !this.isInternalLink(link)) return
      e.preventDefault()
      if (this.$router) this.$router.push(link)
    },
    // 图片加载失败（断网/防盗链/404）→ 标记该滑片，改渲染灰底图标占位
    handleImageError(slide, i) {
      this.failedSlides[slide.id || i] = true
    },
  },
  mounted() {
    this.reduceMotion =
      typeof window !== 'undefined' &&
      !!window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // 异步导入分档配置并拼成本次轮播顺序
    loadHomeAdsConfig().then((config) => {
      const list = resolveSlides(config)
      if (Array.isArray(list) && list.length) this.loadedSlides = list
    })
  },
}
</script>

<template>
  <div class="ad-carousel" aria-label="广告推广位轮播">
    <n-carousel
      v-if="items.length"
      class="ad-carousel__inner"
      direction="horizontal"
      dot-placement="bottom"
      dot-type="dot"
      :autoplay="canAutoplay"
      :interval="interval"
      :show-dots="items.length > 1"
      :show-arrow="items.length > 1"
      :keyboard="items.length > 1"
    >
      <n-carousel-item v-for="(slide, i) in items" :key="slide.id || i">
        <!-- 图片滑片：配了 link 才包 <a>（未配则纯 div，不留空链接）；
             站内(/开头)点击走 SPA 切换，站外新标签页打开 -->
        <component
          :is="slide.link ? 'a' : 'div'"
          v-if="slide.image && !failedSlides[slide.id || i]"
          class="ad-carousel__media"
          :href="slide.link ? slide.link : undefined"
          :target="slide.link && !isInternalLink(slide.link) ? '_blank' : undefined"
          :rel="slide.link && !isInternalLink(slide.link) ? 'noopener noreferrer' : undefined"
          :aria-label="slide.link ? slide.title || '广告' : undefined"
          @click="handleSlideClick($event, slide)"
        >
          <img
            class="ad-carousel__img"
            :src="slide.image"
            :alt="slide.title || '广告'"
            loading="lazy"
            draggable="false"
            @error="handleImageError(slide, i)"
          />
        </component>
        <!-- 无图 / 加载失败占位：灰底 + 居中图标（与工具卡片 logo 错误占位同款图标） -->
        <div v-else class="ad-carousel__ph">
          <svg class="ad-carousel__ph-icon" viewBox="0 0 20 20" aria-hidden="true">
            <path
              d="M2.854 2.146a.5.5 0 1 0-.708.708l3.67 3.668a5.326 5.326 0 0 0-.463 1.724h-.07C3.468 8.246 2 9.758 2 11.623C2 13.488 3.47 15 5.282 15h9.01l2.854 2.854a.5.5 0 0 0 .708-.708l-15-15zM18 11.623a3.4 3.4 0 0 1-1.452 2.804l-9.49-9.49C7.808 4.353 8.792 4 10 4c2.817 0 4.415 1.923 4.647 4.246h.07c1.814 0 3.283 1.512 3.283 3.377z"
            />
          </svg>
        </div>
      </n-carousel-item>
    </n-carousel>
  </div>
</template>

<style scoped>
/* 容器：固定 3:1 比例。窄屏宽度驱动（整行通栏），桌面由 HomeView 双栏侧贴、宽度驱动为 324×108 */
.ad-carousel {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 1;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  background: var(--bg-card);
  transition: border-color 0.4s ease;
}

.ad-carousel__inner {
  width: 100%;
  height: 100%;
}

/* ===== Naive NCarousel 深浅色/尺寸适配 =====
   覆盖默认亮色变量，跟随广告画面使用白色系指示点/箭头；cssVar 打在 .n-carousel 行内，
   需 !important 才压得住行内值（与 main.css 适配范式一致） */
.ad-carousel :deep(.n-carousel) {
  --n-dot-color: rgba(255, 255, 255, 0.38) !important;
  --n-dot-color-focus: rgba(255, 255, 255, 0.62) !important;
  --n-dot-color-active: #ffffff !important;
  --n-arrow-color: #ffffff !important;
  --n-bezier: cubic-bezier(0.4, 0, 0.2, 1) !important;
}

/* 指示点与切换按钮均保持 NCarousel 默认排布：show-arrow 下指示点位于底边左下、
   切换按钮位于右下角互不重叠，故此处不再重排位置 */

/* 滑片：图片撑满（非 3:1 素材拉伸变形，不裁切不留边）；
   有 link 时该层为 <a>，否则为 <div> */
.ad-carousel__media {
  display: block;
  width: 100%;
  height: 100%;
  text-decoration: none;
}

.ad-carousel__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: fill;
  user-select: none;
  -webkit-user-select: none;
  -webkit-user-drag: none;
}

/* 无图 / 加载失败占位：灰底 + 居中图标 */
.ad-carousel__ph {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--bg-sub);
  transition: background-color 0.4s ease;
}

.ad-carousel__ph-icon {
  width: 28px;
  height: 28px;
  fill: var(--text-tertiary);
  transition: fill 0.4s ease;
}

/* 双栏侧贴：固定宽 324 → 高 108（3:1）。与 HomeView 双栏区间一致：
   639–770（移动布局）与 ≥889（桌面）双栏；771–888 中间退回整行通栏 */
@media (min-width: 639px) and (max-width: 770px), (min-width: 889px) {
  .ad-carousel {
    width: 324px;
  }
}
</style>

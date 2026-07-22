<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NConfigProvider, NTooltip, darkTheme } from 'naive-ui'
import { RiBilibiliLine, RiTiktokFill, RiGithubFill, RiQqFill, RiRssFill } from '@remixicon/vue'
import { useTheme } from '../composables/useTheme'
import { useStats } from '../composables/useStats'
import IframeForm from '../components/IframeForm.vue'

const { isDark } = useTheme()
const { stats, fetchStats } = useStats()
const router = useRouter()

const naiveTheme = computed(() => isDark.value ? darkTheme : null)

/* Tooltip 配色覆盖为项目风格：反色（亮色模式深底浅字，暗色模式浅底深字） */
const naiveThemeOverrides = computed(() => isDark.value
  ? { Tooltip: { color: '#E8E8E8', textColor: '#111111' } }
  : { Tooltip: { color: '#1A1A1A', textColor: '#F5F7F9' } }
)

/* ===== 贡献者数据（异步 import，参考打赏记录） ===== */
const contributors = ref([])
/* 跑马灯每份最少头像数，拆分两行后每行只有一半，需翻倍 */
const MIN_PER_SET = 24
/* 每份 set 的头像列表：贡献者循环填充到至少 MIN_PER_SET 个 */
const marqueeSetItems = computed(() => {
  const list = contributors.value
  if (list.length === 0) return []
  if (list.length >= MIN_PER_SET) return list
  const result = []
  while (result.length < MIN_PER_SET) {
    result.push(...list)
  }
  return result
})
/* 按奇偶索引拆分两行：上行=偶数索引，下行=奇数索引，形成竖向砖墙排列 */
const marqueeRows = computed(() => {
  const items = marqueeSetItems.value
  if (items.length === 0) return [[], []]
  return [
    items.filter((_, i) => i % 2 === 0),
    items.filter((_, i) => i % 2 === 1),
  ]
})

/* ===== 触发统计数据加载 ===== */
onMounted(() => {
  fetchStats()
  requestAnimationFrame(setupCountUp)
})

onMounted(async () => {
  try {
    const data = await import('../data/contributors.json')
    contributors.value = data.default || data
  } catch {
    contributors.value = []
  }
})

/* 头像加载失败：用 name 首字兜底 */
const failedAvatars = ref(new Set())
function onAvatarError(url) {
  failedAvatars.value = new Set([...failedAvatars.value, url])
}
function avatarFailed(url) {
  return failedAvatars.value.has(url)
}

/* ===== 视频统计：播放/点赞/收藏（内存 + localStorage 双层缓存，TTL 4h） ===== */
const VIDEO_CACHE_KEY = 'video_stats_cache'
const VIDEO_CACHE_TTL = 4 * 60 * 60 * 1000
const videoMemCache = ref(null)
const videoStats = ref({ view: null, like: null, favorite: null })

function readVideoLocalCache() {
  try {
    const raw = localStorage.getItem(VIDEO_CACHE_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw)
    if (!entry || typeof entry.ts !== 'number') return null
    return entry
  } catch { return null }
}

function writeVideoLocalCache(data, ts) {
  try {
    localStorage.setItem(VIDEO_CACHE_KEY, JSON.stringify({ data, ts }))
  } catch { /* ignore */ }
}

function applyVideoData(d) {
  videoStats.value = { view: d.view ?? null, like: d.like ?? null, favorite: d.favorite ?? null }
}

onMounted(async () => {
  /* 1. 内存缓存 */
  if (videoMemCache.value && Date.now() - videoMemCache.value.ts < VIDEO_CACHE_TTL) {
    applyVideoData(videoMemCache.value.data)
    return
  }
  /* 2. localStorage 缓存 */
  const local = readVideoLocalCache()
  if (local && Date.now() - local.ts < VIDEO_CACHE_TTL) {
    applyVideoData(local.data)
    videoMemCache.value = { data: local.data, ts: local.ts }
    return
  }
  /* 3. 请求 API */
  try {
    const res = await fetch('https://api.lonzov.top/u/api/bilibili')
    if (res.ok) {
      const d = await res.json()
      applyVideoData(d)
      const now = Date.now()
      videoMemCache.value = { data: d, ts: now }
      writeVideoLocalCache(d, now)
    }
  } catch {
    /* 静默失败，保留 null */
  }
})

/* ===== count-up：进入视口即慢速爬升，数据到达后加速冲到目标 ===== */
const countEls = new Set()
function setCountRef(el, getter, formatter) {
  if (!el) return
  /* 每次都更新 getter，确保响应式数据最新 */
  el._getter = getter
  /* 首次初始化才设状态，避免 Vue 函数 ref 重复调用导致状态被重置 */
  if (!el._countInited) {
    el._formatter = formatter || ((n) => n.toLocaleString().replace(/,/g, '<span class="num-sep">,</span>'))
    el._current = 0
    el._state = 'idle' /* idle | crawling | rushing | done */
    el._countInited = true
    countEls.add(el)
  }
}
let countIO = null

/* 慢速爬升：每秒约 +100 */
function startCrawl(el) {
  el._state = 'crawling'
  el._current = 0
  const speed = 100
  let lastT = performance.now()
  const tick = (t) => {
    if (el._state !== 'crawling') return
    const dt = (t - lastT) / 1000
    lastT = t
    el._current += speed * dt
    el.innerHTML = el._formatter(Math.floor(el._current))
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

/* 加速冲到目标值 */
function rushToTarget(el, target) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el._current = target
    el.innerHTML = el._formatter(target)
    el._state = 'done'
    return
  }
  el._state = 'rushing'
  const start = el._current
  const diff = target - start
  if (diff <= 0) {
    el._current = target
    el.innerHTML = el._formatter(target)
    el._state = 'done'
    return
  }
  const dur = 1200, t0 = performance.now()
  const tick = (t) => {
    if (el._state !== 'rushing') return
    const p = Math.min(1, (t - t0) / dur)
    const e = 1 - Math.pow(1 - p, 3)
    el._current = start + diff * e
    el.innerHTML = el._formatter(Math.round(el._current))
    if (p < 1) requestAnimationFrame(tick)
    else {
      el._current = target
      el.innerHTML = el._formatter(target)
      el._state = 'done'
    }
  }
  requestAnimationFrame(tick)
}

/* 进入视口：有数据就 rush，没数据就 crawl */
function startCountUp(el) {
  const raw = el._getter()
  const target = raw == null ? null : +raw
  if (target != null && Number.isFinite(target)) {
    rushToTarget(el, target)
  } else {
    startCrawl(el)
  }
}

function setupCountUp() {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    countEls.forEach(startCountUp)
    return
  }
  if (!countIO) {
    countIO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          startCountUp(entry.target)
          countIO.unobserve(entry.target)
        }
      })
    }, { threshold: 0.4 })
  }
  countEls.forEach((el) => {
    if (el._state === 'idle') countIO.observe(el)
  })
}

/* 数据到达后：把正在爬升的元素加速冲到目标 */
function onDataReady() {
  countEls.forEach((el) => {
    if (el._state === 'crawling') {
      const raw = el._getter()
      const target = raw == null ? null : +raw
      if (target != null && Number.isFinite(target)) {
        rushToTarget(el, target)
      }
    }
  })
}

/* 视频统计到达后：加速冲到目标 */
watch(videoStats, (v) => {
  if (v.view !== null) {
    requestAnimationFrame(() => {
      setupCountUp()
      onDataReady()
    })
  }
}, { flush: 'post' })

/* 统计数据到达后：加速冲到目标 */
watch(() => stats.value.yearPV, (v) => {
  if (v !== null) {
    requestAnimationFrame(() => {
      setupCountUp()
      onDataReady()
    })
  }
}, { flush: 'post' })

onBeforeUnmount(() => {
  if (countIO) countIO.disconnect()
  countEls.forEach((el) => { el._state = 'done' })
  countEls.clear()
})



/* ===== reveal 滚动揭示（共享单个 IntersectionObserver） ===== */
let revealIO = null
const vReveal = {
  mounted(el, binding) {
    el.classList.add('reveal')
    if (binding.value) el.dataset.d = String(binding.value)
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      el.classList.add('in')
      return
    }
    if (!revealIO) {
      revealIO = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in')
            revealIO.unobserve(entry.target)
          }
        })
      }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' })
    }
    revealIO.observe(el)
  },
}

/* ===== 滚动到反馈区 ===== */
function scrollToFeedback() {
  const el = document.getElementById('feedback')
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/* ===== 数字格式化：< 1w 显示千分位逗号，>= 1w 显示 x.xw ===== */
function formatCount(n) {
  if (n === null || n === undefined) return '—'
  const num = +n
  if (!Number.isFinite(num)) return '—'
  let str
  if (num >= 10000) {
    const w = num / 10000
    str = (Math.round(w * 10) / 10).toString() + 'w'
  } else {
    str = num.toLocaleString()
  }
  return str.replace(/,/g, '<span class="num-sep">,</span>')
}

/* ===== 数据 ===== */
const highlights = [
  { n: '01', t: '分类清晰', d: '在线网站与本地工具两大分类，快速定位所需资源。' },
  { n: '02', t: '智能搜索', d: '多搜索引擎一键切换，直达站内工具或外部结果。' },
  { n: '03', t: '主题切换', d: '深浅色模式自由切换，自动记忆用户偏好。' },
  { n: '04', t: '标签页布局', d: '“多”窗口提升效率，拖拽排序与持久化存储。' },
  { n: '05', t: 'PWA 支持', d: '可安装到桌面，配合 Service Worker 离线可用。' },
  { n: '06', t: '隐私保护', d: 'Cookie 同意管理、透明的隐私政策与可选分析。' },
]

const thanks = [
  { name: '命令模拟器', href: 'https://commandsimulator.great-site.net/', desc: 'execute 语法转换与特殊符号资源参考' },
  { name: 'Webstack 网址导航', href: 'https://github.com/WebStackPage/WebStackPage.github.io', desc: '首页布局设计参考' },
  { name: 'Mizuki', href: 'https://github.com/LyraVoid/Mizuki', desc: '部分 UI/UX 效果参考' },
  { name: '矩阵方块 - T显编译器', href: 'https://jzfk.indevs.in/', desc: 'T显编辑器功能参考' },
  { name: 'MC 格式化代码渲染器', href: 'https://github.com/Spectrollay/minecraft_formating_code_online', desc: '§ 颜色代码渲染（MIT）' },
]

/* 社交关注链接 */
const socialFollowLinks = [
  { name: 'bilibili', icon: RiBilibiliLine, href: 'https://space.bilibili.com/3494378672753456', title: 'Bilibili', targetBlank: true },
  { name: 'douyin', icon: RiTiktokFill, href: 'https://www.douyin.com/user/MS4wLjABAAAADj8IaLSifYcIu5tcIOncHXGk_LjpeyRE7MJUV7xbIaK6A4Hijh1E--IiII91dFCn', title: '抖音', targetBlank: true },
  { name: 'github', icon: RiGithubFill, href: 'https://github.com/lonzov/LonzovTool/', title: 'GitHub', targetBlank: true },
  { name: 'qqgroup', icon: RiQqFill, href: 'https://qm.qq.com/q/hjTqUyIKEo', title: 'QQ 群 587984701', targetBlank: true },
  { name: 'blog', icon: RiRssFill, href: 'https://blog.lonzov.top/', title: '博客', targetBlank: true },
]

/* 统计区数据映射 */
const statMain = computed(() => stats.value.yearPV)
const statCluster = computed(() => ([
  { label: '今日访客', v: stats.value.todayUV },
  { label: '今日浏览', v: stats.value.todayPV },
  { label: '昨日访客', v: stats.value.yesterdayUV },
  { label: '本月访客', v: stats.value.monthUV },
]))
</script>

<template>
  <NConfigProvider :theme="naiveTheme" :theme-overrides="naiveThemeOverrides">
    <div class="about-page">
      <!-- ===== 1. HERO ===== -->
      <header class="hero">
        <span class="wm wm--slash" aria-hidden="true">/</span>
        <span class="hero-rail" aria-hidden="true"><b>01</b> about · <b>02</b> features · <b>03</b> contributors</span>

        <span class="hero-tag"><img src="/favicon.ico" alt="" class="hero-tag-logo" />小舟工具箱 / tool.lonzov.top</span>

        <h1>
          <span class="w l-mc">Minecraft<small>BEDROCK EDITION</small></span>
          <span class="w l-solid">指令工具</span>
          <span class="w l-hollow">聚合平台</span>
        </h1>

        <p class="hero-sub">聚合各类命令相关工具、文档与社区资源——<br>让复杂重复，变得简单高效。</p>

        <div class="hero-cta">
          <button class="btn btn-solid" @click="router.push('/')">浏览工具</button>
          <button class="btn btn-ghost" @click="scrollToFeedback">我要反馈</button>
        </div>
      </header>

      <!-- ===== 2. 数据统计 ===== -->
      <section class="sec stats">
        <span class="wm" aria-hidden="true">∑</span>
        <div class="grid">
          <div class="stat-hero" v-reveal>
            <div class="k">本年浏览</div>
            <div class="v">
              <span :ref="(el) => setCountRef(el, () => statMain)">0</span>
            </div>
            <div class="bar"></div>
          </div>
          <div class="stat-cluster">
            <div
              v-for="(s, i) in statCluster"
              :key="s.label"
              class="stat"
              v-reveal="i + 1"
            >
              <div class="k">{{ s.label }}</div>
              <div class="v">
                <span :ref="(el) => setCountRef(el, () => s.v)">0</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== 3. 视频 ===== -->
      <section class="sec video">
        <span class="wm" aria-hidden="true">▶</span>
        <div class="grid">
          <div class="video-stage" v-reveal>
            <span class="ghost" aria-hidden="true">// demo</span>
            <div class="video-frame">
              <span class="rec"><i></i>REC</span>
              <iframe
                src="//player.bilibili.com/player.html?isOutside=true&amp;aid=116619267281992&amp;bvid=BV1i6Ga6EELe&amp;cid=38536282740&amp;p=1&amp;autoplay=0"
                scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen
              ></iframe>
            </div>
          </div>
          <aside class="video-meta" v-reveal="1">
            <span class="vt" aria-hidden="true">WATCH</span>
            <ul>
              <li><span class="k">播放量</span><span class="v">
                <span :ref="(el) => setCountRef(el, () => videoStats.view, formatCount)">0</span>
              </span></li>
              <li><span class="k">点赞</span><span class="v">
                <span :ref="(el) => setCountRef(el, () => videoStats.like, formatCount)">0</span>
              </span></li>
              <li><span class="k">收藏</span><span class="v">
                <span :ref="(el) => setCountRef(el, () => videoStats.favorite, formatCount)">0</span>
              </span></li>
            </ul>
            <p>60 秒看懂为什么值得选择小舟工具箱</p>
          </aside>
        </div>
      </section>

      <!-- ===== 4. 关于 ===== -->
      <section class="sec about" id="about">
        <span class="wm" aria-hidden="true">01</span>
        <div class="eyebrow" v-reveal><b>01</b> about / 关于项目 <span class="ln"></span></div>
        <div class="grid">
          <div class="about-body" v-reveal>
            <p>这是一个 <span class="code">Minecraft</span> 基岩版指令工具聚合平台。提供在线 ID 查询、智能补全与各种快捷工具，<span class="hl">浏览器点开即用</span>。</p>
            <p>这是我自学的第一个完整作品，很多地方是边做边学磨出来的。代码基本都是 AI 敲的，我可以说是离开 AI 不会写 Hello World :(</p>
            <p>我只负架构设计、业务逻辑梳理与 Debug 环节……说人话就是出点子，做测试。相关的实践经验，以后如果有空会在博客做些总结。</p>
            <p>代码谈不上优雅，结构也未必规范，但它 <span class="big">能跑、能用，还能帮到别人</span>，我就挺开心的。</p>
          </div>
          <blockquote class="pullquote" v-reveal="1">
            <span class="mark" aria-hidden="true">/*</span>
            <q>能跑、能用，还能帮到别人，我就挺开心的。</q>
          </blockquote>
          <div class="lic" v-reveal="2">
            <span>100% LLM 生成</span>
            <span>Apache 2.0</span>
            <span>CC BY-NC 4.0</span>
          </div>
        </div>
      </section>

      <!-- ===== 5. 功能亮点 ===== -->
      <section class="sec features" id="features">
        <span class="wm" aria-hidden="true">02</span>
        <div class="eyebrow" v-reveal><b>02</b> features / 功能亮点 <span class="ln"></span></div>
        <ul class="feat">
          <li v-for="item in highlights" :key="item.n" v-reveal>
            <span class="n">{{ item.n }}</span>
            <div>
              <div class="t">{{ item.t }}</div>
              <div class="d">{{ item.d }}</div>
            </div>
          </li>
        </ul>
      </section>

      <!-- ===== 6. 贡献者跑马灯 ===== -->
      <section class="sec contrib" id="contributors">
        <span class="wm" aria-hidden="true">03</span>
        <div class="eyebrow" v-reveal><b>03</b> contributors / 贡献者 <span class="ln"></span></div>
        <div class="contrib-head" v-reveal>
          <h2 class="contrib-title">社区共建</h2>
          <p>每一条反馈、每一次收录、每一份打赏，都让小舟行得更远。感谢一路同行的每一位。</p>
        </div>
        <div class="marquee" v-reveal="1" aria-label="贡献者头像墙">
          <div class="marquee-row" v-for="(rowItems, rowIdx) in marqueeRows" :key="rowIdx">
            <div class="marquee-track">
              <div class="marquee-offset" :class="{ 'marquee-offset--shift': rowIdx === 1 }">
                <div class="marquee-set" v-for="set in 3" :key="set">
                  <NTooltip v-for="(c, i) in rowItems" :key="i" trigger="hover" :placement="rowIdx === 1 ? 'bottom' : 'top'">
                    <template #trigger>
                      <a
                        class="av"
                        :href="c.link || null"
                        :target="c.link ? '_blank' : null"
                        rel="noopener noreferrer"
                      >
                        <img
                          v-if="c.avatar && !avatarFailed(c.avatar)"
                          :src="c.avatar"
                          :alt="c.name"
                          @error="onAvatarError(c.avatar)"
                        />
                        <span v-else class="av-text">{{ c.name ? c.name.charAt(0) : '?' }}</span>
                      </a>
                    </template>
                    {{ c.name }}
                  </NTooltip>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== 7. 反馈 CTA（唯一反差块） ===== -->
      <section class="sec cta" id="feedback">
        <div class="cta-inner">
          <span class="wm" aria-hidden="true">!</span>
          <div class="eyebrow cta-eyebrow" v-reveal><b>04</b> feedback / 建议 &amp; 反馈 <span class="ln"></span></div>
          <h2 class="cta-title" v-reveal>有 Bug？<br>有 <span class="o">新想法？</span></h2>
          <div class="cta-row" v-reveal="1">
            <span class="cmd">$ 通过下方表单告诉我们 →</span>
            <span class="btn btn-inv trigger-feedback">在线反馈</span>
          </div>
          <div class="md-content cta-form-wrap">
            <IframeForm
              src="https://pcnk2disyt2p.feishu.cn/share/base/form/shrcnSkK8TS3y8eR4bnHkI1wmlc"
              :height="600"
              id="feedback"
            />
          </div>
          <div class="channels" v-reveal="2">
            <span>其它方式:</span>
            <a href="mailto:i@lonzov.top">邮件</a>
            <a href="https://qm.qq.com/q/hjTqUyIKEo" target="_blank" rel="noopener noreferrer">QQ 群 587984701</a>
          </div>
        </div>
      </section>

      <!-- ===== 8. 关注我们 + 特别鸣谢 ===== -->
      <section class="sec credits" id="credits">
        <span class="wm" aria-hidden="true">eof</span>
        <div class="grid">
          <div class="follow" v-reveal>
            <div class="eyebrow"><b>05</b> follow / 关注我们 <span class="ln"></span></div>
            <p class="follow-lead">如果觉得有用，欢迎点个 Star，或把它分享给身边同样在写指令的朋友。</p>
            <div class="social-row">
              <a
                v-for="btn in socialFollowLinks"
                :key="btn.name"
                class="soc"
                :href="btn.href"
                :target="btn.targetBlank ? '_blank' : null"
                :rel="btn.targetBlank ? 'noopener noreferrer' : null"
                :title="btn.title"
              >
                <component :is="btn.icon" size="18" />
              </a>
            </div>
          </div>
          <div class="thanks" v-reveal="1">
            <div class="eyebrow"><b>06</b> credits / 特别鸣谢 <span class="ln"></span></div>
            <ul>
              <li v-for="item in thanks" :key="item.name">
                <a class="name" :href="item.href" target="_blank" rel="noopener noreferrer">{{ item.name }}</a>
                <span class="desc">{{ item.desc }}</span>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  </NConfigProvider>
</template>

<style scoped>
/* ===== 局部变量：映射到项目变量 ===== */
.about-page {
  --mono: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  --r: 14px;
  --ease: cubic-bezier(.22, .61, .36, 1);
  --wm: color-mix(in srgb, var(--text-primary) 4.5%, transparent);
  --invert-bg: var(--text-primary);
  --invert-fg: var(--bg-color);
  --invert-line: var(--border-color);
  --line-2: var(--border-color);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", system-ui, sans-serif;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

.about-page :deep(*) {
  box-sizing: border-box;
}

.mono {
  font-family: var(--mono);
}

/* ===== 容器 + 12 列网格 ===== */
.hero,
.sec > .grid,
.sec > .eyebrow,
.sec > .feat,
.sec > .contrib-head,
.sec > .marquee,
.sec > .lic,
.sec > ul,
.cta-inner {
  max-width: 1240px;
  margin-inline: auto;
  padding-inline: clamp(20px, 5vw, 0px);
}

.grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: clamp(16px, 2vw, 28px);
}

/* ===== 章节通用 ===== */
.sec {
  position: relative;
  padding-block: clamp(56px, 9vw, 128px);
}

.sec + .sec {
  border-top: 1px solid var(--border-color);
}

/* 水印巨字 */
.wm {
  position: absolute;
  top: clamp(8px, 2vw, 24px);
  right: clamp(20px, 5vw, 64px);
  font-family: var(--mono);
  font-weight: 800;
  line-height: .8;
  font-size: clamp(7rem, 22vw, 20rem);
  color: var(--wm);
  pointer-events: none;
  user-select: none;
  z-index: 0;
  letter-spacing: -.04em;
}

.sec > *:not(.wm) {
  position: relative;
  z-index: 1;
}

/* 章节眉标 */
.eyebrow {
  display: flex;
  align-items: baseline;
  gap: 12px;
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: .18em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  margin-bottom: clamp(20px, 3vw, 36px);
}

.eyebrow b {
  color: var(--text-primary);
  font-weight: 700;
  font-size: 13px;
}

.eyebrow .ln {
  flex: 1;
  height: 1px;
  background: var(--border-color);
  transform: translateY(-3px);
}

/* ===== reveal 动效 ===== */
.reveal {
  opacity: 0;
  transform: translateY(22px);
  transition: opacity .8s var(--ease), transform .8s var(--ease);
}

.reveal.in {
  opacity: 1;
  transform: none;
}

.reveal[data-d="1"] { transition-delay: .08s; }
.reveal[data-d="2"] { transition-delay: .16s; }
.reveal[data-d="3"] { transition-delay: .24s; }
.reveal[data-d="4"] { transition-delay: .32s; }
.reveal[data-d="5"] { transition-delay: .40s; }

@media (prefers-reduced-motion: reduce) {
  .reveal {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
  }
}

/* ===== 1. HERO ===== */
.hero {
  position: relative;
  padding-top: clamp(0px, 4vw, 96px);
  padding-bottom: clamp(40px, 6vw, 80px);
  overflow: hidden;
  max-width: 1240px;
  margin: 0 auto;
  padding-inline: clamp(20px, 5vw, 0px);
}

.wm--slash {
  font-size: clamp(10rem, 40vw, 34rem);
  top: 50%;
  right: -2vw;
  transform: translateY(-50%);
  opacity: .6;
}

.hero-rail {
  position: absolute;
  top: clamp(120px, 18vw, 200px);
  right: calc(clamp(20px, 5vw, 64px) - 4px);
  writing-mode: vertical-rl;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: .25em;
  color: var(--text-tertiary);
  display: none;
}

.hero-rail b {
  color: var(--text-secondary);
  font-weight: 600;
}

@media (min-width: 1080px) {
  .hero-rail { display: block; }
}

.hero-tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: .12em;
  padding: 6px 14px 6px 9px;
  border: 1px solid var(--line-2);
  border-radius: 999px;
  color: var(--text-secondary);
  background: var(--bg-card);
}

.hero-tag-logo {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
  flex: none;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: .35; transform: scale(.7); }
}

.hero h1 {
  margin: clamp(20px, 3vw, 32px) 0 0;
  font-weight: 900;
  letter-spacing: -.03em;
  line-height: .92;
}

.hero h1 .w {
  display: inline-block;
  opacity: 0;
  transform: translateY(.4em);
  animation: rise .9s var(--ease) forwards;
}

@keyframes rise {
  to { opacity: 1; transform: none; }
}

.hero h1 .w:nth-child(1) { animation-delay: .05s; }
.hero h1 .w:nth-child(2) { animation-delay: .15s; }
.hero h1 .w:nth-child(3) { animation-delay: .28s; }

.l-mc {
  display: block;
  font-family: var(--mono);
  font-weight: 600;
  font-size: clamp(1.4rem, 4.5vw, 2.6rem);
  letter-spacing: -.01em;
  color: var(--text-secondary);
  border-bottom: 2px dashed var(--line-2);
  width: max-content;
  padding-bottom: 4px;
  margin-bottom: .1em;
}

.l-mc small {
  font-size: .5em;
  color: var(--text-tertiary);
  border: none;
  margin-left: 10px;
  letter-spacing: .1em;
}

.l-solid {
  display: block;
  font-size: clamp(3rem, 12vw, 8.5rem);
}

.l-hollow {
  display: block;
  font-size: clamp(3rem, 12vw, 8.5rem);
  margin-left: clamp(0px, 7vw, 90px);
  color: transparent;
  -webkit-text-stroke: 1.5px var(--text-primary);
}

@media (min-width: 760px) {
  .l-hollow { -webkit-text-stroke-width: 2px; }
}

.hero-sub {
  max-width: 42ch;
  margin-top: clamp(22px, 3vw, 34px);
  color: var(--text-secondary);
  font-size: clamp(1rem, 1.4vw, 1.15rem);
  border-left: 2px solid var(--text-primary);
  padding-left: 18px;
  opacity: 0;
  animation: rise .9s var(--ease) .55s forwards;
}

.hero-cta {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: clamp(26px, 3.5vw, 40px);
  opacity: 0;
  animation: rise .9s var(--ease) .68s forwards;
}

.btn {
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  padding: 8px 26px;
  border-radius: 999px;
  border: 1px solid var(--text-primary);
  text-decoration: none;
  color: var(--text-primary);
  background: transparent;
  transition: transform .25s var(--ease), box-shadow .25s var(--ease), background .25s, color .25s;
  display: inline-flex;
  align-items: center;
}

.btn-solid {
  background: var(--text-primary);
  color: var(--bg-color);
}

.btn-solid:hover {
  transform: translate(-3px, -3px);
  box-shadow: 5px 5px 0 var(--line-2);
}

.btn-ghost:hover {
  background: var(--text-primary);
  color: var(--bg-color);
}

/* ===== 2. 数据统计 ===== */
.stats .grid {
  align-items: end;
}

.stat-hero {
  grid-column: span 7;
}

.stat-hero .k {
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: .16em;
  color: var(--text-tertiary);
  text-transform: uppercase;
}

.stat-hero .v {
  font-family: var(--mono);
  font-weight: 800;
  line-height: .85;
  letter-spacing: -.04em;
  font-size: clamp(4.5rem, 15vw, 11rem);
}

:deep(.num-sep) {
  margin: 0 -.15em;
}

.stat-hero .bar {
  width: 64px;
  height: 3px;
  background: var(--text-primary);
  margin-top: 18px;
}

.stat-cluster {
  grid-column: span 5;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: clamp(18px, 3vw, 40px) clamp(16px, 2vw, 28px);
}

.stat {
  border-top: 1px solid var(--border-color);
  padding-top: 12px;
}

.stat .k {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: .12em;
  color: var(--text-tertiary);
  text-transform: uppercase;
}

.stat .v {
  font-family: var(--mono);
  font-weight: 700;
  font-size: clamp(1.6rem, 3.4vw, 2.4rem);
  letter-spacing: -.02em;
}

@media (max-width: 760px) {
  .stat-hero,
  .stat-cluster {
    grid-column: span 12;
  }
}

/* ===== 3. 视频 ===== */
.video .grid {
  align-items: center;
}

.video-stage {
  grid-column: span 8;
  position: relative;
}

.video-stage .ghost {
  position: absolute;
  top: -.35em;
  left: -.05em;
  z-index: 2;
  pointer-events: none;
  font-family: var(--mono);
  font-weight: 800;
  letter-spacing: -.03em;
  font-size: clamp(2.4rem, 7vw, 5rem);
  color: var(--wm);
}

.video-frame {
  position: relative;
  aspect-ratio: 16 / 9;
  border: 1px solid var(--line-2);
  border-radius: var(--r);
  overflow: hidden;
  background: #000;
}

.video-frame iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
}

[data-theme='dark'] .video-frame iframe {
  filter: brightness(0.7);
}

.video-frame .rec {
  position: absolute;
  top: 10px;
  left: 12px;
  z-index: 3;
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: .15em;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 6px;
  mix-blend-mode: difference;
}

.video-frame .rec i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ff3b30;
  animation: pulse 1.6s infinite;
}

.video-meta {
  grid-column: span 4;
  padding-left: clamp(0px, 2vw, 20px);
}

.video-meta .vt {
  writing-mode: vertical-rl;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: .2em;
  color: var(--text-tertiary);
  float: right;
  display: none;
}

.video-meta ul {
  list-style: none;
  display: grid;
  gap: 18px;
}

.video-meta li {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  border-bottom: 1px dashed var(--border-color);
  padding-bottom: 10px;
  font-family: var(--mono);
}

.video-meta li .k {
  color: var(--text-tertiary);
  font-size: 12px;
  letter-spacing: .08em;
}

.video-meta li .v {
  font-weight: 700;
  font-size: 15px;
}

.video-meta p {
  margin-top: 22px;
  color: var(--text-secondary);
  font-size: 14px;
  max-width: 30ch;
}

@media (min-width: 900px) {
  .video-meta .vt { display: block; }
}

@media (max-width: 820px) {
  .video-stage,
  .video-meta {
    grid-column: span 12;
  }
  .video-meta {
    padding-left: 0;
    margin-top: 24px;
  }
}

/* ===== 4. 关于 ===== */
.about-body {
  grid-column: span 7;
  font-size: clamp(1rem, 1.3vw, 1.12rem);
  color: var(--text-secondary);
}

.about-body p + p {
  margin-top: 1.1em;
}

.about-body .hl {
  color: var(--text-primary);
  font-weight: 600;
}

.about-body .code {
  font-family: var(--mono);
  border-bottom: 1.5px dashed var(--line-2);
}

.about-body .inv {
  background: var(--text-primary);
  color: var(--bg-color);
  padding: 1px 7px;
  border-radius: 5px;
  font-family: var(--mono);
  font-size: .92em;
}

.about-body .big {
  font-size: 1.18em;
  color: var(--text-primary);
  font-weight: 600;
}

.pullquote {
  grid-column: span 5;
  align-self: start;
  border-left: 3px solid var(--text-primary);
  padding: 6px 0 6px clamp(18px, 2vw, 28px);
  margin-left: clamp(0px, 3vw, 40px);
}

.pullquote .mark {
  font-family: var(--mono);
  font-size: clamp(1.5rem, 2.6vw, 2.2rem);
  line-height: 1;
  color: var(--text-tertiary);
  display: block;
  margin-bottom: .4em;
  letter-spacing: .05em;
}

.pullquote q {
  quotes: none;
  font-size: clamp(1.3rem, 2.6vw, 2rem);
  font-weight: 800;
  letter-spacing: -.01em;
  line-height: 1.3;
  color: var(--text-primary);
  display: block;
}

.pullquote q::after {
  content: "\00a0*/";
  color: var(--text-tertiary);
  font-family: var(--mono);
  font-weight: 500;
  font-size: .6em;
  letter-spacing: 0;
}

.lic {
  grid-column: span 12;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: clamp(28px, 4vw, 48px);
}

.lic span {
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: .04em;
  color: var(--text-secondary);
  border: 1px solid var(--line-2);
  border-radius: 6px;
  padding: 7px 12px;
}

.lic span::before {
  content: "> ";
  color: var(--text-tertiary);
}

@media (max-width: 820px) {
  .about-body,
  .pullquote {
    grid-column: span 12;
  }
  .pullquote {
    margin-left: 0;
  }
}

/* ===== 5. 功能亮点 ===== */
.feat {
  list-style: none;
}

.feat li {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: clamp(16px, 3vw, 40px);
  align-items: baseline;
  padding: clamp(18px, 2.4vw, 30px) clamp(8px, 1.5vw, 20px);
  border-top: 1px solid var(--border-color);
  transition: background .3s var(--ease), color .3s var(--ease), padding .3s var(--ease);
}

.feat li:last-child {
  border-bottom: 1px solid var(--border-color);
}

.feat li:nth-child(even) {
  padding-left: clamp(28px, 7vw, 96px);
}

.feat .n {
  font-family: var(--mono);
  font-weight: 800;
  font-size: clamp(2rem, 5vw, 3.4rem);
  line-height: .8;
  color: var(--text-tertiary);
  opacity: .5;
  transition: color .3s, opacity .3s;
}

.feat .t {
  font-size: clamp(1.15rem, 2vw, 1.6rem);
  font-weight: 800;
  letter-spacing: -.01em;
}

.feat .d {
  color: var(--text-secondary);
  font-size: clamp(.92rem, 1.2vw, 1.02rem);
  margin-top: 4px;
  max-width: 54ch;
}

.feat li:hover {
  background: var(--text-primary);
  color: var(--bg-color);
}

.feat li:hover .n {
  color: var(--bg-color);
  opacity: 1;
}

.feat li:hover .d {
  color: var(--invert-fg);
  opacity: .8;
}

/* ===== 6. 贡献者跑马灯 ===== */
.contrib-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: clamp(24px, 3vw, 40px);
}

.contrib-title {
  font-size: clamp(1.6rem, 4vw, 2.8rem);
  font-weight: 900;
  letter-spacing: -.02em;
  line-height: 1;
  margin: 0;
}

.contrib-head p {
  color: var(--text-secondary);
  max-width: 40ch;
  font-size: 15px;
  margin: 0;
}

.marquee {
  --av-size: clamp(48px, 7vw, 72px);
  --av-gap: 16px;
  position: relative;
  display: grid;
  gap: clamp(8px, 1.2vw, 14px);
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
  mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
}

.marquee-row {
  overflow: hidden;
}

.marquee-track {
  display: flex;
  width: max-content;
  animation: scroll-x 46s linear infinite;
}

.marquee-offset {
  display: flex;
  gap: var(--av-gap);
}

.marquee-set {
  display: flex;
  gap: var(--av-gap);
}

.marquee-offset--shift {
  transform: translateX(calc((var(--av-size) + var(--av-gap)) / -2));
}

@keyframes scroll-x {
  to { transform: translateX(-33.3333%); }
}

.av {
  width: var(--av-size);
  height: var(--av-size);
  border-radius: 50%;
  flex: none;
  border: 1px solid var(--line-2);
  overflow: hidden;
  display: block;
  position: relative;
  background: var(--bg-sub);
}

.av img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.av-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(var(--av-size) * 0.42);
  font-weight: 700;
  color: var(--text-secondary);
  user-select: none;
}

/* ===== 7. 反馈 CTA ===== */
.cta {
  border-top: 0;
}

.cta .wm {
  color: var(--wm);
}

.cta-eyebrow {
  color: var(--text-tertiary);
}

.cta-eyebrow b {
  color: var(--text-primary);
}

.cta-eyebrow .ln {
  background: var(--border-color);
}

.cta-title {
  font-size: clamp(2.2rem, 7vw, 5.5rem);
  font-weight: 900;
  letter-spacing: -.03em;
  line-height: .95;
  max-width: 14ch;
  margin: 0;
  color: var(--text-primary);
}

.cta-title .o {
  color: transparent;
  -webkit-text-stroke: 1.5px var(--text-primary);
}

.cta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 30px;
  flex-wrap: wrap;
  margin-top: clamp(24px, 3vw, 40px);
}

.cta-row .cmd {
  font-family: var(--mono);
  font-size: 13px;
  color: var(--text-tertiary);
  letter-spacing: .05em;
}

.btn-inv {
  background: var(--text-primary);
  color: var(--bg-color);
  border-color: var(--text-primary);
}

.btn-inv:hover {
  transform: translate(-3px, -3px);
  box-shadow: 5px 5px 0 var(--line-2);
}

.cta-form-wrap {
  max-width: 1240px;
  margin: 0 auto;
  padding-inline: clamp(0px, 5vw, 0px);
}

.channels {
  margin-top: clamp(28px, 4vw, 48px);
  padding-top: 20px;
  border-top: 1px solid var(--border-color);
  font-family: var(--mono);
  font-size: 13px;
  color: var(--text-tertiary);
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
}

.channels a {
  color: var(--text-primary);
  text-decoration: none;
  border-bottom: 1px dashed var(--border-color);
}

.channels a:hover {
  border-bottom-style: solid;
}

/* ===== 8. 关注我们 + 特别鸣谢 ===== */
.follow {
  grid-column: span 5;
}

.thanks {
  grid-column: span 7;
}

.follow-lead {
  color: var(--text-secondary);
  max-width: 34ch;
  font-size: 15px;
  margin-bottom: 24px;
}

.social-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.soc {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border: 1px solid var(--line-2);
  border-radius: 10px;
  color: var(--text-secondary);
  text-decoration: none;
  transition: background .2s var(--ease), color .2s var(--ease), transform .2s var(--ease);
}

.soc:hover {
  background: var(--text-primary);
  color: var(--bg-color);
  transform: translateY(-2px);
}

.soc :deep(svg) {
  width: 18px;
  height: 18px;
  display: block;
}

.thanks ul {
  list-style: none;
  display: grid;
  gap: 0;
}

.thanks li {
  display: grid;
  grid-template-columns: minmax(150px, auto) 1fr;
  gap: 16px;
  padding: 13px 0;
  border-top: 1px solid var(--border-color);
  font-size: 14px;
  align-items: baseline;
}

.thanks li:last-child {
  border-bottom: 1px solid var(--border-color);
}

.thanks .name {
  font-weight: 700;
  color: var(--text-primary);
  text-decoration: none;
  border-bottom: 1.5px dashed var(--line-2);
  width: max-content;
  transition: border-color .2s;
}

.thanks .name:hover {
  border-bottom-style: solid;
}

.thanks .desc {
  color: var(--text-tertiary);
  font-family: var(--mono);
  font-size: 12.5px;
  letter-spacing: .02em;
}

.thanks .desc::before {
  content: "# ";
}

@media (max-width: 820px) {
  .follow,
  .thanks {
    grid-column: span 12;
  }
}

@media (max-width: 560px) {
  .thanks li {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}
</style>

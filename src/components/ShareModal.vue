<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { NModal, useMessage } from 'naive-ui'
import { useRoute } from 'vue-router'

const props = defineProps({ show: Boolean })
const emit = defineEmits(['update:show'])
const message = useMessage()
const route = useRoute()

const showLocal = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val),
})

// ---- 状态 ----
const posterRef = ref(null)    // 离屏海报 DOM，html2canvas 的截图目标
const posterImgEl = ref(null)  // 模态框里的真图，揭幕前先等它解码完
const posterImage = ref(null)
let cachedKey = '' // 内容缓存键：命中则复用已生成海报，避免二次渲染
const generating = ref(false)

// 揭幕动效阶段：loading（骨架 + 毛玻璃 + 进度条）→ revealing（毛玻璃渐隐）→ idle（只剩真图）
const phase = ref('idle')
const progress = ref(0)
const posterShown = ref(false) // 真图渐显开关：骨架换成真图时用透明度过渡，避免硬切
const REVEAL_MS = 520   // 与 .poster-veil 的 opacity 过渡时长保持一致
const IMG_FADE_MS = 620 // 与 .poster-img 的 opacity 过渡时长保持一致，需小于 REVEAL_MS

// ---- 进度条补间 ----
// html2canvas 不提供真实百分比，只能按生成阶段跳档；阶段内用 ease-out 补间，越接近目标越慢
let rafId = 0
let rafResolve = null

function cancelTween() {
  cancelAnimationFrame(rafId)
  rafId = 0
  const done = rafResolve
  rafResolve = null
  done?.()
}

/** 平滑补间到目标值；Promise 在到达或被下一次调用打断时 resolve */
function tweenProgress(target, duration = 520) {
  cancelTween()
  return new Promise((resolve) => {
    const from = progress.value
    const delta = target - from
    if (Math.abs(delta) < 0.5) {
      progress.value = target
      resolve()
      return
    }
    const t0 = performance.now()
    rafResolve = resolve
    const step = (now) => {
      const t = Math.min(1, (now - t0) / duration)
      progress.value = from + delta * (1 - Math.pow(1 - t, 3)) // cubic ease-out
      if (t < 1) {
        rafId = requestAnimationFrame(step)
        return
      }
      progress.value = target
      rafId = 0
      const done = rafResolve
      rafResolve = null
      done?.()
    }
    rafId = requestAnimationFrame(step)
  })
}

let revealTimer = 0

// 移动端自适应高度（参考 UpdateDialog）
const isCompact = ref(false)
let mq = null
function onMqChange(e) { isCompact.value = e.matches }
onMounted(() => {
  mq = window.matchMedia('(max-width: 640px)')
  isCompact.value = mq.matches
  mq.addEventListener('change', onMqChange)
})
onUnmounted(() => {
  if (mq) mq.removeEventListener('change', onMqChange)
  cancelTween()
  clearTimeout(revealTimer)
})

// 动态数据
const shareTitle = ref('小舟工具箱')
const shareDesc = ref('')
const qrDataUrl = ref('')
const logoUrl = '/app-icon/ios/180.png'

// ---- 工具函数 ----
function getMeta(name, property) {
  const el = property
    ? document.querySelector(`meta[property="${property}"]`)
    : document.querySelector(`meta[name="${name}"]`)
  return el?.getAttribute('content')?.trim() || ''
}

// ---- 分享事件上报去重 ----
let shareReported = false
watch(() => route.path, () => { shareReported = false })

/* Umami事件上报 */
function trackShare() {
  if (shareReported) return
  if (typeof window === 'undefined' || !window.umami) return
  shareReported = true
  window.umami.track(`Share+${window.location.pathname}`)
}

/** 清洗 URL 参数并追加 UTM 渠道追踪 */
function buildShareUrl() {
  const u = new URL(window.location.href)
  // 清洗掉所有已有参数
  u.search = ''
  // 统一 UTM 渠道标记
  u.searchParams.set('utm_source', 'user_sharing')
  return u.toString()
}


// ---- 生成海报 ----
async function generatePoster() {
  // 1. 收集数据
  const url = buildShareUrl()
  const rawTitle = getMeta('', 'og:title') || document.title || '小舟工具箱'
  const title = rawTitle.split(' - ')[0].trim()
  const desc = getMeta('description') || getMeta('', 'og:description') || ''
  const key = `${title}|${desc}|${url}`

  // 2. 命中缓存：直接出图，不播揭幕动效
  if (cachedKey === key && posterImage.value) {
    return
  }
  // 已有一轮生成在跑（生成中关掉再打开），让它继续跑完，避免两次渲染互相打断
  if (generating.value) {
    return
  }

  generating.value = true
  posterImage.value = null
  shareTitle.value = title
  shareDesc.value = desc
  progress.value = 0
  posterShown.value = false
  clearTimeout(revealTimer)
  phase.value = 'loading'

  // 3. QR 码
  tweenProgress(35)
  try {
    const QRCode = (await import('qrcode')).default
    qrDataUrl.value = await QRCode.toDataURL(url, {
      margin: 1,
      width: 168,
      color: { dark: '#141414', light: '#ffffff' },
    })
  } catch { /* 静默降级 */ }

  // 4. 等图片加载
  tweenProgress(60)
  await nextTick()
  // 等 qr img 和 logo 加载完成
  await new Promise(r => setTimeout(r, 500))

  // 5. html2canvas 截图（按需加载，避免其 ~200K 体积在启动时被解析占用主线程）
  tweenProgress(90)
  try {
    if (!posterRef.value) throw new Error('poster not mounted')
    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(posterRef.value, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
    })
    posterImage.value = canvas.toDataURL('image/png')
    cachedKey = key
  } catch {
    // 生成失败：撤掉毛玻璃与骨架，保留占位高度，避免卡在加载态
    cachedKey = ''
    cancelTween()
    phase.value = 'idle'
    generating.value = false
    return
  }

  // 6. 等真图解码完再渐显，否则毛玻璃散开的一瞬下面还是空白
  await nextTick()
  try { await posterImgEl.value?.decode() } catch { /* 解码失败也照常揭幕 */ }
  // 先让它以 opacity:0 画过一帧，透明度渐变才有起点
  await new Promise(r => requestAnimationFrame(r))
  posterShown.value = true

  // 7. 进度冲满 → 毛玻璃与进度条一起渐隐（真图此时已在下面渐显完）
  await tweenProgress(100, 340)
  phase.value = 'revealing'
  revealTimer = setTimeout(() => {
    phase.value = 'idle'
    generating.value = false
  }, REVEAL_MS)
}

// ---- 复制链接 ----
async function copyLink() {
  trackShare()
  const url = window.location.href
  try {
    await navigator.clipboard.writeText(url)
    message.success('已复制', { duration: 1000 })
  } catch {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = url
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'absolute'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      if (!document.execCommand('copy')) throw new Error()
      document.body.removeChild(textarea)
      message.success('已复制', { duration: 1000 })
    } catch {
      message.error('复制失败，请重试', { duration: 1000 })
    }
  }
}

// ---- 保存图片 ----
function buildPosterFileName() {
  const title = (shareTitle.value || '').trim() || '小舟工具箱'
  const base = title === '小舟工具箱' ? title : `${title} - 小舟工具箱`
  return `${base.replace(/[\\/:*?"<>|]/g, '').trim() || '小舟工具箱'}.png`
}

function downloadPoster() {
  trackShare()
  if (!posterImage.value) return
  const a = document.createElement('a')
  a.href = posterImage.value
  a.download = buildPosterFileName()
  a.click()
}

// ---- 监听 ----
watch(() => props.show, (val) => {
  if (val) {
    nextTick(() => generatePoster())
  }
})

// ---- 模糊遮罩 ----
watch(() => props.show, (val) => {
  const id = 'share-modal-blur'
  if (val) {
    nextTick(() => {
      if (document.getElementById(id)) return
      const overlay = document.createElement('div')
      overlay.id = id
      overlay.style.cssText = [
        'position:fixed','top:0','left:0','right:0','bottom:0',
        'z-index:1990', // 盖住移动端汉堡(1950)/菜单抽屉(1900)，仍低于 NModal(≥2000)
        '-webkit-backdrop-filter:blur(8px)','backdrop-filter:blur(8px)',
        'background:rgba(0,0,0,0.1)',
        'pointer-events:none',
        'opacity:0','transition:opacity 0.3s ease',
      ].join(';')
      document.body.appendChild(overlay)
      requestAnimationFrame(() => { overlay.style.opacity = '1' })
    })
  } else {
    const overlay = document.getElementById(id)
    if (overlay) {
      overlay.style.opacity = '0'
      setTimeout(() => overlay.remove(), 300)
    }
  }
})

// ---- Naive UI ----
const modalStyle = computed(() => ({
  maxWidth: '560px',
  width: 'calc(100% - 32px)',
  maxHeight: isCompact.value ? 'calc(100vh - 120px)' : 'calc(100vh - 48px)',
  borderRadius: 'var(--radius-xl)',
}))
</script>

<template>
  <!-- 隐藏的海报 HTML（供 html2canvas 截图） -->
  <div
    ref="posterRef"
    class="poster-src"
    :style="{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1 }"
  >
    <article class="poster-card">
      <!-- 几何装饰 -->
      <div class="geo" aria-hidden="true">
        <svg viewBox="0 0 100 100" shape-rendering="geometricPrecision" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(20,20,20,.14)" stroke-width=".6"/>
          <rect x="18" y="18" width="64" height="64" fill="none" stroke="rgba(20,20,20,.095)" stroke-width=".5" transform="rotate(45 50 50)"/>
          <line x1="50" y1="14" x2="50" y2="86" stroke="rgba(20,20,20,.07)" stroke-width=".45"/>
          <line x1="14" y1="50" x2="86" y2="50" stroke="rgba(20,20,20,.07)" stroke-width=".45"/>
          <line x1="50" y1="2"  x2="50" y2="9"  stroke="rgba(20,20,20,.11)" stroke-width=".5"/>
          <line x1="50" y1="91" x2="50" y2="98" stroke="rgba(20,20,20,.11)" stroke-width=".5"/>
          <line x1="2"  y1="50" x2="9"  y2="50" stroke="rgba(20,20,20,.11)" stroke-width=".5"/>
          <line x1="91" y1="50" x2="98" y2="50" stroke="rgba(20,20,20,.11)" stroke-width=".5"/>
          <circle cx="50" cy="50" r=".5" fill="rgba(20,20,20,.18)"/>
        </svg>
      </div>

      <!-- 主体 -->
      <div class="body">
        <div class="title">{{ shareTitle }}</div>
        <div class="desc">
          <i></i>
          <p>{{ shareDesc }}</p>
        </div>
      </div>

      <!-- 底栏 -->
      <footer class="foot">
        <img class="brandlogo" :src="logoUrl" alt="小舟工具箱" crossorigin="anonymous">
        <div class="brand">
          <strong>小舟工具箱</strong>
          <span>扫码免费使用</span>
        </div>
        <img v-if="qrDataUrl" class="qr" :src="qrDataUrl" alt="扫码访问">
      </footer>
    </article>
  </div>

  <NModal
    v-model:show="showLocal"
    preset="card"
    :style="modalStyle"
    title="分享"
    :bordered="false"
    :closable="true"
    :mask-closable="true"
    :auto-focus="false"
    content-scrollable
    :segmented="{ content: true, footer: true }"
  >
    <div class="poster-wrap">
      <!-- 海报框：始终按海报 2:3 占位，高度从打开到出图都不变 -->
      <div class="poster-frame">
        <!-- 占位骨架：按海报真实版式排，压在毛玻璃下只看大意 -->
        <div v-if="phase !== 'idle'" class="poster-skeleton" aria-hidden="true">
          <div class="sk-title">
            <span class="sk-bar sk-bar-title1"></span>
            <span class="sk-bar sk-bar-title2"></span>
          </div>
          <div class="sk-desc">
            <span class="sk-rail"></span>
            <div class="sk-desc-lines">
              <span class="sk-bar"></span>
              <span class="sk-bar"></span>
              <span class="sk-bar sk-bar-desc3"></span>
            </div>
          </div>
          <div class="sk-foot">
            <span class="sk-logo"></span>
            <div class="sk-brand">
              <span class="sk-bar sk-bar-name"></span>
              <span class="sk-bar sk-bar-sub"></span>
            </div>
            <span class="sk-qr"></span>
          </div>
        </div>

        <img
          v-if="posterImage"
          ref="posterImgEl"
          :src="posterImage"
          alt="分享海报"
          class="poster-img"
          :class="{ 'is-in': posterShown }"
          :style="{ '--img-fade': IMG_FADE_MS + 'ms' }"
        >

        <!-- 毛玻璃 + 进度条：真图就位后整体渐隐揭幕 -->
        <div
          v-if="phase !== 'idle'"
          class="poster-veil"
          :class="{ 'is-out': phase === 'revealing' }"
        >
          <div class="poster-progress">
            <span class="poster-progress-fill" :style="{ width: progress + '%' }"></span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="modal-foot">
        <button class="foot-btn foot-btn-outline" @click="copyLink">复制链接</button>
        <button
          class="foot-btn foot-btn-fill"
          :disabled="!posterImage"
          @click="downloadPoster"
        >保存图片</button>
      </div>
    </template>
  </NModal>
</template>

<style>
/* ===== 海报 HTML 样式（精确匹配预览页，供 html2canvas 截图） ===== */
.poster-src {
  font-family: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.poster-card {
  position: relative;
  overflow: hidden;
  width: 360px;
  height: 540px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
}

.poster-card .geo {
  position: absolute;
  right: -104px;
  top: 58%;
  transform: translateY(-50%);
  width: 340px;
  height: 340px;
  z-index: 0;
  pointer-events: none;
}

.poster-card .geo svg {
  display: block;
  width: 100%;
  height: 100%;
}

.poster-card .body {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 50px 30px 0;
}

.poster-card .title {
  font-family: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 32px;
  font-weight: 900;
  line-height: 1.12;
  letter-spacing: .01em;
  color: #141414;
  word-break: break-word;
  margin: 0;
}

.poster-card .desc {
  display: flex;
  gap: 13px;
  align-items: stretch;
  margin-top: 20px;
  margin-left: -13px;
  padding: 11px 14px 11px 13px;
  background: linear-gradient(92deg, rgba(20,20,20,.035), rgba(20,20,20,0) 82%);
}

.poster-card .desc i {
  flex: none;
  width: 7px;
  position: relative;
}

.poster-card .desc i::before {
  content: "";
  position: absolute;
  top: 2px;
  left: 0;
  width: 7px;
  height: 7px;
  background: #141414;
}

.poster-card .desc i::after {
  content: "";
  position: absolute;
  top: 13px;
  left: 3px;
  width: 1px;
  bottom: 1px;
  background: #cfcfcf;
}

.poster-card .desc p {
  font-family: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 15px;
  line-height: 1.9;
  color: #444444;
  letter-spacing: .01em;
  margin: 0;
}

.poster-card .foot {
  position: relative;
  z-index: 1;
  flex: none;
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 20px 30px 26px;
}

.poster-card .foot::before {
  content: "";
  position: absolute;
  top: 0;
  left: 30px;
  right: 30px;
  height: 1px;
  background: #e6e6e6;
}

.poster-card .brandlogo {
  flex: none;
  width: 50px;
  height: 50px;
  object-fit: contain;
}

.poster-card .brand {
  min-width: 0;
}

.poster-card .brand strong {
  display: block;
  font-family: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 16px;
  font-weight: 900;
  letter-spacing: .04em;
  color: #141414;
}

.poster-card .brand span {
  display: block;
  margin-top: 6px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
  font-weight: 500;
  line-height: 1;
  letter-spacing: .14em;
  color: #8c8c8c;
}

.poster-card .qr {
  margin-left: auto;
  flex: none;
  width: 96px;
  height: 96px;
  border: 1.5px solid #141414;
  background: #fff;
  padding: 6px;
  object-fit: contain;
  box-sizing: border-box;
}
</style>

<style scoped>
.poster-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0 0 0;
}

/* 海报框：2:3 与海报本体一致，高度自始至终不变 */
.poster-frame {
  position: relative;
  flex: none;
  width: 100%;
  max-width: 360px;
  aspect-ratio: 360 / 540;
  border-radius: 8px;
  overflow: hidden;
  /* 海报本体永远是白底，骨架与真图都铺在这上面，不随主题变 */
  background: #FFFFFF;
}

/* ===== 占位骨架（尺寸对应海报 360×540 的版式，宽度用 % 跟随缩放） ===== */
.poster-skeleton {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 13.889% 8.333% 0; /* 对应海报内边距 50px 30px */
}

.sk-bar {
  display: block;
  flex: none;
  height: 28px;
  border-radius: 7px;
  background: #C2C2C2;
}

.sk-title {
  display: flex;
  flex-direction: column;
  gap: 7px; /* 对应标题行距 1.12 × 32px */
}
.sk-bar-title1 { width: 100%; }
.sk-bar-title2 { width: 55%; }

.sk-desc {
  display: flex;
  align-items: stretch;
  gap: 4.333%;       /* 对应简介内间距 13px */
  margin-top: 6.667%; /* 对应简介上外边距 20px */
}
.sk-rail {
  flex: none;
  width: 2.333%; /* 对应简介左侧方块 7px */
  border-radius: 2px;
  background: #C2C2C2;
}
.sk-desc-lines {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px; /* 14px 条 + 14px 间距 ≈ 简介行高 1.9 × 15px */
  padding-top: 4px;
}
.sk-desc-lines .sk-bar {
  height: 14px;
  border-radius: 4px;
}
.sk-bar-desc3 { width: 60%; }

.sk-foot {
  display: flex;
  align-items: center;
  gap: 4.333%;           /* 对应底栏间距 13px */
  margin-top: auto;      /* 顶到底部，与海报底栏对齐 */
  padding-bottom: 8.667%; /* 对应底栏下内边距 26px */
}
.sk-logo {
  flex: none;
  width: 16.667%; /* 对应 logo 50px */
  aspect-ratio: 1;
  border-radius: 8px;
  background: #C2C2C2;
}
.sk-brand {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sk-bar-name {
  width: 62%;
  height: 14px;
  border-radius: 4px;
}
.sk-bar-sub {
  width: 48%;
  height: 6px;
  border-radius: 3px;
}
.sk-qr {
  flex: none;
  width: 32%; /* 对应二维码 96px */
  aspect-ratio: 1;
  border-radius: 6px;
  background: #C2C2C2;
}

.poster-img {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: block;
  width: 100%;
  height: 100%;
  /* 从骨架渐显到真图，避免毛玻璃下露出硬切 */
  opacity: 0;
  transition: opacity var(--img-fade, 0.62s) cubic-bezier(0.4, 0, 0.2, 1);
}
.poster-img.is-in { opacity: 1; }

/* ===== 毛玻璃层 + 进度条：真图就位后整体渐隐揭幕 ===== */
.poster-veil {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: inherit;
  background: rgba(255, 255, 255, 0.16);
  -webkit-backdrop-filter: blur(15px) saturate(1.5);
  backdrop-filter: blur(15px) saturate(1.5);
  transition: opacity 0.52s cubic-bezier(0.4, 0, 0.2, 1);
}
.poster-veil.is-out { opacity: 0; }

.poster-progress {
  width: 46%;
  max-width: 168px;
  height: 6px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(20, 20, 20, 0.12);
}
.poster-progress-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: #141414;
}

.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.foot-btn {
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
  font-family: inherit;
}

.foot-btn:disabled { opacity: 0.4; cursor: default; }

.foot-btn-outline { border: 1.5px solid currentColor; }
[data-theme='light'] .foot-btn-outline { background: #fff; color: #1A1A1A; }
[data-theme='light'] .foot-btn-outline:hover { background: #E8E8E8; }
[data-theme='dark'] .foot-btn-outline { background: transparent; color: rgba(255,255,255,0.87); }
[data-theme='dark'] .foot-btn-outline:hover { background: rgba(255,255,255,0.08); }

[data-theme='light'] .foot-btn-fill { background: #1A1A1A; color: #fff !important; }
[data-theme='dark'] .foot-btn-fill { background: #fff; color: #1A1A1A !important; }
.foot-btn-fill:hover { opacity: 0.85; }
</style>

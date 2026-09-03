<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { NModal, NConfigProvider, useMessage } from 'naive-ui'
import { darkTheme } from 'naive-ui'
import { useTheme } from '../composables/useTheme'

const props = defineProps({ show: Boolean })
const emit = defineEmits(['update:show'])
const { isDark } = useTheme()
const message = useMessage()

const showLocal = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val),
})

// ---- 状态 ----
const posterRef = ref(null)
const posterImage = ref(null)
let cachedKey = '' // 内容缓存键：命中则复用已生成海报，避免二次渲染
const generating = ref(false)

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

/** 清洗 URL 参数并追加 UTM 渠道追踪 */
function buildShareUrl() {
  const u = new URL(window.location.href)
  // 清洗掉所有已有参数
  u.search = ''
  // 统一 UTM 渠道标记
  u.searchParams.set('utm_source', 'user_sharing')
  u.searchParams.set('utm_medium', 'user_sharing')
  u.searchParams.set('utm_campaign', 'user_sharing')
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

  // 2. 命中缓存：直接展示，跳过整个渲染流程
  if (cachedKey === key && posterImage.value) {
    return
  }

  generating.value = true
  posterImage.value = null
  shareTitle.value = title
  shareDesc.value = desc

  // 3. QR 码
  try {
    const QRCode = (await import('qrcode')).default
    qrDataUrl.value = await QRCode.toDataURL(url, {
      margin: 1,
      width: 168,
      color: { dark: '#141414', light: '#ffffff' },
    })
  } catch { /* 静默降级 */ }

  // 4. 等图片加载
  await nextTick()
  // 等 qr img 和 logo 加载完成
  await new Promise(r => setTimeout(r, 500))

  // 5. html2canvas 截图（按需加载，避免其 ~200K 体积在启动时被解析占用主线程）
  if (posterRef.value) {
    try {
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
      cachedKey = '' // 生成失败清空缓存，避免下次误命中
    }
  }

  generating.value = false
}

// ---- 复制链接 ----
async function copyLink() {
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
function downloadPoster() {
  if (!posterImage.value) return
  const a = document.createElement('a')
  a.href = posterImage.value
  a.download = 'poster-xiaozhou-toolkit.png'
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
        'z-index:1000',
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
const darkOverrides = {
  common: { neutralModal: '#191919' },
  Card: { colorModal: '#191919' },
}

const modalStyle = computed(() => ({
  maxWidth: '560px',
  width: 'calc(100% - 32px)',
  maxHeight: isCompact.value ? 'calc(100vh - 120px)' : 'calc(100vh - 48px)',
  borderRadius: '16px',
  cornerShape: 'squircle',
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

  <NConfigProvider :theme="isDark ? darkTheme : null" :theme-overrides="isDark ? darkOverrides : undefined">
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
        <div v-if="generating" class="poster-loading">
          <div class="spinner"></div>
          <span>正在生成海报…</span>
        </div>
        <img
          v-else-if="posterImage"
          :src="posterImage"
          alt="分享海报"
          class="poster-img"
        >
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
  </NConfigProvider>
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
  min-height: 200px;
  padding: 8px 0 0 0;
}

.poster-img {
  width: 100%;
  max-width: 360px;
  height: auto;
  display: block;
  border-radius: 8px;
}

.poster-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--n-text-color-2);
  font-size: 14px;
  padding: 40px 0;
}

.spinner {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 3px solid;
  animation: spin 0.9s linear infinite;
}
[data-theme='dark'] .spinner { border-color: #fff #fff0; }
[data-theme='light'] .spinner { border-color: #000 #0000; }

@keyframes spin { to { transform: rotate(1turn); } }

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

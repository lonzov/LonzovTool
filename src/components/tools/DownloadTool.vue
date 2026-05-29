<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { NIcon, NModal, NConfigProvider, NCascader, NNumberAnimation, useMessage } from 'naive-ui'
import { darkTheme } from 'naive-ui'
import { PersonBoard24Filled, Link24Filled, ArrowDownload24Filled, ArrowUpRight20Filled } from '@vicons/fluent'
import { useTheme } from '../../composables/useTheme'

const props = defineProps({
  tabPath: {
    type: String,
    default: '',
  },
})

const route = useRoute()
const message = useMessage()

// 从路由参数解析页面名称
const pageName = computed(() => {
  // 优先使用 props.tabPath（WorkspaceView 传入），其次用路由参数，最后从 path 解析
  if (props.tabPath) {
    return props.tabPath.replace(/\/+$/, '').split('/').pop() || ''
  }
  // /down/:path 路由，直接取 params
  const param = route.params.path
  if (param && typeof param === 'string') {
    return param.replace(/\/+$/, '')
  }
  // fallback: 从完整路径取最后一段
  return route.path.replace(/\/+$/, '').split('/').pop() || ''
})

const config = ref(null)
const loading = ref(true)

import { getDownloadConfig } from '../../data/downloads/index.js'

async function loadConfig() {
  loading.value = true
  config.value = null

  try {
    const slug = pageName.value

    const loader = getDownloadConfig(slug)
    if (!loader) throw new Error(`下载页配置不存在: ${slug}`)

    const mod = await loader()
    config.value = mod.default || mod
  } catch (e) {
    message.error('加载失败：' + e.message, { duration: 2500 })
  } finally {
    loading.value = false
  }
}

watch(pageName, () => loadConfig())
onMounted(() => { loadConfig() })

// ===== 下载逻辑 =====
const showDownloadModal = ref(false)
const { isDark } = useTheme()

// 覆盖Naive弹窗背景色为主区域卡片同色（--bg-card: 浅色#FFFFFF, 深色#191919）
const darkOverrides = {
  common: { neutralModal: '#191919' },
  Card: { colorModal: '#191919' },
}

const lightOverrides = {
  common: { neutralModal: '#FFFFFF' },
  Card: { colorModal: '#FFFFFF' },
}

// 手动创建模糊遮罩（NModal 自带遮罩不支持 backdrop-filter + 遮罩不够黑）
watch(showDownloadModal, (val) => {
  if (val) {
    nextTick(() => {
      const existing = document.getElementById('download-blur-overlay')
      if (!existing) {
        const overlay = document.createElement('div')
        overlay.id = 'download-blur-overlay'
        overlay.style.cssText = [
          'position: fixed',
          'top: 0',
          'left: 0',
          'right: 0',
          'bottom: 0',
          'z-index: 1000',
          '-webkit-backdrop-filter: blur(8px)',
          'backdrop-filter: blur(8px)',
          'background: rgba(0, 0, 0, 0.1)',
          'pointer-events: none',
          'opacity: 0',
          'transition: opacity 0.3s ease'
        ].join(';')
        document.body.appendChild(overlay)
        requestAnimationFrame(() => {
          overlay.style.opacity = '1'
        })
      }
    })
  } else {
    const overlay = document.getElementById('download-blur-overlay')
    if (overlay) {
      overlay.style.opacity = '0'
      setTimeout(() => overlay.remove(), 300)
    }
  }
})

function openDownloadModal() {
  if (!currentLanzou.value) return
  showDownloadModal.value = true
}

// ===== 多版本选择 =====
const selectedVersionIndex = ref(0)

/** 将 lanzou 统一为数组格式（兼容旧对象格式） */
const lanzouList = computed(() => {
  const lz = config.value?.lanzou
  if (!lz) return []
  return Array.isArray(lz) ? lz : [lz]
})

/** 是否存在多版本 */
const hasMultiVersion = computed(() => lanzouList.value.length > 1)

/** 当前选中版本的下载信息 */
const currentLanzou = computed(() => {
  const list = lanzouList.value
  return list[selectedVersionIndex.value] || list[0] || null
})

/** Cascader options：单层结构，value 为索引 */
const cascaderOptions = computed(() =>
  lanzouList.value.map((item, idx) => ({
    value: idx,
    label: item.version || `版本 ${idx + 1}`,
  }))
)

/** 打开模态框时重置为最新版本（第一个） */
watch(showDownloadModal, (val) => {
  if (val) selectedVersionIndex.value = 0
})

/** 构造API解析链接 */
function buildApiUrl(apiType) {
  const lz = currentLanzou.value
  if (!lz) return ''
  if (apiType === 1) {
    return `https://lz.qaiu.top/parser?url=${encodeURIComponent(lz.url)}&pwd=${encodeURIComponent(lz.password)}`
  }
  return `https://api.lonzov.top/lanzou/index.php?url=${encodeURIComponent(lz.url)}&pwd=${encodeURIComponent(lz.password)}&type=down`
}

function handleDirectParse() {
  reportDownload()
  window.open(buildApiUrl(1), '_blank')
  showDownloadModal.value = false
}

function handleBackupParse() {
  reportDownload()
  window.open(buildApiUrl(2), '_blank')
  showDownloadModal.value = false
}

// 临时记录：已提示过复制失败的 slug 集合，下次点击不再拦截
const _copyFailedSlugs = new Set()

async function handleOriginalLink() {
  reportDownload()
  const lz = currentLanzou.value
  const pwd = lz?.password
  const slug = pageName.value
  if (pwd && !_copyFailedSlugs.has(slug)) {
    let copied = false
    try {
      await navigator.clipboard.writeText(pwd)
      copied = true
    } catch {
      try {
        const textarea = document.createElement('textarea')
        textarea.value = pwd
        textarea.setAttribute('readonly', '')
        textarea.style.cssText = 'position:fixed;left:-9999px'
        document.body.appendChild(textarea)
        textarea.select()
        copied = !!document.execCommand('copy')
        document.body.removeChild(textarea)
      } catch { /* ignore */ }
    }
    if (!copied) {
      _copyFailedSlugs.add(slug)
      message.error(`复制失败，请在记住密码 ${pwd} 后再次点击`, { duration: 6000 })
      return
    }
  }
  window.open(lz.url, '_blank')
  showDownloadModal.value = false
}

// 开发者点击
function handleDeveloperClick() {
  if (config.value?.developerLink) {
    window.open(config.value.developerLink, '_blank')
  }
}

// ===== 下载次数统计（多层缓存） =====
const CACHE_KEY = 'dl_count_cache'       // localStorage 缓存 key
const COOLDOWN_KEY = 'dl_count_log'      // 上报限速 key（复用已有）
const CACHE_TTL_MS = 3 * 60 * 1000       // 缓存有效期 3 分钟
// 内存缓存（跨组件实例共享）
const memoryCache = new Map()             // slug → { count, ts }

const dlCount = ref(0)
const dlCountFetched = ref(false)

/** 验证下载量数值：必须为 8 位及以内的正整数 */
function isValidCount(val) {
  return typeof val === 'number' && Number.isInteger(val) && val >= 0 && val < 1e8
}

/** 读取 localStorage 缓存 */
function readLocalCache(slug) {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const map = JSON.parse(raw)
    const entry = map[slug]
    if (!entry || typeof entry.count !== 'number' || typeof entry.ts !== 'number') return null
    return entry
  } catch { return null }
}

/** 写入 localStorage 缓存 */
function writeLocalCache(slug, count, ts) {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    const map = raw ? JSON.parse(raw) : {}
    map[slug] = { count, ts }
    localStorage.setItem(CACHE_KEY, JSON.stringify(map))
  } catch { /* ignore */ }
}

/** 检查上报冷却（3 分钟限速） */
function shouldReport(slug) {
  try {
    const raw = localStorage.getItem(COOLDOWN_KEY)
    if (!raw) return true
    const log = JSON.parse(raw)
    const entry = log[slug]
    if (!entry) return true
    return Date.now() - entry.t > CACHE_TTL_MS
  } catch { return true }
}

/** 标记已上报 */
function markReported(slug) {
  try {
    const raw = localStorage.getItem(COOLDOWN_KEY)
    const log = raw ? JSON.parse(raw) : {}
    log[slug] = { t: Date.now(), p: slug }
    localStorage.setItem(COOLDOWN_KEY, JSON.stringify(log))
  } catch { /* ignore */ }
}

/** 获取下载次数（核心逻辑） */
async function fetchDownloadCount() {
  const slug = pageName.value
  if (!slug) return

  const hardcoded = config.value?.downloads ?? 0
  let bestCount = isValidCount(hardcoded) ? hardcoded : 0
  let hasFreshCache = false

  // 检查内存缓存
  const mem = memoryCache.get(slug)
  if (mem && isValidCount(mem.count)) {
    if (mem.count > bestCount) bestCount = mem.count
    if (Date.now() - mem.ts < CACHE_TTL_MS) hasFreshCache = true
  }

  // 检查 localStorage 缓存
  const local = readLocalCache(slug)
  if (local && isValidCount(local.count)) {
    if (local.count > bestCount) bestCount = local.count
    if (Date.now() - local.ts < CACHE_TTL_MS) hasFreshCache = true
  }

  // 先显示已知最大值
  dlCount.value = bestCount
  dlCountFetched.value = true

  // 有任意未过期缓存则不发请求
  if (hasFreshCache) return

  // 全过期，发请求
  try {
    const res = await fetch(`https://api.lonzov.top/count/?s=${encodeURIComponent(slug)}`)
    const data = await res.json()
    const count = typeof data === 'number' ? data : (data?.count ?? data?.value ?? null)
    if (isValidCount(count)) {
      const now = Date.now()
      dlCount.value = count
      // 存入内存 + localStorage
      memoryCache.set(slug, { count, ts: now })
      writeLocalCache(slug, count, now)
    }
  } catch { /* ignore */ }
}

/** 上报下载事件（点击模态框按钮时调用） */
function reportDownload() {
  const slug = pageName.value
  if (!slug || !shouldReport(slug)) return
  markReported(slug)
  // 静默上报
  fetch(`https://api.lonzov.top/count/?p=${encodeURIComponent(slug)}`, { mode: 'no-cors' }).catch(() => {})
  // 本地缓存 +1
  const now = Date.now()
  let current = dlCount.value
  if (isValidCount(current)) {
    current += 1
    dlCount.value = current
    memoryCache.set(slug, { count: current, ts: now })
    writeLocalCache(slug, current, now)
  }
}

// 配置加载完成后拉取下载次数
watch(config, (val) => {
  if (val) fetchDownloadCount()
}, { immediate: true })
</script>

<template>
  <div class="download-tool">
    <!-- 加载状态 -->
    <div v-if="loading" class="download-loading">
      <div class="download-loader"></div>
      <span>加载中...</span>
    </div>

    <!-- 错误/无配置 -->
    <div v-else-if="!config" class="download-empty">
      <p>下载页不存在</p>
    </div>

    <template v-else>
      <!-- 头部信息区 -->
      <div class="download-header">
        <div class="header-icon-wrap">
          <img :src="config.icon" :alt="config.name" class="header-icon" />
          <span class="header-version">{{ config.version }}</span>
        </div>
        <div class="header-info">
          <h1 class="header-name">{{ config.name }}</h1>
          <p class="header-tagline">{{ config.tagline }}</p>
        </div>
      </div>

      <!-- 统计栏：三等分卡片 -->
      <div class="stats-row">
        <div class="stat-item">
          <span class="stat-label">下载</span>
          <span class="stat-value">
            <NNumberAnimation
              :from="0"
              :to="dlCount"
              :active="dlCountFetched"
              :duration="1200"
            />
          </span>
          <span class="stat-unit">次</span>
        </div>
        <div
          class="stat-item"
          :class="{ 'stat-item--clickable': config.developerLink }"
          @click="handleDeveloperClick"
        >
          <span class="stat-label">开发者</span>
          <NIcon :component="PersonBoard24Filled" class="stat-dev-icon" />
          <span class="stat-dev-name">{{ config.developer }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">大小</span>
          <span class="stat-value">{{ config.fileSize }}</span>
          <span class="stat-unit">MB</span>
        </div>
      </div>

      <!-- 下载按钮：滑动动画 -->
      <button class="download-btn" @click="openDownloadModal">
        <div class="dl-btn-content">
          <div class="dl-btn-icon-wrap">
            <svg class="dl-btn-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.479 10.092c-.212-3.951-3.473-7.092-7.479-7.092-4.005 0-7.267 3.141-7.479 7.092-2.57.463-4.521 2.706-4.521 5.408 0 3.037 2.463 5.5 5.5 5.5h13c3.037 0 5.5-2.463 5.5-5.5 0-2.702-1.951-4.945-4.521-5.408zm-7.479 6.908l-4-4h3v-4h2v4h3l-4 4z"/>
            </svg>
          </div>
          <div class="dl-btn-text-wrap">
            <span class="dl-btn-text">下载</span>
          </div>
        </div>
      </button>

      <!-- 下载选项模态框 -->
      <NConfigProvider :theme="isDark ? darkTheme : null" :theme-overrides="isDark ? darkOverrides : lightOverrides" style="display: contents">
        <NModal
          v-model:show="showDownloadModal"
          preset="card"
          :style="{ maxWidth: '540px', width: 'calc(100% - 32px)', borderRadius: '16px' }"
          title="下载方式"
          :bordered="false"
          closable
          :auto-focus="false"
        >
          <div class="dl-modal-header-row">
            <span class="dl-modal-desc">选择一个适合你的下载方式</span>
            <NCascader
              v-if="hasMultiVersion"
              v-model:value="selectedVersionIndex"
              :options="cascaderOptions"
              placeholder="选择版本"
              :show-path="false"
              placement="bottom-end"
              size="medium"
              class="dl-version-cascader"
            />
          </div>

          <div class="dl-options">
            <div class="dl-option" @click="handleDirectParse">
              <NIcon :component="Link24Filled" :size="22" class="dl-option-icon" />
              <div class="dl-option-text">
                <span class="dl-option-title">直链解析（推荐）</span>
                <span class="dl-option-desc">一键下载，不可用时尝试其他通道</span>
              </div>
              <NIcon :component="ArrowUpRight20Filled" :size="18" class="dl-option-arrow" />
            </div>
            <div class="dl-option" @click="handleBackupParse">
              <NIcon :component="Link24Filled" :size="22" class="dl-option-icon" />
              <div class="dl-option-text">
                <span class="dl-option-title">备用解析</span>
                <span class="dl-option-desc">一键下载，不可用时尝试其他通道</span>
              </div>
              <NIcon :component="ArrowUpRight20Filled" :size="18" class="dl-option-arrow" />
            </div>
            <div class="dl-option" @click="handleOriginalLink">
              <NIcon :component="ArrowDownload24Filled" :size="22" class="dl-option-icon" />
              <div class="dl-option-text">
                <span class="dl-option-title">蓝奏云网盘</span>
                <span class="dl-option-desc">解析失效时使用，密码会自动复制({{ currentLanzou.password }})</span>
              </div>
              <NIcon :component="ArrowUpRight20Filled" :size="18" class="dl-option-arrow" />
            </div>
          </div>
        </NModal>
      </NConfigProvider>
      <p class="download-disclaimer">第三方内容，与本站无关，本站无法保证其100%的安全性和可靠性</p>
      <div class="disclaimer-divider"></div>

      <!-- 功能介绍 -->
      <div class="download-intro">
        <h2 class="intro-title">功能介绍</h2>
        <p class="intro-text" v-html="config.intro.replace(/\n/g, '<br>')"></p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.download-tool {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-top: 70px; /* PC端顶部间距 */
}

/* ===== 加载状态 ===== */
.download-loading,
.download-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 8em 0;
  color: color-mix(in srgb, var(--text-primary) 87%, transparent);
  font-size: 1rem;
}

.download-loader {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 4px solid;
  animation: dl-loader-spin 1s infinite;
}

[data-theme='dark'] .download-loader { border-color: #fff #fff0; }
[data-theme='light'] .download-loader { border-color: #000 #0000; }

@keyframes dl-loader-spin {
  to { transform: rotate(0.5turn); }
}

/* ===== 头部信息区 ===== */
.download-header {
  display: flex;
  align-items: center;
  gap: 18px;
}

.header-icon-wrap {
  position: relative;
  flex-shrink: 0;
}

.header-icon {
  width: 80px;
  height: 80px;
  border-radius: 22px;
  object-fit: cover;
  background: var(--bg-sub);
  display: block;
}

/* 版本号绝对定位在图片下方，不占布局空间，保证标题与图片中轴对齐 */
.header-version {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  top: calc(100% + 6px);
  font-size: 12px;
  color: var(--text-tertiary);
  font-weight: 500;
  white-space: nowrap;
}

.header-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.header-name {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.3;
}

.header-tagline {
  font-size: 14px;
  color: color-mix(in srgb, var(--text-primary) 87%, transparent);
  margin: 0;
  line-height: 1.5;
}

/* ===== 统计栏：三等分无填充无描边卡片 ===== */
.stats-row {
  display: flex;
  align-items: stretch;
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 0;
  padding: 10px 4px;
  position: relative;
}

/* 分割线：通过伪元素实现，仅第1、2张卡片的右侧显示，高度65%，使用项目标准边框色 */
.stat-item:not(:last-child)::after {
  content: '';
  position: absolute;
  right: 0;
  top: 17.5%; /* (100%-65%)/2 = 17.5% 居中 */
  height: 65%;
  width: 1px;
  background: var(--border-color);
}

.stat-item--clickable {
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.stat-item--clickable:hover {
  opacity: 0.7;
}

.stat-label {
  font-size: 14px;
  color: color-mix(in srgb, var(--text-primary) 50%, transparent);
  font-weight: 500;
}

.stat-value {
  font-size: 27px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.2;
}

/* 让 NumberAnimation 内部数字继承 stat-value 样式 */
.stat-value :deep(.n-number-animation) {
  font-size: inherit;
  font-weight: inherit;
  color: inherit;
  line-height: inherit;
}

.stat-unit {
  font-size: 14px;
  color: color-mix(in srgb, var(--text-primary) 50%, transparent);
}

/* 开发者卡片：属相排列 - 标签 / 图标 / 名字 */
.stat-dev-icon {
  font-size: 26px;
  line-height: 1.2;
  color: var(--text-primary);
}

.stat-dev-name {
  font-size: 13px;
  color: color-mix(in srgb, var(--text-primary) 50%, transparent);
}

/* ===== 下载按钮（滑动动画） ===== */
.download-btn {
  width: 100%;
  height: 45px;
  cursor: pointer;
  background-color: var(--text-primary);
  border: none;
  border-radius: 999px;
  overflow: hidden;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
}

.dl-btn-content {
  transform: translateY(-45px);
  transition: all 250ms ease-in-out;
}

.dl-btn-icon-wrap,
.dl-btn-text-wrap {
  height: 45px;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.dl-btn-text {
  font-size: 18px;
  font-weight: 500;
  color: var(--bg-color);
  opacity: 1;
  letter-spacing: 5px;
  transition: opacity ease-in-out 250ms;
}

.dl-btn-icon {
  height: 22px;
  width: 22px;
  color: var(--bg-color);
  opacity: 0;
  transition: opacity ease-in-out 250ms;
}

.download-btn:hover .dl-btn-content {
  transform: translateY(0);
}

.download-btn:hover .dl-btn-text {
  opacity: 0;
}

.download-btn:hover .dl-btn-icon {
  opacity: 1;
}

.download-btn:focus .dl-btn-icon {
  animation: heartbeat 1.5s ease-in-out infinite both;
}

@-webkit-keyframes heartbeat {
  from { transform: scale(1); transform-origin: center center; animation-timing-function: ease-out; }
  10%  { transform: scale(0.91); animation-timing-function: ease-in; }
  17%  { transform: scale(0.98); animation-timing-function: ease-out; }
  33%  { transform: scale(0.87); animation-timing-function: ease-in; }
  45%  { transform: scale(1); animation-timing-function: ease-out; }
}
@keyframes heartbeat {
  from { transform: scale(1); transform-origin: center center; animation-timing-function: ease-out; }
  10%  { transform: scale(0.91); animation-timing-function: ease-in; }
  17%  { transform: scale(0.98); animation-timing-function: ease-out; }
  33%  { transform: scale(0.87); animation-timing-function: ease-in; }
  45%  { transform: scale(1); animation-timing-function: ease-out; }
}

.download-disclaimer {
  text-align: center;
  font-size: 12px;
  color: var(--text-tertiary);
  margin: 0;
  line-height: 1.5;
}

/* 免责声明下方全宽分割线，使用项目标准边框色 */
.disclaimer-divider {
  width: 100%;
  height: 1px;
  background: var(--border-color);
}

/* ===== 功能介绍 ===== */
.download-intro {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ===== 下载选项模态框（仿 Cookie 模态框风格） ===== */

/* 弹窗标题加粗 + 强制100%不透明度 */
:deep(.n-card-header__main) {
  font-weight: 700 !important;
  color: rgba(0, 0, 0, 1) !important;
}

[data-theme='dark'] :deep(.n-card-header__main) {
  color: rgba(255, 255, 255, 1) !important;
}

/* ===== 版本选择行（文字 + 级联选择器同一行） ===== */
.dl-modal-header-row {
  display: flex;
  align-items: center;
  gap: 0.5em;
}

.dl-modal-desc {
  font-size: 14px;
  line-height: 1.6;
  color: rgba(0, 0, 0, 0.6);
  white-space: nowrap;
}

[data-theme='dark'] .dl-modal-desc {
  color: rgba(255, 255, 255, 0.6);
}

/* ===== 版本级联选择器 ===== */
.dl-version-cascader {
  flex: 1;
  max-width: 180px;
  min-width: 0;
}

.dl-options {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dl-option {
  padding: 16px 10px;
  border-radius: 12px;
  cursor: pointer;
  transition: background-color 0.15s ease, opacity 0.15s ease;
  display: flex;
  align-items: center;
  gap: 14px;
}

[data-theme='light'] .dl-option:hover { background: #F0F2F5; }
[data-theme='dark'] .dl-option:hover { background: rgba(255,255,255,0.06); }

.dl-option:active {
  opacity: 0.7;
}

.dl-option-icon {
  flex-shrink: 0;
  color: rgba(0, 0, 0, 0.4);
}

[data-theme='dark'] .dl-option-icon {
  color: rgba(255, 255, 255, 0.75);
}

.dl-option-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.dl-option-arrow {
  flex-shrink: 0;
  margin-left: auto;
  color: rgba(0, 0, 0, 0.7);
  transition: transform 0.25s ease, filter 0.25s ease;
}

[data-theme='dark'] .dl-option-arrow {
  color: rgba(255, 255, 255, 0.7);
}

.dl-option:hover .dl-option-arrow {
  transform: rotate(45deg);
  filter: drop-shadow(0 0 4px currentColor) drop-shadow(0 0 8px rgba(128, 128, 128, 0.3));
}

.dl-option-title {
  font-size: 15px;
  font-weight: 600;
  color: rgba(0, 0, 0, 1);
}

[data-theme='dark'] .dl-option-title {
  color: rgba(255, 255, 255, 1);
}

.dl-option-desc {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.6);
}

[data-theme='dark'] .dl-option-desc {
  color: rgba(255, 255, 255, 0.6);
}

.intro-title {
  font-size: 21px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.5px;
  margin: 0;
}

.intro-text {
  font-size: 15px;
  color: color-mix(in srgb, var(--text-primary) 87%, transparent);
  line-height: 1.75;
  margin: 0;
}

/* 超链接样式（仿 docs 页面） */
.intro-text :deep(a) {
  color: var(--text-primary);
  text-decoration: none;
  position: relative;
  padding-bottom: 2px;
  cursor: pointer;
  display: inline-block;
  vertical-align: baseline;
  background: none;
}

.intro-text :deep(a)::before {
  content: '';
  display: block;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 5px;
  height: 1px;
  background-image: repeating-linear-gradient(to right,
      color-mix(in srgb, var(--text-primary), transparent 30%) 0 4px,
      transparent 4px 8px);
  background-repeat: repeat-x;
  background-size: 8px 1px;
  opacity: 1;
  transition: opacity 0.3s;
  pointer-events: none;
  z-index: 2;
}

.intro-text :deep(a)::after {
  content: '';
  display: block;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 5px;
  height: 1px;
  background-color: var(--text-primary);
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
  z-index: 3;
}

.intro-text :deep(a:hover::before) {
  opacity: 0;
}

.intro-text :deep(a:hover::after) {
  opacity: 1;
}

/* ===== 响应式 ===== */
@media (max-width: 640px) {
  .download-tool {
    padding-top: 21px; /* 移动端21px间距 */
  }

  .download-header {
    gap: 14px;
  }

  .header-icon {
    width: 64px;
    height: 64px;
    border-radius: 18px;
  }

  .header-version {
    font-size: 11px;
  }

  .header-name {
    font-size: 20px;
  }

  .header-tagline {
    font-size: 13px;
  }

  .stat-value {
    font-size: 22px;
  }

  .stat-dev-icon {
    font-size: 22px;
  }

  .stat-dev-name {
    font-size: 13px;
  }

  .intro-title {
    font-size: 16px;
  }

  .intro-text {
    font-size: 14px;
  }
}
</style>

<!-- 非 scoped：级联选择器下拉菜单被 teleport 到 body，scoped 样式无法触及 -->
<style>
/* 级联选择器下拉面板描边 + 配色（与搜索引擎下拉菜单一致，直接选择器，不使用父选择器） */
.n-cascader-menu {
  --n-menu-color: var(--bg-card) !important;
  --n-option-color-hover: var(--bg-sub) !important;
  --n-option-text-color: var(--text-primary) !important;
  --n-menu-divider-color: var(--border-color) !important;
  --n-column-width: 126px !important;
  --n-menu-height: calc(var(--n-option-height) * 2) !important;
  border: 1px solid var(--border-color) !important;
}

[data-theme='light'] .n-cascader-menu,
html:not([data-theme='dark']) .n-cascader-menu {
  box-shadow:
    0 3px 6px -4px rgba(0, 0, 0, 0.16),
    0 6px 16px 0 rgba(0, 0, 0, 0.12),
    0 9px 28px 8px rgba(0, 0, 0, 0.08) !important;
}

[data-theme='dark'] .n-cascader-menu {
  box-shadow:
    0 3px 6px -4px rgba(0, 0, 0, 0.48),
    0 6px 12px 0 rgba(0, 0, 0, 0.36),
    0 9px 18px 8px rgba(0, 0, 0, 0.24) !important;
}
</style>

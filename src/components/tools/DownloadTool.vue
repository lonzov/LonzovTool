<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { NIcon, NNumberAnimation, useMessage } from 'naive-ui'
import { PersonBoard24Filled } from '@vicons/fluent'
import DownloadModal from './DownloadModal.vue'
import DownloadIntro from './DownloadIntro.vue'

const props = defineProps({
  tabPath: {
    type: String,
    default: '',
  },
})

const route = useRoute()
const message = useMessage()

const pageName = computed(() => {
  if (props.tabPath) {
    return props.tabPath.replace(/\/+$/, '').split('/').pop() || ''
  }
  const param = route.params.path
  if (param && typeof param === 'string') {
    return param.replace(/\/+$/, '')
  }
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

function openDownloadModal() {
  showDownloadModal.value = true
}

function handleDeveloperClick() {
  if (config.value?.developerLink) {
    window.open(config.value.developerLink, '_blank')
  }
}

// ===== 下载次数统计 =====
const CACHE_KEY = 'dl_count_cache'
const COOLDOWN_KEY = 'dl_count_log'
const CACHE_TTL_MS = 3 * 60 * 1000
const memoryCache = new Map()

const dlCount = ref(0)
const dlCountFetched = ref(false)

function isValidCount(val) {
  return typeof val === 'number' && Number.isInteger(val) && val >= 0 && val < 1e8
}

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

function writeLocalCache(slug, count, ts) {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    const map = raw ? JSON.parse(raw) : {}
    map[slug] = { count, ts }
    localStorage.setItem(CACHE_KEY, JSON.stringify(map))
  } catch { /* ignore */ }
}

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

function markReported(slug) {
  try {
    const raw = localStorage.getItem(COOLDOWN_KEY)
    const log = raw ? JSON.parse(raw) : {}
    log[slug] = { t: Date.now(), p: slug }
    localStorage.setItem(COOLDOWN_KEY, JSON.stringify(log))
  } catch { /* ignore */ }
}

async function fetchDownloadCount() {
  const slug = pageName.value
  if (!slug) return

  const hardcoded = config.value?.downloads ?? 0
  let bestCount = isValidCount(hardcoded) ? hardcoded : 0
  let hasFreshCache = false

  const mem = memoryCache.get(slug)
  if (mem && isValidCount(mem.count)) {
    if (mem.count > bestCount) bestCount = mem.count
    if (Date.now() - mem.ts < CACHE_TTL_MS) hasFreshCache = true
  }

  const local = readLocalCache(slug)
  if (local && isValidCount(local.count)) {
    if (local.count > bestCount) bestCount = local.count
    if (Date.now() - local.ts < CACHE_TTL_MS) hasFreshCache = true
  }

  dlCount.value = bestCount
  dlCountFetched.value = true

  if (hasFreshCache) return

  try {
    const res = await fetch(`https://api.lonzov.top/count/?s=${encodeURIComponent(slug)}`)
    const data = await res.json()
    const count = typeof data === 'number' ? data : (data?.count ?? data?.value ?? null)
    if (isValidCount(count)) {
      const now = Date.now()
      dlCount.value = count
      memoryCache.set(slug, { count, ts: now })
      writeLocalCache(slug, count, now)
    }
  } catch { /* ignore */ }
}

function reportDownload() {
  const slug = pageName.value
  if (!slug || !shouldReport(slug)) return
  markReported(slug)
  fetch(`https://api.lonzov.top/count/?p=${encodeURIComponent(slug)}`, { mode: 'no-cors' }).catch(() => {})
  const now = Date.now()
  let current = dlCount.value
  if (isValidCount(current)) {
    current += 1
    dlCount.value = current
    memoryCache.set(slug, { count: current, ts: now })
    writeLocalCache(slug, current, now)
  }
}

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

      <!-- 统计栏 -->
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

      <!-- 下载按钮 -->
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
      <DownloadModal v-model:show="showDownloadModal" :config="config" :page-name="pageName" @download="reportDownload" />

      <p class="download-disclaimer">第三方内容，与本站无关，本站无法保证其100%的安全性和可靠性</p>
      <div class="disclaimer-divider"></div>

      <!-- 功能介绍 -->
      <DownloadIntro :config="config" />
    </template>
  </div>
</template>

<style scoped>
.download-tool {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-top: 70px;
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
  corner-shape: squircle;
  object-fit: cover;
  background: var(--bg-sub);
  display: block;
}

@supports (corner-shape: squircle) {
  .header-icon {
    border-radius: 38px;
  }
}

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

/* ===== 统计栏 ===== */
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

.stat-item:not(:last-child)::after {
  content: '';
  position: absolute;
  right: 0;
  top: 17.5%;
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

.stat-dev-icon {
  font-size: 26px;
  line-height: 1.2;
  color: var(--text-primary);
}

.stat-dev-name {
  font-size: 13px;
  color: color-mix(in srgb, var(--text-primary) 50%, transparent);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===== 下载按钮 ===== */
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

.disclaimer-divider {
  width: 100%;
  height: 1px;
  background: var(--border-color);
}

/* ===== 响应式 ===== */
@media (max-width: 640px) {
  .download-tool {
    padding-top: 21px;
  }

  .download-header {
    gap: 14px;
  }

  .header-icon {
    width: 64px;
    height: 64px;
    border-radius: 18px;
    corner-shape: squircle;
  }

  @supports (corner-shape: squircle) {
    .header-icon {
      border-radius: 30px;
    }
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

}
</style>

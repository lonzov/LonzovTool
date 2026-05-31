<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { NIcon, NModal, NConfigProvider, NCascader, useMessage } from 'naive-ui'
import { darkTheme } from 'naive-ui'
import { Link24Filled, ArrowDownload24Filled, ArrowUpRight20Filled } from '@vicons/fluent'
import { useTheme } from '../../composables/useTheme'
import { useMouseGlow } from '../../composables/useMouseGlow'

const props = defineProps({
  show: Boolean,
  config: { type: Object, default: null },
  pageName: { type: String, default: '' },
})

const emit = defineEmits(['update:show', 'download'])

const message = useMessage()
const { isDark } = useTheme()

const showLocal = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val),
})

const darkOverrides = {
  common: { neutralModal: '#191919' },
  Card: { colorModal: '#191919' },
}

const lightOverrides = {
  common: { neutralModal: '#FFFFFF' },
  Card: { colorModal: '#FFFFFF' },
}

// 模糊遮罩
watch(() => props.show, (val) => {
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

// ===== 多版本选择 =====
const selectedVersionIndex = ref(0)

const lanzouList = computed(() => {
  const lz = props.config?.lanzou
  if (!lz) return []
  return Array.isArray(lz) ? lz : [lz]
})

const hasMultiVersion = computed(() => lanzouList.value.length > 1)

const currentLanzou = computed(() => {
  const list = lanzouList.value
  return list[selectedVersionIndex.value] || list[0] || null
})

const cascaderOptions = computed(() =>
  lanzouList.value.map((item, idx) => ({
    value: idx,
    label: item.version || `版本 ${idx + 1}`,
  }))
)

const cascaderMenuProps = computed(() => ({
  style: { '--n-menu-height': `calc(var(--n-option-height) * ${lanzouList.value.length})` }
}))

// 打开时重置为最新版本
watch(() => props.show, (val) => {
  if (val) selectedVersionIndex.value = 0
})

function buildApiUrl(apiType) {
  const lz = currentLanzou.value
  if (!lz) return ''
  if (apiType === 1) {
    return `https://lz.qaiu.top/parser?url=${encodeURIComponent(lz.url)}&pwd=${encodeURIComponent(lz.password)}`
  }
  return `https://api.lonzov.top/lanzou/index.php?url=${encodeURIComponent(lz.url)}&pwd=${encodeURIComponent(lz.password)}&type=down`
}

function handleDirectParse() {
  emit('download')
  window.open(buildApiUrl(1), '_blank')
  showLocal.value = false
}

function handleBackupParse() {
  emit('download')
  window.open(buildApiUrl(2), '_blank')
  showLocal.value = false
}

const _copyFailedSlugs = new Set()

async function handleOriginalLink() {
  emit('download')
  const lz = currentLanzou.value
  const pwd = lz?.password
  const slug = props.pageName
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
  showLocal.value = false
}

// ===== 鼠标跟随边框高光 =====
const { subscribe: subGlow, unsubscribe: unsubGlow } = useMouseGlow()

const GLOW_SELECTORS = '.dl-version-cascader .n-base-selection, .dl-option'

function handleGlow(mouseX, mouseY) {
  if (!props.show) return
  const els = document.querySelectorAll(GLOW_SELECTORS)
  els.forEach((el) => {
    const rect = el.getBoundingClientRect()
    const x = mouseX - rect.left
    const y = mouseY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2)
    const threshold = Math.sqrt(rect.width ** 2 + rect.height ** 2) * 1.8

    if (dist < threshold) {
      el.style.setProperty('--mouse-x', `${x}px`)
      el.style.setProperty('--mouse-y', `${y}px`)
      el.classList.add('glow-active')
    } else {
      el.classList.remove('glow-active')
    }
  })
}

onMounted(() => subGlow(handleGlow))
onUnmounted(() => unsubGlow(handleGlow))
</script>

<template>
  <NConfigProvider :theme="isDark ? darkTheme : null" :theme-overrides="isDark ? darkOverrides : lightOverrides" style="display: contents">
    <NModal
      v-model:show="showLocal"
      preset="card"
      :style="{ maxWidth: '540px', width: 'calc(100% - 32px)', borderRadius: '16px' }"
      title="下载方式"
      :bordered="false"
      closable
      :auto-focus="false"
    >
      <div class="dl-modal-header-row">
        <span class="dl-modal-desc">{{ hasMultiVersion ? '请选择下载方式和版本' : '选择一个适合你的下载方式' }}</span>
        <NCascader
          v-if="hasMultiVersion"
          v-model:value="selectedVersionIndex"
          :options="cascaderOptions"
          placeholder="选择版本"
          :show-path="false"
          :menu-props="cascaderMenuProps"
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
</template>

<style scoped>
/* 弹窗标题加粗 */
:deep(.n-card-header__main) {
  font-weight: 700 !important;
  color: rgba(0, 0, 0, 1) !important;
}

[data-theme='dark'] :deep(.n-card-header__main) {
  color: rgba(255, 255, 255, 1) !important;
}

/* ===== 版本选择行 ===== */
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
  max-width: 120px;
  min-width: 0;
}

.dl-version-cascader :deep(.n-base-selection),
.dl-version-cascader :deep(.n-base-selection-label) {
  border-radius: 100px !important;
}

.dl-version-cascader :deep(.n-base-selection) {
  position: relative;
  z-index: 0;
}

/* ===== 鼠标跟随边框高光 ===== */
.dl-version-cascader :deep(.n-base-selection)::before,
.dl-option::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  padding: 1px;
  background: radial-gradient(
    250px circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
    rgba(255, 255, 255, 1)     0%,
    rgba(255, 255, 255, 0.55) 5%,
    rgba(255, 255, 255, 0.31) 10%,
    rgba(255, 255, 255, 0.18) 15%,
    rgba(255, 255, 255, 0.12) 20%,
    rgba(255, 255, 255, 0.07) 30%,
    rgba(255, 255, 255, 0.04) 40%,
    rgba(255, 255, 255, 0.02) 55%,
    rgba(255, 255, 255, 0.01) 70%,
    transparent                 100%
  );
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  -webkit-mask-composite: destination-out;
  opacity: 0;
  pointer-events: none;
  z-index: 10;
  transition: opacity 0.2s ease;
}

.dl-version-cascader :deep(.n-base-selection.glow-active)::before,
.dl-option.glow-active::before {
  opacity: 1;
}

[data-theme='light'] .dl-version-cascader :deep(.n-base-selection)::before,
[data-theme='light'] .dl-option::before {
  background: radial-gradient(
    300px circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
    rgba(180, 180, 180, 1)     0%,
    rgba(180, 180, 180, 0.55)  5%,
    rgba(180, 180, 180, 0.31) 10%,
    rgba(180, 180, 180, 0.18) 15%,
    rgba(180, 180, 180, 0.12) 20%,
    rgba(180, 180, 180, 0.07) 30%,
    rgba(180, 180, 180, 0.04) 40%,
    rgba(180, 180, 180, 0.02) 55%,
    rgba(180, 180, 180, 0.01) 70%,
    transparent                100%
  );
}

/* ===== 下载选项 ===== */
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
  position: relative;
  z-index: 0;
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
</style>

<style>
/* 级联选择器下拉面板 */
.n-cascader-menu {
  --n-menu-color: var(--bg-card) !important;
  --n-option-color-hover: var(--bg-sub) !important;
  --n-option-text-color: var(--text-primary) !important;
  --n-menu-divider-color: var(--border-color) !important;
  --n-column-width: 126px !important;
  --n-menu-border-radius: 8px !important;
  border: 1px solid var(--border-color) !important;
}

/* 级联选择器 focus 状态不变 */
.dl-version-cascader .n-base-selection {
  --n-border: 1px solid var(--border-color) !important;
  --n-border-hover: 1px solid var(--border-color) !important;
  --n-border-focus: 1px solid var(--border-color) !important;
  --n-border-active: 1px solid var(--border-color) !important;
  --n-box-shadow-focus: none !important;
  --n-box-shadow-active: none !important;
}

[data-theme='dark'] .dl-version-cascader .n-base-selection {
  --n-color: #191919 !important;
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

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { NIcon, useMessage, NSwitch } from 'naive-ui'
import { CurrencyDollarEuro20Regular } from '@vicons/fluent'
import { useMouseGlow, applyGlow } from '../../composables/useMouseGlow.js'
import { useToolStorage } from '../../composables/useToolStorage.js'
import glyphMap from '../../data/glyph-map.json'

defineProps({
  tabPath: {
    type: String,
    default: '',
  },
})

const message = useMessage()
const { subscribe: subGlow, unsubscribe: unsubGlow } = useMouseGlow()

// ===== 雪碧图配置 =====
const SPRITE_PATH = '/sprites/glyph-pack.webp'
const DISPLAY_SIZE = 48    // 卡片中显示尺寸

// ===== 图标数据（从构建时生成的映射数组构建） =====
const NULL_CHAR = String.fromCharCode(0)

const iconsData = glyphMap.map((hex, index) => {
  if (hex === 'a0a') {
    return {
      index,
      codePointHex: 'a0a',
      character: 'a' + NULL_CHAR + 'a',
      bgPositionX: -index * DISPLAY_SIZE,
    }
  }
  const cp = parseInt(hex, 16)
  return {
    index,
    codePointHex: hex,
    character: String.fromCodePoint(cp),
    bgPositionX: -index * DISPLAY_SIZE,
  }
})

// ===== 字符到图标映射（仅单字符条目，排除 a0a） =====
const charToIconMap = new Map()
iconsData.forEach((icon) => {
  if (icon.codePointHex !== 'a0a') {
    charToIconMap.set(icon.character, icon)
  }
})

function getIconStyle(icon) {
  return {
    backgroundImage: `url(${SPRITE_PATH})`,
    backgroundPositionX: `${icon.bgPositionX}px`,
    backgroundSize: `auto ${DISPLAY_SIZE}px`,
    imageRendering: 'pixelated',
  }
}

// ===== 验证输入 =====
const verifyInput = ref('')

const previewSegments = computed(() => {
  const chars = [...verifyInput.value]
  const segments = []
  let textBuf = ''
  for (const char of chars) {
    const icon = charToIconMap.get(char)
    if (icon) {
      if (textBuf) { segments.push({ type: 'text', text: textBuf }); textBuf = '' }
      segments.push({ type: 'icon', icon })
    } else if (char.charCodeAt(0) === 0) {
      if (textBuf) { segments.push({ type: 'text', text: textBuf }); textBuf = '' }
      segments.push({ type: 'dot' })
    } else {
      textBuf += char
    }
  }
  if (textBuf) segments.push({ type: 'text', text: textBuf })
  return segments
})

function getPreviewSpriteStyle(icon) {
  return {
    backgroundImage: `url(${SPRITE_PATH})`,
    backgroundPositionX: `${icon.bgPositionX}px`,
    backgroundSize: `auto ${DISPLAY_SIZE}px`,
    imageRendering: 'pixelated',
    width: `${DISPLAY_SIZE}px`,
    height: `${DISPLAY_SIZE}px`,
  }
}

function getSegmentMargin(seg, index) {
  const segments = previewSegments.value
  const leftType = index > 0 ? segments[index - 1].type : null
  if (!leftType) return { marginLeft: '0px' }
  const ml = (seg.type === 'icon' && leftType === 'icon') ? -20 : -8
  return { marginLeft: ml + 'px' }
}

// ===== 复制模式 =====
const copyModeCodepoint = ref(false)

useToolStorage('lonzovtool-fuhao', { copyModeCodepoint })

function toggleCopyMode(value) {
  copyModeCodepoint.value = value
}

// 开关轨道颜色：加深灰色面（unchecked），checked 面保持默认（亮色黑/深色黑）
function switchRailStyle({ focused, checked }) {
  if (checked) {
    const style = { background: '#333' }
    if (focused) style.boxShadow = '0 0 0 2px #33340'
    return style
  }
  const style = { background: '#a0a0a0' }
  if (focused) style.boxShadow = '0 0 0 2px #a0a0a040'
  return style
}

// ===== 复制反馈 =====
async function handleCardClick(icon) {

  let copyText
  if (!copyModeCodepoint.value) {
    copyText = icon.character
  } else {
    if (icon.codePointHex === 'a0a') {
      copyText = '\\u0061\\u0000\\u0061'
    } else {
      const num = parseInt(icon.codePointHex, 16)
      if (isNaN(num)) return
      copyText = `\\u${num.toString(16).padStart(4, '0').toUpperCase()}`
    }
  }

  if (!copyText) return

  try {
    await navigator.clipboard.writeText(copyText)
    message.success('已复制', { duration: 1000 })
  } catch {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = copyText
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

// ===== 鼠标高光跟随 =====
const glowCards = ref(new Map())

function handleGlow(mouseX, mouseY) {
  glowCards.value.forEach((el) => {
    if (el) applyGlow(el, mouseX, mouseY)
  })
}

function registerCardRef(el, index) {
  if (el) glowCards.value.set(index, el)
  else glowCards.value.delete(index)
}

onMounted(() => {
  subGlow(handleGlow)
})

onBeforeUnmount(() => {
  unsubGlow(handleGlow)
})
</script>

<template>
  <div class="fuhao-tool">
    <!-- 页面主标题与简介 -->
    <div class="page-header">
      <div class="page-title-row">
        <NIcon :component="CurrencyDollarEuro20Regular" class="page-title-icon" />
        <h1 class="page-title">特殊符号</h1>
      </div>
      <p class="page-desc">Minecraft 基岩版特殊符号合集，点击即可复制（来自最新国际基岩版，在低版本可能部分不可用）</p>
    </div>

    <!-- 验证输入卡片 -->
    <div class="verify-card">
      <div class="verify-col verify-col-left">
        <label class="verify-label">输入验证</label>
        <input
          v-model="verifyInput"
          type="text"
          class="verify-input"
          placeholder="粘贴或输入字符以验证..."
          spellcheck="false"
          autocomplete="off"
        />
      </div>
      <div class="verify-divider"></div>
      <div class="verify-col verify-col-right">
        <label class="verify-label">预览结果</label>
        <div class="verify-preview">
          <template v-for="(seg, i) in previewSegments" :key="i">
            <div v-if="seg.type === 'icon'" class="preview-sprite-wrap" :style="getSegmentMargin(seg, i)">
              <div
                class="preview-sprite"
                :style="getPreviewSpriteStyle(seg.icon)"
              ></div>
            </div>
            <span v-else-if="seg.type === 'dot'" class="preview-dot" :style="getSegmentMargin(seg, i)"></span>
            <span v-else class="preview-text" :style="getSegmentMargin(seg, i)">{{ seg.text }}</span>
          </template>
          <span v-if="!previewSegments.length" class="preview-placeholder">预览</span>
        </div>
      </div>
    </div>

    <!-- 模式切换栏 -->
    <div class="mode-bar">
      <span class="mode-label">复制为:</span>
      <NSwitch
        :value="copyModeCodepoint"
        @update:value="toggleCopyMode"
        :rail-style="switchRailStyle"
        size="small"
        :checked-value="true"
        :unchecked-value="false"
      >
        <template #checked>码点</template>
        <template #unchecked>字符</template>
      </NSwitch>
      <span class="mode-hint">大部分符号在网易版是敏感词 ⚠️</span>
    </div>

    <!-- 符号卡片网格 -->
    <div class="cards-grid">
      <div
        v-for="(icon, idx) in iconsData"
        :key="icon.codePointHex"
        :ref="(el) => registerCardRef(el, idx)"
        class="symbol-card tool-card glow-border"
        @click="handleCardClick(icon, $event)"
      >
        <div
          class="icon-sprite"
          :style="getIconStyle(icon)"
        ></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fuhao-tool {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ===== 页面标题区域 ===== */
.page-header {
  margin-bottom: 0;
}

.page-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.page-title-icon {
  font-size: 26px;
  color: var(--text-primary);
  flex-shrink: 0;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.3;
  margin: 0;
}

.page-desc {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-top: 6px;
}

/* ===== 模式切换栏 ===== */
.mode-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: #FFFFFF;
  border-radius: 12px;
  border: 1px solid #E0E0E0;
  transition: background-color 0.4s ease, border-color 0.4s ease;
}

[data-theme="dark"] .mode-bar {
  background: #191919;
  border-color: #2B2B2B;
}

.mode-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.mode-hint {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-left: auto;
}

/* ===== 验证输入卡片（照抄 ArtTextTool 风格） ===== */
.verify-card {
  display: flex;
  align-items: stretch;
  background: #FFFFFF;
  border-radius: 12px;
  border: 1px solid #E0E0E0;
  padding: 16px;
  gap: 0;
  transition: background-color 0.4s ease, border-color 0.4s ease;
}

[data-theme="dark"] .verify-card {
  background: #191919;
  border-color: #2B2B2B;
}

.verify-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.verify-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.verify-input {
  width: 100%;
  flex: 1;
  border: 1px solid var(--border-color);
  border-radius: 5px;
  padding: 8px 12px;
  font-size: 0.9rem;
  background-color: transparent;
  color: var(--text-primary);
  font-family: inherit;
  line-height: 1.4;
  transition: border-color 0.4s ease, box-shadow 0.4s ease;
  caret-color: var(--text-primary);
}

.verify-input:focus {
  outline: none;
  border-color: var(--text-secondary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 20%, transparent);
}

.verify-input::placeholder {
  color: var(--text-tertiary);
}

.verify-divider {
  width: 1px;
  align-self: stretch;
  background: #E0E0E0;
  margin: 0 16px;
  flex-shrink: 0;
  transition: background-color 0.4s ease;
}

[data-theme="dark"] .verify-divider {
  background: #2B2B2B;
}

.verify-preview {
  display: flex;
  align-items: center;
  gap: 0;
  flex: 1;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 0.9rem;
  line-height: 1.4;
  color: var(--text-primary);
  overflow-x: auto;
  white-space: nowrap;
  transition: border-color 0.4s ease;
  min-height: 36px;
}

.verify-preview::-webkit-scrollbar {
  height: 3px;
}

.verify-preview::-webkit-scrollbar-thumb {
  background: var(--text-tertiary);
  border-radius: 3px;
}

.preview-placeholder {
  color: var(--text-tertiary);
}

.preview-text {
  display: inline;
}

.preview-sprite-wrap {
  width: 48px;
  height: 16px;
  flex-shrink: 0;
  position: relative;
  overflow: visible;
}

.preview-sprite {
  position: absolute;
  top: 50%;
  left: 0;
  transform: translateY(-50%);
  background-repeat: no-repeat;
}

.preview-dot {
  display: inline-block;
  width: 0.2em;
  height: 0.2em;
  background: #e74c3c;
  border-radius: 50%;
  vertical-align: middle;
  flex-shrink: 0;
}

/* ===== 卡片网格 ===== */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 12px;
}

/* ===== 符号卡片（复用首页 ToolCard 样式 + 高光效果） ===== */
.symbol-card {
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  min-height: auto;
  transform: translateY(-1px);
}

.symbol-card:hover {
  background: var(--bg-sub) !important;
  border-color: var(--border-color) !important;
  transform: translateY(-4px) !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15) !important;
}

/* ToolCard 基础样式 */
.tool-card {
  background: #FFFFFF;
  border-radius: 12px;
  corner-shape: squircle;
  border: 1px solid #E0E0E0;
  transition: all 0.3s ease;
  box-shadow: 0 0 0 transparent;
  position: relative;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

@supports (corner-shape: squircle) {
  .tool-card {
    border-radius: 25px;
  }
  .tool-card.glow-border::before {
    corner-shape: squircle;
  }
}

[data-theme="dark"] .tool-card {
  background: #191919;
  border-color: #2B2B2B;
}

/* ===== 精灵图图标 ===== */
.icon-sprite {
  width: 48px;
  height: 48px;
  background-repeat: no-repeat;
  transition: transform 0.2s ease;
}

.symbol-card:hover .icon-sprite {
  transform: scale(1.2);
}

/* ===== 响应式 ===== */
@media (max-width: 640px) {
  .verify-card {
    flex-direction: column;
    gap: 12px;
    padding: 12px;
  }

  .verify-divider {
    width: 100%;
    height: 1px;
    margin: 0;
    align-self: auto;
  }
}

@media (max-width: 470px) {
  .mode-bar {
    flex-wrap: wrap;
  }

  .mode-hint {
    width: 100%;
    margin-left: 0;
    text-align: left;
  }
}

@media (max-width: 1200px) {
  .cards-grid {
    grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
  }
}

@media (max-width: 768px) {
  .cards-grid {
    grid-template-columns: repeat(auto-fill, minmax(68px, 1fr));
    gap: 10px;
  }
}

@media (max-width: 480px) {
  .cards-grid {
    grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
    gap: 8px;
  }
}
</style>

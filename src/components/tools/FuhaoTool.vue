<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { NIcon, useMessage, NSwitch } from 'naive-ui'
import { CurrencyDollarEuro20Regular } from '@vicons/fluent'
import { useMouseGlow } from '../../composables/useMouseGlow.js'
import { useToolStorage } from '../../composables/useToolStorage.js'

defineProps({
  tabPath: {
    type: String,
    default: '',
  },
})

const message = useMessage()
const { subscribe: subGlow, unsubscribe: unsubGlow } = useMouseGlow()

// ===== 雪碧图配置 =====
const SPRITE_CONFIG = {
  spritePath: '/sprites/mc-unicode.png',
  iconWidth: 48,
  iconHeight: 48,
  iconsPerRow: 5,
}

// ===== 图标数据 (来自 v2/c/fuhao/iconList.js) =====
const rawIcons = [
  { codePointHex: 'E000' }, { codePointHex: 'E001' }, { codePointHex: 'E002' }, { codePointHex: 'E003' }, { codePointHex: 'E004' },
  { codePointHex: 'E005' }, { codePointHex: 'E006' }, { codePointHex: 'E007' }, { codePointHex: 'E008' }, { codePointHex: 'E009' },
  { codePointHex: 'E00A' }, { codePointHex: 'E00B' }, { codePointHex: 'E00C' }, { codePointHex: 'E00D' }, { codePointHex: 'E00E' },
  { codePointHex: 'E00F' }, { codePointHex: 'E010' }, { codePointHex: 'E011' }, { codePointHex: 'E012' }, { codePointHex: 'E013' },
  { codePointHex: 'E014' }, { codePointHex: 'E015' }, { codePointHex: 'E016' }, { codePointHex: 'E017' }, { codePointHex: 'E018' },
  { codePointHex: 'E019' }, { codePointHex: 'E01A' }, { codePointHex: 'E01B' }, { codePointHex: 'E01C' }, { codePointHex: 'E01D' },
  { codePointHex: 'E020' }, { codePointHex: 'E021' }, { codePointHex: 'E022' }, { codePointHex: 'E023' }, { codePointHex: 'E024' },
  { codePointHex: 'E025' }, { codePointHex: 'E026' }, { codePointHex: 'E027' }, { codePointHex: 'E028' }, { codePointHex: 'E029' },
  { codePointHex: 'E02A' }, { codePointHex: 'E02B' }, { codePointHex: 'E02C' }, { codePointHex: 'E02D' }, { codePointHex: 'E02E' },
  { codePointHex: 'E02F' }, { codePointHex: 'E040' }, { codePointHex: 'E041' }, { codePointHex: 'E042' }, { codePointHex: 'E043' },
  { codePointHex: 'E044' }, { codePointHex: 'E045' }, { codePointHex: 'E046' }, { codePointHex: 'E047' }, { codePointHex: 'E048' },
  { codePointHex: 'E049' }, { codePointHex: 'E04A' }, { codePointHex: 'E04B' }, { codePointHex: 'E04C' }, { codePointHex: 'E04D' },
  { codePointHex: 'E04E' }, { codePointHex: 'E04F' }, { codePointHex: 'E060' }, { codePointHex: 'E061' }, { codePointHex: 'E062' },
  { codePointHex: 'E063' }, { codePointHex: 'E065' }, { codePointHex: 'E066' }, { codePointHex: 'E067' }, { codePointHex: 'E068' },
  { codePointHex: 'E069' }, { codePointHex: 'E06A' }, { codePointHex: 'E06B' }, { codePointHex: 'E06C' }, { codePointHex: 'E06D' },
  { codePointHex: 'E06E' }, { codePointHex: 'E06F' }, { codePointHex: 'E070' }, { codePointHex: 'E071' }, { codePointHex: 'E072' },
  { codePointHex: 'E073' }, { codePointHex: 'E075' }, { codePointHex: 'E076' }, { codePointHex: 'E080' }, { codePointHex: 'E081' },
  { codePointHex: 'E082' }, { codePointHex: 'E083' }, { codePointHex: 'E084' }, { codePointHex: 'E085' }, { codePointHex: 'E086' },
  { codePointHex: 'E087' }, { codePointHex: 'E088' }, { codePointHex: 'E0A0' }, { codePointHex: 'E0A1' }, { codePointHex: 'E0C0' },
  { codePointHex: 'E0C1' }, { codePointHex: 'E0C2' }, { codePointHex: 'E0C3' }, { codePointHex: 'E0C4' }, { codePointHex: 'E0C5' },
  { codePointHex: 'E0C6' }, { codePointHex: 'E0C7' }, { codePointHex: 'E0C8' }, { codePointHex: 'E0C9' }, { codePointHex: 'E0CA' },
  { codePointHex: 'E0CB' }, { codePointHex: 'E0CC' }, { codePointHex: 'E0CD' }, { codePointHex: 'E0E0' }, { codePointHex: 'E0E1' },
  { codePointHex: 'E0E2' }, { codePointHex: 'E0E3' }, { codePointHex: 'E0E4' }, { codePointHex: 'E0E5' }, { codePointHex: 'E0E6' },
  { codePointHex: 'E0E7' }, { codePointHex: 'E0E8' }, { codePointHex: 'E0E9' }, { codePointHex: 'E0EA' }, { codePointHex: 'E100' },
  { codePointHex: 'E101' }, { codePointHex: 'E102' }, { codePointHex: 'E103' }, { codePointHex: 'E104' }, { codePointHex: 'E105' },
  { codePointHex: 'E106' }, { codePointHex: 'E107' }, { codePointHex: 'E108' }, { codePointHex: 'E109' }, { codePointHex: 'E10A' },
  { codePointHex: 'E10B' }, { codePointHex: 'E10C' }, { codePointHex: 'E10D' }, { codePointHex: 'a0a' },
]

// 处理图标数据：计算背景位置和字符
const iconsData = rawIcons.map((icon, index) => {
  const row = Math.floor(index / SPRITE_CONFIG.iconsPerRow)
  const col = index % SPRITE_CONFIG.iconsPerRow

  if (icon.codePointHex === 'a0a') {
    return {
      index,
      codePointHex: 'a0a',
      character: 'a\u0000a',
      bgPositionX: -col * SPRITE_CONFIG.iconWidth,
      bgPositionY: -row * SPRITE_CONFIG.iconHeight,
    }
  }
  const cp = parseInt(icon.codePointHex, 16)
  return {
    index,
    codePointHex: icon.codePointHex,
    character: String.fromCodePoint(cp),
    bgPositionX: -col * SPRITE_CONFIG.iconWidth,
    bgPositionY: -row * SPRITE_CONFIG.iconHeight,
  }
})

const spriteWidth = SPRITE_CONFIG.iconsPerRow * SPRITE_CONFIG.iconWidth
const spriteHeight = Math.ceil(iconsData.length / SPRITE_CONFIG.iconsPerRow) * SPRITE_CONFIG.iconHeight

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
    if (!el) return
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
      <p class="page-desc">Minecraft 基岩版特殊符号合集，点击即可复制</p>
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
        class="symbol-card tool-card"
        @click="handleCardClick(icon, $event)"
      >
        <div
          class="icon-sprite"
          :style="{
            backgroundImage: `url(${SPRITE_CONFIG.spritePath})`,
            backgroundPosition: `${icon.bgPositionX}px ${icon.bgPositionY}px`,
            backgroundSize: `${spriteWidth}px ${spriteHeight}px`,
          }"
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
  border: 1px solid #E0E0E0;
  transition: all 0.3s ease;
  box-shadow: 0 0 0 transparent;
  position: relative;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

[data-theme="dark"] .tool-card {
  background: #191919;
  border-color: #2B2B2B;
}

/* 高光跟随边框效果 */
.tool-card::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  padding: 1px;
  background: radial-gradient(
    80px circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
    rgba(255, 255, 255, 0.65),
    transparent 60%
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

.tool-card.glow-active::before {
  opacity: 1;
}

[data-theme="light"] .tool-card::before {
  background: radial-gradient(
    80px circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
    rgb(255, 255, 255),
    transparent 60%
  );
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

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { NIcon, useMessage, NSwitch } from 'naive-ui'
import { CurrencyDollarEuro20Regular } from '@vicons/fluent'
import { useMouseGlow, applyGlow } from '../../composables/useMouseGlow.js'
import { useToolStorage } from '../../composables/useToolStorage.js'
import { renderMcText } from '../../utils/mcTextRender.js'
import data from '../../data/glyph-map.json'
import '../../vendor/mcfc/mcfc.css'

const { sprite, glyphs } = data

defineProps({
  tabPath: {
    type: String,
    default: '',
  },
})

const message = useMessage()
const { subscribe: subGlow, unsubscribe: unsubGlow } = useMouseGlow()

// ===== 雪碧图配置 =====
const SPRITE_PATH = `/sprites/${sprite}`
const DISPLAY_SIZE = 48    // 卡片中显示尺寸

// ===== 图标数据（从构建时生成的映射数组构建） =====
const NULL_CHAR = String.fromCharCode(0)

const iconsData = glyphs.map((hex, index) => {
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

/** a\0a 里的 NUL 是控制字符，字体渲染不出来，切成两段并在中间标一个红点 */
const NULL_MARKER = '<span class="preview-dot"></span>'

const previewHtml = computed(() => {
  const raw = String(verifyInput.value ?? '')
  if (!raw) return ''
  // map 会把索引当第二个参数传进去，这里显式包一层，免得落到 renderMcText 的 options 上
  return raw.split(NULL_CHAR).map(text => renderMcText(text)).join(NULL_MARKER)
})

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
    if (focused) style.boxShadow = '0 0 0 2px #33333340'
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
          <div v-if="previewHtml" class="preview-content mcfc" v-html="previewHtml" />
          <span v-else class="preview-placeholder">预览</span>
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
  color: var(--foreground);
  flex-shrink: 0;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--foreground);
  line-height: 1.3;
  margin: 0;
}

.page-desc {
  font-size: 14px;
  color: var(--muted-foreground);
  line-height: 1.5;
  margin-top: 6px;
}

/* ===== 模式切换栏 ===== */
.mode-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  transition: background-color 0.4s ease, border-color 0.4s ease;
}

.mode-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--muted-foreground);
}

.mode-hint {
  font-size: 12px;
  color: var(--subtle-foreground);
  margin-left: auto;
}

/* ===== 验证输入卡片（照抄 ArtTextTool 风格） ===== */
.verify-card {
  display: flex;
  align-items: stretch;
  background: var(--card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  padding: 16px;
  gap: 0;
  transition: background-color 0.4s ease, border-color 0.4s ease;
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
  color: var(--muted-foreground);
}

.verify-input {
  width: 100%;
  flex: 1;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  font-size: 0.9rem;
  background-color: transparent;
  color: var(--foreground);
  font-family: inherit;
  line-height: 1.4;
  transition: border-color 0.4s ease, box-shadow 0.4s ease;
  caret-color: var(--foreground);
}

.verify-input:focus {
  outline: none;
  border-color: var(--muted-foreground);
  box-shadow: 0 0 0 2px var(--ring);
}

.verify-input::placeholder {
  color: var(--subtle-foreground);
}

.verify-divider {
  width: 1px;
  align-self: stretch;
  background: var(--border);
  margin: 0 16px;
  flex-shrink: 0;
  transition: background-color 0.4s ease;
}

/* stylelint-disable declaration-property-value-disallowed-list --
   预览舞台固定深色：它模拟的是游戏内聊天框，内容由 renderMcText 按 Minecraft 原色渲染、
   假定深底（默认白字 + 半透明黑描边）。改成 --card 会让浅色主题下白字糊在浅色底上。 */
.verify-preview {
  display: flex;
  align-items: center;
  flex: 1;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  font-size: 0.9rem;
  overflow-x: auto;
  white-space: nowrap;
  transition: background-color 0.4s ease, border-color 0.4s ease;
  min-height: 36px;
}

[data-theme="dark"] .verify-preview {
  background: #111;
  border-color: #2b2b2b;
}

.preview-placeholder {
  color: #888;
}

/* stylelint-enable declaration-property-value-disallowed-list */

.verify-preview::-webkit-scrollbar {
  height: 3px;
}

.verify-preview::-webkit-scrollbar-thumb {
  background: var(--scrollbar);
  border-radius: var(--radius-xs);
}

.preview-content {
  flex-shrink: 0;
  /* 行高必须写死，与 T显 预览同一套标定值：符号字形高近 2em，靠字体度量自动算行高
     会把带符号的行撑到 2.9em。0.8px 字距也是同一处标定来的。 */
  line-height: 1.19;
  letter-spacing: 0.8px;
}

.preview-dot {
  display: inline-block;
  width: 0.2em;
  height: 0.2em;
  /* 表示 U+0000 的标记点 */
  background: var(--destructive);
  border-radius: 50%;
  corner-shape: round;
  vertical-align: middle;
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
  background: var(--muted);
  border-color: var(--border);
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

/* ToolCard 基础样式 */
.tool-card {
  background: var(--card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  transition: all 0.3s ease;
  box-shadow: 0 0 0 transparent;
  position: relative;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
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

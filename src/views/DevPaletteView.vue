<script setup>
import { computed, ref } from 'vue'
import {
  NConfigProvider,
  NButton,
  NInput,
  NSelect,
  NSwitch,
  NCheckbox,
  NCascader,
  NTooltip,
  NDropdown,
  NIcon,
  darkTheme,
  lightTheme,
} from 'naive-ui'
import { Copy24Regular } from '@vicons/fluent'
import { neutral, highlight, destructive } from '../theme/palette'
import { lightTokens, darkTokens, staticTokens } from '../theme/tokens'
import { lightThemeOverrides, darkThemeOverrides } from '../theme/naive-theme'

/* ===== 颜色工具：解析 / 合成 / WCAG 对比度 ===== */

function parseColor(str) {
  if (str.startsWith('#')) {
    let h = str.slice(1)
    if (h.length === 3) h = h.replace(/./g, (c) => c + c)
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: 1,
    }
  }
  const m = str.match(/rgba?\(([^)]+)\)/)
  if (!m) return null
  const p = m[1].split(',').map((s) => parseFloat(s.trim()))
  return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }
}

// 半透明前景与不透明背景合成后的实际颜色
function flatten(fg, bg) {
  return {
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  }
}

function luminance(c) {
  const f = (v) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
}

function contrastRatio(fgStr, bgStr) {
  const fg = parseColor(fgStr)
  const bg = parseColor(bgStr)
  if (!fg || !bg) return null
  const f = flatten(fg, bg)
  const b = bg.a < 1 ? flatten(bg, { r: 255, g: 255, b: 255, a: 1 }) : bg
  const l1 = luminance(f)
  const l2 = luminance(b)
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

function grade(ratio) {
  if (ratio === null) return { label: '—', level: 'none' }
  if (ratio >= 7) return { label: `${ratio.toFixed(2)} AAA`, level: 'aaa' }
  if (ratio >= 4.5) return { label: `${ratio.toFixed(2)} AA`, level: 'aa' }
  if (ratio >= 3) return { label: `${ratio.toFixed(2)} AA-large`, level: 'large' }
  return { label: `${ratio.toFixed(2)} 不达标`, level: 'fail' }
}

/* ===== 结构 ===== */

const TOKEN_GROUPS = [
  { title: '底色', keys: ['background', 'card', 'popover', 'muted', 'footer', 'input-background'] },
  {
    title: '文字（由 foreground 按透明度派生）',
    keys: ['foreground', 'muted-foreground', 'subtle-foreground', 'disabled-foreground'],
  },
  { title: '边框与分割线', keys: ['border', 'border-strong', 'input'] },
  { title: '叠层', keys: ['accent', 'ripple', 'ring'] },
  { title: '滚动条', keys: ['scrollbar', 'scrollbar-hover'] },
  { title: '反色块', keys: ['primary', 'primary-foreground'] },
  {
    title: '强调色',
    keys: ['highlight', 'highlight-foreground', 'destructive', 'destructive-foreground'],
  },
  { title: '阴影', keys: ['shadow-sm', 'shadow-md', 'shadow-popover', 'shadow-drawer'] },
]

// 前景 / 背景组合，用于对比度矩阵
const PAIRS = [
  ['foreground', 'background'],
  ['foreground', 'card'],
  ['foreground', 'muted'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'card'],
  ['muted-foreground', 'muted'],
  ['subtle-foreground', 'background'],
  ['subtle-foreground', 'card'],
  ['primary-foreground', 'primary'],
  ['highlight-foreground', 'highlight'],
  ['destructive-foreground', 'destructive'],
]

const RADIUS_KEYS = ['radius-xs', 'radius-sm', 'radius-md', 'radius-lg', 'radius-xl', 'radius-full']

const Z_KEYS = ['z-mobile-drawer', 'z-mobile-menu', 'z-blur-mask']

const selectOptions = [
  { label: '草原', value: 'grass' },
  { label: '沙漠', value: 'desert' },
  { label: '海洋', value: 'ocean' },
]

const cascaderOptions = [
  {
    label: '方块',
    value: 'block',
    children: [
      { label: '石头', value: 'stone' },
      { label: '泥土', value: 'dirt' },
    ],
  },
]

const dropdownOptions = [
  { label: '复制', key: 'copy' },
  { label: '重命名', key: 'rename' },
  { label: '删除', key: 'delete' },
]

const demoSelect = ref('grass')
const demoCascader = ref(null)
const demoInput = ref('')
const demoSwitch = ref(true)
const demoCheckbox = ref(true)

const copied = ref('')
let copyTimer = null
async function copyValue(key, value) {
  try {
    await navigator.clipboard.writeText(value)
  } catch {
    return
  }
  copied.value = key
  clearTimeout(copyTimer)
  copyTimer = setTimeout(() => (copied.value = ''), 1200)
}

const neutralSwatches = computed(() => Object.entries(neutral))
</script>

<template>
  <div class="palette">
    <header class="palette-head">
      <div>
        <h1>设计规范</h1>
        <p>
          开发专用页。所有颜色、圆角、阴影、层级都来自
          <code>src/theme</code>，改 token 即全站生效。Naive UI 组件通过
          <code>themeOverrides</code> 映射，不再用 CSS 硬覆盖。
        </p>
      </div>
      <RouterLink class="palette-link" to="/dev/markdown">Markdown 排版预览 →</RouterLink>
    </header>

    <!-- ===== 基础色阶 ===== -->
    <section class="block">
      <h2>基础色阶</h2>
      <p class="hint">只作为底色的实色锚点与色板来源，组件里禁止直接引用。</p>
      <div class="ramp">
        <div v-for="[step, value] in neutralSwatches" :key="step" class="ramp-item">
          <div class="ramp-chip" :style="{ background: value }" />
          <span class="ramp-step">{{ step }}</span>
          <span class="ramp-value">{{ value }}</span>
        </div>
      </div>
      <div class="ramp">
        <div class="ramp-item">
          <div class="ramp-chip" :style="{ background: highlight.light }" />
          <span class="ramp-step">highlight</span>
          <span class="ramp-value">{{ highlight.light }}</span>
        </div>
        <div class="ramp-item">
          <div class="ramp-chip" :style="{ background: highlight.dark }" />
          <span class="ramp-step">highlight·dark</span>
          <span class="ramp-value">{{ highlight.dark }}</span>
        </div>
        <div class="ramp-item">
          <div class="ramp-chip" :style="{ background: destructive.light }" />
          <span class="ramp-step">destructive</span>
          <span class="ramp-value">{{ destructive.light }}</span>
        </div>
      </div>
    </section>

    <!-- ===== 语义 token ===== -->
    <section class="block">
      <h2>语义 token</h2>
      <p class="hint">
        左侧浅色、右侧深色并排。点击色块复制当前值。文字与边框类 token 是半透明值，
        显示为叠在其所属底色上的实际观感。
      </p>

      <div v-for="group in TOKEN_GROUPS" :key="group.title" class="token-group">
        <h3>{{ group.title }}</h3>
        <div class="token-table">
          <div class="token-row token-row--head">
            <span class="col-name">token</span>
            <span class="col-preview">浅色</span>
            <span class="col-value">值</span>
            <span class="col-preview">深色</span>
            <span class="col-value">值</span>
            <span class="col-copy" />
          </div>
          <div v-for="key in group.keys" :key="key" class="token-row">
            <span class="col-name">--{{ key }}</span>
            <span class="col-preview">
              <span
                class="swatch"
                data-theme="light"
                :style="{ background: lightTokens[key], boxShadow: 'inset 0 0 0 1px var(--border)' }"
              />
            </span>
            <span class="col-value" data-theme="light">{{ lightTokens[key] }}</span>
            <span class="col-preview">
              <span
                class="swatch"
                data-theme="dark"
                :style="{ background: darkTokens[key], boxShadow: 'inset 0 0 0 1px var(--border)' }"
              />
            </span>
            <span class="col-value" data-theme="dark">{{ darkTokens[key] }}</span>
            <span class="col-copy">
              <button
                type="button"
                class="copy-btn"
                :aria-label="`复制 --${key}`"
                @click="copyValue(key, `var(--${key})`)"
              >
                <NIcon :component="Copy24Regular" :size="16" />
              </button>
              <span v-if="copied === key" class="copied">已复制</span>
            </span>
          </div>
        </div>
      </div>
    </section>

    <!-- ===== 对比度矩阵 ===== -->
    <section class="block">
      <h2>对比度（WCAG）</h2>
      <p class="hint">
        半透明文字的实际对比度取决于它叠在哪一层底色上，所以逐组合列出。
        AA 正文需 ≥ 4.5，大字需 ≥ 3。
      </p>
      <div class="contrast-grid">
        <div v-for="mode in ['light', 'dark']" :key="mode" class="contrast-col" :data-theme="mode">
          <h3>{{ mode === 'light' ? '浅色' : '深色' }}</h3>
          <div
            v-for="[fgKey, bgKey] in PAIRS"
            :key="`${mode}-${fgKey}-${bgKey}`"
            class="contrast-row"
            :style="{ background: (mode === 'light' ? lightTokens : darkTokens)[bgKey] }"
          >
            <span
              class="contrast-sample"
              :style="{ color: (mode === 'light' ? lightTokens : darkTokens)[fgKey] }"
            >
              {{ bgKey }} 上的 {{ fgKey }}
            </span>
            <span class="contrast-badge" :class="`is-${grade(contrastRatio((mode === 'light' ? lightTokens : darkTokens)[fgKey], (mode === 'light' ? lightTokens : darkTokens)[bgKey])).level}`">
              {{ grade(contrastRatio((mode === 'light' ? lightTokens : darkTokens)[fgKey], (mode === 'light' ? lightTokens : darkTokens)[bgKey])).label }}
            </span>
          </div>
        </div>
      </div>
    </section>

    <!-- ===== 非颜色 token ===== -->
    <section class="block">
      <h2>圆角</h2>
      <p class="hint">
        平滑曲率圆角（<code>corner-shape: squircle</code>）在支持它的浏览器里半径自动放大
        1.75×，以保持视觉等效；不支持的浏览器回退到传统 1/4 圆角。下面展示的是当前浏览器的实际渲染。
      </p>
      <div class="radius-row">
        <div v-for="key in RADIUS_KEYS" :key="key" class="radius-item">
          <div class="radius-box" :style="{ borderRadius: `var(--${key})` }" />
          <span class="radius-name">--{{ key }}</span>
          <span class="radius-value" data-theme="light">{{ staticTokens[key] }}</span>
        </div>
      </div>
    </section>

    <section class="block">
      <h2>阴影</h2>
      <div class="shadow-row">
        <div v-for="key in ['shadow-sm', 'shadow-md', 'shadow-popover', 'shadow-drawer']" :key="key" class="shadow-item">
          <div class="shadow-box" :style="{ boxShadow: `var(--${key})` }" />
          <span class="radius-name">--{{ key }}</span>
        </div>
      </div>
    </section>

    <section class="block">
      <h2>动效与层级</h2>
      <div class="plain-table">
        <div class="plain-row">
          <span class="col-name">--duration-theme</span>
          <span>{{ staticTokens['duration-theme'] }}</span>
        </div>
        <div class="plain-row">
          <span class="col-name">--ease-theme</span>
          <span>{{ staticTokens['ease-theme'] }}</span>
        </div>
        <div v-for="key in Z_KEYS" :key="key" class="plain-row">
          <span class="col-name">--{{ key }}</span>
          <span>{{ staticTokens[key] }}（Naive 弹层从 2000 起自动递增）</span>
        </div>
      </div>
    </section>

    <!-- ===== Naive 组件 ===== -->
    <section class="block">
      <h2>Naive UI 组件</h2>
      <p class="hint">
        变量名写错时 Naive 会静默忽略，只看色块看不出来 —— 这一节是验证映射是否真正生效的唯一手段。
      </p>
      <div class="compare">
        <div v-for="mode in ['light', 'dark']" :key="mode" class="compare-pane" :data-theme="mode">
          <NConfigProvider
            :theme="mode === 'light' ? lightTheme : darkTheme"
            :theme-overrides="mode === 'light' ? lightThemeOverrides : darkThemeOverrides"
          >
            <h3>{{ mode === 'light' ? '浅色' : '深色' }}</h3>
            <div class="demo">
              <div class="demo-row">
                <NButton>默认按钮</NButton>
                <NButton type="primary">主要按钮</NButton>
                <NButton quaternary>次要按钮</NButton>
              </div>
              <div class="demo-row">
                <NInput v-model:value="demoInput" placeholder="输入框占位文字" style="max-width: 200px" />
                <NSelect v-model:value="demoSelect" :options="selectOptions" style="width: 140px" />
              </div>
              <div class="demo-row">
                <NCascader
                  v-model:value="demoCascader"
                  :options="cascaderOptions"
                  placeholder="级联选择"
                  style="width: 160px"
                />
                <NSwitch v-model:value="demoSwitch" />
                <NCheckbox v-model:checked="demoCheckbox">复选</NCheckbox>
              </div>
              <div class="demo-row">
                <NTooltip>
                  <template #trigger><NButton size="small">悬停看气泡</NButton></template>
                  反色气泡
                </NTooltip>
                <NDropdown :options="dropdownOptions">
                  <NButton size="small">下拉菜单</NButton>
                </NDropdown>
              </div>
            </div>
          </NConfigProvider>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.palette {
  padding: 8px 0 48px;
  color: var(--foreground);
  font-size: 14px;
}

.palette-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 32px;
}

.palette-head h1 {
  font-size: 24px;
  margin-bottom: 8px;
}

.palette-head p {
  color: var(--muted-foreground);
  max-width: 640px;
  line-height: 1.7;
}

.palette-head code,
.hint code {
  background: var(--muted);
  padding: 1px 5px;
  border-radius: var(--radius-xs);
  font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
  font-size: 0.9em;
}

.palette-link {
  color: var(--foreground);
  text-decoration: none;
  border-bottom: 1px dashed var(--border-strong);
  padding-bottom: 2px;
  white-space: nowrap;
}

.palette-link:hover {
  border-bottom-style: solid;
}

.block {
  margin-bottom: 44px;
}

.block h2 {
  font-size: 17px;
  margin-bottom: 6px;
}

.block h3 {
  font-size: 13px;
  font-weight: 600;
  color: var(--muted-foreground);
  margin: 18px 0 8px;
}

.hint {
  color: var(--subtle-foreground);
  font-size: 13px;
  line-height: 1.7;
  margin-bottom: 14px;
  max-width: 780px;
}

/* 色阶 */
.ramp {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.ramp-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 84px;
}

.ramp-chip {
  height: 44px;
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--border);
}

.ramp-step,
.ramp-value {
  font-size: 11px;
  font-family: 'Cascadia Code', Consolas, monospace;
  color: var(--subtle-foreground);
}

/* token 表 */
.token-table {
  display: flex;
  flex-direction: column;
}

.token-row {
  display: grid;
  grid-template-columns: 200px 44px 1fr 44px 1fr 92px;
  align-items: center;
  gap: 12px;
  padding: 5px 0;
  border-bottom: 1px solid var(--border);
}

.token-row--head {
  color: var(--subtle-foreground);
  font-size: 12px;
  border-bottom-color: var(--border-strong);
}

.col-name {
  font-family: 'Cascadia Code', Consolas, monospace;
  font-size: 12px;
}

.col-value {
  font-family: 'Cascadia Code', Consolas, monospace;
  font-size: 11px;
  color: var(--muted-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.swatch {
  display: block;
  width: 32px;
  height: 22px;
  border-radius: var(--radius-xs);
}

.col-copy {
  display: flex;
  align-items: center;
  gap: 6px;
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--subtle-foreground);
  cursor: pointer;
  transition: background-color var(--duration-theme) var(--ease-theme),
    color var(--duration-theme) var(--ease-theme);
}

.copy-btn:hover {
  background: var(--accent);
  color: var(--foreground);
}

.copied {
  font-size: 11px;
  color: var(--muted-foreground);
}

/* 对比度 */
.contrast-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 20px;
}

.contrast-col {
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.contrast-col h3 {
  margin: 0 0 8px;
}

.contrast-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 12px;
  border-radius: var(--radius-sm);
  margin-bottom: 6px;
}

.contrast-sample {
  font-size: 13px;
}

.contrast-badge {
  font-size: 11px;
  font-family: 'Cascadia Code', Consolas, monospace;
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  background: var(--muted);
  color: var(--muted-foreground);
  white-space: nowrap;
}

.contrast-badge.is-aaa {
  background: var(--primary);
  color: var(--primary-foreground);
}

.contrast-badge.is-fail {
  background: var(--destructive);
  color: var(--destructive-foreground);
}

/* 圆角 / 阴影 */
.radius-row,
.shadow-row {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
}

.radius-item,
.shadow-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.radius-box {
  width: 72px;
  height: 72px;
  background: var(--muted);
  border: 1px solid var(--border);
}

.shadow-box {
  width: 96px;
  height: 60px;
  border-radius: var(--radius-md);
  background: var(--card);
}

.radius-name {
  font-family: 'Cascadia Code', Consolas, monospace;
  font-size: 11px;
  color: var(--muted-foreground);
}

.radius-value {
  font-family: 'Cascadia Code', Consolas, monospace;
  font-size: 11px;
  color: var(--subtle-foreground);
}

/* 普通表格 */
.plain-table {
  display: flex;
  flex-direction: column;
  max-width: 560px;
}

.plain-row {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  color: var(--muted-foreground);
}

/* Naive 组件对照 */
.compare {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 16px;
}

.compare-pane {
  background: var(--background);
  border-radius: var(--radius-lg);
  padding: 16px;
  border: 1px solid var(--border);
}

.compare-pane h3 {
  margin-top: 0;
}

.demo {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.demo-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
</style>

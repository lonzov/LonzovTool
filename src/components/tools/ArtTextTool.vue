<script setup>
import { ref, watch } from 'vue'
import { NIcon, NSelect, useMessage } from 'naive-ui'
import { ArrowSort24Regular, Copy16Regular, Delete24Regular, TextCaseTitle24Regular } from '@vicons/fluent'
import { useToolStorage } from '../../composables/useToolStorage.js'

defineProps({
  tabPath: {
    type: String,
    default: '',
  },
})

const message = useMessage()

// ===== 字形表 =====
const DIGITS = '0123456789'
const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const ALNUM = DIGITS + LOWER + UPPER

// 目标串必须与源串严格同位对齐：某位没有字形就写 NO_GLYPH 占位，该位原样输出。
// 不能用「少写一个字符」表达缺失 —— 那会让后面每一位静默前移一格，人眼在 62 位的
// Unicode 串上根本数不出来（上角标表历史上就这么错过一次，q 之后全体错位）。
const NO_GLYPH = '-'

// 借位规则：Unicode 没有该位的下标字形时借同音希腊下标（β→b、γ→g、φ→f），连希腊字母也没有的
// （c d q）留空位原样输出。w/y/z 用的是 Unicode 18.0 新增的真下标，字体还没跟上时可能显示为空。
const SUB_ROW = 'ₐᵦ--ₑᵩᵧₕᵢⱼₖₗₘₙₒₚ-ᵣₛₜᵤᵥ₝ₓ₞₟'
const SUP_ROW = 'ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖ-ʳˢᵗᵘᵛʷˣʸᶻ'
// 上角标大写：专供的大写修饰字母只有 A B D E G H I J K L M N O P R T U V W，
// 其余借同位的小写上角标（ᶜ ᶠ ˢ ˣ ʸ ᶻ），Q 两套都没有
const SUP_UPPER_ROW = 'ᴬᴮᶜᴰᴱᶠᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾ-ᴿˢᵀᵁⱽᵂˣʸᶻ'

// 全角区偏移：ASCII 的数字与字母加 0xFEE0 即对应全角字形
const FULLWIDTH_OFFSET = 0xFEE0
const toFullwidth = (chars) =>
  [...chars].map((c) => String.fromCharCode(c.charCodeAt(0) + FULLWIDTH_OFFSET)).join('')

const MODES = [
  { label: '衬线体', value: 'fullwidth', source: ALNUM, target: toFullwidth(ALNUM) },
  { label: '上角标 - 仅部分', value: 'superscript', source: ALNUM, target: '⁰¹²³⁴⁵⁶⁷⁸⁹' + SUP_ROW + SUP_UPPER_ROW },
  // 下标没有任何大写专供字形，大写行直接复用小写行，同一字母的大小写输出一致
  { label: '下角标 - 仅部分', value: 'subscript', source: ALNUM, target: '₀₁₂₃₄₅₆₇₈₉' + SUB_ROW + SUB_ROW },
  { label: '类拉丁文 - 仅大写', value: 'latin', source: UPPER, target: 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ' },
]

// 按码点对齐建表，避免目标串混入星面字符时整表错位；占位位不写表，转换时原样输出
const MODE_TABLES = new Map(
  MODES.map(({ value, source, target }) => {
    const glyphs = [...target]
    const table = []
    for (let i = 0; i < source.length; i++) {
      if (glyphs[i] && glyphs[i] !== NO_GLYPH) table[source.charCodeAt(i)] = glyphs[i]
    }
    return [value, table]
  }),
)

if (import.meta.env.DEV) {
  for (const { value, source, target } of MODES) {
    const size = [...target].length
    if (size !== source.length) {
      console.warn(`[艺术字] ${value} 的目标表 ${size} 位与源表 ${source.length} 位不等长，映射已错位`)
    }
  }
}

const modeOptions = MODES.map(({ label, value }) => ({ label, value }))

const inputText = ref('')
const outputText = ref('')
const selectedMode = ref('fullwidth')

useToolStorage('lonzovtool-arttext', { inputText, selectedMode }, {
  onRestored: () => {
    if (inputText.value.trim()) outputText.value = transformText(inputText.value, selectedMode.value)
  },
})

// 模式换掉后旧结果就不再对应，直接按新模式重算，避免结果框里留着上一个模式的产物
watch(selectedMode, (mode) => {
  if (outputText.value) outputText.value = transformText(inputText.value, mode)
})

/** 逐码点查表；代理对与表外字符都取不到值，按原字符输出 */
function transformText(text, mode) {
  const table = MODE_TABLES.get(mode)
  if (!table) return text

  let result = ''
  for (let i = 0; i < text.length; i++) {
    result += table[text.charCodeAt(i)] ?? text[i]
  }
  return result
}

function handleConvert() {
  if (!inputText.value.trim()) {
    message.warning('请输入需要转换的文本', { duration: 1800 })
    return
  }
  outputText.value = transformText(inputText.value, selectedMode.value)
  message.success('转换成功！', { duration: 1800 })
}

async function handleCopy() {
  if (!outputText.value) {
    message.warning('请先转换再复制', { duration: 1800 })
    return
  }
  try {
    await navigator.clipboard.writeText(outputText.value)
    message.success('复制成功！', { duration: 1800 })
  } catch {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = outputText.value
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      message.success('复制成功！', { duration: 1800 })
    } catch {
      message.error('复制失败', { duration: 1800 })
    }
  }
}

let clearClickCount = 0
let clearClickTimer = null
let clearConfirmMsg = null

function handleClear() {
  clearClickCount++
  if (clearClickCount === 1) {
    clearConfirmMsg = message.warning('双击确认清空', { duration: 1800 })
    clearClickTimer = setTimeout(() => {
      clearClickCount = 0
      clearClickTimer = null
    }, 800)
  } else if (clearClickCount >= 2) {
    if (clearClickTimer) clearTimeout(clearClickTimer)
    clearClickTimer = null
    clearClickCount = 0
    inputText.value = ''
    outputText.value = ''
    // 先销毁确认提示再重发结果提示，独占展示位并保证完整停留时长
    if (clearConfirmMsg) {
      clearConfirmMsg.destroy()
      clearConfirmMsg = null
    }
    message.success('已清空', { duration: 1800 })
  }
}
</script>

<template>
  <div class="arttext-tool">
    <!-- 页面主标题与简介 -->
    <div class="page-header">
      <div class="page-title-row">
        <NIcon :component="TextCaseTitle24Regular" class="page-title-icon" />
        <h1 class="page-title">艺术字转换</h1>
      </div>
      <p class="page-desc">将字母数字转换为游戏内的艺术字</p>
    </div>

    <!-- 配置+输入卡片，底部收一条贯穿式操作栏 -->
    <div class="tool-card">
      <div class="card-body">
        <div class="form-field">
          <label>转换模式</label>
          <NSelect
            v-model:value="selectedMode"
            :options="modeOptions"
            class="field-select"
          />
          <p class="field-hint">【仅转换数字和字母】字母数字会被替换成对应字形，无法映射的字符原样保留</p>
        </div>

        <div class="form-field">
          <label for="arttext-input">输入文本</label>
          <textarea
            id="arttext-input"
            v-model="inputText"
            class="text-input"
            placeholder="在此输入需要转换的文本..."
            spellcheck="false"
            autocomplete="off"
            autocapitalize="off"
          ></textarea>
        </div>
      </div>

      <div class="card-footer">
        <button class="control-btn" @click="handleConvert">
          <NIcon :component="ArrowSort24Regular" />
          <span>转换</span>
        </button>
        <button class="control-btn control-btn--ghost" @click="handleCopy">
          <NIcon :component="Copy16Regular" />
          <span>复制</span>
        </button>
        <button class="control-btn control-btn--danger" @click="handleClear">
          <NIcon :component="Delete24Regular" />
          <span>清空</span>
        </button>
      </div>
    </div>

    <!-- 输出区（单独卡片） -->
    <div class="tool-card">
      <div class="card-body">
        <div class="form-field">
          <label for="arttext-output">转换结果</label>
          <textarea
            id="arttext-output"
            :value="outputText"
            class="text-input"
            placeholder="转换结果将显示在这里..."
            spellcheck="false"
            readonly
          ></textarea>
          <p class="field-hint">*此处可能不支持渲染，请以游戏内实际效果为准</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.arttext-tool {
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

/* ===== 卡片：内容区与底部操作栏分段，两者之间的分割线贯穿整卡 ===== */
.tool-card {
  background: var(--card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: background-color 0.4s ease, border-color 0.4s ease;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 16px;
}

.card-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid var(--border);
  background: var(--accent);
  transition: background-color 0.4s ease, border-color 0.4s ease;
}

/* ===== 表单字段（标签在上，控件在下） ===== */
.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-field label {
  font-size: 13px;
  font-weight: 600;
  color: var(--foreground);
}

.field-hint {
  font-size: 13px;
  line-height: 1.5;
  color: var(--muted-foreground);
  margin: 0;
}

.field-select {
  width: 100%;
}

.field-select :deep(.n-base-selection) {
  transition: border-color 0.4s ease, background-color 0.4s ease, color 0.4s ease, box-shadow 0.4s ease;
}

/* ===== 文本域 ===== */
.text-input {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 15px;
  font-size: 1rem;
  resize: none;
  background-color: var(--input-background);
  color: var(--foreground);
  transition: border-color 0.4s ease, box-shadow 0.4s ease, background-color 0.4s ease;
  font-family: inherit;
  line-height: 1.6;
  min-height: 160px;
}

.text-input:focus {
  outline: none;
  border-color: var(--muted-foreground);
  box-shadow: 0 0 0 2px var(--ring);
}

.text-input::placeholder {
  color: var(--subtle-foreground);
}

/* ===== 按钮 ===== */
.control-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  font-size: 0.875rem;
  font-weight: 600;
  font-family: inherit;
  white-space: nowrap;
  cursor: pointer;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background-color: var(--primary);
  color: var(--primary-foreground);
  transition: background-color 0.4s ease, color 0.4s ease, border-color 0.4s ease;
  -webkit-tap-highlight-color: transparent;
}

.control-btn--ghost {
  background-color: var(--accent);
  border-color: var(--border-strong);
  color: var(--foreground);
}

/* 危险操作只做浅底红字，实心红在这类「清空」动作上过重 */
.control-btn--danger {
  background-color: color-mix(in srgb, var(--destructive) 10%, transparent);
  color: var(--destructive);
}

.control-btn :deep(.n-icon) {
  font-size: 15px;
}

/* ===== 响应式 ===== */
@media (max-width: 640px) {
  .card-body {
    padding: 12px;
    gap: 16px;
  }

  .card-footer {
    justify-content: center;
    flex-wrap: wrap;
    padding: 12px;
  }

  .text-input {
    padding: 12px;
    min-height: 120px;
  }
}
</style>

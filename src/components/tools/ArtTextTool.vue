<script setup>
import { ref } from 'vue'
import { NIcon, useMessage } from 'naive-ui'
import { Copy24Regular, Delete24Regular, TextCaseTitle24Regular, ConvertRange24Regular } from '@vicons/fluent'

defineProps({
  tabPath: {
    type: String,
    default: '',
  },
})

const message = useMessage()

const inputText = ref('')
const outputText = ref('')
const selectedMode = ref('fullwidth')

function transformText(text) {
  const mode = selectedMode.value
  let result = ''

  switch (mode) {
    case 'fullwidth':
      for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i)
        if ((code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
          result += String.fromCharCode(code + 65248)
        } else {
          result += text[i]
        }
      }
      return result

    case 'superscript': {
      const sourceCharsSuper = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
      const targetCharsSuper = '⁰¹²³⁴⁵⁶⁷⁸⁹ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻᴬᴮᒼᴰᴱᶠᴳᴴᴵᴶᴷᴸṹᴺἼᴾᴼ̴ᴿˢᵀᵁⱽᵂˣᵞᙆ'
      const superMap = {}
      for (let i = 0; i < sourceCharsSuper.length; i++) {
        superMap[sourceCharsSuper[i]] = targetCharsSuper[i]
      }
      for (let i = 0; i < text.length; i++) {
        result += superMap[text[i]] !== undefined ? superMap[text[i]] : text[i]
      }
      return result
    }

    case 'subscript': {
      const sourceCharsSub = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
      const targetCharsSub = '₀₁₂₃₄₅₆₇₈₉ₐᵦcdₑfgₕᵢⱼₖₗₘₙₒₚᵨᵣₛₜᵤᵥwₓᵧzAᵦCDEFGHₗJK˪៳៷ₒₚᵨᵣₛₜᵤ៴WᵪᵧZ'
      const subMap = {}
      for (let i = 0; i < sourceCharsSub.length; i++) {
        subMap[sourceCharsSub[i]] = targetCharsSub[i]
      }
      for (let i = 0; i < text.length; i++) {
        result += subMap[text[i]] !== undefined ? subMap[text[i]] : text[i]
      }
      return result
    }

    case 'latin': {
      const sourceCharsLatin = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      const targetCharsLatin = 'ᴀʙᴄᴅᴇғɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ'
      const latinMap = {}
      for (let i = 0; i < sourceCharsLatin.length; i++) {
        latinMap[sourceCharsLatin[i]] = targetCharsLatin[i]
      }
      for (let i = 0; i < text.length; i++) {
        result += latinMap[text[i]] !== undefined ? latinMap[text[i]] : text[i]
      }
      return result
    }

    default:
      return text
  }
}

function handleConvert() {
  if (!inputText.value.trim()) {
    message.warning('请输入需要转换的文本', { duration: 1800 })
    return
  }
  try {
    outputText.value = transformText(inputText.value)
    message.success('转换成功！', { duration: 1800 })
  } catch (error) {
    message.error('转换失败：' + error.message, { duration: 1800 })
  }
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

function handleClear() {
  clearClickCount++
  if (clearClickCount === 1) {
    message.warning('双击确认清空', { duration: 1800 })
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
    message.info('已清空', { duration: 1800 })
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

    <!-- 输入+配置+按钮 合并卡片 -->
    <div class="tool-card">
      <div class="form-field">
        <label for="modeSelect">转换模式</label>
        <select id="modeSelect" v-model="selectedMode" class="field-select">
          <option value="fullwidth">标准艺术字</option>
          <option value="superscript">上角标</option>
          <option value="subscript">下角标</option>
          <option value="latin">类拉丁文</option>
        </select>
      </div>

      <textarea
        v-model="inputText"
        class="text-input"
        placeholder="在此输入需要转换的文本..."
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
      ></textarea>

      <div class="btn-row">
        <button class="control-btn" @click="handleConvert">
          <NIcon :component="ConvertRange24Regular" />
          <span>转换</span>
        </button>
        <button class="control-btn" @click="handleCopy">
          <NIcon :component="Copy24Regular" />
          <span>复制</span>
        </button>
        <button class="control-btn" @click="handleClear">
          <NIcon :component="Delete24Regular" />
          <span>清空</span>
        </button>
      </div>
    </div>

    <!-- 输出区（单独卡片） -->
    <div class="tool-card tool-card--output">
      <textarea
        :value="outputText"
        class="text-input"
        placeholder="转换结果将显示在这里..."
        spellcheck="false"
        readonly
      ></textarea>
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

/* ===== 卡片 ===== */
.tool-card {
  background: #FFFFFF;
  border-radius: 12px;
  border: 1px solid #E0E0E0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  transition: background-color 0.4s ease, border-color 0.4s ease;
}

[data-theme="dark"] .tool-card {
  background: #191919;
  border-color: #2B2B2B;
}

.tool-card:hover {
  background: #FFFFFF !important;
  border-color: #E0E0E0 !important;
  transform: none !important;
  box-shadow: none !important;
}

[data-theme="dark"] .tool-card:hover {
  background: #191919 !important;
  border-color: #2B2B2B !important;
}

.tool-card--output {
  min-height: 160px;
}

/* ===== 表单字段（标签在上，控件在下） ===== */
.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-field label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.field-select,
.field-input {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 1rem;
  background-color: var(--bg-sub);
  color: var(--text-primary);
  transition: border-color 0.4s ease, box-shadow 0.4s ease, background-color 0.4s ease;
  font-family: inherit;
  appearance: auto;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23525252' d='M3 4l3 3 3-3'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;
  cursor: pointer;
}

[data-theme="dark"] .field-select {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23A0A0A0' d='M3 4l3 3 3-3'/%3E%3C/svg%3E");
}

.field-select:focus,
.field-input:focus {
  outline: none;
  border-color: var(--text-secondary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 20%, transparent);
}

/* ===== 文本域 ===== */
.text-input {
  width: 100%;
  flex: 1;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 15px;
  font-size: 1rem;
  resize: none;
  background-color: transparent;
  color: var(--text-primary);
  transition: border-color 0.4s ease, box-shadow 0.4s ease;
  font-family: inherit;
  line-height: 1.6;
  min-height: 160px;
}

.text-input:focus {
  outline: none;
  border-color: var(--text-secondary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 20%, transparent);
}

.text-input::placeholder {
  color: var(--text-tertiary);
}

/* ===== 按钮行（靠右对齐） ===== */
.btn-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  padding-top: 4px;
}

.control-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background-color: var(--text-primary);
  color: var(--bg-color);
  border: none;
  padding: 9px 20px;
  font-size: 0.95rem;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.4s ease, color 0.4s ease;
  font-weight: 600;
  font-family: inherit;
  height: 38px;
  -webkit-tap-highlight-color: transparent;
  position: relative;
  overflow: hidden;
}

.control-btn:active {
  transform: none;
  box-shadow: none;
}

.control-btn :deep(.n-icon) {
  font-size: 15px;
}

/* ===== 响应式 ===== */
@media (max-width: 640px) {
  .btn-row {
    justify-content: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .control-btn {
    padding: 8px 16px;
    font-size: 0.9rem;
  }

  .tool-card {
    padding: 12px;
    gap: 12px;
  }

  .text-input {
    padding: 12px;
    min-height: 120px;
  }
}
</style>

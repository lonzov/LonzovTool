<script setup>
import { ref } from 'vue'
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

const modeOptions = [
  { label: '衬线体 - 仅数字字母', value: 'fullwidth' },
  { label: '上角标 - 部分数字字母', value: 'superscript' },
  { label: '下角标 - 部分数字字母', value: 'subscript' },
  { label: '类拉丁文 - 仅部分大写字母', value: 'latin' },
]

const inputText = ref('')
const outputText = ref('')
const selectedMode = ref('fullwidth')

useToolStorage('lonzovtool-arttext', { inputText, selectedMode }, {
  onRestored: () => { if (inputText.value.trim()) outputText.value = transformText(inputText.value) },
})

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
          <p class="field-hint">字母数字会被替换成对应字形，无法映射的字符原样保留</p>
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

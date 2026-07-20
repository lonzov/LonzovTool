<script setup>
import { ref } from 'vue'
import { NIcon, NSelect, NConfigProvider, darkTheme, useMessage } from 'naive-ui'
import { Copy24Regular, Delete24Regular, TextGrammarWand24Regular, ConvertRange24Regular } from '@vicons/fluent'
import { useToolStorage } from '../../composables/useToolStorage.js'
import { useTheme } from '../../composables/useTheme'

defineProps({
  tabPath: {
    type: String,
    default: '',
  },
})

const message = useMessage()
const { isDark } = useTheme()

/** NSelect 主题覆盖：增强下拉菜单阴影 + 深色模式 peer 覆盖（按 customize-theme.md 文档方式） */
const lightSelectOverrides = {
  Select: {
    menuBoxShadow: '0 8px 24px -6px rgba(0, 0, 0, .14), 0 12px 32px 4px rgba(0, 0, 0, .08), 0 16px 48px 16px rgba(0, 0, 0, .05)',
  },
}

const darkSelectOverrides = {
  Select: {
    menuBoxShadow: '0 8px 24px -6px rgba(0, 0, 0, .6), 0 12px 32px 4px rgba(0, 0, 0, .4), 0 16px 48px 16px rgba(0, 0, 0, .3)',
    peers: {
      InternalSelection: {
        color: '#191919',
        textColor: '#E8E8E8',
        border: '1px solid #333333',
        borderHover: '1px solid #555555',
        borderFocus: '1px solid #E8E8E8',
        borderActive: '1px solid #E8E8E8',
        boxShadowFocus: 'none',
        boxShadowActive: 'none',
      },
      InternalSelectMenu: {
        color: '#1E1E1E',
        optionTextColor: '#E8E8E8',
        optionTextColorActive: '#E8E8E8',
        optionTextColorPressed: '#E8E8E8',
        optionCheckColor: '#E8E8E8',
        optionColorActive: '#2A2A2A',
        optionColorActivePending: '#2A2A2A',
        optionColorPending: '#2A2A2A',
        loadingColor: '#E8E8E8',
      },
    },
  },
}

const initOptions = [
  { label: '否', value: false },
  { label: '是', value: true },
]

const inputText = ref('')
const outputText = ref('')
const startScore = ref('')
const scoreboardName = ref('')
const initialize = ref(false)

useToolStorage('lonzovtool-tranimation', { inputText, startScore, scoreboardName, initialize }, {
  onRestored: () => {
    if (inputText.value.trim() && scoreboardName.value.trim()) {
      const res = transformText(inputText.value, scoreboardName.value, startScore.value, initialize.value)
      if (!res.error) outputText.value = res.result
    }
  },
})

// ===== 核心转换逻辑 (来自 v2/c/tr/script.js) =====

function transformText(text, scoreboard, startScoreVal, init) {
  if (!text || !text.toString().trim()) {
    return { error: '请输入需要转换的文本' }
  }
  try {
    const commands = []
    let i = 0
    let initialScoreValue = parseInt(startScoreVal, 10)
    if (isNaN(initialScoreValue)) {
      initialScoreValue = 0
    }

    let score = initialScoreValue

    if (typeof scoreboard !== 'string' || !scoreboard.trim()) {
      return { error: '请输入有效的计分板名称' }
    }
    const trimmedScoreboard = scoreboard.trim()

    while (i < text.length) {
      let currentText = ''
      // 递归收集所有连续的§*和\n
      while (i < text.length) {
        // 处理§格式
        if (text[i] === '§' && i + 1 < text.length) {
          currentText += text.substr(i, 2)
          i += 2
          continue
        }
        // 处理\n字符串
        else if (text[i] === '\\' && i + 1 < text.length && text[i + 1] === 'n') {
          currentText += '\n'
          i += 2
          continue
        }
        // 处理实际换行符
        else if (text[i] === '\n') {
          currentText += '\n'
          i++
          continue
        }
        break
      }
      // 收集后续一个普通字符
      if (i < text.length && currentText) {
        currentText += text[i]
        i++
      }
      if (currentText) {
        const commandData = {
          translate: '%%2',
          with: {
            rawtext: [
              { selector: `@s[scores={${trimmedScoreboard}=${score}..}]` },
              { text: currentText },
            ],
          },
        }
        commands.push(JSON.stringify(commandData))
        score++
      } else if (i < text.length) {
        const commandData = {
          translate: '%%2',
          with: {
            rawtext: [
              { selector: `@s[scores={${trimmedScoreboard}=${score}..}]` },
              { text: text[i] },
            ],
          },
        }
        commands.push(JSON.stringify(commandData))
        i++
        score++
      }
    }

    let result = '[' + commands.join(',') + ']'
    if (init) {
      result = `/execute as @a[scores={${trimmedScoreboard}=${initialScoreValue}..}] run titleraw @s actionbar {"rawtext":${result}}`
    }
    return { result }
  } catch (err) {
    return { error: `生成失败 (${err.message})` }
  }
}

function handleConvert() {
  if (!scoreboardName.value || !scoreboardName.value.trim()) {
    message.warning('请输入计分板名称', { duration: 1800 })
    return
  }
  if (!inputText.value.trim()) {
    message.warning('请输入需要转换的文本', { duration: 1800 })
    return
  }

  const res = transformText(inputText.value, scoreboardName.value, startScore.value, initialize.value)
  if (res.error) {
    message.error(res.error, { duration: 1800 })
    outputText.value = ''
  } else {
    outputText.value = res.result
    message.success('转换成功！', { duration: 1800 })
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
  <NConfigProvider
    :theme="isDark ? darkTheme : null"
    :theme-overrides="isDark ? darkSelectOverrides : lightSelectOverrides"
  >
    <div class="tr-tool">
      <!-- 页面主标题与简介 -->
      <div class="page-header">
        <div class="page-title-row">
          <NIcon :component="TextGrammarWand24Regular" class="page-title-icon" />
          <h1 class="page-title">T显动画生成</h1>
        </div>
        <p class="page-desc">生成打字机动画效果的rawJSON</p>
      </div>

      <!-- 配置+输入+按钮 合并卡片 -->
      <div class="tool-card">
        <div class="form-field">
          <label for="startScoreInput">初始的分数</label>
          <input
            id="startScoreInput"
            v-model="startScore"
            type="number"
            class="field-input"
            placeholder="不填默认为0"
            min="0"
          />
        </div>

        <div class="form-field">
          <label for="scoreboardInput">计分板名称</label>
          <input
            id="scoreboardInput"
            v-model="scoreboardName"
            type="text"
            class="field-input"
            placeholder="例如: T显"
          />
        </div>

        <div class="form-field">
          <label>是否初始化</label>
          <NSelect
            v-model:value="initialize"
            :options="initOptions"
            class="field-select"
          />
        </div>

      <textarea
        v-model="inputText"
        class="text-input"
        placeholder="请输入需要转换的文本（支持 §颜色码 和 \n 换行）..."
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
  </NConfigProvider>
</template>

<style scoped>
.tr-tool {
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

/* ===== 表单字段（标签在上，控件在下，参考图片布局） ===== */
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
}

.field-select {
  width: 100%;
}

.field-select :deep(.n-base-selection) {
  transition: border-color 0.4s ease, background-color 0.4s ease, color 0.4s ease, box-shadow 0.4s ease;
}

.field-input:focus {
  outline: none;
  border-color: var(--text-secondary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 20%, transparent);
}

/* 隐藏 number 输入框箭头 */
.field-input[type='number']::-webkit-outer-spin-button,
.field-input[type='number']::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.field-input[type='number'] {
  -moz-appearance: textfield;
  appearance: none;
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
  .tool-card {
    padding: 12px;
    gap: 12px;
  }

  .btn-row {
    justify-content: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .control-btn {
    padding: 8px 16px;
    font-size: 0.9rem;
  }

  .text-input {
    padding: 12px;
    min-height: 120px;
  }
}
</style>

<script setup>
import { ref } from 'vue'
import { NIcon, NSelect, useMessage } from 'naive-ui'
import { Copy24Regular, Delete24Regular, TextGrammarWand24Regular, ConvertRange24Regular } from '@vicons/fluent'
import { useToolStorage } from '../../composables/useToolStorage.js'

defineProps({
  tabPath: {
    type: String,
    default: '',
  },
})

const message = useMessage()

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
  <div class="tr-tool">
    <!-- 页面主标题与简介 -->
    <div class="page-header">
      <div class="page-title-row">
        <NIcon :component="TextGrammarWand24Regular" class="page-title-icon" />
        <h1 class="page-title">T显动画生成</h1>
      </div>
      <p class="page-desc">生成打字机动画效果的rawJSON</p>
    </div>

    <!-- 配置+输入卡片，底部收一条贯穿式操作栏 -->
    <div class="tool-card">
      <div class="card-body">
        <div class="form-field">
          <label for="scoreboardInput">计分板名称</label>
          <input
            id="scoreboardInput"
            v-model="scoreboardName"
            type="text"
            class="field-input"
            placeholder="例如: T显"
          />
          <p class="field-hint">动画靠这个计分板的分数推进，分数加1字数加1</p>
        </div>

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
          <label>是否初始化</label>
          <NSelect
            v-model:value="initialize"
            :options="initOptions"
            class="field-select"
          />
          <p class="field-hint">选「是」时外面会再套一层 /execute 与 titleraw，可直接整条粘贴执行</p>
        </div>

        <div class="form-field">
          <label for="tr-input">输入文本</label>
          <textarea
            id="tr-input"
            v-model="inputText"
            class="text-input"
            placeholder="请输入需要转换的文本（支持 §颜色码 和 \n 换行）..."
            spellcheck="false"
            autocomplete="off"
            autocapitalize="off"
          ></textarea>
        </div>
      </div>

      <div class="card-footer">
        <button class="control-btn" @click="handleConvert">
          <NIcon :component="ConvertRange24Regular" />
          <span>转换</span>
        </button>
        <button class="control-btn control-btn--ghost" @click="handleCopy">
          <NIcon :component="Copy24Regular" />
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
          <label for="tr-output">转换结果</label>
          <textarea
            id="tr-output"
            :value="outputText"
            class="text-input"
            placeholder="转换结果将显示在这里..."
            spellcheck="false"
            readonly
          ></textarea>
        </div>
      </div>
    </div>
  </div>
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

.field-input {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 1rem;
  background-color: var(--input-background);
  color: var(--foreground);
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
  border-color: var(--muted-foreground);
  box-shadow: 0 0 0 2px var(--ring);
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

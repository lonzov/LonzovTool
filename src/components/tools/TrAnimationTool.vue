<script setup>
import { ref } from 'vue'
import { NSelect, useMessage } from 'naive-ui'
import { TextGrammarWand24Regular } from '@vicons/fluent'
import { useToolStorage } from '../../composables/useToolStorage.js'
import ToolActionBar from './ui/ToolActionBar.vue'
import ToolCard from './ui/ToolCard.vue'
import ToolField from './ui/ToolField.vue'
import ToolPageHeader from './ui/ToolPageHeader.vue'
import ToolTextarea from './ui/ToolTextarea.vue'

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

function handleClear() {
  inputText.value = ''
  outputText.value = ''
}
</script>

<template>
  <div class="tr-tool">
    <ToolPageHeader
      :icon="TextGrammarWand24Regular"
      title="T显动画生成"
      desc="生成打字机动画效果的rawJSON"
    />

    <!-- 配置+输入卡片，底部收一条贯穿式操作栏 -->
    <ToolCard>
      <ToolField
        label="计分板名称"
        html-for="scoreboardInput"
        help="动画靠这个计分板的分数推进，分数加1字数加1"
      >
        <input
          id="scoreboardInput"
          v-model="scoreboardName"
          type="text"
          class="field-input"
          placeholder="例如: T显"
        />
      </ToolField>

      <ToolField label="初始的分数" html-for="startScoreInput">
        <input
          id="startScoreInput"
          v-model="startScore"
          type="number"
          class="field-input"
          placeholder="不填默认为0"
          min="0"
        />
      </ToolField>

      <ToolField label="是否初始化" help="选「是」时外面会再套一层 /execute 与 titleraw，可直接整条粘贴执行">
        <NSelect
          v-model:value="initialize"
          :options="initOptions"
          class="field-select"
        />
      </ToolField>

      <ToolField label="输入文本" html-for="tr-input">
        <ToolTextarea
          id="tr-input"
          v-model="inputText"
          placeholder="请输入需要转换的文本（支持 §颜色码 和 \n 换行）..."
        />
      </ToolField>

      <template #footer>
        <ToolActionBar
          :output="outputText"
          @convert="handleConvert"
          @clear="handleClear"
        />
      </template>
    </ToolCard>

    <!-- 输出区（单独卡片） -->
    <ToolCard>
      <ToolField label="转换结果" html-for="tr-output">
        <ToolTextarea
          id="tr-output"
          :model-value="outputText"
          placeholder="转换结果将显示在这里..."
          readonly
        />
      </ToolField>
    </ToolCard>
  </div>
</template>

<style scoped>
.tr-tool {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field-input {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 1rem;
  background-color: var(--input-background);
  color: var(--foreground);
  transition: border-color 0.4s ease, box-shadow 0.4s ease, background-color 0.4s ease,
    color 0.4s ease;
  font-family: inherit;
}

.field-select {
  width: 100%;
}

.field-select :deep(.n-base-selection) {
  transition: border-color 0.4s ease, background-color 0.4s ease, color 0.4s ease,
    box-shadow 0.4s ease;
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
</style>

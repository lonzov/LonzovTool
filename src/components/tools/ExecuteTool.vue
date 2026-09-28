<script setup>
/*
 * 来源声明：本文件的旧版 execute 语法升级逻辑（compileOldExecute）翻译自
 * 命令模拟器（https://github.com/missing244/Command_Simulator）的
 * expand_pack/transform_core/execute.py，依 MIT 许可使用，Copyright (c) 2023 missing244。
 * 许可证全文见 LICENSES/MIT.txt。
 * 分词器与新语法通道化处理为自行实现。
 */

import { ref } from 'vue'
import { useMessage } from 'naive-ui'
import { ArrowTrending20Regular } from '@vicons/fluent'
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

const inputText = ref('')
const outputText = ref('')

useToolStorage('lonzovtool-execute', { inputText }, {
  onRestored: () => {
    if (inputText.value.trim()) {
      const { result } = convertExecuteCommand(inputText.value)
      outputText.value = result
    }
  },
})

// ===== 核心转换逻辑 (来自 v2/c/execute/script.js) =====

class CompileError extends Error {
  constructor(message, pos) {
    super(message)
    this.pos = pos
  }
}

/**
 * 将命令字符串拆分为 token 列表
 */
function tokenize(command) {
  const tokens = []
  let i = 0
  const len = command.length

  while (i < len) {
    if (command[i] === ' ' || command[i] === '\t') {
      i++
      continue
    }

    const start = i

    if (command[i] === '"' || command[i] === "'") {
      const quote = command[i]
      i++
      while (i < len && command[i] !== quote) {
        if (command[i] === '\\') i++
        i++
      }
      if (i < len) i++
      tokens.push({ token: command.slice(start, i), type: 'String', start, end: i })
      continue
    }

    if (command[i] === '~' || command[i] === '^') {
      i++
      if (i < len && (command[i] === '+' || command[i] === '-')) i++
      while (i < len && ((command[i] >= '0' && command[i] <= '9') || command[i] === '.')) i++
      tokens.push({ token: command.slice(start, i), type: 'Coordinate', start, end: i })
      continue
    }

    if ((command[i] >= '0' && command[i] <= '9') ||
        ((command[i] === '-' || command[i] === '+') && i + 1 < len && command[i + 1] >= '0' && command[i + 1] <= '9')) {
      if (command[i] === '+' || command[i] === '-') i++
      while (i < len && ((command[i] >= '0' && command[i] <= '9') || command[i] === '.')) i++
      if (i < len && command[i] === '.' && i + 1 < len && command[i + 1] === '.') {
        i += 2
        if (i < len && (command[i] === '+' || command[i] === '-')) i++
        while (i < len && ((command[i] >= '0' && command[i] <= '9') || command[i] === '.')) i++
      }
      tokens.push({ token: command.slice(start, i), type: 'Number', start, end: i })
      continue
    }

    if (command[i] === '.' && i + 1 < len && command[i + 1] === '.') {
      i += 2
      if (i < len && (command[i] === '+' || command[i] === '-')) i++
      while (i < len && ((command[i] >= '0' && command[i] <= '9') || command[i] === '.')) i++
      tokens.push({ token: command.slice(start, i), type: 'Range', start, end: i })
      continue
    }

    if (command[i] === '!') {
      i++
      tokens.push({ token: command.slice(start, i), type: 'Not', start, end: i })
      continue
    }

    if (command[i] === '@') {
      i++
      while (i < len && command[i] !== ' ' && command[i] !== '[' && command[i] !== '\t') i++
      if (i < len && command[i] === '[') {
        let bracketDepth = 1
        i++
        while (i < len && bracketDepth > 0) {
          if (command[i] === '[') bracketDepth++
          else if (command[i] === ']') bracketDepth--
          i++
        }
      }
      tokens.push({ token: command.slice(start, i), type: 'Selector', start, end: i })
      continue
    }

    if (command[i] === '{') {
      let depth = 1
      i++
      while (i < len && depth > 0) {
        if (command[i] === '{') depth++
        else if (command[i] === '}') depth--
        else if (command[i] === '"' || command[i] === "'") {
          const q = command[i]
          i++
          while (i < len && command[i] !== q) {
            if (command[i] === '\\') i++
            i++
          }
        }
        i++
      }
      tokens.push({ token: command.slice(start, i), type: 'NBT', start, end: i })
      continue
    }

    if (command[i] === '=' || command[i] === '<' || command[i] === '>') {
      if (i + 1 < len && command[i + 1] === '=') {
        i += 2
      } else {
        i++
      }
      tokens.push({ token: command.slice(start, i), type: 'Operator', start, end: i })
      continue
    }

    while (i < len && command[i] !== ' ' && command[i] !== '\t' &&
           command[i] !== '"' && command[i] !== "'" && command[i] !== '{' &&
           command[i] !== '[' && command[i] !== '!' && command[i] !== '=' &&
           command[i] !== '<' && command[i] !== '>') {
      i++
    }

    if (i > start) {
      const token = command.slice(start, i)
      let type = 'Word'
      if (/^-?\d+$/.test(token)) type = 'Int'
      else if (/^-?\d+\.\d+$/.test(token)) type = 'Float'
      tokens.push({ token, type, start, end: i })
    } else {
      i++
    }
  }

  return tokens
}

function readSelector(tokens, index) {
  if (index >= tokens.length) throw new CompileError('期望选择器，但到达命令末尾')
  const t = tokens[index]
  if (t.type === 'Selector') return [t.token, index + 1]
  if (t.type === 'Word' || t.type === 'String') return [t.token, index + 1]
  throw new CompileError(`期望选择器，但得到: ${t.token}`, t.start)
}

function readPosition(tokens, index) {
  if (index + 2 >= tokens.length) throw new CompileError('期望3个坐标分量，但命令长度不足')
  const coords = []
  for (let i = 0; i < 3; i++) {
    const t = tokens[index + i]
    if (t.type !== 'Coordinate' && t.type !== 'Number' && t.type !== 'Int' && t.type !== 'Float') {
      if (!/^[~^]?[-+]?\d*\.?\d*$/.test(t.token)) {
        throw new CompileError(`期望坐标分量，但得到: ${t.token}`, t.start)
      }
    }
    coords.push(t.token)
  }
  return [coords.join(' '), index + 3]
}

function isZeroOffset(pos) {
  return /^~0?(\.0+)? ~0?(\.0+)? ~0?(\.0+)?$/.test(pos) || /^~~~$/.test(pos.replace(/\s/g, ''))
}

const NEW_SUBCOMMANDS = new Set(['as', 'at', 'in', 'if', 'unless', 'align', 'anchored', 'facing', 'positioned', 'rotated', 'run'])

function isNewExecuteSyntax(tokens) {
  if (tokens.length < 2) return false
  if (tokens[0].token.toLowerCase() !== 'execute') return false
  return NEW_SUBCOMMANDS.has(tokens[1].token.toLowerCase())
}

function isOldExecuteSyntax(tokens) {
  if (tokens.length < 2) return false
  if (tokens[0].token.toLowerCase() !== 'execute') return false
  const second = tokens[1]
  return second.type === 'Selector' ||
         (second.type === 'Word' && !NEW_SUBCOMMANDS.has(second.token.toLowerCase()))
}

function compileOldExecute(tokens, startIndex) {
  let index = startIndex
  const subcommandParts = []

  while (index < tokens.length) {
    let selector
    ;[selector, index] = readSelector(tokens, index)

    let pos
    ;[pos, index] = readPosition(tokens, index)

    let part = `as ${selector} at @s`
    if (!isZeroOffset(pos)) {
      part += ` positioned ${pos}`
    }
    subcommandParts.push(part)

    if (index >= tokens.length) break

    if (tokens[index].token.toLowerCase() === 'detect') {
      index++

      let detectPos
      ;[detectPos, index] = readPosition(tokens, index)

      if (index >= tokens.length) throw new CompileError('detect 后缺少方块ID')
      const blockId = tokens[index].token
      index++

      let dataValue = '-1'
      if (index < tokens.length) {
        const nextToken = tokens[index]
        if (nextToken.type === 'Int' || nextToken.type === 'Number' ||
            (nextToken.type === 'Word' && /^-?\d+$/.test(nextToken.token))) {
          dataValue = nextToken.token
          index++
        }
      }

      let ifBlock
      if (dataValue === '-1' || dataValue === '*') {
        ifBlock = `if block ${detectPos} ${blockId}`
      } else {
        ifBlock = `if block ${detectPos} ${blockId} ${dataValue}`
      }
      subcommandParts[subcommandParts.length - 1] += ` ${ifBlock}`

      if (index >= tokens.length) break
      if (tokens[index].token.toLowerCase() === 'execute') {
        index++
        continue
      }
      break
    } else if (tokens[index].token.toLowerCase() === 'execute') {
      index++
      continue
    } else {
      break
    }
  }

  const remainingCommand = tokens.slice(index).map(t => t.token).join(' ')

  let result = 'execute'
  for (const part of subcommandParts) {
    result += ` ${part}`
  }
  result += ` run ${remainingCommand}`

  return result
}

function cleanResult(result) {
  return result
    .replace(/\bpositioned ~~~\b/g, '')
    .replace(/\bpositioned ~ ~ ~\b/g, '')
    .replace(/\bpositioned ~0(?:\.0+)? ~0(?:\.0+)? ~0(?:\.0+)?\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function processCommand(command) {
  command = command.replace(/\s{2,}/g, ' ').trim()
  if (!command) throw new CompileError('命令为空')

  if (!/^execute\b/i.test(command)) return command

  const tokens = tokenize(command)

  if (isOldExecuteSyntax(tokens)) {
    const result = compileOldExecute(tokens, 1)
    return cleanResult(result)
  }

  if (isNewExecuteSyntax(tokens)) {
    return processNewExecute(tokens)
  }

  try {
    const result = compileOldExecute(tokens, 1)
    return cleanResult(result)
  } catch {
    throw new CompileError(`无法识别的execute语法: ${command}`)
  }
}

function processNewExecute(tokens) {
  const subcommandList = []
  let i = 0

  if (i < tokens.length && tokens[i].token.toLowerCase() === 'execute') {
    i++
  }

  while (i < tokens.length) {
    const token = tokens[i]

    if (token.token.toLowerCase() === 'run') {
      if (i + 1 < tokens.length && tokens[i + 1].token.toLowerCase() === 'execute') {
        const remainingTokens = tokens.slice(i + 1)
        if (isOldExecuteSyntax(remainingTokens)) {
          const convertedSub = compileOldExecute(remainingTokens, 1)
          const subTokens = tokenize(convertedSub)
          if (subTokens.length > 0 && subTokens[0].token.toLowerCase() === 'execute') {
            for (let j = 1; j < subTokens.length; j++) {
              subcommandList.push(subTokens[j].token)
            }
          }
          i = tokens.length
          continue
        } else {
          const innerResult = processNewExecute(remainingTokens)
          const innerTokens = tokenize(innerResult)
          if (innerTokens.length > 0 && innerTokens[0].token.toLowerCase() === 'execute') {
            for (let k = 1; k < innerTokens.length; k++) {
              subcommandList.push(innerTokens[k].token)
            }
          } else {
            subcommandList.push('run')
            subcommandList.push(innerResult)
          }
          i = tokens.length
          continue
        }
      } else {
        i++
        const remainingCommand = tokens.slice(i).map(t => t.token).join(' ')
        subcommandList.push('run')
        subcommandList.push(remainingCommand)
        i = tokens.length
        continue
      }
    }

    subcommandList.push(token.token)
    i++
  }

  return cleanResult('execute ' + subcommandList.join(' '))
}

function convertExecuteCommand(input) {
  try {
    if (!input.trim()) throw new CompileError('输入为空')

    const lines = input.split('\n')
    const results = []
    const errors = []

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum].trim()
      if (!line) {
        results.push('')
        continue
      }

      try {
        let cmd = line.replace(/^\//, '').replace(/\s{2,}/g, ' ').trim()
        if (!/^execute\b/i.test(cmd)) {
          results.push(line.startsWith('/') ? line : line)
          continue
        }
        const converted = processCommand(cmd)
        results.push((line.startsWith('/') ? '/' : '') + converted)
      } catch (e) {
        errors.push(`第${lineNum + 1}行: ${e.message}`)
        results.push(line)
      }
    }

    return { result: results.join('\n'), errors }
  } catch (err) {
    return { result: '', errors: [err.message] }
  }
}

// ===== UI 交互 =====

function handleConvert() {
  if (!inputText.value.trim()) {
    message.warning('请输入需要转换的文本', { duration: 1800 })
    return
  }
  try {
    const { result, errors } = convertExecuteCommand(inputText.value)
    outputText.value = result
    if (errors.length > 0) {
      message.warning(`转换完成，但有 ${errors.length} 个错误: ${errors[0]}`, { duration: 2500 })
    } else {
      message.success('转换成功！', { duration: 1800 })
    }
  } catch (error) {
    outputText.value = ''
    message.error('转换失败：' + error.message, { duration: 1800 })
  }
}

function handleClear() {
  inputText.value = ''
  outputText.value = ''
}
</script>

<template>
  <div class="execute-tool">
    <ToolPageHeader
      :icon="ArrowTrending20Regular"
      title="语法转换"
      desc="将旧版 execute 指令语法升级为新版格式"
    />

    <!-- 输入卡片，底部收一条贯穿式操作栏 -->
    <ToolCard>
      <ToolField label="输入文本" html-for="execute-input" help="支持多行，非 execute 行原样保留">
        <ToolTextarea
          id="execute-input"
          v-model="inputText"
          placeholder="在此输入需要转换的旧版 execute 命令..."
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
      <ToolField label="转换结果" html-for="execute-output">
        <ToolTextarea
          id="execute-output"
          :model-value="outputText"
          placeholder="转换结果将显示在这里..."
          readonly
        />
      </ToolField>
    </ToolCard>
  </div>
</template>

<style scoped>
.execute-tool {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>

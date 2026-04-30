<script setup>
import { ref } from 'vue'
import { NIcon, useMessage } from 'naive-ui'
import { Copy24Regular, Delete24Regular, ArrowTrending20Regular, ConvertRange24Regular } from '@vicons/fluent'

defineProps({
  tabPath: {
    type: String,
    default: '',
  },
})

const message = useMessage()

const inputText = ref('')
const outputText = ref('')

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
  <div class="execute-tool">
    <!-- 页面主标题与简介 -->
    <div class="page-header">
      <div class="page-title-row">
        <NIcon :component="ArrowTrending20Regular" class="page-title-icon" />
        <h1 class="page-title">语法转换</h1>
      </div>
      <p class="page-desc">将旧版 execute 指令语法升级为新版格式</p>
    </div>

    <!-- 输入区卡片 -->
    <div class="tool-card">
      <textarea
        v-model="inputText"
        class="text-input"
        placeholder="在此输入需要转换的旧版 execute 命令..."
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
.execute-tool {
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

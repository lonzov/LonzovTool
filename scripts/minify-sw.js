import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const swPath = resolve(__dirname, '..', 'dist', 'sw.js')

let src = readFileSync(swPath, 'utf-8')

// 移除 /* */ 多行注释
src = src.replace(/\/\*[\s\S]*?\*\//g, '')

// 按行处理：移除行注释、空白行、缩进
const lines = src.split('\n')
const out = []

for (const line of lines) {
  // 找到不在字符串内的 // 注释位置
  let commentIdx = -1
  let inSingle = false
  let inDouble = false
  let inBacktick = false

  for (let i = 0; i < line.length - 1; i++) {
    const ch = line[i]
    const prev = i > 0 ? line[i - 1] : ''

    if (ch === "'" && !inDouble && !inBacktick && prev !== '\\') { inSingle = !inSingle; continue }
    if (ch === '"' && !inSingle && !inBacktick && prev !== '\\') { inDouble = !inDouble; continue }
    if (ch === '`' && !inSingle && !inDouble && prev !== '\\') { inBacktick = !inBacktick; continue }
    if (inSingle || inDouble || inBacktick) continue

    if (ch === '/' && line[i + 1] === '/') {
      commentIdx = i
      break
    }
  }

  const code = (commentIdx >= 0 ? line.slice(0, commentIdx) : line).trimEnd()
  if (code.trim()) out.push(code.trimStart())
}

// 合并：保留必要换行
let result = out.join('\n')

writeFileSync(swPath, result, 'utf-8')
console.log('[minify-sw]', (src.length / 1024).toFixed(1) + 'KB →', (result.length / 1024).toFixed(1) + 'KB')

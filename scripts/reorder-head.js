/**
 * 构建后脚本：将 unhead 注入的社媒/SEO meta 标签搬到 </title> 之后，
 * 使其位于所有 <style>/<script>/外联引用 之前。
 * 用法：node scripts/reorder-head.js
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { readdirSync } from 'node:fs'

const DIST = join(import.meta.dirname, '..', 'dist')

function walkDir(dir) {
  const results = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkDir(full))
    } else if (entry.name.endsWith('.html')) {
      results.push(full)
    }
  }
  return results
}

function processFile(filePath) {
  let html = readFileSync(filePath, 'utf-8')

  // unhead 注入的所有 meta/link 以 og:title 开头，以 </head> 结尾
  const ogStart = html.indexOf('<meta property="og:title"')
  if (ogStart === -1) return false

  const headEnd = html.indexOf('</head>', ogStart)
  if (headEnd === -1) return false

  // 提取 unhead 块（og:title ... canonical），不含 </head>
  const unheadBlock = html.substring(ogStart, headEnd)

  // 从原位切除（如果前面有空白符则一并切除避免空行）
  let cutStart = ogStart
  while (cutStart > 0 && /\s/.test(html[cutStart - 1])) {
    cutStart--
  }
  html = html.substring(0, cutStart) + html.substring(headEnd)

  // 找到 </title>，插入到其后
  const titleEnd = html.indexOf('</title>')
  if (titleEnd === -1) return false

  const insertAt = titleEnd + '</title>'.length
  html = html.substring(0, insertAt) + '\n' + unheadBlock + html.substring(insertAt)

  writeFileSync(filePath, html, 'utf-8')
  return true
}

const files = walkDir(DIST)
let count = 0
for (const f of files) {
  if (processFile(f)) count++
}
console.log(`[reorder-head] 处理完成: ${count}/${files.length} 个文件`)

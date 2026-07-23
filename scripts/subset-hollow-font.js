/**
 * 预构建脚本：子集化鸿蒙体 Bold，只保留空心描边效果用到的文字
 *
 * 依赖：系统已安装 HarmonyOS_Sans_SC_Bold.ttf 字体 + Python fonttools
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const ABOUT_PATH = resolve(ROOT, 'src/views/AboutView.vue')
const OUTPUT_DIR = resolve(ROOT, 'public/fonts')
const OUTPUT_FILE = resolve(OUTPUT_DIR, 'harmonyos-hollow.woff2')
const CACHE_FILE = resolve(ROOT, 'node_modules/.cache/lonzovtool/hollow-font-text.txt')

const FONT_PATH = `${process.env.LOCALAPPDATA}\\Microsoft\\Windows\\Fonts\\HarmonyOS_Sans_SC_Bold.ttf`

if (!existsSync(FONT_PATH)) {
  console.warn('[subset-font] 字体未找到，跳过:', FONT_PATH)
  process.exit(0)
}

/* 1. 从 AboutView.vue 提取描边文字 */
const about = readFileSync(ABOUT_PATH, 'utf-8')
const chars = new Set()
for (const re of [/class="w l-hollow">(.+?)<\/span>/, /class="o">(.+?)<\/span>/]) {
  const m = about.match(re)
  if (m) for (const ch of m[1]) chars.add(ch)
}
const text = [...chars].join('')

if (!text) {
  console.log('[subset-font] 未找到描边文字，跳过')
  process.exit(0)
}
console.log(`[subset-font] 描边文字: ${text} (${chars.size} 字)`)

/* 2. 文字未变化则跳过 */
if (existsSync(CACHE_FILE) && readFileSync(CACHE_FILE, 'utf-8') === text) {
  console.log('[subset-font] 文字未变化，跳过子集化')
  process.exit(0)
}

/* 3. pyftsubset 子集化 → woff2 */
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true })

const cmd = [
  'pyftsubset',
  `"${FONT_PATH}"`,
  `--text="${text}"`,
  `--output-file="${OUTPUT_FILE}"`,
  '--flavor=woff2',
  '--layout-features=""',
  '--no-hinting',
].join(' ')

console.log('[subset-font] 子集化中...')
execSync(cmd, { stdio: 'inherit', cwd: ROOT })
mkdirSync(dirname(CACHE_FILE), { recursive: true })
writeFileSync(CACHE_FILE, text, 'utf-8')
console.log('[subset-font] 完成:', OUTPUT_FILE)

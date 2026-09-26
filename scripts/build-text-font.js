/**
 * 预构建脚本：改写 unifont 点阵黑的步进，对齐游戏内排版规则
 *
 * 实际计算在 build-text-font.py（依赖 Python fontTools），这里负责调用、缓存与降级：
 * 输入只有字体文件本身和脚本里的常量，而改写是幂等的，所以两者哈希没变就直接跳过 ——
 * 单次改写要 4 分多钟，没必要每次构建都跑。没有可用 Python 时同样跳过，沿用已提交的产物。
 *
 * 注意：全角段的字形是脚本从游戏资源包的 glyph_FF.png 生成的（见 .py），换了资源包或改动了
 * 目录候选列表时，要手动删掉缓存文件 node_modules/.cache/lonzovtool/text-font-hash.txt。
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const SCRIPT = resolve(__dirname, 'build-text-font.py')
const FONT = resolve(ROOT, 'public', 'fonts', 'unifontdianzhenhei.woff2')
const CACHE = resolve(ROOT, 'node_modules', '.cache', 'lonzovtool', 'text-font-hash.txt')

let python = null
for (const candidate of ['python', 'python3']) {
  try {
    execFileSync(candidate, ['-c', 'import fontTools'], { stdio: 'ignore' })
    python = candidate
    break
  } catch {
    continue
  }
}

if (!python) {
  console.warn('[text-font] 未找到可用的 Python + fontTools，跳过改写，沿用仓库里已有的 unifontdianzhenhei.woff2')
  process.exit(0)
}

const hash = createHash('sha256').update(readFileSync(SCRIPT)).update(readFileSync(FONT)).digest('hex')
if (existsSync(CACHE) && readFileSync(CACHE, 'utf-8').trim() === hash) {
  console.log('[text-font] 字体与脚本均未变化，跳过改写')
  process.exit(0)
}

execFileSync(python, [SCRIPT], { stdio: 'inherit', cwd: ROOT })
mkdirSync(dirname(CACHE), { recursive: true })
writeFileSync(CACHE, hash + '\n')

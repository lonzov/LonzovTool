/**
 * 预构建脚本：生成 T显预览用的特殊符号字体 public/fonts/mc-symbols.woff2
 *
 * 实际计算在 build-symbol-font.py（依赖 Python fontTools），这里只负责调用，
 * 以及在没有可用 Python 时跳过 —— 产物本身是提交进仓库的，跳过不会导致构建失败。
 */

import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const SCRIPT = resolve(__dirname, 'build-symbol-font.py')

for (const python of ['python', 'python3']) {
  try {
    execFileSync(python, ['-c', 'import fontTools'], { stdio: 'ignore' })
  } catch {
    continue
  }
  execFileSync(python, [SCRIPT], { stdio: 'inherit', cwd: ROOT })
  process.exit(0)
}

console.warn('[symbol-font] 未找到可用的 Python + fontTools，跳过生成，沿用仓库里已有的 mc-symbols.woff2')

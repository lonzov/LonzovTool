import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { minify } from 'terser'

const __dirname = dirname(fileURLToPath(import.meta.url))
const swPath = resolve(__dirname, '..', 'dist', 'sw.js')

const src = readFileSync(swPath, 'utf-8')

const result = await minify(src, {
  compress: {
    drop_console: false,
    drop_debugger: true,
  },
  mangle: false,
  format: {
    comments: false,
  },
})

writeFileSync(swPath, result.code, 'utf-8')
console.log('[minify-sw]', (src.length / 1024).toFixed(1) + 'KB →', (result.code.length / 1024).toFixed(1) + 'KB')

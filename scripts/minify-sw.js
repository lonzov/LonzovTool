import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { minify } from 'terser'

const __dirname = dirname(fileURLToPath(import.meta.url))
const swPath = resolve(__dirname, '..', 'dist', 'sw.js')
const offlineHtmlPath = resolve(__dirname, '..', 'dist', 'offline', 'index.html')

let src = readFileSync(swPath, 'utf-8')

// —— 从离线页 SSG 产物中提取模块脚本 / preload / 样式 URL，注入到 SW ——
try {
  const html = readFileSync(offlineHtmlPath, 'utf-8')
  const urls = new Set()

  // <script type="module" ... src="/assets/js/app-xxx.js">
  for (const m of html.matchAll(/<script\s[^>]*type="module"[^>]*src="([^"]+)"/g)) {
    urls.add(m[1])
  }
  // <link rel="modulepreload" ... href="/assets/js/xxx.js">
  for (const m of html.matchAll(/<link\s[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g)) {
    urls.add(m[1])
  }
  // <link rel="stylesheet" ... href="/assets/css/xxx.css">
  for (const m of html.matchAll(/<link\s[^>]*rel="stylesheet"[^>]*href="([^"]+\.css)"/g)) {
    urls.add(m[1])
  }

  const arr = [...urls]
  src = src.replace("['__OFFLINE_PRECACHE_URLS__']", JSON.stringify(arr))
  console.log('[minify-sw] Injected offline precache URLs:', arr.length, 'files')
} catch (e) {
  console.warn('[minify-sw] Offline precache injection skipped:', e.message)
}

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

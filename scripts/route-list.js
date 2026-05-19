/**
 * 共享模块：从路由配置和数据目录中自动提取所有公开页面路径
 * 供 generate-seo.js 和 prerender.js 共用，避免路径列表重复
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SRC_DIR = join(ROOT, 'src')

function extractMapKeys(content, mapName) {
  const re = new RegExp(`const ${mapName} = \\{([\\s\\S]*?)\\r?\\n\\}`)
  const match = content.match(re)
  if (!match) return []
  const keys = []
  const keyRe = /^\s{2}(?:'([\w-]+)'|"([\w-]+)"|(\w+)):\s*\{/gm
  let m
  while ((m = keyRe.exec(match[1]))) {
    keys.push(m[1] || m[2] || m[3])
  }
  return keys
}

function extractStaticRoutes(content) {
  const routesIdx = content.indexOf('const routes = [')
  if (routesIdx === -1) return []
  const afterRoutes = content.slice(routesIdx)
  const pathRe = /path:\s*['"]([^'"]+)['"]/g
  const paths = []
  let m
  while ((m = pathRe.exec(afterRoutes))) {
    const p = m[1]
    if (!p.includes(':') && !p.includes('*')) {
      paths.push(p)
    }
  }
  return paths
}

export function getPages() {
  const routerContent = readFileSync(join(SRC_DIR, 'router/index.js'), 'utf-8')

  const staticRoutes = extractStaticRoutes(routerContent)
  const toolKeys = extractMapKeys(routerContent, 'TOOL_META_MAP').filter(k => k !== 'down')
  const docKeys = extractMapKeys(routerContent, 'DOCS_META_MAP')

  const downloadsDir = join(SRC_DIR, 'data/downloads')
  let downloadSlugs = []
  try {
    downloadSlugs = readdirSync(downloadsDir)
      .filter(f => f.endsWith('.json'))
      .map(f => basename(f, '.json'))
  } catch { /* 目录不存在则跳过 */ }

  return [
    ...staticRoutes,
    ...toolKeys.map(k => `/c/${k}/`),
    ...docKeys.map(k => `/docs/${k}`),
    ...downloadSlugs.map(s => `/down/${s}`),
  ]
}

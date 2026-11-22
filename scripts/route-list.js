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

/** 跳过字符串字面量（含转义与模板字符串），返回闭合引号的下标 */
function skipString(source, start) {
  const quote = source[start]
  let i = start + 1
  while (i < source.length) {
    if (source[i] === '\\') {
      i += 2
      continue
    }
    if (source[i] === quote) return i
    i += 1
  }
  return source.length - 1
}

function skipWhitespace(source, from) {
  let i = from
  while (i < source.length && /\s/.test(source[i])) i += 1
  return i
}

/** 读取 `键: '字符串'` 的值，值不是引号字符串时返回 null */
function readStringValue(source, from) {
  let i = skipWhitespace(source, from)
  if (source[i] !== ':') return null
  i = skipWhitespace(source, i + 1)
  if (source[i] !== "'" && source[i] !== '"') return null
  const end = skipString(source, i)
  return { value: source.slice(i + 1, end).replace(/\\(['"\\])/g, '$1'), end }
}

/** 是否位于 `键:` 的键位置（`paths`、`.path` 之类不算） */
function isKeyAt(source, index, key) {
  const before = source[index - 1] ?? ''
  const after = source[index + key.length] ?? ''
  return (
    source.startsWith(key, index) &&
    !/[\w$]/.test(before) &&
    !/[\w$]/.test(after)
  )
}

/**
 * 扫描 routes 数组，按嵌套层级还原页面的完整路径。
 * 子路由的 path 是相对父级的片段（如 `cards`），必须补上父级前缀；
 * 直接按字面量取会得到没有前导斜杠的路径，拼进 sitemap 后就成了 `https://域名cards/`。
 */
function extractStaticRoutes(content) {
  const routesAt = content.indexOf('const routes = [')
  if (routesAt === -1) return []
  const source = content.slice(content.indexOf('[', routesAt) + 1)

  // 路由对象按出现顺序记录，父级先于子级，解析时可以直接取父级的 resolved
  const nodes = []
  const scopes = [{ kind: 'routes', owner: null }]
  let i = 0

  while (i < source.length) {
    const ch = source[i]

    // 注释和字符串里也会出现 path/children/括号，先整体跳过
    if (ch === '/' && source[i + 1] === '/') {
      const lineEnd = source.indexOf('\n', i)
      if (lineEnd === -1) break
      i = lineEnd + 1
      continue
    }
    if (ch === '/' && source[i + 1] === '*') {
      const commentEnd = source.indexOf('*/', i + 2)
      if (commentEnd === -1) break
      i = commentEnd + 2
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      i = skipString(source, i) + 1
      continue
    }

    const scope = scopes[scopes.length - 1]

    if (ch === '{') {
      let node = null
      if (scope.kind === 'routes') node = { rawPath: null, parent: null }
      else if (scope.kind === 'children') node = { rawPath: null, parent: scope.owner }
      if (node) nodes.push(node)
      scopes.push({ kind: 'object', node, hasChildren: false })
      i += 1
      continue
    }

    if (ch === '}') {
      scopes.pop()
      i += 1
      continue
    }

    if (ch === '[') {
      if (scope.kind === 'object' && scope.hasChildren) {
        scope.hasChildren = false
        scopes.push({ kind: 'children', owner: scope.node })
      } else {
        scopes.push({ kind: 'other' })
      }
      i += 1
      continue
    }

    if (ch === ']') {
      scopes.pop()
      // routes 数组已闭合，后面的守卫代码里还有 path 字面量，不能继续扫
      if (scopes.length === 0) break
      i += 1
      continue
    }

    if (isKeyAt(source, i, 'path')) {
      const found = readStringValue(source, i + 4)
      if (found) {
        if (scope.kind === 'object' && scope.node) scope.node.rawPath = found.value
        i = found.end + 1
        continue
      }
    }

    if (isKeyAt(source, i, 'children')) {
      const colon = skipWhitespace(source, i + 8)
      if (source[colon] === ':') {
        const bracket = skipWhitespace(source, colon + 1)
        if (source[bracket] === '[' && scope.kind === 'object' && scope.node) {
          scope.hasChildren = true
          i = bracket
          continue
        }
      }
    }

    i += 1
  }

  const paths = []
  for (const node of nodes) {
    // 空 path 是嵌套路由的索引子路由，不是独立页面；动态路由不参与收录
    if (!node.rawPath || node.rawPath.includes(':') || node.rawPath.includes('*')) continue
    node.resolved = node.rawPath.startsWith('/')
      ? node.rawPath
      : `${(node.parent?.resolved ?? '').replace(/\/$/, '')}/${node.rawPath}`
    paths.push(node.resolved)
  }
  return paths
}

export function getPages() {
  const routerContent = readFileSync(join(SRC_DIR, 'router/index.js'), 'utf-8')

  // /dev/* 是仅开发环境注册的预览页，源码里仍是正则可见的静态路径，需在此排除
  const staticRoutes = extractStaticRoutes(routerContent).filter(p => !p.startsWith('/dev/'))
  const toolKeys = extractMapKeys(routerContent, 'TOOL_META_MAP').filter(k => k !== 'down')
  const docKeys = extractMapKeys(routerContent, 'DOCS_META_MAP')

  const downloadsDir = join(SRC_DIR, 'data/downloads')
  let downloadSlugs = []
  try {
    downloadSlugs = readdirSync(downloadsDir)
      .filter(f => f.endsWith('.json'))
      .map(f => basename(f, '.json'))
  } catch { /* 目录不存在则跳过 */ }

  function ensureSlash(p) {
    return p === '/' ? p : p.replace(/\/?$/, '/')
  }

  return [
    ...staticRoutes.map(ensureSlash),
    ...toolKeys.map(k => `/c/${k}/`),
    ...docKeys.map(k => `/docs/${k}/`),
    ...downloadSlugs.map(s => `/down/${s}/`),
  ]
}

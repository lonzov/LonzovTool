/**
 * 把卡片图标从后端同步到前端仓库：`/uploads/logos/*.webp` → `public/uploads/logos/*.webp`。
 *
 * 为什么要有这一步：
 * 站点的前提是"增强而非依赖"——接口挂了、或 Cloudflare 不通时，首页仍要完整可用（SW 缓存整站）。
 * 图标若只存在于后端，那一刻首页就是一排白块。图标本身极小（WebP 高 128，通常几 KB），
 * 进仓库的成本远低于失去离线能力。
 *
 * 为什么是构建期脚本而不是控制台直接提 PR：
 * 控制台是面向公网的进程，给它仓库写权限等于把供应链交给它，还绕过 review。
 * 构建期同步的产物是普通文件 diff，可审阅、可回滚，且不需要在任何服务里存仓库凭证。
 *
 * 幂等：内容相同就跳过；内容变化则覆盖（图标是"当前是哪个"的唯一事实，不保留历史版本）。
 * 后端不可达时**不失败**，沿用仓库里已有文件——构建不该因为接口没起就挂掉。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const ROOT = process.cwd()
const API_BASE = process.env.SITE_API_BASE || 'http://127.0.0.1:8010'
const TIMEOUT_MS = 15000
const LOCAL_PREFIX = '/uploads/logos/'
const UPLOADS_DIR = resolve(ROOT, 'public', 'uploads', 'logos')

async function main() {
  let cards
  try {
    const response = await fetch(`${API_BASE}/api/v1/cards`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    cards = await response.json()
  } catch (error) {
    console.warn(`[logos] 跳过同步（接口不可用：${error.message}），沿用仓库内已有图标`)
    return
  }

  const tools = (cards?.categories || []).flatMap((category) => category.tools || [])
  const wanted = new Map()
  for (const tool of tools) {
    if (tool.logo && tool.logo.startsWith(LOCAL_PREFIX) && tool.logo.endsWith('.webp')) {
      wanted.set(tool.logo, tool.title)
    }
  }

  if (!wanted.size) {
    console.log('[logos] 没有需要同步的上传图标')
    return
  }

  let written = 0
  let skipped = 0
  for (const [path, title] of wanted) {
    const target = resolve(ROOT, 'public', path.replace(/^\//, ''))
    try {
      const response = await fetch(`${API_BASE}${path}`, { signal: AbortSignal.timeout(TIMEOUT_MS) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const body = Buffer.from(await response.arrayBuffer())

      if (existsSync(target) && readFileSync(target).equals(body)) {
        skipped += 1
        continue
      }
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, body)
      written += 1
      console.log(`[logos] ${path} ← ${title}`)
    } catch (error) {
      console.warn(`[logos] ${path} 同步失败（${error.message}），沿用已有文件`)
    }
  }

  console.log(`[logos] 完成：更新 ${written}，未变 ${skipped}，共 ${wanted.size}`)

  // 清理：卡片换图后旧文件名不再被引用，仓库里不该继续留着
  pruneUnused(wanted)
}

function walk(directory, base = '') {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = base ? `${base}/${entry.name}` : entry.name
    const full = resolve(directory, entry.name)
    return entry.isDirectory() ? walk(full, relative) : [{ relative, full }]
  })
}

/** 删除 public/uploads 下已不被任何卡片引用的文件（含换图后遗留的旧哈希文件） */
function pruneUnused(wanted) {
  const keep = new Set([...wanted.keys()].map((path) => path.replace(LOCAL_PREFIX, '')))
  let removed = 0
  for (const { relative, full } of walk(UPLOADS_DIR)) {
    if (keep.has(relative)) continue
    unlinkSync(full)
    removed += 1
  }
  if (removed) console.log(`[logos] 清理过期图标 ${removed} 个`)
}

main().catch((error) => {
  // 同步是增强：任何意外都不该让构建失败
  console.warn(`[logos] 同步异常，已忽略：${error.message}`)
})

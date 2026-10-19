/**
 * 预构建脚本：从接口拉取站点动态数据，覆盖 src/data/ 下的快照文件
 *
 * 服务端数据库是唯一事实来源，仓库内这几个文件降级为生成物，禁止手工编辑。
 * 覆盖是整文件替换——快照形状与接口返回逐字段一致，前端不做字段映射
 * （对应关系见后端仓库 docs/api.md 的「载荷键与构建期快照的对应」）。
 *
 * 容错：接口不可达时沿用上一次的文件并打 warning，**始终以 0 退出**。
 * 这里绝不能失败退出：线上服务抖动会导致前端无法发布，
 * 而那正是「后端是增强不是依赖」要避免的事。
 * 缺席的键表示「保持快照值」，所以只写接口确实给出的键。
 *
 * Node 侧没有 origin，必须用绝对 base。默认指向本机后端，可用 SITE_API_BASE 覆盖。
 *
 * 排在构建链最前：它之后的预构建步骤（贡献者头像、字体子集等）都读这些数据文件，
 * 让它们处理刷新后的数据，而不是上一轮的残留。
 */

import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const API_BASE = process.env.SITE_API_BASE || 'http://127.0.0.1:8010'
const TIMEOUT_MS = 15000

// 资源键 → 接口路径 + 落地文件：与后端按资源拆分的接口一一对应
const SNAPSHOT_FILES = {
  cards: { url: '/api/v1/cards', file: 'src/data/tools.json' },
  menus: { url: '/api/v1/parent-menus', file: 'src/data/parentMenus.json' },
  notices: { url: '/api/v1/notices', file: 'src/data/notices.json' },
  donations: { url: '/api/v1/donations', file: 'src/data/donateRecords.json' },
  contributors: { url: '/api/v1/contributors', file: 'src/data/contributors.json' },
}

async function fetchResource(resource) {
  const res = await fetch(`${API_BASE}${resource.url}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`${resource.url} HTTP ${res.status}`)
  return res.json()
}

async function main() {
  const written = []

  // 各资源独立拉取：某个接口挂了不影响其它资源的快照更新
  for (const [key, resource] of Object.entries(SNAPSHOT_FILES)) {
    const data = await fetchResource(resource)
    writeFileSync(resolve(ROOT, resource.file), JSON.stringify(data, null, 2) + '\n', 'utf-8')
    written.push(key)
  }

  console.log(`[snapshot] 已更新 ${written.length}/${Object.keys(SNAPSHOT_FILES).length}: ${written.join(', ')}`)
}

main().catch((err) => {
  console.warn(`[snapshot] 拉取失败，沿用已有快照: ${err.message}`)
})

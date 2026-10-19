/**
 * 预构建脚本：从接口拉取站点动态数据，覆盖 src/data/ 下的快照文件
 *
 * 服务端数据库是唯一事实来源，仓库内这几个文件降级为生成物，禁止手工编辑。
 * 覆盖是整文件替换——快照形状与接口返回逐字段一致，前端不做字段映射
 * （对应关系见 docs/api.md 的「载荷键与构建期快照的对应」）。
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

const SNAPSHOT_FILES = {
  cards: 'src/data/tools.json',
  parent_menus: 'src/data/parentMenus.json',
  notices: 'src/data/notices.json',
  donate_records: 'src/data/donateRecords.json',
  contributors: 'src/data/contributors.json',
}

async function main() {
  const res = await fetch(`${API_BASE}/api/v1/site-data`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const payload = await res.json()
  const written = []

  for (const [key, file] of Object.entries(SNAPSHOT_FILES)) {
    if (payload[key] === undefined) continue
    writeFileSync(resolve(ROOT, file), JSON.stringify(payload[key], null, 2) + '\n', 'utf-8')
    written.push(key)
  }

  console.log(`[snapshot] version=${payload.version} 已更新 ${written.length}/${Object.keys(SNAPSHOT_FILES).length}: ${written.join(', ')}`)
}

main().catch((err) => {
  console.warn(`[snapshot] 拉取失败，沿用已有快照: ${err.message}`)
})

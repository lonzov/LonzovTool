/**
 * 预构建脚本：为配置了 qq 字段的贡献者拉取 QQ 头像
 *
 * 读取 src/data/contributors.json，对每个含 qq 字段的贡献者：
 *   1. 从 https://thirdqq.qlogo.cn/g?b=sdk&nk={qq}&s=100 拉取头像
 *   2. 为了保护隐私，以图片内容的 sha256 前 16 位命名，保存到 public/avatars/{hash}.{ext}
 *   3. 将 avatar 字段更新为 /avatars/{hash}.{ext}
 *   4. 回写 src/data/contributors.json
 *
 * 幂等：头像内容不变 → 哈希不变 → 文件已存在 → 跳过写入，json 无 diff
 * 容错：qq 未配置 → 跳过；网络失败 → 警告并保留原 avatar
 */

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const JSON_PATH = resolve(ROOT, 'src/data/contributors.json')
const AVATAR_DIR = resolve(ROOT, 'public/logos/avatars')
const QQ_AVATAR_URL = (qq) => `https://thirdqq.qlogo.cn/g?b=sdk&nk=${qq}&s=100`

/* 根据 Content-Type 推断扩展名 */
function extFromContentType(contentType) {
  if (!contentType) return 'jpg'
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('webp')) return 'webp'
  if (contentType.includes('gif')) return 'gif'
  return 'jpg'
}

async function fetchAvatar(qq) {
  const url = QQ_AVATAR_URL(qq)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const ext = extFromContentType(res.headers.get('content-type'))
  const hash = createHash('sha256').update(buf).digest('hex').slice(0, 16)
  return { buf, ext, hash, filename: `${hash}.${ext}` }
}

async function main() {
  const raw = readFileSync(JSON_PATH, 'utf-8')
  const list = JSON.parse(raw)
  if (!Array.isArray(list)) {
    console.log('[avatars] contributors.json 不是数组，跳过')
    return
  }

  if (!existsSync(AVATAR_DIR)) {
    mkdirSync(AVATAR_DIR, { recursive: true })
  }

  let updated = 0
  let skipped = 0
  let failed = 0

  for (const c of list) {
    if (!c || typeof c !== 'object') continue
    const qq = c.qq
    if (!qq) {
      skipped++
      continue
    }

    try {
      const { buf, filename } = await fetchAvatar(qq)
      const filePath = resolve(AVATAR_DIR, filename)
      const avatarPath = `/logos/avatars/${filename}`

      /* 文件已存在（哈希相同）则跳过写入 */
      if (!existsSync(filePath)) {
        writeFileSync(filePath, buf)
      }

      /* 仅当 avatar 字段变化时才标记更新 */
      if (c.avatar !== avatarPath) {
        c.avatar = avatarPath
        updated++
      }
    } catch (err) {
      console.warn(`[avatars] 拉取失败 qq=${qq}: ${err.message}`)
      failed++
    }
  }

  /* 有更新才回写 json */
  if (updated > 0) {
    writeFileSync(JSON_PATH, JSON.stringify(list, null, 2) + '\n', 'utf-8')
  }

  console.log(`[avatars] 完成: ${updated} 更新, ${skipped} 无 qq 跳过, ${failed} 失败`)
}

main().catch((err) => {
  console.error('[avatars] 脚本异常:', err)
  process.exit(1)
})

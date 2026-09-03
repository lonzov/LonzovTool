/**
 * 预构建脚本：为配置了 qq 字段的贡献者拉取 QQ 头像
 *
 * 读取 src/data/contributors.json，对每个含 qq 字段的贡献者：
 *   1. 从 https://thirdqq.qlogo.cn/g?b=sdk&nk={qq}&s=100 拉取头像
 *   2. 用 sharp 计算视觉感知哈希（dHash，8×8=64 位）作为稳定的文件名
 *   3. 归一化为 PNG 保存到 public/logos/avatars/{phash}.png
 *   4. 将 avatar 字段更新为 /logos/avatars/{phash}.png，回写 contributors.json
 *
 * 为什么用感知哈希而非内容哈希：QQ 头像接口对同一头像的 JPEG 原始字节每次请求都会
 * 变化（重编码 / 头信息变动），内容哈希必然每次都不同 → 文件名跟着变 → 服务端与
 * Service Worker 缓存全部失效。而视觉 dHash 只在 0~2 位内漂移，可稳定识别同一头像。
 *
 * 稳定策略：
 *   - 拉取后与磁盘上该贡献者旧头像比较 dHash 汉明距离，≤10 视为视觉未变 → 沿用旧文件名，
 *     不写新文件、不改 json（文件名跨构建稳定，缓存可命中）
 *   - 只有真实变化（无旧文件或距离 > 10）才写新文件并更新 avatar
 *   - 结束后 GC：删除目录中未被任何贡献者引用的头像文件，避免积累
 *
 * 容错：qq 未配置 → 跳过；网络/解码失败 → 警告并保留原 avatar
 */

import sharp from 'sharp'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const JSON_PATH = resolve(ROOT, 'src/data/contributors.json')
const AVATAR_DIR = resolve(ROOT, 'public/logos/avatars')
const QQ_AVATAR_URL = (qq) => `https://thirdqq.qlogo.cn/g?b=sdk&nk=${qq}&s=100`

// 视觉感知哈希：转灰度 → 缩放到 9×9 → 水平差分生成 8×8=64 位 dHash，输出 16 位 hex
async function computePHash(buf, hashSize = 8) {
  const size = hashSize + 1
  const px = await sharp(buf).greyscale().resize(size, size, { fit: 'fill' }).raw().toBuffer()
  let bits = ''
  for (let y = 0; y < hashSize; y++) {
    for (let x = 0; x < hashSize; x++) {
      bits += px[y * size + x] < px[y * size + x + 1] ? '1' : '0'
    }
  }
  return BigInt('0b' + bits).toString(16).padStart(16, '0')
}

// 汉明距离：两个 16 位 hex phash 的按位差异数
function hamming(a, b) {
  let n = BigInt('0x' + a) ^ BigInt('0x' + b)
  let bits = 0
  while (n > 0n) {
    bits += Number(n & 1n)
    n >>= 1n
  }
  return bits
}

const SAME_AVATAR_THRESHOLD = 10 // 距离 ≤ 10 视为同一头像（实测同人头像漂移仅 0~2）

async function fetchAvatar(qq) {
  const res = await fetch(QQ_AVATAR_URL(qq))
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

function avatarFilename(c) {
  if (!c.avatar) return null
  return c.avatar.split('/').pop() || null
}

async function main() {
  const list = JSON.parse(readFileSync(JSON_PATH, 'utf-8'))
  if (!Array.isArray(list)) {
    console.log('[avatars] contributors.json 不是数组，跳过')
    return
  }

  if (!existsSync(AVATAR_DIR)) {
    mkdirSync(AVATAR_DIR, { recursive: true })
  }

  let updated = 0
  let reused = 0
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
      const buf = await fetchAvatar(qq)
      const ph = await computePHash(buf)

      // 视觉对比：磁盘上该贡献者旧头像的 phash
      const oldName = avatarFilename(c)
      const oldPath = oldName ? resolve(AVATAR_DIR, oldName) : null
      const oldPh = oldPath && existsSync(oldPath) ? await computePHash(readFileSync(oldPath)) : null

      if (oldPh !== null && hamming(ph, oldPh) <= SAME_AVATAR_THRESHOLD) {
        // 视觉未变：沿用旧文件名/路径，不写新文件、不改 json → 文件名稳定、缓存可命中
        reused++
        continue
      }

      // 视觉有变化或尚无旧头像：归一化为 PNG 写入新文件
      const filename = `${ph}.png`
      const avatarPath = `/logos/avatars/${filename}`
      const filePath = resolve(AVATAR_DIR, filename)
      if (!existsSync(filePath)) {
        writeFileSync(filePath, await sharp(buf).png().toBuffer())
      }
      if (c.avatar !== avatarPath) {
        c.avatar = avatarPath
        updated++
      }
    } catch (err) {
      console.warn(`[avatars] 拉取/处理失败 qq=${qq}: ${err.message}`)
      failed++
    }
  }

  // GC：删除目录中未被任何贡献者引用的头像文件（跳过子目录，如 static 手工维护区）
  const referenced = new Set(list.filter((c) => c && c.avatar).map((c) => c.avatar))
  let removed = 0
  for (const f of readdirSync(AVATAR_DIR, { withFileTypes: true })) {
    if (f.isDirectory()) continue
    const name = f.name
    if (!referenced.has(`/logos/avatars/${name}`)) {
      rmSync(resolve(AVATAR_DIR, name), { force: true })
      removed++
    }
  }

  if (updated > 0) {
    writeFileSync(JSON_PATH, JSON.stringify(list, null, 2) + '\n', 'utf-8')
  }

  console.log(
    `[avatars] 完成: ${updated} 更新, ${reused} 复用(视觉未变), ${skipped} 无 qq 跳过, ${failed} 失败, 清理 ${removed} 冗余`
  )
}

main().catch((err) => {
  console.error('[avatars] 脚本异常:', err)
  process.exit(1)
})
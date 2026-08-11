/**
 * 构建时脚本：从 Minecraft 风格字形 PNG 生成紧凑雪碧图 + 码点映射
 *
 * 输入：public/sprites/glyph_E0.png (512×512, 32px/格, 16×16 逻辑网格)
 *       public/sprites/glyph_E1.png (256×256, 16px/格, 16×16 逻辑网格)
 *       public/sprites/null.png    (16×16 空字符)
 * 输出：public/sprites/glyph-pack-{hash}.png  (紧凑单行雪碧图, 32px/格, 文件名含内容哈希)
 *       src/data/glyph-map.json             ({ sprite: "glyph-pack-{hash}.png", glyphs: [...] })
 *
 * 缓存：node_modules/.cache/glyph-hash.json 记录源文件哈希，无变化时跳过构建
 *
 * 运行：node scripts/build-glyph-sprites.cjs
 */

const { PNG } = require('pngjs')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

// ===== 配置 =====
const ROOT = path.join(__dirname, '..')
const PUBLIC_SPRITES = path.join(ROOT, 'public', 'sprites')
const DATA_DIR = path.join(ROOT, 'src', 'data')
const CACHE_FILE = path.join(ROOT, 'node_modules', '.cache', 'glyph-hash.json')
const HASH_LEN = 7

const GRID_COLS = 16
const GRID_ROWS = 16
const TARGET_CELL = 32

/** 字形来源定义 */
const GLYPH_SOURCES = [
  { file: 'glyph_E0.png', cellSize: 32, codepointBase: 0xe000 },
  { file: 'glyph_E1.png', cellSize: 16, codepointBase: 0xe100 },
]

/** 参与哈希校验的源文件 */
const SOURCE_FILES = ['glyph_E0.png', 'glyph_E1.png', 'null.png']

// ===== 工具函数 =====

function readPNG(filepath) {
  return PNG.sync.read(fs.readFileSync(filepath))
}

function writePNG(filepath, png) {
  return new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(filepath)
    png.pack().pipe(ws)
    ws.on('finish', resolve)
    ws.on('error', reject)
  })
}

/** 检测一个 cell 是否完全透明（所有像素 alpha=0） */
function isCellEmpty(data, imgWidth, cellX, cellY, cellSize) {
  for (let y = 0; y < cellSize; y++) {
    for (let x = 0; x < cellSize; x++) {
      const px = cellX * cellSize + x
      const py = cellY * cellSize + y
      const idx = (py * imgWidth + px) * 4
      if (data[idx + 3] !== 0) return false
    }
  }
  return true
}

/** 复制一个 cell 到输出图像（源和目标 cell 大小相同） */
function copyCell(srcData, srcWidth, cellX, cellY, cellSize, dstData, dstWidth, dstCellX, dstCellY) {
  for (let y = 0; y < cellSize; y++) {
    const srcRowStart = ((cellY * cellSize + y) * srcWidth + cellX * cellSize) * 4
    const dstRowStart = ((dstCellY + y) * dstWidth + dstCellX * cellSize) * 4
    dstData.set(srcData.subarray(srcRowStart, srcRowStart + cellSize * 4), dstRowStart)
  }
}

/** 最近邻缩放 cell 到输出图像 */
function scaleCellNearest(srcData, srcWidth, cellX, cellY, srcCellSize, dstData, dstWidth, dstCellX, dstCellY, dstCellSize) {
  const scale = dstCellSize / srcCellSize
  for (let dy = 0; dy < dstCellSize; dy++) {
    const srcY = Math.floor(dy / scale)
    const srcRowStart = ((cellY * srcCellSize + srcY) * srcWidth + cellX * srcCellSize) * 4
    const dstRowStart = ((dstCellY + dy) * dstWidth + dstCellX * dstCellSize) * 4
    for (let dx = 0; dx < dstCellSize; dx++) {
      const srcX = Math.floor(dx / scale)
      const si = srcRowStart + srcX * 4
      const di = dstRowStart + dx * 4
      dstData[di] = srcData[si]
      dstData[di + 1] = srcData[si + 1]
      dstData[di + 2] = srcData[si + 2]
      dstData[di + 3] = srcData[si + 3]
    }
  }
}

/** 计算源文件 + 脚本自身的组合哈希 */
function getSourceHash() {
  const hash = crypto.createHash('sha256')
  for (const f of SOURCE_FILES) {
    hash.update(fs.readFileSync(path.join(PUBLIC_SPRITES, f)))
  }
  // 脚本自身变更也应使缓存失效
  hash.update(fs.readFileSync(__filename))
  return hash.digest('hex')
}

// ===== 主流程 =====
async function main() {
  // 0. 检查源文件存在
  for (const f of SOURCE_FILES) {
    const fp = path.join(PUBLIC_SPRITES, f)
    if (!fs.existsSync(fp)) {
      console.error(`错误：源文件不存在: ${fp}`)
      process.exit(1)
    }
  }

  // 1. 检查缓存
  const currentHash = getSourceHash()
  if (fs.existsSync(CACHE_FILE)) {
    const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'))
    if (cache.hash === currentHash) {
      console.log('源文件未变化，跳过构建')
      return
    }
    console.log('源文件已变化，重新构建...')
  }

  const glyphEntries = []

  // 2. 处理 glyph_E0 和 glyph_E1
  for (const src of GLYPH_SOURCES) {
    const filepath = path.join(PUBLIC_SPRITES, src.file)
    console.log(`[1/4] 读取 ${src.file} (cellSize=${src.cellSize}px)...`)
    const png = readPNG(filepath)

    let emptyCount = 0
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (isCellEmpty(png.data, png.width, col, row, src.cellSize)) {
          emptyCount++
          continue
        }

        const codepoint = src.codepointBase + row * 16 + col
        const hex = codepoint.toString(16).toUpperCase()

        glyphEntries.push({
          hex,
          codepoint,
          srcPNG: png,
          srcCellX: col,
          srcCellY: row,
          srcCellSize: src.cellSize,
        })
      }
    }
    const total = GRID_ROWS * GRID_COLS
    console.log(`  非空: ${total - emptyCount}, 空: ${emptyCount}, 总计: ${total}`)
  }

  // 3. 读取并校验空字符专用图 null.png
  console.log('[2/4] 读取并校验 null.png...')
  const nullPNG = readPNG(path.join(PUBLIC_SPRITES, 'null.png'))
  if (nullPNG.width !== 16 || nullPNG.height !== 16) {
    console.error(`错误：null.png 应为 16×16，实际为 ${nullPNG.width}×${nullPNG.height}`)
    process.exit(1)
  }

  // 4. 组装输出雪碧图（单行，每格 TARGET_CELL px）
  const nullSlot = { hex: 'a0a', codepoint: -1 }
  const allGlyphs = [...glyphEntries, nullSlot]
  const outputWidth = allGlyphs.length * TARGET_CELL
  const outputHeight = TARGET_CELL

  console.log(`[3/4] 生成雪碧图 (${outputWidth}×${outputHeight}px, ${allGlyphs.length} 个字形)...`)

  const outPNG = new PNG({ width: outputWidth, height: outputHeight })

  for (let i = 0; i < allGlyphs.length; i++) {
    const g = allGlyphs[i]
    if (g.hex === 'a0a') {
      scaleCellNearest(
        nullPNG.data, nullPNG.width, 0, 0, nullPNG.width,
        outPNG.data, outPNG.width, i, 0, TARGET_CELL,
      )
    } else if (g.srcCellSize === TARGET_CELL) {
      copyCell(
        g.srcPNG.data, g.srcPNG.width,
        g.srcCellX, g.srcCellY, TARGET_CELL,
        outPNG.data, outPNG.width, i, 0,
      )
    } else {
      scaleCellNearest(
        g.srcPNG.data, g.srcPNG.width,
        g.srcCellX, g.srcCellY, g.srcCellSize,
        outPNG.data, outPNG.width, i, 0, TARGET_CELL,
      )
    }
  }

  // 5. 写入 PNG 并计算内容哈希
  console.log('[4/4] 写入雪碧图与码点映射...')
  const tmpPng = path.join(PUBLIC_SPRITES, '.glyph-tmp.png')
  await writePNG(tmpPng, outPNG)

  // 对 PNG 文件内容取哈希前 N 位
  const pngBuf = fs.readFileSync(tmpPng)
  const contentHash = crypto.createHash('sha256').update(pngBuf).digest('hex').slice(0, HASH_LEN)
  const spriteName = `glyph-pack-${contentHash}.png`
  const spritePng = path.join(PUBLIC_SPRITES, spriteName)

  // 清理旧的 glyph-pack-*.png 和 glyph-pack*.webp（保留新文件名）
  for (const f of fs.readdirSync(PUBLIC_SPRITES)) {
    if (f !== spriteName && ((f.startsWith('glyph-pack') && (f.endsWith('.png') || f.endsWith('.webp'))))) {
      fs.unlinkSync(path.join(PUBLIC_SPRITES, f))
      console.log(`  清理旧文件: ${f}`)
    }
  }

  fs.renameSync(tmpPng, spritePng)
  console.log(`  → ${spritePng}`)

  // 码点映射 JSON（含雪碧图文件名）
  const glyphMap = allGlyphs.map((g) => g.hex)
  const jsonOut = path.join(DATA_DIR, 'glyph-map.json')
  fs.writeFileSync(jsonOut, JSON.stringify({ sprite: spriteName, glyphs: glyphMap }) + '\n')
  console.log(`  → ${jsonOut}`)

  // 写入缓存
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true })
  fs.writeFileSync(CACHE_FILE, JSON.stringify({ hash: currentHash }) + '\n')

  console.log(`\n完成！共 ${glyphMap.length} 个字形（${glyphEntries.length} 个标准 + 1 个 a0a）`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

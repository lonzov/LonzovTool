import {
  findZipEntry, readZipEntries, zipEntryBytes, zipEntryText,
} from './zip.js'

/**
 * 语言包文件读取：文本（.lang / .json）与资源包压缩包（.mcpack / .zip）两种来源。
 *
 * 资源包的目录结构由游戏规定：manifest.json 描述包本身，pack_icon.png 是缩略图，
 * texts/*.lang 才是词表。这里按后缀找文件而不写死层级 —— 导出工具常在根目录外包一层
 * 同名文件夹（如 CatLang/texts/zh_CN.lang），写死层级会直接读不到。
 */

const ICON_SIZE = 64
const decoder = new TextDecoder('utf-8')

/** 资源包名称允许带 § 格式码（游戏内会渲染颜色），列表里按纯文本展示 */
function stripFormatting(text) {
  return String(text ?? '').replace(/§[0-9a-fk-or]/gi, '').trim()
}

function baseName(fileName) {
  return String(fileName || '').replace(/\.[^.]+$/, '')
}

function formatVersion(version) {
  if (Array.isArray(version)) return version.join('.')
  return typeof version === 'string' ? version : ''
}

function isZip(buffer) {
  const head = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength))
  return head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b && (head[2] === 3 || head[2] === 5)
}

/** 二进制内容按文本解析只会得到乱码，提前拦住并给出可读的提示 */
function assertTextLike(text) {
  const sample = text.slice(0, 4096)
  if (!sample) throw new Error('文件是空的')
  let control = 0
  for (const ch of sample) {
    const code = ch.codePointAt(0)
    if (code === 0 || (code < 0x20 && code !== 9 && code !== 10 && code !== 13)) control++
  }
  if (control / sample.length > 0.02) {
    throw new Error('这不是文本文件；语言包请选择 .lang / .json，或导入资源包压缩包')
  }
}

/** 图标裁成正方形缩略图存进 meta，避免把整张 400KB 的图塞进数据库 */
async function toIconDataUrl(entry) {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return ''
  try {
    const bytes = await zipEntryBytes(entry)
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    const side = ICON_SIZE
    const scale = Math.max(side / bitmap.width, side / bitmap.height)
    const width = bitmap.width * scale
    const height = bitmap.height * scale
    const canvas = document.createElement('canvas')
    canvas.width = side
    canvas.height = side
    canvas.getContext('2d').drawImage(bitmap, (side - width) / 2, (side - height) / 2, width, height)
    bitmap.close?.()
    return canvas.toDataURL('image/png')
  } catch {
    // 图标缺失或解码失败不影响词表导入
    return ''
  }
}

/** 优先中文，其次英文，再退回任意一份（原版包通常只带 en_US） */
function pickLangEntry(entries) {
  const candidates = [...entries.keys()].filter(path => path.toLowerCase().endsWith('.lang'))
  if (!candidates.length) return null
  const rank = (path) => {
    if (/(^|\/)texts\/zh_cn\.lang$/i.test(path)) return 0
    if (/(^|\/)texts\/en_us\.lang$/i.test(path)) return 1
    if (/(^|\/)texts\//i.test(path)) return 2
    return 3
  }
  const [best] = candidates.sort((a, b) => rank(a) - rank(b) || a.length - b.length)
  return { path: best, entry: entries.get(best) }
}

async function parseArchive(buffer, fileName) {
  const entries = readZipEntries(buffer)

  const manifestEntry = findZipEntry(entries, path => path.endsWith('manifest.json'))
  if (!manifestEntry) throw new Error('资源包里没有 manifest.json，不是有效的语言包')
  let manifest
  try {
    manifest = JSON.parse(await zipEntryText(manifestEntry.entry))
  } catch {
    throw new Error('资源包的 manifest.json 无法解析')
  }
  const header = manifest?.header || {}

  const lang = pickLangEntry(entries)
  if (!lang) throw new Error('资源包里没有 texts 目录下的 .lang 词表')

  const text = await zipEntryText(lang.entry)
  assertTextLike(text)

  const iconEntry = findZipEntry(entries, path => /(^|\/)pack_icon\.(png|jpe?g)$/.test(path))
  const iconUrl = iconEntry ? await toIconDataUrl(iconEntry.entry) : ''

  return {
    text,
    source: 'pack',
    name: stripFormatting(header.name) || baseName(fileName),
    description: stripFormatting(header.description),
    version: formatVersion(header.version),
    iconUrl,
    langPath: lang.path,
  }
}

/**
 * 读取用户选择的文件。
 * @param {File} file
 * @returns {Promise<{ text: string, source: 'lang' | 'pack', name: string, description?: string, version?: string, iconUrl?: string, langPath?: string }>}
 */
export async function parseLangPackFile(file) {
  if (!file) throw new Error('没有选择文件')
  const buffer = await file.arrayBuffer()
  if (!buffer.byteLength) throw new Error('文件是空的')
  if (isZip(buffer)) return parseArchive(buffer, file.name)

  const text = decoder.decode(buffer)
  assertTextLike(text)
  return {
    text,
    source: 'lang',
    name: baseName(file.name),
    description: '',
    version: '',
    iconUrl: '',
    langPath: '',
  }
}

/**
 * 极简 ZIP 读取：只够读出资源包里的文件（store / deflate 两种压缩方式）。
 * 不支持 zip64 与加密条目 —— 资源包不会用到，遇到时给出明确错误而不是解析出半截数据。
 */

const SIG_EOCD = 0x06054b50
const SIG_CENTRAL = 0x02014b50
const SIG_LOCAL = 0x04034b50

const decoder = new TextDecoder('utf-8')

function findEndOfCentralDirectory(view) {
  // EOCD 后面可能跟着任意长度的注释，从尾部向前找签名
  const min = Math.max(0, view.byteLength - 22 - 0xffff)
  for (let i = view.byteLength - 22; i >= min; i--) {
    if (view.getUint32(i, true) === SIG_EOCD) return i
  }
  return -1
}

/**
 * 读出压缩包中央目录。
 * @param {ArrayBuffer} buffer
 * @returns {Map<string, { method: number, raw: Uint8Array, size: number }>}
 */
export function readZipEntries(buffer) {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const eocd = findEndOfCentralDirectory(view)
  if (eocd < 0) throw new Error('不是有效的 ZIP 压缩包')

  const entryCount = view.getUint16(eocd + 10, true)
  let offset = view.getUint32(eocd + 16, true)
  if (!entryCount) throw new Error('压缩包是空的')

  const entries = new Map()
  for (let i = 0; i < entryCount; i++) {
    if (offset + 46 > view.byteLength || view.getUint32(offset, true) !== SIG_CENTRAL) {
      throw new Error('压缩包目录损坏，无法读取')
    }
    const method = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const size = view.getUint32(offset + 24, true)
    const nameLen = view.getUint16(offset + 28, true)
    const extraLen = view.getUint16(offset + 30, true)
    const commentLen = view.getUint16(offset + 32, true)
    const localOffset = view.getUint32(offset + 42, true)
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLen))
    offset += 46 + nameLen + extraLen + commentLen

    if (name.endsWith('/')) continue
    if (compressedSize === 0xffffffff || size === 0xffffffff || localOffset === 0xffffffff) {
      throw new Error('暂不支持 zip64 压缩包')
    }
    if (view.getUint32(localOffset, true) !== SIG_LOCAL) {
      throw new Error('压缩包目录损坏，无法读取')
    }
    const localNameLen = view.getUint16(localOffset + 26, true)
    const localExtraLen = view.getUint16(localOffset + 28, true)
    const dataStart = localOffset + 30 + localNameLen + localExtraLen
    if (dataStart + compressedSize > bytes.byteLength) throw new Error('压缩包内容被截断')
    entries.set(name, { method, raw: bytes.subarray(dataStart, dataStart + compressedSize), size })
  }
  return entries
}

/** 解压单个条目（store 直接返回，deflate 交给浏览器原生解压流） */
export async function zipEntryBytes(entry) {
  if (!entry) throw new Error('压缩包条目不存在')
  if (entry.method === 0) return entry.raw
  if (entry.method !== 8) throw new Error(`暂不支持这种压缩方式（method ${entry.method}）`)
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('当前浏览器不支持解压，请改用解压后的 .lang 文件导入')
  }
  const stream = new Blob([entry.raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** 解压并解码为文本 */
export async function zipEntryText(entry) {
  return decoder.decode(await zipEntryBytes(entry))
}

/** 按路径后缀查找条目，可限定目录前缀；返回最浅的一层，避免嵌套备份目录抢先 */
export function findZipEntry(entries, matcher) {
  let hit = null
  let hitDepth = Infinity
  for (const [path, entry] of entries) {
    if (!matcher(path.toLowerCase())) continue
    const depth = path.split('/').length
    if (depth < hitDepth) {
      hit = { path, entry }
      hitDepth = depth
    }
  }
  return hit
}

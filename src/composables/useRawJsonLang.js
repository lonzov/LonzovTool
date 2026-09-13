import { ref, computed } from 'vue'
import { parseLangAuto, buildLookup } from '../utils/mcTranslate.js'

/**
 * T显编辑器 · 语言包（模块级单例）
 *
 * 语言包由用户自行导入（游戏 resource_pack/texts/*.lang，或 {"键":"值"} 的 JSON），
 * 一份 .lang 约 768KB / 13000 键，所以走 localforage(IndexedDB) 而不是 localStorage。
 *
 * 存储结构（key 前缀分区，新增一份包只需两次独立写入，不需要 read-modify-write 共享索引）：
 *   meta:<id>  → { id, name, source, keyCount, bytes, importedAt }
 *   data:<id>  → { entries: { 键: 值 } }
 *   state      → { version, activePackId }
 *
 * 列表页只读 meta:*，绝不 iterate() 整个 store —— 那会把每份包 768KB 的 body 全反序列化出来。
 */

const DB_NAME = 'lonzovtool-rawjson-lang'
const STORE_NAME = 'langpacks'
const KEY_STATE = 'state'
const PREFIX_META = 'meta:'
const PREFIX_DATA = 'data:'

// ========== 响应式状态 ==========
export const langPackList = ref([])
export const activePackId = ref(null)
export const langLoading = ref(false)
/** 语言包变更计数：previewHtml 读它建立响应式依赖，切换/导入/删除时自增即可触发重算 */
export const langRevision = ref(0)
/** 存储降级提示（非 IndexedDB 时给出配额风险提示） */
export const langStorageFallback = ref(false)

// 弹窗与导入表单
export const showLangModal = ref(false)
export const langImportOpen = ref(false)
export const langImportName = ref('')
/** 粘贴进来的文本 */
export const langImportText = ref('')
/** 选中的文件：文本单独存，不塞进 textarea（一份 .lang 有 13k 行，塞进去渲染会卡） */
export const langImportFileName = ref('')
export const langImportFileText = ref('')
export const langImportError = ref('')
export const langImporting = ref(false)
export const langDeleteConfirmId = ref(null)
export const langRenamingId = ref(null)
export const langRenamingName = ref('')
let deleteConfirmTimer = null

// ========== 内部状态 ==========
/** 当前生效词表。刻意用裸 Map：13k 键不需要 Vue 深度代理（放大内存 + 首次代理开销），只读不响应 */
let _activeEntries = null
let _store = null
let _lf = null

export const activePackName = computed(() =>
  langPackList.value.find(p => p.id === activePackId.value)?.name ?? '')
export const activePackKeyCount = computed(() =>
  langPackList.value.find(p => p.id === activePackId.value)?.keyCount ?? 0)
export const hasActivePack = computed(() => !!activePackId.value)

// ========== 工具 ==========

/** UTF-8 字节数（不依赖 Blob，SSR 安全） */
function utf8Bytes(str) {
  let n = 0
  for (const ch of String(str)) {
    const c = ch.codePointAt(0)
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4
  }
  return n
}

function newId() {
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function formatBytes(n) {
  if (!n) return '0 KB'
  return n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`
}

function describeStorageError(e) {
  const name = e?.name || ''
  if (name === 'QuotaExceededError' || /quota/i.test(e?.message || '')) {
    return '存储空间不足，无法保存语言包。请先删除不再使用的语言包。'
  }
  return e?.message || '本地存储写入失败'
}

// ========== localforage ==========

async function getStore() {
  // vite-ssg 预渲染跑在 jsdom 里，window/document 都存在，typeof window 判断不可靠
  if (import.meta.env.SSR) return null
  if (_store) return _store
  if (!_lf) {
    const mod = await import('localforage')
    _lf = mod.default ?? mod
  }
  _store = _lf.createInstance({
    name: DB_NAME,
    storeName: STORE_NAME,
    driver: [_lf.INDEXEDDB, _lf.LOCALSTORAGE],
  })
  try {
    langStorageFallback.value = (await _store.ready()).driver() !== _lf.INDEXEDDB
  } catch { /* 探测失败不影响使用 */ }
  return _store
}

/** 只读 meta:* 前缀，不碰 data:* */
async function loadMetas(store) {
  const keys = await store.keys()
  const metaKeys = keys.filter(k => k.startsWith(PREFIX_META))
  const metas = await Promise.all(metaKeys.map(k => store.getItem(k)))
  return metas.filter(Boolean)
}

// ========== 生命周期 ==========

export async function initLangStore() {
  if (import.meta.env.SSR) return
  try {
    const store = await getStore()
    if (!store) return
    langPackList.value = (await loadMetas(store)).sort((a, b) => b.importedAt - a.importedAt)
    const state = await store.getItem(KEY_STATE)
    const want = state?.activePackId ?? langPackList.value[0]?.id ?? null
    if (want) await activatePack(want, { persist: false })
  } catch { /* 初始化失败时预览退化为「显示键名」 */ }
}

// ========== 查找 ==========

/**
 * 供 previewHtml 使用的同步查找。未加载任何语言包时返回 null，
 * 调用方随即退化为「显示键名本身」（与游戏查不到键时的行为一致）。
 */
export function lookupTranslate(key) {
  if (!_activeEntries) return null
  const v = _activeEntries.get(key)
  return v === undefined ? null : v
}

// ========== 增删改查 ==========

export async function activatePack(id, { persist = true } = {}) {
  if (!id) return false
  if (id === activePackId.value && _activeEntries) return true
  langLoading.value = true
  try {
    const store = await getStore()
    if (!store) return false
    const rec = await store.getItem(PREFIX_DATA + id)
    if (!rec?.entries) return false
    _activeEntries = buildLookup(rec.entries)
    activePackId.value = id
    langRevision.value++
    if (persist) await store.setItem(KEY_STATE, { version: 1, activePackId: id })
    return true
  } catch {
    return false
  } finally {
    langLoading.value = false
  }
}

/**
 * 导入一份语言包并立即设为生效
 * @param {{ text: string, name?: string, source?: 'lang' | 'json' | 'paste' }} payload
 */
export async function importLangPack({ text, name, source = 'paste' }) {
  const parsed = parseLangAuto(text)
  const store = await getStore()
  if (!store) throw new Error('当前环境不支持本地存储，无法保存语言包')
  const id = newId()
  const meta = {
    id,
    name: (name || '').trim() || `语言包 ${new Date().toLocaleDateString('zh-CN')}`,
    source: parsed.format === 'json' ? 'json' : source,
    keyCount: parsed.count,
    bytes: utf8Bytes(text),
    importedAt: Date.now(),
  }
  try {
    await store.setItem(PREFIX_META + id, meta)
    await store.setItem(PREFIX_DATA + id, { entries: parsed.entries })
  } catch (e) {
    // 写 meta 成功但写 data 失败时留一条孤儿 meta，清掉
    try { await store.removeItem(PREFIX_META + id) } catch { /* ignore */ }
    throw new Error(describeStorageError(e), { cause: e })
  }
  langPackList.value = [meta, ...langPackList.value]
  await activatePack(id)
  return meta
}

export async function renamePack(id, name) {
  const trimmed = (name || '').trim()
  if (!trimmed) return false
  const idx = langPackList.value.findIndex(p => p.id === id)
  if (idx < 0) return false
  const meta = { ...langPackList.value[idx], name: trimmed }
  langPackList.value.splice(idx, 1, meta)
  try {
    const store = await getStore()
    if (store) await store.setItem(PREFIX_META + id, meta)
  } catch { /* 内存已更新，落盘失败不阻断 */ }
  return true
}

export async function deletePack(id) {
  langPackList.value = langPackList.value.filter(p => p.id !== id)
  try {
    const store = await getStore()
    if (store) {
      await store.removeItem(PREFIX_META + id)
      await store.removeItem(PREFIX_DATA + id)
    }
  } catch { /* ignore */ }
  if (activePackId.value === id) {
    _activeEntries = null
    activePackId.value = null
    langRevision.value++
    const next = langPackList.value[0]?.id ?? null
    if (next) await activatePack(next)
    else {
      try {
        const store = await getStore()
        if (store) await store.setItem(KEY_STATE, { version: 1, activePackId: null })
      } catch { /* ignore */ }
    }
  }
}

export async function clearActivePack() {
  if (!activePackId.value) return
  _activeEntries = null
  activePackId.value = null
  langRevision.value++
  try {
    const store = await getStore()
    if (store) await store.setItem(KEY_STATE, { version: 1, activePackId: null })
  } catch { /* ignore */ }
}

/** 清空所有语言包。供设置页「重置」调用（localStorage.clear() 清不掉 IndexedDB） */
export async function clearAllLangPacks() {
  try {
    const store = await getStore()
    if (store) await store.clear()
  } catch { /* ignore */ }
  langPackList.value = []
  _activeEntries = null
  activePackId.value = null
  langRevision.value++
}

// ========== 弹窗 ==========

export function openLangModal() {
  // 上一次可能通过遮罩直接关闭，这里复位所有临时状态
  clearDeleteConfirm()
  cancelRename()
  langImportError.value = ''
  langImportName.value = ''
  langImportText.value = ''
  langImportFileName.value = ''
  langImportFileText.value = ''
  // 一份语言包都没有时默认展开导入区，否则收起
  langImportOpen.value = langPackList.value.length === 0
  showLangModal.value = true
}

/** 置入选中的文件（文本单独存，不进 textarea） */
export function setImportFile(name, text) {
  langImportFileName.value = name
  langImportFileText.value = text
  langImportError.value = ''
  if (!langImportName.value.trim()) langImportName.value = name.replace(/\.[^.]+$/, '')
}

export function clearImportFile() {
  langImportFileName.value = ''
  langImportFileText.value = ''
}
export function closeLangModal() {
  showLangModal.value = false
  clearDeleteConfirm()
  langRenamingId.value = null
}

export function toggleDeleteConfirm(id) {
  if (langDeleteConfirmId.value === id) {
    clearDeleteConfirm()
    return true
  }
  clearDeleteConfirm()
  langDeleteConfirmId.value = id
  deleteConfirmTimer = setTimeout(() => { langDeleteConfirmId.value = null }, 5000)
  return false
}
function clearDeleteConfirm() {
  clearTimeout(deleteConfirmTimer)
  deleteConfirmTimer = null
  langDeleteConfirmId.value = null
}

export function startRename(id) {
  const meta = langPackList.value.find(p => p.id === id)
  langRenamingId.value = id
  langRenamingName.value = meta?.name ?? ''
}
export function cancelRename() {
  langRenamingId.value = null
  langRenamingName.value = ''
}
export async function confirmRename() {
  const id = langRenamingId.value
  if (!id) return
  const ok = await renamePack(id, langRenamingName.value)
  if (ok) cancelRename()
}

export { formatBytes }

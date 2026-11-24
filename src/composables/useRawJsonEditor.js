/*
 * 来源声明：本文件中的颜色数据表，以及校验、导入解析部分的逻辑沿用自
 * 矩阵方块 T显编译器（https://github.com/mc-str/MC-JZFK，Copyright © 2026 矩阵方块，GPLv3）。
 * 其余实现为自行编写。本项目已另行取得原作者授权（含再授权权），故本仓库整体按 Apache-2.0 分发。
 * 详见 /docs/third-party。
 */

import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useMessage } from 'naive-ui'
import { renderRawtext } from '../utils/mcTextRender.js'
import { parseJsonWithHint } from '../utils/jsonError.js'
import { copyText } from '../utils/clipboard.js'
import { lookupTranslate, langRevision } from './useRawJsonLang.js'
import { simulator } from './useRawJsonSimulator.js'
import { confirmDialog } from './useConfirm.js'

// ========== 模块级状态（单例，所有组件共享） ==========

// 颜色定义
export const colorsStandard = [
  { code: '0', color: '#000000', name: '黑色' },
  { code: '1', color: '#0000AA', name: '深蓝色' },
  { code: '2', color: '#00AA00', name: '深绿色' },
  { code: '3', color: '#00AAAA', name: '青色' },
  { code: '4', color: '#AA0000', name: '深红色' },
  { code: '5', color: '#AA00AA', name: '紫色' },
  { code: '6', color: '#FFAA00', name: '金色' },
  { code: '7', color: '#AAAAAA', name: '灰色' },
  { code: '8', color: '#555555', name: '深灰色' },
  { code: '9', color: '#5555FF', name: '蓝色' },
  { code: 'a', color: '#55FF55', name: '绿色' },
  { code: 'b', color: '#55FFFF', name: '浅青色' },
  { code: 'c', color: '#FF5555', name: '红色' },
  { code: 'd', color: '#FF55FF', name: '粉色' },
  { code: 'e', color: '#FFFF55', name: '黄色' },
  { code: 'f', color: '#FFFFFF', name: '白色' },
]

export const colorsMaterial = [
  { code: 'g', color: '#DDD605', name: 'Minecoin金' },
  { code: 'h', color: '#E3D4D1', name: '材料石英' },
  { code: 'i', color: '#CECACA', name: '材料铁' },
  { code: 'j', color: '#443A3B', name: '材料下界合金' },
  { code: 'm', color: '#971607', name: '材料红石' },
  { code: 'n', color: '#B4684D', name: '材料铜' },
  { code: 'p', color: '#DEB12D', name: '材料金' },
  { code: 'q', color: '#47A036', name: '材料绿宝石' },
  { code: 's', color: '#2CBAA8', name: '材料钻石' },
  { code: 't', color: '#21497B', name: '材料青金石' },
  { code: 'u', color: '#9A5CC6', name: '材料紫水晶' },
]

export const colorMap = {}
for (const c of [...colorsStandard, ...colorsMaterial]) {
  colorMap[c.code] = c.color
}

// 核心数据
export const data = ref([])
export const cmdType = ref('tellraw')
export const titlePos = ref('actionbar')
export const targetSel = ref('@a')
export const targetCustom = ref('@a')

// 撤销/重做
export const undoStack = ref([])
export const redoStack = ref([])

// 编辑状态
export const editIdx = ref(null)
export const insertIdx = ref(null)
export const tempWith = ref([])

// 删除确认状态（二次点击确认）
export const deleteConfirmIdx = ref(null)
let deleteConfirmTimer = null

// ========== 桌面端就地编辑 ==========
// 移动端仍走编辑弹窗；桌面端点击元素条就地展开编辑，字段直接写回元素对象。
// 同一时刻只有一条处于编辑态，下标即元素在 data 中的位置。
export const inlineIdx = ref(null)
/** 进入就地编辑时的快照：真正发生改动才压入撤销栈，只点开看一眼不占撤销位 */
let inlineSnapshot = null

/**
 * 最近一次新增的元素对象，列表据此播放插入动画。
 * 不能让列表用长度差反推：撤销/导入会整体换掉元素对象，长度不变时反推会错认成首条。
 */
export const lastAddedEl = ref(null)

/**
 * 列表行的稳定标识。就地编辑要求 DOM 节点跟着元素对象走（切换编辑行不能重建节点），
 * 上下交换的过渡动画也依赖节点在原地被移动，所以 v-for 的 key 必须绑定到对象本身。
 * 用 WeakMap 而非给数据加字段：元素会整份序列化成 rawtext，不能夹带私有字段。
 */
const elementKeys = new WeakMap()
let elementKeySeq = 0

export function getElementKey(el) {
  if (!el || typeof el !== 'object') return 'invalid'
  let key = elementKeys.get(el)
  if (key === undefined) {
    key = ++elementKeySeq
    elementKeys.set(el, key)
  }
  return key
}

// 弹窗内删除确认状态
export const withParamConfirmIdx = ref(null)
export const withElConfirmIdx = ref(null)
export const nestedWithParamConfirmIdx = ref(null)
let withParamConfirmTimer = null
let withElConfirmTimer = null
let nestedWithParamConfirmTimer = null

// 弹窗状态
export const showEditModal = ref(false)
export const showImportModal = ref(false)
export const showColorModal = ref(false)

// 编辑表单
export const editType = ref('text')
export const formText = ref('')
export const formSelector = ref('@p')
export const formScoreObj = ref('')
export const formScoreName = ref('@s')
export const formTranslateKey = ref('')

// translate with 配置
export const withMode = ref('array') // 'array' | 'object'
export const withRawtext = ref([]) // object 模式下的 rawtext 元素数组

// 嵌套编辑（with.rawtext 内元素编辑）
export const nestedIdx = ref(null) // null=不在嵌套编辑中
export const nestedType = ref('text')
export const nestedText = ref('')
export const nestedSelector = ref('@p')
export const nestedScoreObj = ref('')
export const nestedScoreName = ref('@s')
export const nestedTranslateKey = ref('')
export const nestedWithMode = ref('array')
export const nestedWith = ref([])
export const nestedWithRawtext = ref([])

// 导入
export const importText = ref('')
export const importError = ref('')

// JSON 格式化
export const jsonFormatted = ref(true)

// message 实例（由 useRawJsonEditor() 初始化）
let _msg = null


// ========== localStorage ==========
const STORAGE_KEY = 'lonzovtool-rawjson-jzfk'
const STORAGE_KEY_META = 'lonzovtool-rawjson-jzfk-meta'
let saveTimer = null

/**
 * 只保留对象型元素。null / 数字 / 字符串 / 数组出现在 rawtext 里时，
 * 任何属性访问都会直接抛异常（`Cannot read properties of null`），
 * 而 data 的来源除了编辑器本身还有导入与 localStorage，必须在入口处滤掉。
 */
function sanitizeElements(list) {
  if (!Array.isArray(list)) return []
  return list.filter(el => el && typeof el === 'object' && !Array.isArray(el))
}

function loadFromStorage() {
  try {
    // 1) 兼容 v2 旧格式：key=rawTextArray，值为纯 rawtext 数组的 JSON
    const v2Raw = localStorage.getItem('rawTextArray')
    if (v2Raw) {
      const arr = JSON.parse(v2Raw)
      if (Array.isArray(arr)) {
        const clean = sanitizeElements(arr)
        // 归一化 v2 旧数据：将字面量 \n 转为真实换行符
        for (const el of clean) {
          if (el.text !== undefined) el.text = processEscapes(el.text)
        }
        data.value = clean
        // 迁移到新格式，同时清理旧 key
        persistNow()
        localStorage.removeItem('rawTextArray')
        localStorage.removeItem('previewSettings')
        localStorage.removeItem('undoStack')
        localStorage.removeItem('redoStack')
        localStorage.removeItem('expandedDetailsPaths')
        return
      }
    }

    // 2) 新格式：jsonOutput 字符串 + 元数据分离
    const jsonStr = localStorage.getItem(STORAGE_KEY)
    const metaStr = localStorage.getItem(STORAGE_KEY_META)
    if (jsonStr) {
      const parsed = JSON.parse(jsonStr)
      if (parsed.rawtext && Array.isArray(parsed.rawtext)) {
        data.value = sanitizeElements(parsed.rawtext)
      }
      if (metaStr) {
        const meta = JSON.parse(metaStr)
        if (meta.type) cmdType.value = meta.type
        if (meta.pos) titlePos.value = meta.pos
        if (meta.target) {
          const presets = ['@s', '@a', '@r', '@p', '@e']
          if (presets.includes(meta.target)) {
            targetSel.value = meta.target
          } else {
            targetSel.value = 'custom'
            targetCustom.value = meta.target
          }
        }
      }
    }
  } catch { /* ignore */ }
}

function persistNow() {
  try {
    // 以 jsonOutput 同款纯字符串储存，不再包裹第二层 JSON.stringify
    const jsonStr = JSON.stringify({ rawtext: data.value }, null, jsonFormatted.value ? 2 : 0)
    localStorage.setItem(STORAGE_KEY, jsonStr)
    localStorage.setItem(STORAGE_KEY_META, JSON.stringify({
      type: cmdType.value,
      pos: titlePos.value,
      target: targetSel.value === 'custom' ? targetCustom.value : targetSel.value,
    }))
  } catch { /* ignore */ }
}

export function triggerSave() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(persistNow, 300)
}

// ========== 撤销/重做 ==========
function snapshot() {
  return JSON.stringify({
    data: data.value,
    cmdType: cmdType.value,
    titlePos: titlePos.value,
    targetSel: targetSel.value,
    targetCustom: targetCustom.value,
  })
}

function restoreState(json) {
  const s = JSON.parse(json)
  data.value = s.data
  lastAddedEl.value = null
  cmdType.value = s.cmdType
  titlePos.value = s.titlePos
  targetSel.value = s.targetSel
  targetCustom.value = s.targetCustom
}

export function pushUndo() {
  undoStack.value.push(snapshot())
  if (undoStack.value.length > 50) undoStack.value.shift()
  redoStack.value = []
}

/** 撤销/重做整体替换 data，就地编辑的行会失去跟踪，统一收起 */
function exitInlineEdit() {
  inlineIdx.value = null
  inlineSnapshot = null
}

export function undo() {
  if (undoStack.value.length === 0) return
  redoStack.value.push(snapshot())
  restoreState(undoStack.value.pop())
  exitInlineEdit()
  triggerSave()
}

export function redo() {
  if (redoStack.value.length === 0) return
  undoStack.value.push(snapshot())
  restoreState(redoStack.value.pop())
  exitInlineEdit()
  triggerSave()
}

// ========== 计算属性 ==========
export const isTitle = computed(() => cmdType.value === 'titleraw')

export const targetValue = computed(() =>
  targetSel.value === 'custom' ? targetCustom.value : targetSel.value
)

export const elementCount = computed(() => data.value.length)

export const modeLabel = computed(() =>
  cmdType.value === 'titleraw' ? `titleraw ${titlePos.value}` : 'tellraw'
)

// ========== 验证 ==========
/**
 * 单个元素的校验。每条错误带 field：界面据此把问题标到对应字段上，
 * msg 只写规则本身，序号与位置由调用方拼（同一行里再写一遍 #N 是噪音）。
 */
export function validateElement(el) {
  const errors = []

  if (!el || typeof el !== 'object' || Array.isArray(el)) {
    return [{ field: 'element', msg: '元素必须是对象' }]
  }

  // 与游戏一致的元素优先级：translate > text > score > selector
  if (el.translate !== undefined) {
    if (typeof el.translate !== 'string') errors.push({ field: 'translate', msg: '键名必须是字符串' })
    else if (el.translate === '') errors.push({ field: 'translate', msg: '键名不能为空' })
    if (el.with !== undefined) {
      if (Array.isArray(el.with)) {
        for (let wi = 0; wi < el.with.length; wi++) {
          if (typeof el.with[wi] !== 'string') {
            errors.push({ field: 'with', msg: `参数 ${wi + 1} 必须是字符串` })
          }
        }
      } else if (!el.with.rawtext || !Array.isArray(el.with.rawtext)) {
        errors.push({ field: 'with', msg: 'with 必须是参数数组或 rawtext 对象' })
      }
    }
  } else if (el.text !== undefined) {
    if (typeof el.text !== 'string') errors.push({ field: 'text', msg: '文本必须是字符串' })
    else if (el.text === '') errors.push({ field: 'text', msg: '文本不能为空' })
  } else if (el.selector !== undefined) {
    if (typeof el.selector !== 'string') errors.push({ field: 'selector', msg: '选择器必须是字符串' })
    else if (!el.selector.match(/^@[sarpaer](\[.*\])?$/)) errors.push({ field: 'selector', msg: '选择器需形如 @p 或 @a[...]' })
  } else if (el.score !== undefined) {
    if (!el.score || typeof el.score !== 'object') {
      errors.push({ field: 'score', msg: '记分板必须是对象' })
    } else {
      if (!el.score.name) errors.push({ field: 'score.name', msg: '记分项缺少 name' })
      if (!el.score.objective) errors.push({ field: 'score.objective', msg: '记分项缺少 objective' })
    }
  } else {
    errors.push({ field: 'type', msg: '未知的元素类型' })
  }

  return errors
}

export function validate() {
  const errors = []
  data.value.forEach((el, idx) => {
    for (const issue of validateElement(el)) errors.push({ idx, ...issue })
  })
  return { errors }
}

/** 全部校验错误。列表在展示时自己排除正在编辑的那条，编辑区按字段标红 */
export const validationResult = computed(() => validate())

/** 待修正的错误条数：顶部状态与命令卡提示共用 */
export const errorCount = computed(() => validationResult.value.errors.length)

/** 逆处理：将已处理过的文本编码回转义序列形态，用于回填编辑框 */
export function encodeEscapes(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/"/g, '\\"')
}

/** 单次遍历解析转义序列：\n → 换行、\t → 制表、\\ → \、\" → "、\uXXXX → Unicode */
export function processEscapes(str) {
  let out = ''
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '\\' && i + 1 < str.length) {
      const next = str[i + 1]
      switch (next) {
        case '\\': out += '\\'; i++; break
        case '"': out += '"'; i++; break
        case 'n': out += '\n'; i++; break
        case 't': out += '\t'; i++; break
        case 'r': out += '\r'; i++; break
        case 'b': out += '\b'; i++; break
        case 'f': out += '\f'; i++; break
        case 'u': {
          const hex = str.slice(i + 2, i + 6)
          if (/^[0-9a-fA-F]{4}$/.test(hex)) {
            out += String.fromCharCode(parseInt(hex, 16))
            i += 5
          } else {
            out += '\\u'
            i++
          }
          break
        }
        default: out += '\\' + next; i++; break
      }
    } else {
      out += str[i]
    }
  }
  return out
}

// ========== 预览输出 ==========
export const previewHtml = computed(() => {
  // 读一次 langRevision 建立响应式依赖：切换/导入/删除语言包时预览自动重算
  void langRevision.value
  return renderRawtext(data.value, {
    lookup: lookupTranslate,
    simulator: simulator.value,
  }) || '<span style="color:#AAAAAA">预览</span>'
})

export const jsonOutput = computed(() => {
  const raw = { rawtext: data.value }
  return JSON.stringify(raw, null, jsonFormatted.value ? 2 : 0)
})

export const commandOutput = computed(() => {
  const raw = { rawtext: data.value }
  const json = JSON.stringify(raw)
  const target = targetValue.value
  return cmdType.value === 'tellraw'
    ? `/tellraw ${target} ${json}`
    : `/titleraw ${target} ${titlePos.value} ${json}`
})

export const cmdLength = computed(() => commandOutput.value.length)

// ========== 元素类型辅助 ==========
export function getElType(el) {
  // 与 validate / 预览渲染保持同一优先级：translate > text > score > selector
  if (el.translate !== undefined) return 'translate'
  if (el.text !== undefined) return 'text'
  if (el.score !== undefined) return 'score'
  if (el.selector !== undefined) return 'selector'
  return 'unknown'
}

export function getElTypeLabel(el) {
  const map = { text: 'TEXT', selector: 'SEL', score: 'SCR', translate: 'TRN', unknown: 'ERR' }
  return map[getElType(el)] || 'ERR'
}

export function getElPreviewText(el) {
  const type = getElType(el)
  switch (type) {
    case 'text': { const t = el.text || ''; return t.length > 30 ? t.slice(0, 30) + '...' : t }
    case 'selector': return el.selector || ''
    case 'score': return `${el.score.objective || ''} / ${el.score.name || ''}`
    case 'translate': {
      let wl = 0
      if (Array.isArray(el.with)) wl = el.with.length
      else if (el.with?.rawtext) wl = el.with.rawtext.length
      return (el.translate || '') + (wl > 0 ? ` [${wl}]` : '')
    }
    default: return '未知类型'
  }
}

export function getElTypeClass(el) {
  const map = { text: 'type-text', selector: 'type-sel', score: 'type-scr', translate: 'type-trn', unknown: 'type-err' }
  return map[getElType(el)] || 'type-err'
}

function isElement(value) {
  return !!value && value.nodeType === 1
}

// ========== 元素操作 ==========
export function addElement(idx = null, type = 'text') {
  insertIdx.value = idx
  editIdx.value = null
  resetEditForm()
  editType.value = type
  showEditModal.value = true
}

/** 各类型的默认值：新增元素与就地切换类型共用 */
export function createElement(type = 'text') {
  switch (type) {
    case 'selector': return { selector: '@p' }
    case 'score': return { score: { name: '@s', objective: '' } }
    case 'translate': return { translate: '' }
    default: return { text: '' }
  }
}

export function startInlineEdit(idx) {
  if (inlineIdx.value === idx) return
  inlineSnapshot = snapshot()
  inlineIdx.value = idx
}

export function stopInlineEdit() {
  if (inlineIdx.value === null) return
  inlineIdx.value = null
  inlineSnapshot = null
  triggerSave()
}

export function toggleInlineEdit(idx) {
  if (inlineIdx.value === idx) stopInlineEdit()
  else startInlineEdit(idx)
}

/** 字段改动后调用：首次改动把进入时的快照压入撤销栈，并触发防抖持久化 */
export function touchInline() {
  if (inlineSnapshot) {
    undoStack.value.push(inlineSnapshot)
    if (undoStack.value.length > 50) undoStack.value.shift()
    redoStack.value = []
    inlineSnapshot = null
  }
  triggerSave()
}

/**
 * 就地切换类型：保留对象身份（DOM 节点不重建，展开状态不抖），内容按新类型重置。
 * 清空键而不是整体替换 —— 对象被替换后列表的稳定 key 会变，行会被整个重建。
 */
export function resetElementType(el, type) {
  if (getElType(el) === type) return
  touchInline()
  for (const key of Object.keys(el)) delete el[key]
  Object.assign(el, createElement(type))
}

/** 新增元素并直接进入就地编辑；idx 为插入位置，null 表示追加到末尾 */
export function addInlineElement(idx = null, type = 'text') {
  pushUndo()
  const at = idx === null ? data.value.length : Math.min(Math.max(idx, 0), data.value.length)
  const el = createElement(type)
  data.value.splice(at, 0, el)
  lastAddedEl.value = el
  // 插入点之后的元素整体后移，正在编辑的那条跟着挪一位
  if (inlineIdx.value !== null && inlineIdx.value >= at) inlineIdx.value++
  inlineIdx.value = at
  inlineSnapshot = null
  triggerSave()
  return at
}

export function editElement(idx) {
  editIdx.value = idx
  insertIdx.value = null
  const el = data.value[idx]
  const type = getElType(el)
  editType.value = type
  switch (type) {
    case 'text': formText.value = encodeEscapes(el.text || ''); break
    case 'selector': formSelector.value = el.selector || '@p'; break
    case 'score':
      formScoreObj.value = el.score?.objective || ''
      formScoreName.value = el.score?.name || '@s'
      break
    case 'translate':
      formTranslateKey.value = el.translate || ''
      if (Array.isArray(el.with)) {
        withMode.value = 'array'
        tempWith.value = el.with.map(String)
      } else if (el.with?.rawtext && Array.isArray(el.with.rawtext)) {
        withMode.value = 'object'
        withRawtext.value = el.with.rawtext.map(e => ({ ...e }))
      } else {
        withMode.value = 'array'
        tempWith.value = []
      }
      break
    default: formText.value = ''; break
  }
  showEditModal.value = true
}

export function deleteElement(idx) {
  if (deleteConfirmIdx.value === idx) {
    // 第二次点击：真正删除
    clearTimeout(deleteConfirmTimer)
    deleteConfirmIdx.value = null
    pushUndo()
    data.value.splice(idx, 1)
    if (inlineIdx.value === idx) exitInlineEdit()
    else if (inlineIdx.value !== null && inlineIdx.value > idx) inlineIdx.value--
    triggerSave()
  } else {
    // 第一次点击：进入确认状态
    clearTimeout(deleteConfirmTimer)
    deleteConfirmIdx.value = idx
    deleteConfirmTimer = setTimeout(() => {
      deleteConfirmIdx.value = null
    }, 5000)
  }
}

export function copyElement(idx) {
  pushUndo()
  const cloned = JSON.parse(JSON.stringify(data.value[idx]))
  data.value.splice(idx + 1, 0, cloned)
  lastAddedEl.value = cloned
  if (inlineIdx.value !== null && inlineIdx.value > idx) inlineIdx.value++
  triggerSave()
}

export function moveElement(idx, dir) {
  const target = dir === 'up' ? idx - 1 : idx + 1
  if (target < 0 || target >= data.value.length) return
  pushUndo()
  const temp = data.value[idx]
  data.value[idx] = data.value[target]
  data.value[target] = temp
  // 就地编辑跟着元素走：交换后两条的下标互换
  if (inlineIdx.value === idx) inlineIdx.value = target
  else if (inlineIdx.value === target) inlineIdx.value = idx
  triggerSave()
}

// ========== 编辑弹窗 ==========
function clearModalConfirmStates() {
  clearTimeout(withParamConfirmTimer)
  clearTimeout(withElConfirmTimer)
  clearTimeout(nestedWithParamConfirmTimer)
  withParamConfirmIdx.value = null
  withElConfirmIdx.value = null
  nestedWithParamConfirmIdx.value = null
}

export function resetEditForm() {
  formText.value = ''
  formSelector.value = '@p'
  formScoreObj.value = ''
  formScoreName.value = '@s'
  formTranslateKey.value = ''
  tempWith.value = []
  withMode.value = 'array'
  withRawtext.value = []
  clearModalConfirmStates()
  resetNestedForm()
}

function resetNestedForm() {
  nestedIdx.value = null
  nestedType.value = 'text'
  nestedText.value = ''
  nestedSelector.value = '@p'
  nestedScoreObj.value = ''
  nestedScoreName.value = '@s'
  nestedTranslateKey.value = ''
  nestedWithMode.value = 'array'
  nestedWith.value = []
  nestedWithRawtext.value = []
}

export function closeEditModal() {
  showEditModal.value = false
  editIdx.value = null
  insertIdx.value = null
  clearModalConfirmStates()
}

/** 按当前表单值拼出元素对象：保存与弹窗内即时校验共用同一份构造规则 */
export function buildEditElement() {
  switch (editType.value) {
    case 'text': return { text: processEscapes(formText.value) }
    case 'selector': return { selector: formSelector.value }
    case 'score':
      return { score: { name: formScoreName.value || '@s', objective: formScoreObj.value } }
    case 'translate': {
      const el = { translate: formTranslateKey.value }
      if (withMode.value === 'array') {
        // 保序且保留空串：空参数仍占一个槽位，%1/%2/%3 的对应关系才与游戏一致；
        // 首尾空格在 MC 文本里是有意义的排版，同样不做 trim
        const arr = tempWith.value.map(s => String(s ?? ''))
        if (arr.length) el.with = arr
      } else if (withRawtext.value.length) {
        el.with = { rawtext: withRawtext.value.map(e => ({ ...e })) }
      }
      return el
    }
    default: return { text: '' }
  }
}

export function saveElement() {
  pushUndo()
  const el = buildEditElement()

  if (editIdx.value !== null) data.value[editIdx.value] = el
  else if (insertIdx.value !== null) {
    data.value.splice(insertIdx.value, 0, el)
    lastAddedEl.value = el
  } else {
    data.value.push(el)
    lastAddedEl.value = el
  }

  closeEditModal()
  triggerSave()
}

export function addWithParam() { tempWith.value.push('') }
export function removeWithParam(i) {
  if (withParamConfirmIdx.value === i) {
    clearTimeout(withParamConfirmTimer)
    withParamConfirmIdx.value = null
    tempWith.value.splice(i, 1)
  } else {
    clearTimeout(withParamConfirmTimer)
    withParamConfirmIdx.value = i
    withParamConfirmTimer = setTimeout(() => { withParamConfirmIdx.value = null }, 5000)
  }
}

// ========== 嵌套编辑（with.rawtext 内元素） ==========

function buildNestedElement() {
  const type = nestedType.value
  switch (type) {
    case 'text': return { text: processEscapes(nestedText.value) }
    case 'selector': return { selector: nestedSelector.value }
    case 'score': return { score: { name: nestedScoreName.value || '@s', objective: nestedScoreObj.value } }
    case 'translate': {
      const el = { translate: nestedTranslateKey.value }
      // 同 saveElement：保序、保留空串与首尾空格
      const arr = nestedWith.value.map(s => String(s ?? ''))
      if (arr.length) el.with = arr
      return el
    }
    default: return { text: '' }
  }
}

function populateNestedForm(el) {
  const type = getElType(el)
  nestedType.value = type
  switch (type) {
    case 'text': nestedText.value = encodeEscapes(el.text || ''); break
    case 'selector': nestedSelector.value = el.selector || '@p'; break
    case 'score':
      nestedScoreObj.value = el.score?.objective || ''
      nestedScoreName.value = el.score?.name || '@s'
      break
    case 'translate':
      nestedTranslateKey.value = el.translate || ''
      nestedWith.value = Array.isArray(el.with) ? el.with.map(String) : []
      break
  }
}

export function startNestedEdit(idx) {
  if (idx !== null && idx !== undefined) {
    nestedIdx.value = idx
    populateNestedForm(withRawtext.value[idx])
  } else {
    nestedIdx.value = -1 // -1 表示新增
    resetOnlyNestedForm()
  }
}

function resetOnlyNestedForm() {
  nestedType.value = 'text'
  nestedText.value = ''
  nestedSelector.value = '@p'
  nestedScoreObj.value = ''
  nestedScoreName.value = '@s'
  nestedTranslateKey.value = ''
  nestedWithMode.value = 'array'
  nestedWith.value = []
  nestedWithRawtext.value = []
}

export function saveNestedEdit() {
  const el = buildNestedElement()
  if (nestedIdx.value >= 0) {
    withRawtext.value[nestedIdx.value] = el
  } else {
    withRawtext.value.push(el)
  }
  nestedIdx.value = null
  clearModalConfirmStates()
}

export function cancelNestedEdit() {
  nestedIdx.value = null
  clearModalConfirmStates()
}

export function deleteWithEl(idx) {
  if (withElConfirmIdx.value === idx) {
    clearTimeout(withElConfirmTimer)
    withElConfirmIdx.value = null
    withRawtext.value.splice(idx, 1)
  } else {
    clearTimeout(withElConfirmTimer)
    withElConfirmIdx.value = idx
    withElConfirmTimer = setTimeout(() => { withElConfirmIdx.value = null }, 5000)
  }
}

export function moveWithEl(idx, dir) {
  if (dir === 'up' && idx > 0) {
    const temp = withRawtext.value[idx]
    withRawtext.value[idx] = withRawtext.value[idx - 1]
    withRawtext.value[idx - 1] = temp
  } else if (dir === 'down' && idx < withRawtext.value.length - 1) {
    const temp = withRawtext.value[idx]
    withRawtext.value[idx] = withRawtext.value[idx + 1]
    withRawtext.value[idx + 1] = temp
  }
}

// 嵌套 translate 的 with 操作
export function addNestedWithParam() { nestedWith.value.push('') }
export function removeNestedWithParam(i) {
  if (nestedWithParamConfirmIdx.value === i) {
    clearTimeout(nestedWithParamConfirmTimer)
    nestedWithParamConfirmIdx.value = null
    nestedWith.value.splice(i, 1)
  } else {
    clearTimeout(nestedWithParamConfirmTimer)
    nestedWithParamConfirmIdx.value = i
    nestedWithParamConfirmTimer = setTimeout(() => { nestedWithParamConfirmIdx.value = null }, 5000)
  }
}
export function addNestedWithRawtextEl() {
  nestedWithRawtext.value.push({ text: '' })
}

// 嵌套 translate 的 with.rawtext 内元素编辑（第三层）
// 复用 nestedIdx 追踪：当嵌套 translate 的 with 为 object 时，
// 编辑其 rawtext 内元素 → 将当前元素备份，切换 nested 表单
export function startNestedWithEdit(idx) {
  // 备份当前 nested 表单状态，进入更深层编辑
  // 实际上嵌套 translate 编辑其 with.rawtext 中的元素时，
  // 我们用另一个临时数组来追踪：当前 translate 编辑的就是 nestedWithRawtext
  // 编辑其 with.rawtext 元素时，把元素数据填入 nested 表单
  if (idx !== null && idx !== undefined) {
    // 编辑已有元素
    const el = nestedWithRawtext.value[idx]
    nestedIdx.value = idx
    populateNestedForm(el)
    // 保存编辑目标：是 nestedWithRawtext 而非 withRawtext
    // 需要新增一个标记区分
  } else {
    // 添加新元素到 nestedWithRawtext
    nestedIdx.value = -1
    resetOnlyNestedForm()
  }
}

export function saveNestedWithEdit() {
  const el = buildNestedElement()
  if (nestedIdx.value >= 0) {
    nestedWithRawtext.value[nestedIdx.value] = el
  } else {
    nestedWithRawtext.value.push(el)
  }
  nestedIdx.value = null
}

export function deleteNestedWithEl(idx) {
  nestedWithRawtext.value.splice(idx, 1)
}

// ========== 导入 ==========
export function openImport() {
  importText.value = ''
  importError.value = ''
  showImportModal.value = true
}

export function closeImport() {
  showImportModal.value = false
  importText.value = ''
  importError.value = ''
}

export async function parseImport() {
  const text = importText.value.trim()
  importError.value = ''
  try {
    if (!text) throw new Error('请输入指令')
    let jsonStr = ''; let itype = 'tellraw'; let target = '@a'; let pos = 'actionbar'
    const t1 = text.match(/\/?tellraw\s+(\S+)\s+(.+)/s)
    if (t1) { target = t1[1]; jsonStr = t1[2]; itype = 'tellraw' }
    else {
      const t2 = text.match(/\/?titleraw\s+(\S+)\s+(\S+)\s+(.+)/s)
      if (t2) { target = t2[1]; pos = t2[2]; jsonStr = t2[3]; itype = 'titleraw' }
      else if (text.startsWith('{')) { jsonStr = text }
      else throw new Error('格式错误：需要 tellraw 或 titleraw 开头，或直接粘贴 JSON 对象')
    }
    // 不用裸 JSON.parse：它的报错文案各浏览器不一致，用户看不懂
    const json = parseJsonWithHint(jsonStr)
    if (!json.rawtext || !Array.isArray(json.rawtext)) throw new Error('缺少 rawtext 数组')
    const valid = sanitizeElements(json.rawtext).filter(e =>
      e.text !== undefined || e.selector !== undefined || e.score !== undefined || e.translate !== undefined
    )
    if (valid.length === 0) throw new Error('未找到有效元素')
    if (data.value.length > 0) {
      const confirmed = await confirmDialog({
        title: '导入指令',
        message: `导入将覆盖现有 ${data.value.length} 个元素，确定？`,
        confirmText: '确认导入',
        danger: true,
      })
      if (!confirmed) return
    }
    pushUndo()
    data.value = valid
    lastAddedEl.value = null
    exitInlineEdit()
    cmdType.value = itype
    if (itype === 'titleraw' && ['actionbar', 'title', 'subtitle'].includes(pos)) titlePos.value = pos
    const presets = ['@s', '@a', '@r', '@p', '@e']
    if (presets.includes(target)) targetSel.value = target
    else { targetSel.value = 'custom'; targetCustom.value = target }
    closeImport()
    triggerSave()
    if (_msg) _msg.success(`导入了 ${valid.length} 个元素`, { duration: 1800 })
  } catch (e) { importError.value = e.message }
}

// ========== 颜色表 ==========
export function openColorTable() { showColorModal.value = true }
export function closeColorTable() { showColorModal.value = false }

/** 复制 § 颜色代码；成败交给调用方就地反馈 */
export async function copyColorCode(code, container) {
  return copyText('§' + code, { container: isElement(container) ? container : undefined })
}

// ========== 工具操作 ==========
export function formatJson() { jsonFormatted.value = true }
export function minifyJson() { jsonFormatted.value = false }

/** 复制命令；成败交给调用方就地反馈 */
export async function copyCommand(container) {
  return copyText(commandOutput.value, { container: isElement(container) ? container : undefined })
}

export async function clearAll() {
  if (data.value.length === 0) return
  const confirmed = await confirmDialog({
    title: '清空元素',
    message: `清空 ${data.value.length} 个元素？`,
    confirmText: '确认清空',
    danger: true,
  })
  if (!confirmed) return
  pushUndo(); data.value = []; lastAddedEl.value = null; exitInlineEdit(); triggerSave()
}

export function loadExample() {
  pushUndo()
  data.value = [
    { text: '§e欢迎, ' }, { selector: '@p' },
    { text: ' §7| 金币: ' }, { score: { name: '*', objective: 'coin' } },
  ]
  lastAddedEl.value = null
  cmdType.value = 'titleraw'; titlePos.value = 'actionbar'; exitInlineEdit(); triggerSave()
}

export function onTargetSelChange() { triggerSave() }

// ========== 组合式函数入口 ==========
export function useRawJsonEditor() {
  // 捕获 message / notification 实例（必须在 setup 期间调用）
  _msg = useMessage()

  onMounted(() => { loadFromStorage() })
  onBeforeUnmount(() => {
    persistNow()
    clearTimeout(saveTimer)
    // 就地编辑属于视图态，模块级状态不随组件卸载清空，重新进入时必须收起
    exitInlineEdit()
  })

  return {
    // 状态
    data, cmdType, titlePos, targetSel, targetCustom,
    undoStack, redoStack,
    editIdx, insertIdx, tempWith, deleteConfirmIdx, inlineIdx,
    withParamConfirmIdx, withElConfirmIdx, nestedWithParamConfirmIdx,
    showEditModal, showImportModal, showColorModal,
    editType, formText, formSelector, formScoreObj, formScoreName, formTranslateKey,
    withMode, withRawtext,
    nestedIdx, nestedType, nestedText, nestedSelector, nestedScoreObj, nestedScoreName, nestedTranslateKey,
    nestedWithMode, nestedWith, nestedWithRawtext,
    importText, importError,
    jsonFormatted,
    // 计算属性
    isTitle, targetValue, elementCount, validationResult, errorCount,
    previewHtml, jsonOutput, commandOutput, cmdLength, modeLabel,
    // 函数
    pushUndo, undo, redo, triggerSave,
    validate,
    getElType, getElTypeLabel, getElPreviewText, getElTypeClass, getElementKey,
    addElement, editElement, deleteElement, copyElement, moveElement,
    createElement, startInlineEdit, stopInlineEdit, toggleInlineEdit,
    touchInline, resetElementType, addInlineElement,
    resetEditForm, closeEditModal, saveElement, addWithParam, removeWithParam,
    validateElement, buildEditElement,
    startNestedEdit, saveNestedEdit, cancelNestedEdit, deleteWithEl, moveWithEl,
    addNestedWithParam, removeNestedWithParam, addNestedWithRawtextEl,
    startNestedWithEdit, saveNestedWithEdit, deleteNestedWithEl,
    openImport, closeImport, parseImport,
    openColorTable, closeColorTable, copyColorCode,
    formatJson, minifyJson, copyCommand, clearAll, loadExample,
    onTargetSelChange,
  }
}

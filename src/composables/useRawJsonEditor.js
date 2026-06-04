import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useMessage } from 'naive-ui'
import { parseMinecraftTextToHtml } from '../vendor/mcfc/mcfc.js'

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

function loadFromStorage() {
  try {
    // 1) 兼容 v2 旧格式：key=rawTextArray，值为纯 rawtext 数组的 JSON
    const v2Raw = localStorage.getItem('rawTextArray')
    if (v2Raw) {
      const arr = JSON.parse(v2Raw)
      if (Array.isArray(arr)) {
        // 归一化 v2 旧数据：将字面量 \n 转为真实换行符
        for (const el of arr) {
          if (el.text !== undefined) el.text = processEscapes(el.text)
        }
        data.value = arr
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
        data.value = parsed.rawtext
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

export function undo() {
  if (undoStack.value.length === 0) return
  redoStack.value.push(snapshot())
  restoreState(undoStack.value.pop())
  triggerSave()
}

export function redo() {
  if (redoStack.value.length === 0) return
  undoStack.value.push(snapshot())
  restoreState(redoStack.value.pop())
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
export function validate() {
  const errors = []
  const warnings = []

  data.value.forEach((el, idx) => {
    const num = idx + 1

    if (el.text !== undefined) {
      if (typeof el.text !== 'string') errors.push({ idx, msg: `#${num} text 必须是字符串` })
      else if (el.text === '') errors.push({ idx, msg: `#${num} text 为空` })
    } else if (el.selector !== undefined) {
      if (typeof el.selector !== 'string') errors.push({ idx, msg: `#${num} selector 必须是字符串` })
      else if (!el.selector.match(/^@[sarpaer](\[.*\])?$/)) errors.push({ idx, msg: `#${num} selector 格式错误 (${el.selector})` })
    } else if (el.score !== undefined) {
      if (!el.score || typeof el.score !== 'object') {
        errors.push({ idx, msg: `#${num} score 必须是对象` })
      } else {
        if (!el.score.name) errors.push({ idx, msg: `#${num} score 缺少 name 字段` })
        if (!el.score.objective) errors.push({ idx, msg: `#${num} score 缺少 objective 字段` })
      }
    } else if (el.translate !== undefined) {
      if (typeof el.translate !== 'string') errors.push({ idx, msg: `#${num} translate 必须是字符串` })
      else if (el.translate === '') errors.push({ idx, msg: `#${num} translate 为空` })
      if (el.with !== undefined) {
        if (Array.isArray(el.with)) {
          for (let wi = 0; wi < el.with.length; wi++) {
            if (typeof el.with[wi] !== 'string') {
              errors.push({ idx, msg: `#${num} with[${wi}] 必须是字符串` })
            }
          }
        } else if (!el.with.rawtext || !Array.isArray(el.with.rawtext)) {
          errors.push({ idx, msg: `#${num} with.rawtext 必须是数组` })
        }
      }
    } else {
      errors.push({ idx, msg: `#${num} 未知的元素类型` })
    }
  })

  return { errors, warnings }
}

export const validationResult = computed(() => validate())

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

// ========== HTML 转义 ==========
export function escHtml(str) {
  const d = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
  return str.replace(/[&<>"']/g, c => d[c])
}

// ========== § 颜色渲染（基于 minecraft_formatting_code_online） ==========
export function col(text) {
  if (!text) return ''
  // 兼容旧数据：字面量 \n → 真实换行
  text = text.replace(/\\n/g, '\n')
  // 按换行分割，每段用 mcfc 渲染，中间插 <br>
  return text.split('\n').map(line => parseMinecraftTextToHtml(line, '#FFFFFF')).join('<br>')
}

// ========== 预览输出 ==========
export const previewHtml = computed(() => {
  let html = ''
  data.value.forEach(el => {
    if (el.text !== undefined) html += col(el.text)
    else if (el.selector !== undefined) html += `<span style="color:#999">[${escHtml(el.selector)}]</span>`
    else if (el.score !== undefined) html += '<span style="color:#999">0</span>'
    else if (el.translate !== undefined) html += `<span style="color:#999">{${escHtml(el.translate)}}</span>`
    else html += '<span style="color:#666">[错误]</span>'
  })
  return html || '<span style="color:#AAAAAA">预览</span>'
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
  if (el.text !== undefined) return 'text'
  if (el.selector !== undefined) return 'selector'
  if (el.score !== undefined) return 'score'
  if (el.translate !== undefined) return 'translate'
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

// ========== 元素操作 ==========
export function addElement(idx = null) {
  insertIdx.value = idx
  editIdx.value = null
  resetEditForm()
  editType.value = 'text'
  showEditModal.value = true
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

export function moveElement(idx, dir) {
  pushUndo()
  if (dir === 'up' && idx > 0) {
    const temp = data.value[idx]
    data.value[idx] = data.value[idx - 1]
    data.value[idx - 1] = temp
  } else if (dir === 'down' && idx < data.value.length - 1) {
    const temp = data.value[idx]
    data.value[idx] = data.value[idx + 1]
    data.value[idx + 1] = temp
  }
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

export function saveElement() {
  pushUndo()
  let el
  const type = editType.value
  switch (type) {
    case 'text': el = { text: processEscapes(formText.value) }; break
    case 'selector': el = { selector: formSelector.value }; break
    case 'score':
      el = { score: { name: formScoreName.value || '@s', objective: formScoreObj.value } }
      break
    case 'translate': {
      el = { translate: formTranslateKey.value }
      if (withMode.value === 'array') {
        const arr = tempWith.value.map(s => s.trim()).filter(Boolean)
        if (arr.length) el.with = arr
      } else {
        if (withRawtext.value.length) el.with = { rawtext: withRawtext.value.map(e => ({ ...e })) }
      }
      break
    }
    default: el = { text: '' }
  }

  if (editIdx.value !== null) data.value[editIdx.value] = el
  else if (insertIdx.value !== null) data.value.splice(insertIdx.value, 0, el)
  else data.value.push(el)

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
    case 'text': return { text: nestedText.value }
    case 'selector': return { selector: nestedSelector.value }
    case 'score': return { score: { name: nestedScoreName.value || '@s', objective: nestedScoreObj.value } }
    case 'translate': {
      const el = { translate: nestedTranslateKey.value }
      const arr = nestedWith.value.map(s => s.trim()).filter(Boolean)
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
    case 'text': nestedText.value = el.text || ''; break
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

export function parseImport() {
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
    const json = JSON.parse(jsonStr)
    if (!json.rawtext || !Array.isArray(json.rawtext)) throw new Error('缺少 rawtext 数组')
    const valid = json.rawtext.filter(e =>
      e.text !== undefined || e.selector !== undefined || e.score !== undefined || e.translate !== undefined
    )
    if (valid.length === 0) throw new Error('未找到有效元素')
    if (data.value.length > 0 && !window.confirm(`覆盖现有 ${data.value.length} 个元素?`)) return
    pushUndo()
    data.value = valid
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

export function copyColorCode(code) {
  const text = '§' + code
  navigator.clipboard.writeText(text).then(() => {
    if (_msg) _msg.success(`已复制 §${code}`, { duration: 1200 })
  }).catch(() => {
    const input = document.createElement('input')
    input.value = text
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
  })
}

// ========== 工具操作 ==========
export function formatJson() { jsonFormatted.value = true }
export function minifyJson() { jsonFormatted.value = false }

export function copyCommand() {
  const cmd = commandOutput.value
  navigator.clipboard.writeText(cmd).then(() => {
    if (_msg) _msg.success('命令已复制', { duration: 1800 })
  }).catch(() => {
    const input = document.createElement('input')
    input.value = cmd; document.body.appendChild(input)
    input.select(); document.execCommand('copy')
    document.body.removeChild(input)
  })
}

export function clearAll() {
  if (data.value.length === 0) return
  if (window.confirm(`清空 ${data.value.length} 个元素?`)) {
    pushUndo(); data.value = []; triggerSave()
  }
}

export function loadExample() {
  pushUndo()
  data.value = [
    { text: '§e欢迎, ' }, { selector: '@p' },
    { text: ' §7| 金币: ' }, { score: { name: '*', objective: 'coin' } },
  ]
  cmdType.value = 'titleraw'; titlePos.value = 'actionbar'; triggerSave()
}

export function onTargetSelChange() { triggerSave() }

// ========== 组合式函数入口 ==========
export function useRawJsonEditor() {
  // 捕获 message 实例（必须在 setup 期间调用）
  _msg = useMessage()

  onMounted(() => { loadFromStorage() })
  onBeforeUnmount(() => { persistNow(); clearTimeout(saveTimer) })

  return {
    // 状态
    data, cmdType, titlePos, targetSel, targetCustom,
    undoStack, redoStack,
    editIdx, insertIdx, tempWith, deleteConfirmIdx,
    withParamConfirmIdx, withElConfirmIdx, nestedWithParamConfirmIdx,
    showEditModal, showImportModal, showColorModal,
    editType, formText, formSelector, formScoreObj, formScoreName, formTranslateKey,
    withMode, withRawtext,
    nestedIdx, nestedType, nestedText, nestedSelector, nestedScoreObj, nestedScoreName, nestedTranslateKey,
    nestedWithMode, nestedWith, nestedWithRawtext,
    importText, importError,
    jsonFormatted,
    // 计算属性
    isTitle, targetValue, elementCount, validationResult,
    previewHtml, jsonOutput, commandOutput, cmdLength, modeLabel,
    // 函数
    pushUndo, undo, redo, triggerSave,
    validate, col, escHtml,
    getElType, getElTypeLabel, getElPreviewText, getElTypeClass,
    addElement, editElement, deleteElement, moveElement,
    resetEditForm, closeEditModal, saveElement, addWithParam, removeWithParam,
    startNestedEdit, saveNestedEdit, cancelNestedEdit, deleteWithEl, moveWithEl,
    addNestedWithParam, removeNestedWithParam, addNestedWithRawtextEl,
    startNestedWithEdit, saveNestedWithEdit, deleteNestedWithEl,
    openImport, closeImport, parseImport,
    openColorTable, closeColorTable, copyColorCode,
    formatJson, minifyJson, copyCommand, clearAll, loadExample,
    onTargetSelChange,
  }
}

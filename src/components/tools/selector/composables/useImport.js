import {
  selectorType,
  params,
  importText,
  importError,
  showImportModal,
  internals,
} from './useState.js'
import { PARAM_KINDS } from '../constants.js'
import { makeParam } from './useParams.js'
import { triggerSave } from './usePersistence.js'

// ========== 导入弹窗 ==========

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
    if (!text) throw new Error('请输入选择器参数文本')

    const match = text.match(/^@([sapre])\s*\[(.+)\]$/s)
    if (!match) throw new Error('格式错误：需要 @选择器[参数...] 格式')

    const selType = '@' + match[1]
    const body = match[2]

    const parsed = parseParamString(body)
    if (!parsed || parsed.length === 0) throw new Error('解析失败：未找到有效参数')

    if (params.value.length > 0 && !window.confirm(`覆盖现有 ${params.value.length} 个参数?`)) return

    selectorType.value = selType
    params.value = parsed
    closeImport()
    triggerSave()
    if (internals.msg) internals.msg.success(`导入了 ${parsed.length} 个参数`, { duration: 1800 })
  } catch (e) {
    importError.value = e.message
  }
}

// ========== 解析器 ==========

/**
 * 解析参数字符串主体（[] 内部内容）
 */
function parseParamString(str) {
  const result = []
  let i = 0

  while (i < str.length) {
    while (i < str.length && /[\s,]/.test(str[i])) i++
    if (i >= str.length) break

    let key = ''
    while (i < str.length && !/[\s=,]/.test(str[i])) {
      key += str[i]; i++
    }
    key = key.trim()
    if (!key) break

    while (i < str.length && /[\s=]/.test(str[i])) i++

    const valResult = parseImportValue(str, i)
    if (!valResult) break

    const param = importValueToParam(key, valResult)
    result.push(param)
    i = valResult.endIndex
  }

  return result
}

function parseImportValue(str, startI) {
  if (startI >= str.length) return null
  let i = startI

  while (i < str.length && /[\s]/.test(str[i])) i++
  if (i >= str.length) return null

  const ch = str[i]

  let not = false
  if (ch === '!') {
    not = true
    i++
    while (i < str.length && /[\s]/.test(str[i])) i++
  }

  if (i >= str.length) return null

  // 字符串
  if (str[i] === '"' || str[i] === '\'') {
    const quote = str[i]
    i++
    let val = ''
    while (i < str.length && str[i] !== quote) {
      if (str[i] === '\\' && i + 1 < str.length) {
        val += str[i + 1]; i += 2
      } else {
        val += str[i]; i++
      }
    }
    i++
    return { type: 'string', value: val, not, endIndex: i }
  }

  // 数组 [...]
  if (str[i] === '[') {
    i++
    const items = []
    while (i < str.length) {
      while (i < str.length && /[\s,]/.test(str[i])) i++
      if (i >= str.length || str[i] === ']') break
      if (str[i] === '{') {
        const objResult = parseImportObject(str, i)
        if (objResult) {
          items.push(objResult.fields)
          i = objResult.endIndex
        } else break
      } else break
    }
    while (i < str.length && str[i] !== ']') i++
    if (str[i] === ']') i++
    return { type: 'hasitem', value: '', not, hasitemItems: items, hasitemIsArray: true, endIndex: i }
  }

  // 对象 {...}
  if (str[i] === '{') {
    const objResult = parseImportObject(str, i)
    if (objResult) {
      return { type: 'object', value: '', not, fields: objResult.fields, endIndex: objResult.endIndex }
    }
  }

  // 布尔值
  if (str.slice(i, i + 4) === 'true') {
    return { type: 'boolean', value: 'true', not, endIndex: i + 4 }
  }
  if (str.slice(i, i + 5) === 'false') {
    return { type: 'boolean', value: 'false', not, endIndex: i + 5 }
  }

  // 数字
  const numMatch = str.slice(i).match(/^-?\d+(\.\d+)?/)
  if (numMatch) {
    return { type: 'number', value: numMatch[0], not, endIndex: i + numMatch[0].length }
  }

  // 无引号字符串（回退）
  let val = ''
  while (i < str.length && !/[,}\]]/.test(str[i])) {
    val += str[i]; i++
  }
  val = val.trim()
  return { type: 'string', value: val, not, endIndex: i }
}

function parseImportObject(str, startI) {
  let i = startI
  if (str[i] === '{') i++

  const fields = {}
  while (i < str.length) {
    while (i < str.length && /[\s,]/.test(str[i])) i++
    if (i >= str.length || str[i] === '}') break

    let fKey = ''
    while (i < str.length && !/[\s=,}]/.test(str[i])) {
      fKey += str[i]; i++
    }
    fKey = fKey.trim()
    if (!fKey) break

    while (i < str.length && /[\s=]/.test(str[i])) i++

    const fv = parseImportValue(str, i)
    if (fv) {
      fields[fKey] = fv.value !== undefined ? fv.value : ''
      i = fv.endIndex
    } else break
  }

  if (str[i] === '}') i++
  return { fields, endIndex: i }
}

// ========== 导入值 → 参数对象 ==========

/**
 * 将导入解析出的键值对转为内部参数对象
 */
function importValueToParam(key, valResult) {
  const knownKind = Object.keys(PARAM_KINDS).find(k => PARAM_KINDS[k].label === key)

  if (knownKind) {
    const editor = PARAM_KINDS[knownKind].editor
    const p = makeParam(knownKind, { not: valResult.not || false })

    switch (editor) {
      case 'name':
      case 'tag':
      case 'text-not':
      case 'text':
        p.value = valResult.value || ''
        break
      case 'gamemode':
        p.value = valResult.value || 'survival'
        break
      case 'scores':
      case 'has_property':
        if (valResult.type === 'object' && valResult.fields) {
          p.value = Object.entries(valResult.fields).map(([k, v]) => `${k}=${v}`).join(',')
        } else {
          p.value = valResult.value || ''
        }
        break
      case 'hasitem':
        if (valResult.hasitemItems && valResult.hasitemItems.length) {
          p.hasitemItems = valResult.hasitemItems.map(fields => ({
            item: fields.item || '',
            data: fields.data || '',
            location: fields.location || '',
            slot: fields.slot || '',
            quantity: fields.quantity || '',
          }))
          p.hasitemIsArray = true
        } else if (valResult.fields) {
          p.hasitemItems = [{
            item: valResult.fields.item || '',
            data: valResult.fields.data || '',
            location: valResult.fields.location || '',
            slot: valResult.fields.slot || '',
            quantity: valResult.fields.quantity || '',
          }]
          p.hasitemIsArray = false
        }
        break
      case 'haspermission':
        if (valResult.fields) {
          p.permCamera = valResult.fields.camera || null
          p.permMovement = valResult.fields.movement || null
        }
        break
    }
    return p
  }

  return makeParam('custom', { customKey: key, value: valResult.value || '', not: valResult.not || false })
}

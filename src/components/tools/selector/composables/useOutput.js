import { computed } from 'vue'
import { selectorType, params, internals } from './useState.js'
import { cancelEdit, cancelAdd } from './useParams.js'
import { makeParam } from './useParams.js'
import { getParamKey, getParamEditor } from './useParams.js'
import { triggerSave } from './usePersistence.js'

// ========== 字符串转义 ==========

function escapeStr(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

// ========== hasitem 格式化 ==========

/** 格式化单个 hasitem 条目 */
function formatHasitemItem(item, compact) {
  const parts = []
  if (item.item) parts.push(`item=${item.item}`)
  if (item.data) parts.push(`data=${item.data}`)
  if (item.location) parts.push(`location=${item.location}`)
  if (item.slot) parts.push(`slot=${item.slot}`)
  if (item.quantity) parts.push(`quantity=${item.quantity}`)
  return compact ? parts.join(',') : parts.join(', ')
}

/** 格式化 hasitem 值 */
function formatHasitemValue(param, compact) {
  if (!param.hasitemItems || param.hasitemItems.length === 0) {
    return param.hasitemIsArray ? '[]' : '{}'
  }
  if (param.hasitemIsArray) {
    const inner = param.hasitemItems.map(it => '{' + formatHasitemItem(it, compact) + '}').join(compact ? ',' : ', ')
    return '[' + inner + ']'
  }
  return '{' + formatHasitemItem(param.hasitemItems[0], compact) + '}'
}

/** 格式化 haspermission 值 */
function formatHaspermissionValue(param, compact) {
  const parts = []
  if (param.permCamera) parts.push(`camera=${param.permCamera}`)
  if (param.permMovement) parts.push(`movement=${param.permMovement}`)
  if (parts.length === 0) return '{}'
  const sep = compact ? ',' : ', '
  return '{' + parts.join(sep) + '}'
}

// ========== 取值显示/输出 ==========

/** 获取参数值的显示/输出文本 */
export function getParamValueText(param, compact = false) {
  switch (getParamEditor(param)) {
    case 'name': {
      const v = param.value || ''
      if (param.not) return v ? '!"' + escapeStr(v) + '"' : '!""'
      return '"' + escapeStr(v) + '"'
    }
    case 'tag': {
      const v = param.value || ''
      if (param.not) return v ? '!' + v : '!'
      return v || '""'
    }
    case 'text-not': {
      const v = param.value || ''
      return param.not ? '!' + v : v
    }
    case 'gamemode': {
      return param.value || 'survival'
    }
    case 'scores': {
      const v = param.value || ''
      return '{' + v + '}'
    }
    case 'has_property': {
      const v = param.value || ''
      return '{' + v + '}'
    }
    case 'hasitem': {
      return formatHasitemValue(param, compact)
    }
    case 'haspermission': {
      return formatHaspermissionValue(param, compact)
    }
    case 'text':
    default: {
      return param.value || ''
    }
  }
}

// ========== 输出 ==========

/** 生成完整的格式化选择器字符串 */
export const formattedOutput = computed(() => {
  const lines = []
  lines.push(selectorType.value + ' [')

  for (const p of params.value) {
    const key = getParamKey(p)
    const val = getParamValueText(p, false)
    lines.push('    ' + key + ' = ' + val + ',')
  }

  if (lines.length === 1) {
    return selectorType.value + ' []'
  }

  const lastIdx = lines.length - 1
  lines[lastIdx] = lines[lastIdx].replace(/,$/, '')

  lines.push(']')
  return lines.join('\n')
})

/** 生成压缩的选择器字符串 */
export const compactOutput = computed(() => {
  const parts = params.value.map(p => {
    const key = getParamKey(p)
    const val = getParamValueText(p, true)
    return key + '=' + val
  })
  return selectorType.value + '[' + parts.join(',') + ']'
})

// ========== 复制（导出） ==========

export function copyOutput() {
  const text = compactOutput.value
  navigator.clipboard.writeText(text).then(() => {
    if (internals.msg) internals.msg.success('选择器已复制到剪贴板', { duration: 1800 })
  }).catch(() => {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  })
}

// ========== 清空 ==========

export function clearAll() {
  if (params.value.length === 0) return
  if (window.confirm(`清空所有 ${params.value.length} 个参数?`)) {
    params.value = []
    cancelEdit()
    cancelAdd()
    triggerSave()
  }
}

// ========== 示例 ==========

export function loadExample() {
  if (params.value.length > 0 && !window.confirm('加载示例将覆盖当前内容，确定?')) return
  selectorType.value = '@a'
  params.value = [
    makeParam('name', { value: 'Steve' }),
    makeParam('tag', { value: 'admin' }),
    makeParam('scores', { value: 'money=1..' }),
    makeParam('m', { value: 'survival' }),
    makeParam('hasitem', {
      hasitemItems: [
        { item: 'torch', data: '0', location: 'slot.weapon.mainhand', slot: '0', quantity: '1' },
      ],
      hasitemIsArray: true,
    }),
  ]
  triggerSave()
}

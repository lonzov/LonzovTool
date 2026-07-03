import {
  params,
  editingId,
  editNot,
  editValue,
  editCustomKey,
  editPermCamera,
  editPermMovement,
  addingParam,
  newKind,
  newCustomKey,
  newValue,
  newNot,
  newHasitemItems,
  newHasitemIsArray,
  newPermCamera,
  newPermMovement,
  deleteConfirmId,
  hasitemEditId,
  hasitemEditItems,
  hasitemEditIsArray,
  hasitemEditIsAdd,
  haspermissionEditId,
  haspermissionEditIsAdd,
  haspermissionEditCamera,
  haspermissionEditMovement,
  coordCalcModalOpen,
  coordCalcStart,
  coordCalcEnd,
  internals,
} from './useState.js'
import { PARAM_KINDS } from '../constants.js'
import { triggerSave } from './usePersistence.js'

// ========== 辅助 ==========

function genId() {
  return `sp_${++internals.idSeq}_${Date.now().toString(36)}`
}

/** 创建参数对象 */
export function makeParam(kind, overrides = {}) {
  const base = {
    id: genId(),
    kind,
    customKey: '',
    value: '',
    not: false,
    hasitemItems: [],
    hasitemIsArray: true,
    permCamera: null,
    permMovement: null,
  }
  return { ...base, ...overrides }
}

/** 获取参数显示用的 key 名称 */
export function getParamKey(param) {
  if (param.kind === 'custom') return param.customKey || '(未命名)'
  const def = PARAM_KINDS[param.kind]
  return def ? def.label : param.kind
}

/** 获取参数的编辑器类型 */
export function getParamEditor(param) {
  if (param.kind === 'custom') return 'text'
  const def = PARAM_KINDS[param.kind]
  return def ? def.editor : 'text'
}

// ========== 编辑流程 ==========

export function startEdit(id) {
  editingId.value = id
}

export function cancelEdit() {
  editingId.value = null
}

/** 用本地编辑缓冲区值保存编辑 */
export function saveEdit() {
  if (!editingId.value) return
  finishEdit(editingId.value, {
    value: editValue.value,
    not: editNot.value,
    customKey: editCustomKey.value,
    permCamera: editPermCamera.value,
    permMovement: editPermMovement.value,
  })
}

/** 开始编辑：从参数填充编辑缓冲区，设置 editingId */
export function beginEdit(id) {
  commitCurrentState()
  const p = params.value.find((p) => p.id === id)
  if (!p) return
  editNot.value = p.not || false
  editValue.value = p.value || ''
  editCustomKey.value = p.customKey || ''
  editPermCamera.value = p.permCamera
  editPermMovement.value = p.permMovement
  startEdit(id)
}

/** 确保提交当前编辑/添加状态，再切换到新模式 */
export function commitCurrentState() {
  if (editingId.value) {
    saveEdit()
  }
  if (addingParam.value) {
    if (newKind.value === 'custom' && !newCustomKey.value.trim()) {
      cancelAdd()
    } else {
      confirmAdd()
    }
  }
}

/** 保存编辑到参数 */
export function finishEdit(id, updates) {
  const idx = params.value.findIndex(p => p.id === id)
  if (idx === -1) return
  Object.assign(params.value[idx], updates)
  editingId.value = null
  triggerSave()
}

// ========== 添加参数 ==========

export function startAdd() {
  cancelEdit()
  addingParam.value = true
  newKind.value = 'name'
  newCustomKey.value = ''
  newValue.value = ''
  newNot.value = false
  newHasitemItems.value = []
  newHasitemIsArray.value = false
  newPermCamera.value = null
  newPermMovement.value = null
}

export function cancelAdd() {
  addingParam.value = false
}

export function confirmAdd() {
  const kind = newKind.value
  if (kind === 'custom' && !newCustomKey.value.trim()) return

  const p = makeParam(kind, {
    customKey: kind === 'custom' ? newCustomKey.value.trim() : '',
    value: newValue.value,
    not: newNot.value,
    hasitemItems: kind === 'hasitem' ? [...newHasitemItems.value] : [],
    hasitemIsArray: kind === 'hasitem' ? newHasitemIsArray.value : true,
    permCamera: kind === 'haspermission' ? newPermCamera.value : null,
    permMovement: kind === 'haspermission' ? newPermMovement.value : null,
  })

  params.value.push(p)
  cancelAdd()
  triggerSave()
}

// ========== 删除参数 ==========

export function deleteParam(id) {
  if (deleteConfirmId.value === id) {
    clearTimeout(internals.deleteConfirmTimer)
    deleteConfirmId.value = null
    if (editingId.value === id) cancelEdit()
    const idx = params.value.findIndex(p => p.id === id)
    if (idx !== -1) params.value.splice(idx, 1)
    triggerSave()
  } else {
    clearTimeout(internals.deleteConfirmTimer)
    deleteConfirmId.value = id
    internals.deleteConfirmTimer = setTimeout(() => {
      deleteConfirmId.value = null
    }, 5000)
  }
}

// ========== hasitem 子项编辑 ==========

export function openHasitemEditor(id) {
  const p = params.value.find(p => p.id === id)
  if (!p || p.kind !== 'hasitem') return
  hasitemEditId.value = id
  hasitemEditIsAdd.value = false
  hasitemEditItems.value = JSON.parse(JSON.stringify(p.hasitemItems || []))
  hasitemEditIsArray.value = p.hasitemIsArray
}

export function closeHasitemEditor() {
  hasitemEditId.value = null
  hasitemEditIsAdd.value = false
}

/** 动画结束后清理编辑数据（由 useModalContent 的 onAfterLeave 调用） */
export function cleanupHasitemModal() {
  hasitemEditItems.value = []
  hasitemEditIsArray.value = true
}

export function saveHasitemEditor() {
  const p = params.value.find(p => p.id === hasitemEditId.value)
  if (!p) return
  p.hasitemItems = JSON.parse(JSON.stringify(hasitemEditItems.value))
  p.hasitemIsArray = hasitemEditIsArray.value
  closeHasitemEditor()
  triggerSave()
}

export function addHasitemSubItem() {
  hasitemEditItems.value.push({ item: '', data: '', location: '', slot: '', quantity: '' })
}

export function removeHasitemSubItem(idx) {
  hasitemEditItems.value.splice(idx, 1)
}

// 添加模式下 hasitem 子项
export function addNewHasitemSubItem() {
  newHasitemItems.value.push({ item: '', data: '', location: '', slot: '', quantity: '' })
}

export function removeNewHasitemSubItem(idx) {
  newHasitemItems.value.splice(idx, 1)
}

// ========== hasitem 添加模式弹窗 ==========

export function openHasitemAddModal() {
  hasitemEditId.value = '__add__'
  hasitemEditIsAdd.value = true
  hasitemEditItems.value = JSON.parse(JSON.stringify(newHasitemItems.value))
  hasitemEditIsArray.value = newHasitemIsArray.value
}

export function closeHasitemAddModal() {
  hasitemEditId.value = null
  hasitemEditIsAdd.value = false
}

export function saveHasitemAddModal() {
  newHasitemItems.value = JSON.parse(JSON.stringify(hasitemEditItems.value))
  newHasitemIsArray.value = hasitemEditIsArray.value
  closeHasitemAddModal()
}

// ========== haspermission 子项编辑 ==========

export function openHaspermissionEditor(id) {
  const p = params.value.find(p => p.id === id)
  if (!p || p.kind !== 'haspermission') return
  haspermissionEditId.value = id
  haspermissionEditIsAdd.value = false
  haspermissionEditCamera.value = p.permCamera
  haspermissionEditMovement.value = p.permMovement
}

export function closeHaspermissionEditor() {
  haspermissionEditId.value = null
  haspermissionEditIsAdd.value = false
}

/** 动画结束后清理编辑数据（由 useModalContent 的 onAfterLeave 调用） */
export function cleanupHaspermissionModal() {
  haspermissionEditCamera.value = null
  haspermissionEditMovement.value = null
}

export function saveHaspermissionEditor() {
  const p = params.value.find(p => p.id === haspermissionEditId.value)
  if (!p) return
  p.permCamera = haspermissionEditCamera.value
  p.permMovement = haspermissionEditMovement.value
  closeHaspermissionEditor()
  triggerSave()
}

// ========== haspermission 添加模式弹窗 ==========

export function openHaspermissionAddModal() {
  haspermissionEditId.value = '__add__'
  haspermissionEditIsAdd.value = true
  haspermissionEditCamera.value = newPermCamera.value
  haspermissionEditMovement.value = newPermMovement.value
}

export function closeHaspermissionAddModal() {
  haspermissionEditId.value = null
  haspermissionEditIsAdd.value = false
}

export function saveHaspermissionAddModal() {
  newPermCamera.value = haspermissionEditCamera.value
  newPermMovement.value = haspermissionEditMovement.value
  closeHaspermissionAddModal()
}

// ========== 坐标自动计算弹窗 ==========

export function openCoordCalcModal() {
  coordCalcStart.x = ''
  coordCalcStart.y = ''
  coordCalcStart.z = ''
  coordCalcEnd.x = ''
  coordCalcEnd.y = ''
  coordCalcEnd.z = ''
  coordCalcModalOpen.value = true
}

export function closeCoordCalcModal() {
  coordCalcModalOpen.value = false
}

const COORD_KEYS = ['x', 'y', 'z', 'dx', 'dy', 'dz']

function doCoordCalcAdd() {
  const sx = Number(coordCalcStart.x) || 0
  const sy = Number(coordCalcStart.y) || 0
  const sz = Number(coordCalcStart.z) || 0
  const ex = Number(coordCalcEnd.x) || 0
  const ey = Number(coordCalcEnd.y) || 0
  const ez = Number(coordCalcEnd.z) || 0

  const dx = ex - sx
  const dy = ey - sy
  const dz = ez - sz

  // 移除已有的坐标参数
  params.value = params.value.filter(p => !COORD_KEYS.includes(p.kind))

  params.value.push(
    makeParam('x', { value: String(sx) }),
    makeParam('y', { value: String(sy) }),
    makeParam('z', { value: String(sz) }),
    makeParam('dx', { value: String(dx) }),
    makeParam('dy', { value: String(dy) }),
    makeParam('dz', { value: String(dz) }),
  )

  closeCoordCalcModal()
  triggerSave()
}

export function confirmCoordCalc() {
  // 关闭当前编辑/添加状态
  cancelEdit()
  cancelAdd()

  // 检查哪些坐标参数已存在
  const existingKeys = COORD_KEYS.filter(key =>
    params.value.some(p => p.kind === key)
  )

  if (existingKeys.length > 0) {
    const duplicateNames = existingKeys.join('、')
    if (!confirm(`继续添加将覆盖以下参数，是否确认覆盖？\n${duplicateNames}`)) {
      return
    }
  }

  doCoordCalcAdd()
}

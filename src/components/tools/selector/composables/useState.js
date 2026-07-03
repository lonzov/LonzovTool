import { ref, reactive } from 'vue'

// ========== 选择器类型 ==========
export const selectorType = ref('@a')

// ========== 参数列表 ==========
export const params = ref([])

// ========== 编辑状态 ==========
export const editingId = ref(null)

// 编辑缓冲区（beginEdit 填充，saveEdit 提交）
export const editNot = ref(false)
export const editValue = ref('')
export const editCustomKey = ref('')
export const editPermCamera = ref(null)
export const editPermMovement = ref(null)

// ========== 添加状态 ==========
export const addingParam = ref(false)
export const newKind = ref('name')
export const newCustomKey = ref('')
export const newValue = ref('')
export const newNot = ref(false)
// hasitem 添加专用
export const newHasitemItems = ref([])
export const newHasitemIsArray = ref(false)
// haspermission 添加专用
export const newPermCamera = ref(null)
export const newPermMovement = ref(null)

// ========== 删除确认 ==========
export const deleteConfirmId = ref(null)

// ========== 导入 ==========
export const importText = ref('')
export const importError = ref('')
export const showImportModal = ref(false)

// ========== hasitem 子编辑弹窗 ==========
export const hasitemEditId = ref(null)
export const hasitemEditItems = ref([])
export const hasitemEditIsArray = ref(false)
export const hasitemEditIsAdd = ref(false)

// ========== haspermission 子编辑弹窗 ==========
export const haspermissionEditId = ref(null)
export const haspermissionEditIsAdd = ref(false)
export const haspermissionEditCamera = ref(null)
export const haspermissionEditMovement = ref(null)

// ========== 坐标自动计算弹窗 ==========
export const coordCalcModalOpen = ref(false)
export const coordCalcStart = reactive({ x: '', y: '', z: '' })
export const coordCalcEnd = reactive({ x: '', y: '', z: '' })

// ========== 内部非响应式变量 ==========
// 使用对象包裹以允许跨模块赋值（ES module 不允许直接重新赋值 import binding）
export const internals = {
  deleteConfirmTimer: null,
  saveTimer: null,
  idSeq: 0,
  msg: null,
}

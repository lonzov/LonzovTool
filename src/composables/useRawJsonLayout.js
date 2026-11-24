import { computed, ref } from 'vue'

/**
 * T显编辑器 · 桌面端分栏（模块级单例）
 *
 * 三个方向各自独立记忆：左右分栏按像素保存（面板宽度属于操作习惯，换窗口大小时保持
 * 绝对宽度比跟着缩放更符合预期），上下分栏按比例保存（列高随视口变化，按比例分配才
 * 不会让某一栏在小窗口里被挤没）。
 *
 * 偏好值与实际值分开：窗口变窄时先按可用空间把面板收回可用范围，窗口放大后自动回到
 * 原来设定的宽度，不覆盖用户拉出来的偏好。
 */
const STORAGE_KEY = 'lonzovtool-rawjson-jzfk-layout'

export const LIST_WIDTH_MIN = 320
export const LIST_WIDTH_MAX = 560
export const LIST_WIDTH_DEFAULT = 400
/** 右栏至少要留出的宽度：预览与输出卡在里面还要排得下 */
const PANE2_MIN_WIDTH = 360

export const PREVIEW_RATIO_MIN = 0.32
export const PREVIEW_RATIO_MAX = 0.78
export const PREVIEW_RATIO_DEFAULT = 0.56

export const JSON_RATIO_MIN = 0.32
export const JSON_RATIO_MAX = 0.8
/** 默认把输出区对半分：命令面板要放下两三行折行文本，不能只剩一条缝 */
export const JSON_RATIO_DEFAULT = 0.55

const preferredWidth = ref(LIST_WIDTH_DEFAULT)
const preferredPreviewRatio = ref(PREVIEW_RATIO_DEFAULT)
const preferredJsonRatio = ref(JSON_RATIO_DEFAULT)
/** 编辑器自身宽度，由页面已有的尺寸监听写入 */
const containerWidth = ref(0)

export const listWidthMax = computed(() => {
  if (containerWidth.value <= 0) return LIST_WIDTH_MAX
  const usable = containerWidth.value - PANE2_MIN_WIDTH
  return Math.max(LIST_WIDTH_MIN, Math.min(LIST_WIDTH_MAX, usable))
})

export const listWidthPx = computed(() => (
  Math.round(Math.min(listWidthMax.value, Math.max(LIST_WIDTH_MIN, preferredWidth.value)))
))

/** NSplit 的 size / min / max 都是像素模式，单位要跟着一起传 */
export const listWidthSize = computed(() => `${listWidthPx.value}px`)
export const listWidthMin = `${LIST_WIDTH_MIN}px`
export const listWidthMaxSize = computed(() => `${listWidthMax.value}px`)

/** 上下分栏用的是 0–1 比例，越界值在 setter 与加载时收口 */
export const previewRatio = computed(() => preferredPreviewRatio.value)
export const jsonRatio = computed(() => preferredJsonRatio.value)

export function setContainerWidth(width) {
  if (Number.isFinite(width) && width > 0) containerWidth.value = width
}

function clampRatio(value, min, max, fallback) {
  const ratio = typeof value === 'string' ? Number.parseFloat(value) : Number(value)
  if (!Number.isFinite(ratio)) return fallback
  return Math.min(max, Math.max(min, Math.round(ratio * 1000) / 1000))
}

/** 拖拽或键盘微调后的宽度；越界值在这里收口，NSplit 的 min/max 只约束拖拽过程 */
export function setListWidth(value) {
  const px = typeof value === 'string' ? Number.parseFloat(value) : Number(value)
  if (!Number.isFinite(px)) return
  preferredWidth.value = Math.min(
    listWidthMax.value,
    Math.max(LIST_WIDTH_MIN, Math.round(px)),
  )
}

export function setPreviewRatio(value) {
  preferredPreviewRatio.value = clampRatio(
    value,
    PREVIEW_RATIO_MIN,
    PREVIEW_RATIO_MAX,
    PREVIEW_RATIO_DEFAULT,
  )
}

export function setJsonRatio(value) {
  preferredJsonRatio.value = clampRatio(value, JSON_RATIO_MIN, JSON_RATIO_MAX, JSON_RATIO_DEFAULT)
}

export function resetListWidth() {
  preferredWidth.value = LIST_WIDTH_DEFAULT
  saveLayout()
}

export function resetPreviewRatio() {
  preferredPreviewRatio.value = PREVIEW_RATIO_DEFAULT
  saveLayout()
}

export function resetJsonRatio() {
  preferredJsonRatio.value = JSON_RATIO_DEFAULT
  saveLayout()
}

export function loadLayout() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (!saved) return
    if (Number.isFinite(saved.listWidth)) {
      preferredWidth.value = Math.min(
        LIST_WIDTH_MAX,
        Math.max(LIST_WIDTH_MIN, Math.round(saved.listWidth)),
      )
    }
    if (saved.previewRatio !== undefined) {
      setPreviewRatio(saved.previewRatio)
    }
    if (saved.jsonRatio !== undefined) {
      setJsonRatio(saved.jsonRatio)
    }
  } catch { /* 隐私模式下读不到，用默认值 */ }
}

export function saveLayout() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      listWidth: preferredWidth.value,
      previewRatio: preferredPreviewRatio.value,
      jsonRatio: preferredJsonRatio.value,
    }))
  } catch { /* 写不进去只影响下次进入的默认尺寸 */ }
}

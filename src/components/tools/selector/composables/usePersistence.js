import { selectorType, params, internals } from './useState.js'

// ========== localStorage ==========

const STORAGE_KEY = 'lonzovtool-selector-editor'

export function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      if (data.selectorType) selectorType.value = data.selectorType
      if (Array.isArray(data.params)) params.value = data.params
    }
  } catch { /* ignore */ }
}

export function persistNow() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      selectorType: selectorType.value,
      params: params.value,
    }))
  } catch { /* ignore */ }
}

export function triggerSave() {
  clearTimeout(internals.saveTimer)
  internals.saveTimer = setTimeout(persistNow, 300)
}

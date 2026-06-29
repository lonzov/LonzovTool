import { onMounted, onBeforeUnmount } from 'vue'
import { useMessage } from 'naive-ui'
import { internals } from './useState.js'
import { loadFromStorage, persistNow } from './usePersistence.js'

// ========== 组合式函数入口 ==========

export function useSelectorEditor() {
  internals.msg = useMessage()

  onMounted(() => { loadFromStorage() })
  onBeforeUnmount(() => { persistNow(); clearTimeout(internals.saveTimer) })

  return {}
}

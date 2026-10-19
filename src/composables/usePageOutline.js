import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { reduceMotion } from './useMotion.js'
import { useSidebarSectionProvider } from './useSidebarSection.js'
import { scrollToElement } from '../utils/scrollToElement.js'

// 移动端顶部有 56px 固定栏，锚点落位要比桌面端留出更多空隙（与 App.vue 的分类滚动一致）
const MOBILE_MAX_WIDTH = 770
// 高亮判定线在锚点落位处再下移一点，刚跳转完的目标标题即处于选中态
const ACTIVE_LINE_OFFSET = 8

function isMobileViewport() {
  return window.innerWidth <= MOBILE_MAX_WIDTH
}

function anchorMargin() {
  return isMobileViewport() ? 80 : 24
}

// 分类栏的来源标识。目录随路由整体换掉，故把路由并进来，换页时分类栏才有切页动画；
// 但路径只在 refresh() 里记录，不跟着路由响应式变化——否则换页刚开始、新页目录还没出来时
// 就会被判成换了来源，分类栏空放一次切页动画，等目录真的到了再放一次
let sourceKey = ''

/**
 * 页面内的章节大纲：把页面自己的章节标题交给侧边栏分类栏，并跟随滚动高亮。
 *
 * @param {import('vue').Ref<HTMLElement|null>} rootRef 页面根元素
 * @param {() => Array<{ key: string, label: string, level?: number }>} resolveItems
 *        返回章节列表，key 为元素 id（须在 rootRef 内）。仅在 refresh() 时调用，可安全读 DOM
 * @param {object} [options]
 * @param {string} [options.id] 注册方标识，侧边栏据此判断分类栏是否换源（换源走切页动画）
 * @param {(key: string) => Promise<void>|void} [options.beforeScroll]
 *        定位前执行，供页面先改变布局（如展开折叠区）再交给滚动
 */
export function usePageOutline(rootRef, resolveItems, options = {}) {
  const route = useRoute()
  const sectionId = options.id || 'outline'
  const items = ref([])
  const activeId = ref(null)

  let nodes = []
  let rafId = 0

  function updateActive() {
    if (nodes.length === 0) return
    const line = anchorMargin() + ACTIVE_LINE_OFFSET
    let current = nodes[0].id
    for (const node of nodes) {
      if (node.getBoundingClientRect().top > line) break
      current = node.id
    }
    if (activeId.value !== current) activeId.value = current
  }

  function handleScroll() {
    if (rafId) return
    rafId = requestAnimationFrame(() => {
      rafId = 0
      updateActive()
    })
  }

  function scrollToKey(key) {
    const node = nodes.find((item) => item.id === key)
    if (!node) return
    // 先点亮目标项：平滑滚动期间视口判定会路过中间章节，等落位后再交还给滚动监听
    activeId.value = key
    scrollToElement(node, {
      marginTop: anchorMargin(),
      behavior: reduceMotion.value ? 'auto' : 'smooth',
      focusReset: isMobileViewport(),
    })
  }

  async function selectItem(key) {
    if (!items.value.some((item) => item.key === key)) return
    activeId.value = key
    if (options.beforeScroll) await options.beforeScroll(key)
    scrollToKey(key)
  }

  // 带锚点进入（分享链接）时定位到对应章节
  function scrollToHash() {
    if (!route.hash) return
    let id
    try {
      id = decodeURIComponent(route.hash.replace(/^#/, ''))
    } catch {
      return
    }
    if (id) scrollToKey(id)
  }

  function refresh() {
    if (typeof window === 'undefined' || !rootRef.value) return

    const resolved = resolveItems() || []
    const elementMap = new Map()
    rootRef.value.querySelectorAll('[id]').forEach((el) => elementMap.set(el.id, el))

    const matched = resolved.filter((item) => elementMap.has(item.key))
    nodes = matched.map((item) => elementMap.get(item.key))
    sourceKey = `${sectionId}:${route.path}`
    items.value = matched

    updateActive()
    scrollToHash()
  }

  useSidebarSectionProvider(sectionId, () =>
    items.value.length > 0
      ? {
          // 来源标识在 refresh() 里定下，不随路由变（见上）
          key: sourceKey,
          items: items.value,
          selectedKey: activeId.value,
          onSelect: selectItem,
        }
      : null,
  )

  // scroll 不冒泡，但在 window 上以捕获方式监听能收到所有滚动容器的事件，
  // 桌面端（NScrollbar 内部滚动）与移动端（body 滚动）都不必分别适配
  onMounted(() => {
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true })
    window.addEventListener('resize', handleScroll, { passive: true })
    refresh()
  })

  onBeforeUnmount(() => {
    window.removeEventListener('scroll', handleScroll, { capture: true })
    window.removeEventListener('resize', handleScroll)
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
    nodes = []
  })

  return { items, activeId, refresh }
}

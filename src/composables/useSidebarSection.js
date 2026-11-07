import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'

/**
 * 侧边栏「分类栏」的动态内容注册表。
 *
 * 固定栏（首页 / 工作站 / 关于 / 设置 / 更多）由 AppMenu 自持；分类栏的内容由当前页面
 * 模块在挂载期接管，未接管时回落为首页工具分类。分类栏的结构约定：
 *
 *   {
 *     items: [{ key, label, icon?, logo?, level?, children? }],  // children 为可展开分组；level 用于层级缩进
 *     selectedKey,                                    // 高亮项，null 表示无
 *     onSelect(key),                                  // 点选回调
 *     key?,                                           // 该项来源的标识，变化时分类栏走切页动画
 *   }
 *
 * 新增页面（如控制台）只需在自己的模块里调用 useSidebarSectionProvider 交出上述对象，
 * 无需改动 AppMenu。
 */

let tokenSeq = 0
const providers = shallowRef([])
// 最近一次实际展示的分类栏内容，供换页空档期沿用
const lastSection = shallowRef(null)
// 最近一次完成挂载的页面所属路由，用于判断换页过渡是否结束
const mountedPagePath = shallowRef(null)
// 最近一次完成挂载的页面是否注册了分类栏来源
const mountedPageOwnsSection = shallowRef(false)

/**
 * 页面模块注册分类栏内容
 * @param {string} id 注册方标识，仅用于排查
 * @param {() => object|null} getSection 返回分类栏内容，返回 null 表示暂不接管（回落首页分类）
 * @param {number} [order] 数字小的优先，同一页面有多个注册方时用于决定谁接管
 */
export function useSidebarSectionProvider(id, getSection, order = 0) {
  const provider = { id, order, get: getSection, token: ++tokenSeq }

  onMounted(() => {
    const rest = providers.value.filter((item) => item.token !== provider.token)
    providers.value = [...rest, provider].sort((a, b) => a.order - b.order)
  })

  onBeforeUnmount(() => {
    providers.value = providers.value.filter((item) => item.token !== provider.token)
  })

  return provider
}

/**
 * 页面组件挂载完成时由 App.vue 调用（RouterView 上的 @vue:mounted）
 * @param {string} path 该页面所属路由，仅在等于当前路由时才算换页过渡结束
 */
export function markSidebarPageMounted(path) {
  mountedPagePath.value = path
  mountedPageOwnsSection.value = providers.value.length > 0
}

export function useSidebarSection() {
  const route = useRoute()

  // 当前页面交出的内容；页面还没交出（如文档目录仍在加载）时为 null
  const providedSection = computed(() => {
    for (const provider of providers.value) {
      const section = provider.get()
      if (section && Array.isArray(section.items) && section.items.length > 0) {
        // 带上注册方标识，侧边栏据此判断分类栏是否换了来源（换源时走切页动画）
        return { id: provider.id, ...section }
      }
    }
    return null
  })

  // 换页时旧页先卸载、新页后挂载，中间这段空档若直接回落首页分类，分类栏会先闪一下默认内容，
  // 故新页就位前一律沿用上一份；新页就位后仍拿不到内容时，也只有不接管分类栏的页面（首页、
  // 更新日志等，就位时压根没有来源）才回落首页分类，注册了来源但内容还没出来的继续沿用
  const activeSection = computed(() => {
    if (providedSection.value) return providedSection.value
    if (mountedPagePath.value !== route.path) return lastSection.value
    if (providers.value.length > 0 || mountedPageOwnsSection.value) return lastSection.value
    return null
  })

  // 留档的是「当前展示的内容」而非「最近注册的内容」：中间经过不接管分类栏的页面时留档会被清掉，
  // 免得离开该页时把更早那份分类栏又搬出来
  watch(activeSection, (section) => {
    lastSection.value = section || null
  }, { immediate: true })

  return { activeSection }
}

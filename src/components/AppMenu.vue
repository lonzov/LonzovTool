<script>
import { h, markRaw, toRaw, computed, Transition } from 'vue'
import { useRouter } from 'vue-router'
import { NMenu, NIcon, useMessage } from 'naive-ui'
import { NumberSymbol24Filled } from '@vicons/fluent'
import { getCategoryIcon } from '../config/categoryIcons'
import { SIDEBAR_FIXED_ITEM_MAP, SIDEBAR_MORE_ITEM, SIDEBAR_MORE_KEY } from '../config/sidebarFixedItems.js'
import { makeLogoIcon } from '../utils/toolLogo.js'
import { usePWAInstall } from '../composables/usePWAInstall'
import { cardsData, parentMenusData } from '../composables/useSiteData.js'
import { useSidebarSection } from '../composables/useSidebarSection.js'
import { sidebarMenuLayout } from '../composables/useSidebarMenuLayout.js'

// 父级菜单展开状态持久化（桌面端侧边栏与移动端抽屉共用同一份）
const EXPANDED_KEYS_KEY = 'sidebar_expanded_keys'
const MORE_KEY = SIDEBAR_MORE_KEY
const MORE_SEEDED_KEY = 'sidebar_more_seeded'

// 分类栏的层级缩进步长
const SECTION_LEVEL_INDENT = 14

const MENU_STYLE = {
  marginTop: '8px',
}

/**
 * 从菜单选项里找出选中项的所有祖先分组 key（由浅到深），用于自动展开当前页所在分组。
 * 选项结构与 NMenu options 一致：children 为可展开分组。
 */
function findAncestorKeys(options, key) {
  for (const option of options) {
    if (option.key === key) return []
    if (Array.isArray(option.children) && option.children.length > 0) {
      const trail = findAncestorKeys(option.children, key)
      if (trail) return [option.key, ...trail]
    }
  }
  return null
}

function loadExpandedKeys() {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(EXPANDED_KEYS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String) : null
  } catch {
    return null
  }
}

function saveExpandedKeys(keys) {
  try {
    localStorage.setItem(EXPANDED_KEYS_KEY, JSON.stringify(keys))
  } catch {
    // storage unavailable
  }
}

/**
 * 读取持久化的展开状态。
 * 「更多」是后加的分组，老记录里没有它，此处补一次默认展开；
 * 一次性标记保证用户之后主动收起时不会被再次展开。
 */
function resolveExpandedKeys(defaults) {
  const saved = loadExpandedKeys()
  let seeded = true
  try {
    seeded = localStorage.getItem(MORE_SEEDED_KEY) === '1'
    if (!seeded) localStorage.setItem(MORE_SEEDED_KEY, '1')
  } catch {
    // storage unavailable
  }
  if (!saved) return [...defaults]
  if (seeded || saved.includes(MORE_KEY)) return saved
  const merged = [...saved, MORE_KEY]
  saveExpandedKeys(merged)
  return merged
}

export default {
  props: {
    value: {
      type: String,
      default: 'home',
    },
  },
  emits: ['update:value', 'navigate', 'feedback', 'section'],
  setup() {
    // 固定栏与分类栏是两个菜单实例，分类栏的内容来自当前页面模块（见 useSidebarSection）
    const { activeSection } = useSidebarSection()

    // 从配置中计算默认展开的父级菜单
    const defaultExpandedKeys = computed(() => {
      const keys = [MORE_KEY]
      parentMenusData.value.parentMenus.forEach((parent) => {
        if (!parent.defaultCollapsed) {
          keys.push(`parent-${parent.id}`)
        }
      })
      return keys
    })

    // PWA 安装
    const { isInstalled, install: doInstall } = usePWAInstall()
    const message = useMessage()
    const router = useRouter()

    function handlePWAInstall() {
      doInstall().then((result) => {
        if (result.type === 'already-installed') return

        if (result.type === 'ios-manual' || result.type === 'openharmony-manual') {
          message.info(() =>
            h('div', { style: { lineHeight: '1.6' } }, [
              '使用系统浏览器打开本站，点击分享按钮-',
              h('br'),
              '→ 添加到主屏幕/桌面，即可完成安装',
            ]),
            { duration: 8000, closable: true }
          )
          return
        }

        if (result.type === 'prompted') {
          if (result.outcome === 'accepted') {
            message.success('安装成功！小舟工具箱已添加到桌面')
          } else {
            message.warning('手动取消安装/浏览器不支持')
            router.push('/down/LonzovTool/')
          }
          return
        }

        // unsupported — 浏览器不支持自动安装
        message.error('当前浏览器不支持安装，请使用标准浏览器打开本站', {
          duration: 6000,
          closable: true,
        })
        router.push('/down/LonzovTool/')
      })
    }

    return {
      activeSection,
      defaultExpandedKeys,
      isInstalled,
      handlePWAInstall,
    }
  },
  data() {
    return {
      fixedOptions: [],
      sectionOptions: [],
      expandedKeys: [],
      // 已按哪个选中项自动展开过：数据刷新重建选项时不打扰用户手动收起的决定
      expandedForKey: '',
      isDark: typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') === 'dark' : true,
    }
  },
  computed: {
    // 展开状态存在同一个数组里（沿用原持久化 key），两个菜单各管自己那部分
    fixedExpandedKeys() {
      return this.expandedKeys.filter((key) => key === MORE_KEY)
    },
    sectionExpandedKeys() {
      return this.expandedKeys.filter((key) => key !== MORE_KEY)
    },
    // 上半固定栏只按路由高亮：设置、关于、工作站等自身有固定入口的页面，
    // 允许上方当前页 + 下方当前段落各保留一处焦点；控制台等无固定入口的路由由 value=null 处理
    fixedValue() {
      return this.value
    },
    // 分类栏选中态：由页面模块给出；回落首页分类时沿用外部的固定栏选中项
    sectionValue() {
      if (!this.activeSection) return this.value
      return this.activeSection.selectedKey ?? null
    },
    // 分类栏来源标识：切换来源时换 key，触发分类栏的切页动画
    sectionKey() {
      if (!this.activeSection) return 'categories'
      return this.activeSection.key || this.activeSection.id
    },
  },
  mounted() {
    this.initMenuOptions()
    // 优先恢复上次的展开状态，无记录时取 parentMenus.json 的默认展开配置
    this.expandedKeys = resolveExpandedKeys(this.defaultExpandedKeys)
    // 恢复后再按当前选中页补齐所在分组，避免展开状态被默认值覆盖
    this.ensureSectionExpanded()
    this.observeTheme()

    // 选项是挂载时构建的副本，而接口刷新会整体替换快照、页面模块可能中途接管分类栏、
    // 侧边栏布局也允许随时调整，这些都需要跟着重建。
    // 展开状态保持不动：那是用户当下的操作结果，不该被数据刷新覆盖。
    this.$watch(
      () => [cardsData.value, parentMenusData.value, this.activeSection, sidebarMenuLayout.value],
      () => {
        this.initMenuOptions()
        this.ensureSectionExpanded()
      },
    )
  },
  beforeUnmount() {
    if (this.observer) {
      this.observer.disconnect()
    }
  },
  watch: {
    // 安装完成后隐藏按钮
    isInstalled() {
      this.initMenuOptions()
    },
    // 当前页落在分组内时自动展开该分组（用户手动收起后，只有再切换子页才会重新展开）
    sectionValue() {
      this.ensureSectionExpanded()
    },
  },
  methods: {
    observeTheme() {
      this.observer = new MutationObserver(() => {
        this.isDark = document.documentElement.getAttribute('data-theme') === 'dark'
      })
      this.observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
      })
    },
    renderIcon(icon) {
      return () =>
        h(NIcon, {
          component: icon,
          size: 18,
          style: {
            color: 'var(--muted-foreground)',
            transition: 'color 0.4s ease',
          },
        })
    },
    getIconByName(name) {
      return getCategoryIcon(name)
    },
    initMenuOptions() {
      this.fixedOptions = this.buildFixedOptions()
      this.sectionOptions = this.activeSection
        ? this.buildSectionOptions(this.activeSection)
        : this.buildCategoryOptions()
    },
    buildFixedItemOption(item) {
      return {
        label: item.label,
        key: item.key,
        icon: this.renderIcon(markRaw(item.icon)),
      }
    },
    // 安装本站只在还没装成 PWA 时出现，其余入口始终展示
    isFixedItemVisible(key) {
      return key !== 'pwa-install' || !this.isInstalled
    },
    buildFixedOptions() {
      const { level1, more } = sidebarMenuLayout.value
      const buildList = (keys) =>
        keys
          .map((key) => SIDEBAR_FIXED_ITEM_MAP.get(key))
          .filter((item) => item && this.isFixedItemVisible(item.key))
          .map((item) => this.buildFixedItemOption(item))

      const fixedOptions = buildList(level1)

      // 低频入口收进「更多」，展开状态与其他父级菜单共用持久化。
      // 二级菜单被清空时整组隐藏，免得留一个点开没有内容的入口
      const moreChildren = buildList(more)
      if (moreChildren.length > 0) {
        fixedOptions.push({
          label: SIDEBAR_MORE_ITEM.label,
          key: MORE_KEY,
          icon: this.renderIcon(markRaw(SIDEBAR_MORE_ITEM.icon)),
          children: moreChildren,
        })
      }

      fixedOptions.push({
        type: 'divider',
        key: 'divider-categories',
      })

      return fixedOptions
    },
    // 没有页面模块接管分类栏时的默认内容：首页工具分类
    buildCategoryOptions() {
      // 构建父级菜单映射 (id -> parent配置)
      const parentMenuMap = new Map()
      parentMenusData.value.parentMenus.forEach((parent) => {
        parentMenuMap.set(parent.id, parent)
      })

      // 按父级ID分组分类
      const parentGroups = new Map() // parentId -> [categoryItem]
      const standaloneCategories = []

      cardsData.value.categories.forEach((cat, index) => {
        const categoryItem = {
          label: cat.name,
          key: `category-${index}`,
          icon: this.renderIcon(markRaw(this.getIconByName(cat.icon))),
        }

        if (cat.parentMenuId && parentMenuMap.has(cat.parentMenuId)) {
          // 有父级配置
          if (!parentGroups.has(cat.parentMenuId)) {
            parentGroups.set(cat.parentMenuId, [])
          }
          parentGroups.get(cat.parentMenuId).push(categoryItem)
        } else {
          // 无父级配置，独立显示
          standaloneCategories.push(categoryItem)
        }
      })

      // 生成菜单选项：先按父级顺序，再添加独立分类
      const categoryOptions = []

      // 添加父级菜单（包含子分类）
      parentMenusData.value.parentMenus.forEach((parent) => {
        const children = parentGroups.get(parent.id)
        if (children && children.length > 0) {
          categoryOptions.push({
            label: parent.name,
            key: `parent-${parent.id}`,
            icon: this.renderIcon(markRaw(this.getIconByName(parent.icon))),
            children: children,
          })
        }
      })

      // 添加独立分类
      standaloneCategories.forEach((catItem) => {
        categoryOptions.push(catItem)
      })

      return categoryOptions
    },
    // 页面模块交出的分类栏内容（文档目录 / 工作站标签页 / 控制台目录等）
    buildSectionOptions(section) {
      return section.items.map((item) => this.buildSectionOption(item))
    },
    buildSectionOption(item) {
      const option = {
        key: item.key,
        label: this.renderSectionLabel(item),
      }
      // 图标优先级：页面模块自带（控制台目录 / 章节图标）> 工具卡片 logo（工作站标签页）> 章节图标。
      // 页面交出的图标随响应式数据传递会被包成代理，渲染前取回原始组件定义
      const icon = item.icon
        ? this.renderIcon(markRaw(toRaw(item.icon)))
        : item.logo
          ? makeLogoIcon(item.logo, 18)
          : this.renderIcon(markRaw(NumberSymbol24Filled))
      if (icon) option.icon = icon
      if (Array.isArray(item.children) && item.children.length > 0) {
        option.children = item.children.map((child) => this.buildSectionOption(child))
      }
      return option
    },
    renderSectionLabel(item) {
      const indent = item.level > 1 ? (item.level - 1) * SECTION_LEVEL_INDENT : 0
      return () =>
        h(
          'span',
          {
            title: item.label,
            style: `display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${indent ? `padding-left:${indent}px;` : ''}`,
          },
          item.label,
        )
    },
    handleUpdateValue(key, item) {
      // PWA 安装：不导航，触发安装流程
      if (key === 'pwa-install') {
        this.$emit('update:value', key)
        this.handlePWAInstall()
        return
      }

      // 建议反馈：在当前页弹抽屉，路由与选中态都不变，故不派发 update:value
      if (key === 'feedback') {
        this.$emit('feedback')
        return
      }

      this.$emit('update:value', key)
      // 首页、关于、网址提交都触发导航
      if (
        item &&
        item.key &&
        (item.key === 'about' || item.key === 'home' || item.key === 'submit' || item.key === 'workspace' || item.key === 'donate' || item.key === 'settings')
      ) {
        this.$emit('navigate', item.key)
      }
    },
    handleSectionUpdateValue(key, item) {
      if (this.activeSection) {
        if (typeof this.activeSection.onSelect === 'function') {
          this.activeSection.onSelect(key)
        }
        // 移动端抽屉由外层关闭：分类栏的选中项不占用固定栏的选中态
        this.$emit('section', key)
        return
      }

      // 回落首页分类：与固定栏共享选中态与导航逻辑
      this.$emit('update:value', key)
      if (item && item.key && item.key.startsWith('category-')) {
        this.$emit('navigate', item.key)
      }
    },
    updateExpandedKeys(keys) {
      this.expandedKeys = [...new Set(keys)]
      saveExpandedKeys(this.expandedKeys)
    },
    // 当前页位于某个分组内时把祖先分组并入展开状态，跨页进入子页不必先手动展开。
    // 只在选中项变化时展开一次：选项因数据刷新重建时保留用户手动收起的结果。
    ensureSectionExpanded() {
      const selected = this.sectionValue
      if (!selected || selected === this.expandedForKey) return
      const ancestors = findAncestorKeys(this.sectionOptions, selected)
      if (!ancestors) return
      this.expandedForKey = selected
      if (!ancestors.length) return
      const current = new Set(this.sectionExpandedKeys)
      const missing = ancestors.filter((key) => !current.has(key))
      if (!missing.length) return
      this.updateExpandedKeys([...this.fixedExpandedKeys, ...current, ...missing])
    },
    handleFixedExpandedKeys(keys) {
      this.updateExpandedKeys([...keys, ...this.sectionExpandedKeys])
    },
    handleSectionExpandedKeys(keys) {
      this.updateExpandedKeys([...this.fixedExpandedKeys, ...keys])
    },
  },
  render() {
    return h('div', { class: 'app-menu' }, [
      h(NMenu, {
        value: this.fixedValue,
        'onUpdate:value': this.handleUpdateValue,
        expandedKeys: this.fixedExpandedKeys,
        'onUpdate:expandedKeys': this.handleFixedExpandedKeys,
        options: this.fixedOptions,
        mode: 'vertical',
        style: MENU_STYLE,
      }),
      // 分类栏的来源随页面变化，换源时整块交叉淡入淡出（离开的那份绝对定位叠在下方，
      // 高度立刻让给新内容，避免 out-in 留下的空档）
      h(
        'div',
        { class: 'app-menu-section' },
        h(
          Transition,
          { name: 'menu-section' },
          {
            default: () =>
              h(NMenu, {
                key: this.sectionKey,
                value: this.sectionValue,
                'onUpdate:value': this.handleSectionUpdateValue,
                expandedKeys: this.sectionExpandedKeys,
                'onUpdate:expandedKeys': this.handleSectionExpandedKeys,
                options: this.sectionOptions,
                mode: 'vertical',
                style: { ...MENU_STYLE, marginTop: '0' },
              }),
          },
        ),
      ),
    ])
  },
}
</script>

<style>
.app-menu-section {
  position: relative;
}

/* 分组内子项选中时给分组标题加底色：Naive 只映射了 child-active 的前景/图标色，
   没有对应的底色变量，这里用同一套叠层 token 补齐（不写死颜色） */
.app-menu .n-menu-item-content--child-active::before {
  background-color: var(--accent);
}

.menu-section-enter-active,
.menu-section-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
  transform-origin: top center;
}

.menu-section-enter-from {
  opacity: 0;
  transform: translateY(6px) scale(0.98);
}

.menu-section-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}

/* 离开的那份脱离文档流，交叉过渡期间不占高度 */
.menu-section-leave-active {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  pointer-events: none;
}

html[data-motion='reduced'] .menu-section-enter-active,
html[data-motion='reduced'] .menu-section-leave-active {
  transition: none !important;
}
</style>

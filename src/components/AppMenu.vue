<script>
import { h, markRaw, computed } from 'vue'
import { useRouter } from 'vue-router'
import { NMenu, NIcon, useMessage } from 'naive-ui'
import { Home48Regular, Person24Regular, AddSquare24Regular, HeartCircle24Regular, CalendarWorkWeek24Regular, DrawerArrowDownload24Regular } from '@vicons/fluent'
import { getCategoryIcon } from '../config/categoryIcons'
import { usePWAInstall } from '../composables/usePWAInstall'
import toolsData from '../data/tools.json'
import parentMenusData from '../data/parentMenus.json'

export default {
  props: {
    value: {
      type: String,
      default: 'home',
    },
  },
  emits: ['update:value', 'navigate'],
  setup() {
    // 从配置中计算默认展开的父级菜单
    const defaultExpandedKeys = computed(() => {
      const keys = []
      parentMenusData.parentMenus.forEach((parent) => {
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
      defaultExpandedKeys,
      isInstalled,
      handlePWAInstall,
    }
  },
  data() {
    return {
      menuOptions: [],
      expandedKeys: [],
      isDark: typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') === 'dark' : true,
    }
  },
  mounted() {
    this.initMenuOptions()
    this.expandedKeys = [...this.defaultExpandedKeys]
    this.observeTheme()
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
            color: 'var(--text-secondary)',
            transition: 'color 0.4s ease',
          },
        })
    },
    getIconByName(name) {
      return getCategoryIcon(name)
    },
    initMenuOptions() {
      // 固定菜单项
      const staticOptions = [
        {
          label: '首页',
          key: 'home',
          icon: this.renderIcon(markRaw(Home48Regular)),
        },
        {
          label: '关于本站',
          key: 'about',
          icon: this.renderIcon(markRaw(Person24Regular)),
        },
        {
          label: '网址提交',
          key: 'submit',
          icon: this.renderIcon(markRaw(AddSquare24Regular)),
        },
        {
          label: '打赏支持',
          key: 'donate',
          icon: this.renderIcon(markRaw(HeartCircle24Regular)),
        },
        {
          label: '工作站',
          key: 'workspace',
          icon: this.renderIcon(markRaw(CalendarWorkWeek24Regular)),
        },
      ]

      // PWA 安装入口（仅已安装为 PWA 时隐藏，其余情况始终展示）
      if (!this.isInstalled) {
        staticOptions.push({
          label: '安装本站',
          key: 'pwa-install',
          icon: this.renderIcon(markRaw(DrawerArrowDownload24Regular)),
        })
      }

      staticOptions.push({
        type: 'divider',
        key: 'divider-categories',
      })

      // 构建父级菜单映射 (id -> parent配置)
      const parentMenuMap = new Map()
      parentMenusData.parentMenus.forEach((parent) => {
        parentMenuMap.set(parent.id, parent)
      })

      // 按父级ID分组分类
      const parentGroups = new Map() // parentId -> [categoryItem]
      const standaloneCategories = []

      toolsData.categories.forEach((cat, index) => {
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
      parentMenusData.parentMenus.forEach((parent) => {
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

      this.menuOptions = [...staticOptions, ...categoryOptions]
    },
    handleUpdateValue(key, item) {
      // PWA 安装：不导航，触发安装流程
      if (key === 'pwa-install') {
        this.$emit('update:value', key)
        this.handlePWAInstall()
        return
      }

      this.$emit('update:value', key)
      // 首页、关于、分类、网址提交都触发导航
      if (
        item &&
        item.key &&
        (item.key.startsWith('category-') || item.key === 'about' || item.key === 'home' || item.key === 'submit' || item.key === 'workspace' || item.key === 'donate')
      ) {
        this.$emit('navigate', item.key)
      }
    },
    handleUpdateExpandedKeys(keys) {
      this.expandedKeys = keys
    },
  },
  render() {
    return h(NMenu, {
      value: this.value,
      'onUpdate:value': this.handleUpdateValue,
      expandedKeys: this.expandedKeys,
      'onUpdate:expandedKeys': this.handleUpdateExpandedKeys,
      options: this.menuOptions,
      mode: 'vertical',
      style: {
        marginTop: '8px',
        '--n-item-text-color': 'var(--text-secondary)',
        '--n-item-text-color-hover': 'var(--text-primary)',
        '--n-item-text-color-active': 'var(--text-primary)',
        '--n-item-text-color-pressed': 'var(--text-primary)',
        '--n-item-text-color-focus': 'var(--text-primary)',
        '--n-color': 'transparent',
        '--n-color-hover': 'var(--bg-sub)',
        '--n-color-pressed': 'var(--bg-sub)',
        '--n-color-focus': 'var(--bg-sub)',
        '--n-color-active': 'var(--bg-sub)',
        '--n-icon-color': 'var(--text-secondary)',
        '--n-icon-color-hover': 'var(--text-primary)',
        '--n-icon-color-active': 'var(--text-primary)',
        '--n-icon-color-pressed': 'var(--text-primary)',
        '--n-icon-color-focus': 'var(--text-primary)',
        '--n-color-active-child': 'transparent',
        '--n-group-color': 'transparent',
        '--n-bezier': 'cubic-bezier(0.4, 0, 0.2, 1)',
        '--n-bezier-ease-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
        '--n-bezier-ease-in': 'cubic-bezier(0.4, 0, 0.2, 1)',
        '--n-bezier-ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    })
  },
}
</script>

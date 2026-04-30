<script>
import { h, ref, watch, nextTick, markRaw, onMounted, onUnmounted, computed } from 'vue'
import { NIcon } from 'naive-ui'
import { getCategoryIcon } from '../config/categoryIcons'
import ToolCard from './ToolCard.vue'
import toolsData from '../data/tools.json'

export default {
  components: {
    ToolCard,
  },
  props: {
    searchQuery: {
      type: String,
      default: '',
    },
  },
  setup() {
    const activeCategoryIndex = ref(null)
    const isAnimating = ref(false)
    const dimmedCategoryIndex = ref(null) // 当前需要高亮的分类索引（其他分类变暗）
    const dimmedTransition = ref('opacity 0.5s ease') // 恢复透明度时的过渡动画（区分滚动触发和超时触发')

    // 触发透明度动画（从外部调用）
    let dimTimer = null
    const triggerDimEffect = (index) => {
      console.log('[分类引导] 已降低透明度')
      if (dimTimer) clearTimeout(dimTimer)

      dimmedTransition.value = 'opacity 0.5s ease' // 默认超时恢复用 0.5s
      dimmedCategoryIndex.value = index

      // 1.75秒后恢复正常
      dimTimer = setTimeout(() => {
        dimmedCategoryIndex.value = null
        console.log('[分类引导] 超时已恢复透明度')
      }, 1750)
    }

    // 捕获用户滚动意图（移动端 touchmove + 桌面端 wheel）
    let touchStartY = null
    const handleTouchStart = (e) => {
      touchStartY = e.touches[0].clientY
    }
    const handleTouchMove = (e) => {
      if (dimmedCategoryIndex.value !== null && touchStartY !== null) {
        const deltaY = Math.abs(e.touches[0].clientY - touchStartY)
        if (deltaY >= 10) {
          console.log('[分类引导] 监听到滚动（移动端），已恢复透明度')
          if (dimTimer) clearTimeout(dimTimer)
          dimmedTransition.value = 'opacity 0.15s ease'
          dimmedCategoryIndex.value = null
        }
      }
    }
    const handleWheel = () => {
      if (dimmedCategoryIndex.value !== null) {
        console.log('[分类引导] 监听到滚动（桌面端），已恢复透明度')
        if (dimTimer) clearTimeout(dimTimer)
        dimmedTransition.value = 'opacity 0.15s ease'
        dimmedCategoryIndex.value = null
      }
    }

    // 组件挂载时注册
    onMounted(() => {
      window.addEventListener('touchstart', handleTouchStart, { passive: true })
      window.addEventListener('touchmove', handleTouchMove, { passive: true })
      window.addEventListener('wheel', handleWheel, { passive: true })
    })

    // 组件卸载时清理
    onUnmounted(() => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('wheel', handleWheel)
      if (dimTimer) clearTimeout(dimTimer)
    })

    // 监听滚动位置，更新激活的分类
    const checkActiveCategory = () => {
      const scrollPosition = window.scrollY + 150
      let currentIndex = null

      toolsData.categories.forEach((_, index) => {
        const element = document.getElementById(`category-${index}`)
        if (element) {
          const offsetTop = element.offsetTop
          const offsetHeight = element.offsetHeight
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            currentIndex = index
          }
        }
      })

      if (currentIndex !== activeCategoryIndex.value && !isAnimating.value) {
        triggerIconAnimation(currentIndex)
      }
    }

    const triggerIconAnimation = (index) => {
      if (index === null) return

      activeCategoryIndex.value = index
      isAnimating.value = true

      // 动画序列：变化 (0.4s) → 保持 (0.4s) → 变回 (0.4s)
      setTimeout(() => {
        isAnimating.value = false
        activeCategoryIndex.value = null
      }, 1200)
    }

    // 监听滚动事件
    watch(
      () => window.scrollY,
      () => {
        nextTick(() => {
          checkActiveCategory()
        })
      },
    )

    return {
      activeCategoryIndex,
      isAnimating,
      dimmedCategoryIndex,
      dimmedTransition,
      triggerDimEffect,
    }
  },
  render() {
    const isDimmed = this.dimmedCategoryIndex !== null
    const searchQuery = (this.searchQuery || '').replace(/\s/g, '') // 去除所有空格
    const searchPatterns = searchQuery ? [searchQuery] : []

    // 过滤分类和工具
    const filteredCategories = computed(() => {
      if (!searchQuery) return toolsData.categories

      return toolsData.categories
        .map((category) => {
          const filteredTools = category.tools.filter(
            (tool) =>
              tool.title.replace(/\s/g, '').toLowerCase().includes(searchQuery.toLowerCase()) ||
              tool.description.replace(/\s/g, '').toLowerCase().includes(searchQuery.toLowerCase()),
          )
          if (filteredTools.length > 0) {
            return { ...category, tools: filteredTools }
          }
          return null
        })
        .filter(Boolean)
    }).value

    return h(
      'div',
      {
        style: {
          marginBottom: '24px',
        },
      },
      filteredCategories.map((category, categoryIndex) => {
        const isActive = this.activeCategoryIndex === categoryIndex
        const isTargetCategory = this.dimmedCategoryIndex === categoryIndex
        const opacity = isDimmed ? (isTargetCategory ? 1 : 0.25) : 1
        const transition = isDimmed ? 'opacity 0.7s ease' : this.dimmedTransition
        const iconComponent = markRaw(getCategoryIcon(category.icon))

        return [
          // 分类标题
          h(
            'div',
            {
              class: 'tool-category',
              id: `category-${categoryIndex}`,
              style: {
                display: 'flex',
                alignItems: 'center',
                marginBottom: '12px',
                marginTop: '24px',
                transition: `all 0.4s ease, ${transition}`,
                opacity,
              },
            },
            [
              h(NIcon, {
                component: iconComponent,
                size: 18,
                color: isActive ? 'var(--primary-color)' : 'var(--text-secondary)',
                style: {
                  marginRight: '8px',
                  transition: 'all 0.4s ease',
                },
              }),
              h(
                'span',
                {
                  style: {
                    fontSize: '14px',
                    fontWeight: this.isAnimating && isActive ? '700' : '600',
                    color: isActive ? 'var(--primary-color)' : 'var(--text-secondary)',
                    transition: 'all 0.4s ease',
                  },
                },
                category.name,
              ),
            ],
          ),
          // 卡片网格
          h(
            'div',
            {
              style: {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '12px',
                opacity,
                transition,
              },
            },
            category.tools.map((tool) =>
              h(ToolCard, {
                title: tool.title,
                description: tool.description,
                logo: tool.logo || '',
                link: tool.link || '',
                searchPatterns: searchPatterns,
              }),
            ),
          ),
        ]
      }),
    )
  },
}
</script>

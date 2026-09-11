<script>
import { inject, onMounted, ref, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import NoticeBar from './NoticeBar.vue'
import AdCarousel from './AdCarousel.vue'
import SearchBar from './SearchBar.vue'
import ToolGrid from './ToolGrid.vue'
import SearchGrid from './SearchGrid.vue'
import AppFooter from './Footer.vue'
import searchEngines from '../data/searchEngines.json'

export default {
  name: 'HomeView',
  components: { NoticeBar, AdCarousel, SearchBar, ToolGrid, SearchGrid, AppFooter },
  setup() {
    const registerHomeView = inject('registerHomeView')
    const route = useRoute()
    const toolGrid = ref(null)
    const searchBar = ref(null)
    const searchQuery = ref('')
    const showFavorites = ref(false)

    // 清理搜索字符串，只保留字母、数字和中文
    const sanitizeSearchString = (str) => {
      if (!str) return ''
      // 先解码 URL 编码（如 %E6%9F%A5%E8%AF%A2 -> 查询）
      try {
        str = decodeURIComponent(str)
      } catch {
        // 解码失败，保持原样
      }
      // 去除所有空格
      str = str.replace(/\s/g, '')
      // 保留字母、数字、中文和常见中文标点
      return str.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '')
    }

    // 处理 URL 中的 search 参数
    const handleUrlSearchParam = () => {
      const urlSearch = route.query.search
      if (urlSearch) {
        const sanitized = sanitizeSearchString(urlSearch)
        if (sanitized) {
          const internalEngine = searchEngines.find((e) => e.type === 'internal')
          if (internalEngine) {
            localStorage.setItem('search_engine_selected', internalEngine.id)
          }
          handleInternalSearch(sanitized)
        }
      }
    }

    onMounted(() => {
      // 向父组件注册自己
      if (registerHomeView) {
        registerHomeView({
          triggerDimEffect: (index) => {
            // 通过 ref 调用 ToolGrid 组件的方法
            if (toolGrid.value && toolGrid.value.triggerDimEffect) {
              toolGrid.value.triggerDimEffect(index)
            }
          },
          clearSearch: () => {
            // 清空搜索
            searchQuery.value = ''
          },
        })
      }

      // 处理 URL search 参数（延迟到下一帧确保组件已挂载）
      nextTick(() => {
        handleUrlSearchParam()
      })
    })

    // 监听路由变化，处理侧边栏导航时清空搜索
    watch(
      () => route.query,
      () => {
        // 当路由变化时，如果不是由 search 参数触发的，清空搜索
        if (!route.query.search) {
          // 检查是否是导航触发（通过检查路径变化或特定标记）
          // 这里我们依赖父组件调用 clearSearch 方法
        }
      },
    )

    const handleInternalSearch = (query) => {
      searchQuery.value = query
    }

    const handleToggleFavorites = (active) => {
      showFavorites.value = active
    }

    return { toolGrid, searchBar, searchQuery, showFavorites, handleInternalSearch, handleToggleFavorites }
  },
}
</script>

<template>
  <div class="home-view">
    <h1 class="sr-only">小舟工具箱</h1>
    <!-- 顶部区域：公告/搜索/广告逐行叠放；639–770 与 ≥889px 双栏(左列+右侧广告侧贴)，771–888 中间退回逐行 -->
    <div class="home-hero">
      <div class="home-hero__main">
        <NoticeBar />
        <SearchBar ref="searchBar" v-model="searchQuery" @internalSearch="handleInternalSearch" @toggleFavorites="handleToggleFavorites" />
      </div>
      <AdCarousel class="home-hero__ad" />
    </div>
    <SearchGrid :searchQuery="searchQuery" />
    <ToolGrid ref="toolGrid" :searchQuery="searchQuery" :showFavorites="showFavorites" />
    <AppFooter />
  </div>
</template>

<style scoped>
.home-view {
  min-height: 60vh;
}

/* 顶部两区：默认窄屏逐行（公告、搜索、广告各自外距形成 24px 节奏） */
.home-hero__main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.home-hero__ad {
  margin-bottom: 24px;
}

/* 双栏区间：639–770（移动布局但已够宽）与 ≥889（桌面）；771–888 保持逐行，
   广告整行通栏。右列固定 324（3:1，高108），左列 minmax(0,1fr) 自适应 */
@media (min-width: 639px) and (max-width: 770px), (min-width: 889px) {
  .home-hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    column-gap: 16px;
    align-items: start;
  }

  .home-hero__ad {
    margin-bottom: 0;
  }
}
</style>

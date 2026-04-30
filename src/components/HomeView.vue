<script>
import { inject, onMounted, ref, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import NoticeBar from './NoticeBar.vue'
import SearchBar from './SearchBar.vue'
import ToolGrid from './ToolGrid.vue'
import SearchGrid from './SearchGrid.vue'
import AppFooter from './Footer.vue'
import searchEngines from '../data/searchEngines.json'

export default {
  name: 'HomeView',
  components: { NoticeBar, SearchBar, ToolGrid, SearchGrid, AppFooter },
  setup() {
    const registerHomeView = inject('registerHomeView')
    const route = useRoute()
    const toolGrid = ref(null)
    const searchBar = ref(null)
    const searchQuery = ref('')

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

    return { toolGrid, searchBar, searchQuery, handleInternalSearch }
  },
}
</script>

<template>
  <div class="home-view">
    <NoticeBar />
    <SearchBar ref="searchBar" v-model="searchQuery" @internalSearch="handleInternalSearch" />
    <SearchGrid :searchQuery="searchQuery" />
    <ToolGrid ref="toolGrid" :searchQuery="searchQuery" />
    <AppFooter />
  </div>
</template>

<style scoped>
.home-view {
  min-height: 60vh;
}
</style>

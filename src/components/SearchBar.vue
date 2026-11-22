<template>
  <div
    :style="{
      background: 'var(--card)',
      borderRadius: 'var(--radius-lg)',
      display: 'flex',
      alignItems: 'center',
      padding: '0',
      marginBottom: '24px',
      height: '44px',
      border: '1px solid var(--border)',
    }"
  >
    <!-- 搜索方式选择：触发器保持纯文字，级联控件透明铺在上面，点击与弹层都交给级联 -->
    <div class="search-engine-select">
      <span class="search-engine-select__label">{{ selectedEngine?.name || '搜索' }}</span>
      <n-icon
        :component="ChevronDown20Filled"
        :size="14"
        color="var(--subtle-foreground)"
        :style="{ marginLeft: '4px' }"
      />
      <n-cascader
        class="search-engine-select__control"
        :value="selectedEngine?.id ?? null"
        :options="engineOptions"
        check-strategy="child"
        size="medium"
        :menu-props="{ class: 'compact-cascader-menu' }"
        @update:value="handleSelect"
      />
    </div>

    <!-- 竖向分界线 -->
    <div
      :style="{
        width: '1px',
        height: '56%',
        background: 'var(--border)',
        margin: '0 8px',
        alignSelf: 'center',
      }"
    ></div>

    <!-- 搜索输入框 -->
    <div style="flex: 1; display: flex; align-items: center; height: 100%; padding: 0 12px">
      <input
        v-model="searchQuery"
        :placeholder="placeholder"
        :style="{
          width: '100%',
          height: '100%',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: '14px',
          color: 'var(--foreground)',
        }"
        @keydown="handleKeydown"
      />
    </div>

    <!-- 搜索按钮 -->
    <div
      :style="{
        padding: '0 12px',
        display: 'flex',
        alignItems: 'center',
        height: '100%',
        color: 'var(--muted-foreground)',
        cursor: 'pointer',
      }"
      @click="doSearch"
    >
      <n-icon :component="Search12Regular" :size="18" />
    </div>

    <!-- 收藏筛选按钮 -->
    <NTooltip placement="bottom">
      <template #trigger>
        <div
          :style="{
            padding: '0 12px 0 0',
            display: 'flex',
            alignItems: 'center',
            height: '100%',
            cursor: 'pointer',
            color: 'var(--muted-foreground)',
          }"
          @click="toggleFavorite"
        >
          <n-icon
            :component="Star12Regular"
            :size="18"
            :color="favoriteActive ? '#f5c842' : undefined"
          />
        </div>
      </template>
      筛选收藏-右键/长按卡片收藏
    </NTooltip>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'
import { NIcon, NCascader, NTooltip } from 'naive-ui'
import { Search12Regular, ChevronDown20Filled, Star12Regular } from '@vicons/fluent'
import searchEngines from '../data/searchEngines.json'

// 级联第一列的分类；顺序决定菜单里分组的先后
const ENGINE_GROUPS = [
  { value: 'engine', label: '搜索引擎', type: 'engine' },
  { value: 'wiki', label: '文档百科', type: 'wiki' },
  { value: 'community', label: '玩家社区', type: 'community' },
]

export default {
  name: 'SearchBar',
  components: {
    NIcon,
    NCascader,
    NTooltip,
  },
  props: {
    modelValue: {
      type: String,
      default: '',
    },
  },
  emits: ['internalSearch', 'update:modelValue', 'toggleFavorites'],
  setup(props, { emit }) {
    const STORAGE_KEY = 'search_engine_selected'

    // 先检查 URL 是否有 search 参数，有则强制使用站内搜索
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams('')
    const hasSearchParam = urlParams.has('search')
    const internalEngine = searchEngines.find((e) => e.type === 'internal')

    let initialEngine
    const ssrSafeLS = typeof localStorage !== 'undefined'
    if (hasSearchParam && internalEngine) {
      // URL 有 search 参数，强制使用站内搜索并保存
      initialEngine = internalEngine
      if (ssrSafeLS) localStorage.setItem(STORAGE_KEY, internalEngine.id)
    } else {
      // 从 localStorage 读取上次选择的搜索方式
      const savedEngineId = ssrSafeLS ? localStorage.getItem(STORAGE_KEY) : null
      const savedEngine = savedEngineId ? searchEngines.find((e) => e.id === savedEngineId) : null
      initialEngine = savedEngine || searchEngines[0]
    }

    const selectedEngine = ref(initialEngine)
    const searchQuery = ref(props.modelValue || '')
    let updatingFromOutside = false

    // 外部 modelValue 变化时同步到内部（URL参数/clearSearch）
    watch(
      () => props.modelValue,
      (newVal) => {
        if (!updatingFromOutside && newVal !== searchQuery.value) {
          updatingFromOutside = true
          searchQuery.value = newVal
        }
      },
    )

    // 用户输入时同步到外部，并更新地址栏（不触发路由导航）
    watch(searchQuery, (newVal) => {
      if (updatingFromOutside) {
        updatingFromOutside = false
        return
      }
      // 只在站内搜索时同步到父组件和地址栏
      if (selectedEngine.value.type === 'internal') {
        emit('update:modelValue', newVal)
        emit('internalSearch', newVal.trim())
        // 用 replaceState 静默更新地址栏，不触发路由变化和组件重载
        const url = new URL(window.location)
        const trimmed = newVal.trim()
        if (trimmed) {
          url.searchParams.set('search', trimmed)
        } else {
          url.searchParams.delete('search')
        }
        window.history.replaceState({}, '', url.toString())
      }
    })

    // 切换搜索方式时，如果是站内搜索，触发一次搜索
    watch(
      () => selectedEngine.value,
      (newEngine) => {
        if (newEngine.type === 'internal') {
          emit('internalSearch', searchQuery.value.trim())
        }
      },
    )

    const handleSelect = (key) => {
      const engine = searchEngines.find((e) => e.id === key)
      if (engine) {
        selectedEngine.value = engine
        // 保存到 localStorage
        localStorage.setItem(STORAGE_KEY, key)
      }
    }

    const doSearch = () => {
      const query = searchQuery.value.trim()

      const engine = selectedEngine.value
      if (engine.type === 'internal') {
        // 站内搜索逻辑 - 触发事件通知父组件
        emit('internalSearch', query)
      } else {
        if (!query) return
        // 其他搜索在新标签页打开
        const url = engine.url.replace('{query}', encodeURIComponent(query))
        window.open(url, '_blank')
      }
    }

    const handleKeydown = (e) => {
      if (e.key === 'Enter') {
        doSearch()
      }
    }

    // 清空搜索
    const clearSearch = () => {
      searchQuery.value = ''
      emit('internalSearch', '')
    }

    // 收藏筛选
    const favoriteActive = ref(false)
    const toggleFavorite = () => {
      favoriteActive.value = !favoriteActive.value
      emit('toggleFavorites', favoriteActive.value)
    }

    const engineOptions = computed(() => {
      const options = []
      const internal = searchEngines.find((e) => e.type === 'internal')
      if (internal) options.push({ label: internal.name, value: internal.id })
      ENGINE_GROUPS.forEach((group) => {
        const children = searchEngines
          .filter((e) => e.type === group.type)
          .map((e) => ({ label: e.name, value: e.id }))
        if (children.length > 0) {
          options.push({ label: group.label, value: group.value, children })
        }
      })
      return options
    })

    const placeholder = computed(() => {
      return selectedEngine.value?.placeholder || '回车开始搜索…'
    })

    return {
      selectedEngine,
      searchQuery,
      engineOptions,
      placeholder,
      Search12Regular,
      ChevronDown20Filled,
      Star12Regular,
      favoriteActive,
      toggleFavorite,
      handleSelect,
      doSearch,
      handleKeydown,
      clearSearch,
    }
  },
}
</script>

<style>
/* ===== 搜索方式选择 =====
   触发器保持原来的纯文字样式；级联控件透明铺满它，点击、弹层与选中都交给级联，
   可见的只有下面这层文字 + 箭头。 */
.search-engine-select {
  position: relative;
  display: flex;
  align-items: center;
  padding: 0 12px;
  height: 100%;
  cursor: pointer;
  user-select: none;
}

.search-engine-select__label {
  font-size: 13px;
  color: var(--foreground);
}

.search-engine-select__control {
  position: absolute;
  inset: 0;
  opacity: 0;
}

.search-engine-select__control .n-base-selection {
  width: 100%;
  height: 100%;
}
</style>

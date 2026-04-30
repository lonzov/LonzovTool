<template>
  <div
    :style="{
      background: 'var(--bg-card)',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      padding: '0',
      marginBottom: '24px',
      height: '44px',
      border: '1px solid var(--border-color)',
    }"
  >
    <!-- 搜索方式选择 -->
    <n-dropdown
      placement="bottom-start"
      trigger="click"
      size="medium"
      :options="dropdownOptions"
      @select="handleSelect"
      :style="{
        '--n-color': 'var(--bg-card)',
        '--n-text-color': 'var(--text-primary)',
        '--n-icon-color': 'var(--text-secondary)',
        '--n-divider-color': 'var(--border-color)',
        '--n-option-color-hover': 'var(--bg-sub)',
        '--n-group-header-color': 'var(--text-secondary)',
      }"
    >
      <div
        :style="{
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          height: '100%',
          userSelect: 'none',
          cursor: 'pointer',
        }"
      >
        <span :style="{ fontSize: '13px', color: 'var(--text-primary)' }">
          {{ selectedEngine?.name || '搜索' }}
        </span>
        <n-icon
          :component="ChevronDown20Filled"
          :size="14"
          color="var(--text-tertiary)"
          :style="{ marginLeft: '4px' }"
        />
      </div>
    </n-dropdown>

    <!-- 竖向分界线 -->
    <div
      :style="{
        width: '1px',
        height: '56%',
        background: 'var(--border-color)',
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
          color: 'var(--text-primary)',
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
        color: 'var(--text-secondary)',
        cursor: 'pointer',
      }"
      @click="doSearch"
    >
      <n-icon :component="Search12Regular" :size="18" />
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'
import { NIcon, NDropdown } from 'naive-ui'
import { Search12Regular, ChevronDown20Filled } from '@vicons/fluent'
import searchEngines from '../data/searchEngines.json'

export default {
  name: 'SearchBar',
  components: {
    NIcon,
    NDropdown,
  },
  props: {
    modelValue: {
      type: String,
      default: '',
    },
  },
  emits: ['internalSearch', 'update:modelValue'],
  setup(props, { emit }) {
    const STORAGE_KEY = 'search_engine_selected'

    // 先检查 URL 是否有 search 参数，有则强制使用站内搜索
    const urlParams = new URLSearchParams(window.location.search)
    const hasSearchParam = urlParams.has('search')
    const internalEngine = searchEngines.find((e) => e.type === 'internal')

    let initialEngine
    if (hasSearchParam && internalEngine) {
      // URL 有 search 参数，强制使用站内搜索并保存
      initialEngine = internalEngine
      localStorage.setItem(STORAGE_KEY, internalEngine.id)
    } else {
      // 从 localStorage 读取上次选择的搜索方式
      const savedEngineId = localStorage.getItem(STORAGE_KEY)
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

    const dropdownOptions = computed(() => {
      const result = []

      // 站内搜索
      const internal = searchEngines.find((e) => e.type === 'internal')
      if (internal) {
        result.push({
          label: internal.name,
          key: internal.id,
        })
      }

      // 分隔线
      result.push({ type: 'divider', key: 'divider-engine' })

      // 搜索引擎分组（带子菜单）
      const engines = searchEngines.filter((e) => e.type === 'engine')
      if (engines.length > 0) {
        result.push({
          label: '搜索引擎',
          key: 'group-engine',
          children: engines.map((e) => ({
            label: e.name,
            key: e.id,
          })),
        })
      }

      // 分隔线
      result.push({ type: 'divider', key: 'divider-wiki' })

      // 文档百科分组（带子菜单）
      const wikis = searchEngines.filter((e) => e.type === 'wiki')
      if (wikis.length > 0) {
        result.push({
          label: '文档百科',
          key: 'group-wiki',
          children: wikis.map((e) => ({
            label: e.name,
            key: e.id,
          })),
        })
      }

      // 分隔线
      result.push({ type: 'divider', key: 'divider-community' })

      // 玩家社区分组（带子菜单）
      const communities = searchEngines.filter((e) => e.type === 'community')
      if (communities.length > 0) {
        result.push({
          label: '玩家社区',
          key: 'group-community',
          children: communities.map((e) => ({
            label: e.name,
            key: e.id,
          })),
        })
      }

      return result
    })

    const placeholder = computed(() => {
      return selectedEngine.value?.placeholder || '回车开始搜索…'
    })

    return {
      selectedEngine,
      searchQuery,
      dropdownOptions,
      placeholder,
      Search12Regular,
      ChevronDown20Filled,
      handleSelect,
      doSearch,
      handleKeydown,
      clearSearch,
    }
  },
}
</script>

<style>
/* 禁止搜索方式选择菜单内文字被选中 */
.n-dropdown-option-body,
.n-dropdown-option-body__content,
.n-dropdown-group-header {
  user-select: none !important;
  -webkit-user-select: none !important;
  -moz-user-select: none !important;
  -ms-user-select: none !important;
}

/* 搜索方式下拉菜单描边（包括二级菜单） */
.n-dropdown-menu {
  border: 1px solid var(--border-color) !important;
}

/* 加强搜索方式下拉菜单阴影 */
/* 浅色模式 - 略微增强 */
[data-theme='light'] .n-dropdown-menu,
html:not([data-theme='dark']) .n-dropdown-menu {
  box-shadow:
    0 3px 6px -4px rgba(0, 0, 0, 0.16),
    0 6px 16px 0 rgba(0, 0, 0, 0.12),
    0 9px 28px 8px rgba(0, 0, 0, 0.08) !important;
}

/* 深色模式 - 着重增强 */
[data-theme='dark'] .n-dropdown-menu {
  box-shadow:
    0 3px 6px -4px rgba(0, 0, 0, 0.48),
    0 6px 12px 0 rgba(0, 0, 0, 0.36),
    0 9px 18px 8px rgba(0, 0, 0, 0.24) !important;
}
</style>

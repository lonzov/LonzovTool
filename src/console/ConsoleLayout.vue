<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSidebarSectionProvider } from '../composables/useSidebarSection.js'
import ConsolePageHeader from './components/ConsolePageHeader.vue'
import { CONSOLE_NAV, findConsoleNav } from './consoleNav.js'

const route = useRoute()
const router = useRouter()

const current = computed(() => findConsoleNav(route.path))

// 控制台目录挂在侧边栏分类栏上。目录本身不随子页面变化，key 固定为 'console'：
// 子页面之间切换不重放分类栏的切页动画，只有进出控制台才换源。
useSidebarSectionProvider('console', () => ({
  key: 'console',
  items: CONSOLE_NAV.map(({ key, label, icon }) => ({ key, label, icon })),
  selectedKey: current.value.key,
  onSelect: (key) => {
    if (key !== route.path) router.push(key)
  },
}))
</script>

<template>
  <div class="console-layout">
    <ConsolePageHeader
      :icon="current.icon"
      :title="current.title"
      :description="current.description"
    >
      <template #extra>
        <span class="console-readonly-pill" title="后端接口接入前，控制台只读取现有站点数据">只读</span>
      </template>
    </ConsolePageHeader>
    <RouterView />
  </div>
</template>

<style scoped>
.console-layout {
  max-width: 1200px;
  padding-top: 24px;
}

.console-readonly-pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  corner-shape: round;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--muted-foreground);
  white-space: nowrap;
  cursor: default;
  user-select: none;
  transition: color 0.4s ease, border-color 0.4s ease;
}
</style>

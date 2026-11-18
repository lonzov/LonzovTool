<script setup>
import { computed, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import {
  ArrowCircleLeft48Regular,
  Clock24Regular,
  History24Regular,
  Image24Regular,
  People24Regular,
  Settings24Regular,
} from '@vicons/fluent'
import { useSidebarSectionProvider } from '../../composables/useSidebarSection.js'
import { firstAccessibleConsoleChild } from '../consoleNav.js'
import { usePermissions } from '../usePermissions.js'

const route = useRoute()
const router = useRouter()
const { can } = usePermissions()

// 父级不再带权限，精确路径本身没有页面：落地到当前账号能进的第一个子页。
// 权限上下文由 ConsoleLayout 在权限就绪后才挂载，这里读到的 can 已是最终结果。
function isSystemRoot(path) {
  return (path || '').replace(/\/+$/, '') === '/console/system'
}

watch(
  () => route.path,
  (path) => {
    if (!isSystemRoot(path)) return
    router.replace(firstAccessibleConsoleChild('/console/system', can) || '/console')
  },
  { immediate: true },
)

const sections = computed(() => [
  {
    key: '/console',
    label: '返回控制台',
    icon: ArrowCircleLeft48Regular,
  },
  ...(can('system.manage')
    ? [
        {
          key: '/console/system/settings',
          label: '系统设置',
          icon: Settings24Regular,
        },
        {
          key: '/console/system/assets',
          label: '图片资产',
          icon: Image24Regular,
        },
        {
          key: '/console/system/tasks',
          label: '定时任务',
          icon: Clock24Regular,
        },
      ]
    : []),
  ...(can('accounts.manage')
    ? [
        {
          key: '/console/system/accounts',
          label: '账号管理',
          icon: People24Regular,
        },
      ]
    : []),
  ...(can('logs.read')
    ? [
        {
          key: '/console/system/logs',
          label: '管理日志',
          icon: History24Regular,
        },
      ]
    : []),
])

const selectedKey = computed(() => {
  const current = sections.value.find(
    (item) =>
      item.key !== '/console' &&
      (route.path === item.key || route.path.startsWith(`${item.key}/`)),
  )
  return current?.key || null
})

useSidebarSectionProvider(
  'console-system',
  () => ({
    key: 'console-system',
    items: sections.value,
    selectedKey: selectedKey.value,
    onSelect: (key) => {
      if (key && key !== route.path) router.push(key)
    },
  }),
  -1,
)
</script>

<template>
  <RouterView />
</template>

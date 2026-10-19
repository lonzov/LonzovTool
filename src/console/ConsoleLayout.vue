<script setup>
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { useSidebarSectionProvider } from '../composables/useSidebarSection.js'
import ConsolePageHeader from './components/ConsolePageHeader.vue'
import { CONSOLE_NAV, findConsoleNav } from './consoleNav.js'
import { useConsoleAuth } from './consoleAuth.js'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const { account, logout, verify } = useConsoleAuth()

const current = computed(() => findConsoleNav(route.path))
const roleLabel = computed(() => (account.value?.role === 'admin' ? '管理员' : '账号'))

async function handleLogout() {
  try {
    await logout()
  } catch (e) {
    // 本地已经解绑，但远端会话没被作废（HttpOnly Cookie 只能由服务端清），如实告知
    message.warning(`本地已退出，但未能通知服务端注销会话：${e?.message || '请求失败'}`)
  }
  router.push('/console/login')
}

// 本地账号痕迹只是体验层，进控制台必须问一次服务端：过期、被吊销或手工伪造的凭证都过不了这一步
onMounted(async () => {
  try {
    await verify()
  } catch (e) {
    if (e?.code === 'unauthorized') {
      router.replace({ path: '/console/login', query: { redirect: route.fullPath } })
      return
    }
    // 网络或服务端问题不等于登录失效，不能因此把人踢下线
    message.error(e?.message || '会话校验失败，请稍后重试')
  }
})

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
        <span v-if="account" class="console-account">
          <span class="console-account-name">{{ account.name }}</span>
          <span class="console-account-role">{{ roleLabel }}</span>
        </span>
        <button class="app-btn app-btn--text app-btn--sm" type="button" @click="handleLogout">
          退出
        </button>
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

.console-account {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  corner-shape: round;
  white-space: nowrap;
  transition: border-color 0.4s ease;
}

.console-account-name {
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--foreground);
  transition: color 0.4s ease;
}

.console-account-role {
  font-size: 0.72rem;
  color: var(--subtle-foreground);
  transition: color 0.4s ease;
}
</style>

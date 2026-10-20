<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { NIcon, useMessage } from 'naive-ui'
import { Warning24Regular } from '@vicons/fluent'
import { useSidebarSectionProvider } from '../composables/useSidebarSection.js'
import ConsolePageHeader from './components/ConsolePageHeader.vue'
import { findConsoleNav, visibleConsoleNav } from './consoleNav.js'
import { useConsoleAuth } from './consoleAuth.js'
import { provideConsolePermissions } from './usePermissions.js'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const { account, mustChangePassword, permissionsReady, logout, verify } = useConsoleAuth()
const { can } = provideConsolePermissions()

const checking = ref(true)
const sessionError = ref('')

const navItems = computed(() =>
  visibleConsoleNav(can).map(({ key, label, icon }) => ({ key, label, icon })),
)
const current = computed(() => findConsoleNav(route.path))
// 目录里没权限的项不渲染，直接在地址栏输进来的同样拦下：权限未就绪前不能判定，等 /me 回来
const denied = computed(() => {
  const required = route.meta.permission
  return !!required && !can(required)
})
const roleLabel = computed(() => (account.value?.roles || []).join(' · '))

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
async function checkSession() {
  checking.value = true
  sessionError.value = ''
  try {
    await verify()
  } catch (e) {
    if (e?.code === 'unauthorized') {
      router.replace({ path: '/console/login', query: { redirect: route.fullPath } })
      return
    }
    // 网络或服务端问题不等于登录失效，不能因此把人踢下线
    sessionError.value = e?.message || '会话校验失败，请稍后重试'
    message.error(sessionError.value)
  } finally {
    checking.value = false
  }
}

onMounted(checkSession)

// 控制台目录挂在侧边栏分类栏上。目录本身不随子页面变化，key 固定为 'console'：
// 子页面之间切换不重放分类栏的切页动画，只有进出控制台才换源。
useSidebarSectionProvider('console', () => ({
  key: 'console',
  items: navItems.value,
  selectedKey: current.value.key,
  onSelect: (key) => {
    if (key !== route.path) router.push(key)
  },
}))
</script>

<template>
  <div class="console-layout">
    <div v-if="mustChangePassword" class="password-banner" role="status">
      <NIcon :component="Warning24Regular" :size="15" class="password-banner-icon" />
      <span class="password-banner-text">当前是临时密码，请先修改密码</span>
      <RouterLink class="app-btn app-btn--outline app-btn--sm" to="/console/account">
        去修改
      </RouterLink>
    </div>

    <ConsolePageHeader
      :icon="current.icon"
      :title="current.title"
      :description="current.description"
    >
      <template #extra>
        <RouterLink
          v-if="account"
          class="account-chip"
          to="/console/account"
          :title="account.email ? `我的账号 · ${account.email}` : '我的账号'"
        >
          <span class="account-chip-name">{{ account.name }}</span>
          <span v-if="roleLabel" class="account-chip-role">{{ roleLabel }}</span>
        </RouterLink>
        <button class="app-btn app-btn--text app-btn--sm" type="button" @click="handleLogout">
          退出
        </button>
      </template>
    </ConsolePageHeader>

    <p v-if="!permissionsReady && checking" class="console-gate">正在校验会话…</p>
    <div v-else-if="!permissionsReady" class="console-gate">
      <p class="console-gate-text">{{ sessionError || '会话校验未完成' }}</p>
      <button
        class="app-btn app-btn--outline app-btn--sm"
        type="button"
        :disabled="checking"
        @click="checkSession"
      >
        重试
      </button>
    </div>
    <p v-else-if="denied" class="console-gate">没有访问权限</p>
    <RouterView v-else />
  </div>
</template>

<style scoped>
.console-layout {
  max-width: 1200px;
  padding-top: 24px;
}

/* 临时密码提示：常驻而不是弹窗，页面上任何操作都可能被后端拦下，必须一直看得见 */
.password-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 8px 12px;
  border: 1px solid color-mix(in srgb, var(--warning) 32%, transparent);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--warning) 12%, transparent);
  transition: background-color 0.4s ease, border-color 0.4s ease;
}

.password-banner-icon {
  flex-shrink: 0;
  color: var(--warning);
  transition: color 0.4s ease;
}

.password-banner-text {
  flex: 1;
  min-width: 0;
  color: var(--foreground);
  font-size: 0.8rem;
  line-height: 1.5;
  transition: color 0.4s ease;
}

/* 提示条里的按钮沿用提示条自己的底色与边框，避免一块卡片底色突然插进来 */
.password-banner .app-btn {
  border-color: color-mix(in srgb, var(--warning) 32%, transparent);
  background: color-mix(in srgb, var(--warning) 12%, transparent);
  color: var(--foreground);
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.password-banner .app-btn:hover {
  border-color: color-mix(in srgb, var(--warning) 48%, transparent);
  background: color-mix(in srgb, var(--warning) 20%, transparent);
}

/* 页头账号胶囊。类名刻意不叫 console-account：页面根节点若同名会被这里的
   圆角与描边命中（父组件的 scoped 样式会作用到子组件根节点） */
.account-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  corner-shape: round;
  white-space: nowrap;
  text-decoration: none;
  transition: border-color 0.4s ease, background-color 0.2s ease;
}

.account-chip:hover {
  background: var(--accent);
}

.account-chip-name {
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--foreground);
  transition: color 0.4s ease;
}

.account-chip-role {
  font-size: 0.72rem;
  color: var(--subtle-foreground);
  transition: color 0.4s ease;
}

.console-gate {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin: 48px 0 0;
  color: var(--subtle-foreground);
  font-size: 0.84rem;
  transition: color 0.4s ease;
}

.console-gate-text {
  margin: 0;
}
</style>

import './assets/main.css'

import { createApp } from 'vue'
import {
  NConfigProvider,
  NLayout,
  NLayoutSider,
  NLayoutContent,
  NLayoutHeader,
  NButton,
  NIcon,
  NDrawer,
  NDrawerContent,
  NMenu,
  NScrollbar,
} from 'naive-ui'
import App from './App.vue'
import router from './router'
import NProgress from 'nprogress'
import { createHead } from '@vueuse/head'

const head = createHead()

const app = createApp(App)

app.component('NConfigProvider', NConfigProvider)
app.component('NLayout', NLayout)
app.component('NLayoutSider', NLayoutSider)
app.component('NLayoutContent', NLayoutContent)
app.component('NLayoutHeader', NLayoutHeader)
app.component('NButton', NButton)
app.component('NIcon', NIcon)
app.component('NDrawer', NDrawer)
app.component('NDrawerContent', NDrawerContent)
app.component('NMenu', NMenu)
app.component('NScrollbar', NScrollbar)

app.use(head)
app.use(router)

// 禁用浏览器自动滚动恢复，避免 SPA 导航时浏览器覆盖手动 scrollTo 行为
if (typeof window !== 'undefined' && 'scrollRestoration' in history) {
  history.scrollRestoration = 'manual'
}

// SW 离线诊断：若 SW 标记了离线状态，在 mount 前修改 URL 为 /offline
// 必须在 app.mount 之前，因为 mount 会同步触发 Router 初始路由解析
if (window.__SW_OFFLINE) {
  window.history.replaceState(null, '', '/offline')
}

app.mount('#app')

// SPA 内部页面切换时，懒加载 chunk 加载失败（如离线）的处理
router.onError((error) => {
  if (error.message.includes('Failed to fetch dynamically imported module') ||
    error.message.includes('Importing a module script failed') ||
    error.message.includes('error loading dynamically imported module')) {
    NProgress.done()

      // 跳转离线页前先检测服务器连通性
      ; (async () => {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 10000)
          await fetch('https://tool.lonzov.top/', { mode: 'no-cors', signal: controller.signal, cache: 'no-store' })
          clearTimeout(timeoutId)
          // 服务器可达，不做任何处理
        } catch {
          // 服务器不可达，跳转离线诊断页
          window.location.href = '/offline'
        }
      })()
  }
})

// 移除全屏加载动画
const loadingEl = document.getElementById('loading-overlay')
if (loadingEl) {
  loadingEl.classList.add('hidden')
  setTimeout(() => loadingEl.remove(), 420)
}

// 等待 Vue Router 初始导航完成（含懒加载组件）后通知预渲染可抓取
router.isReady().then(() => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('app-rendered'))
  }
})

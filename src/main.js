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

app.mount('#app')

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

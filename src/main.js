import './assets/main.css'
import { ViteSSG } from 'vite-ssg'
import { setup } from '@css-render/vue3-ssr'
import {
  NConfigProvider,
  NLayout,
  NLayoutSider,
  NLayoutContent,
  NLayoutHeader,
  NIcon,
  NDrawer,
  NDrawerContent,
  NMenu,
  NScrollbar,
} from 'naive-ui'

import App from './App.vue'
import { routes, setupRouterGuards } from './router'
import { recordFirstOpen } from './composables/useLocalStats.js'

// 模块级变量：存储 vite-ssg 创建的 head 实例，供 App.vue 客户端侧绕过
// inject(headSymbol) 直接调用 head.push()（避免 Vite Dev 模式下 @unhead/vue
// 与 @unhead/vue/client 内部 headSymbol 因分包导致符号不一致）
let globalHead = null
export function getGlobalHead() {
  return globalHead
}

/**
 * Naive UI 的 CSS-in-JS 由 @css-render 收集，收集器与 app 实例一一对应。
 * vite-ssg 只从 vite.config.js 的 ssgOptions 读 onPageRendered（写在入口第四个参数里不生效），
 * 入口与配置之间无法直接传值，故在此按 app 登记收集器，由 ssgOptions 取出注入 HTML。
 * 用 WeakMap 而非单个变量：预渲染并发渲染多个路由，共用一份会串页。
 */
globalThis.__ssrCssCollectors = new WeakMap()

export const createApp = ViteSSG(
  App,
  { routes },
  ({ app, router, isClient, head }) => {
    // 捕获 head 实例供 App.vue 客户端侧使用
    if (head) globalHead = head
    // vite-ssg 内部无参 createHead()，unhead 服务端默认注入 htmlAttrs.lang="en"，
    // 预渲染时会把模板的 zh-CN 覆盖掉，这里显式声明语言以压回默认值
    head?.push({ htmlAttrs: { lang: 'zh-CN' } })
    // ---- Naive UI 全局组件注册 ----
    app.component('NConfigProvider', NConfigProvider)
    app.component('NLayout', NLayout)
    app.component('NLayoutSider', NLayoutSider)
    app.component('NLayoutContent', NLayoutContent)
    app.component('NLayoutHeader', NLayoutHeader)
    app.component('NIcon', NIcon)
    app.component('NDrawer', NDrawer)
    app.component('NDrawerContent', NDrawerContent)
    app.component('NMenu', NMenu)
    app.component('NScrollbar', NScrollbar)

    // ---- Naive UI CSS-in-JS 样式收集 ----
    // 只登记收集器，注入由 vite.config.js 的 ssgOptions.onPageRendered 完成
    globalThis.__ssrCssCollectors.set(app, setup(app).collect)

    // ---- 路由守卫 (顶部加载条 + SEO head) ----
    setupRouterGuards(router)

    // ===== 浏览器专属代码 =====
    if (isClient) {
      // 首次打开时间：只记一次，用于本地统计
      recordFirstOpen()

      // 禁用浏览器自动滚动恢复
      if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual'
      }

      // SW 离线诊断：若 SW 标记了离线状态，在 mount 前修改 URL 为 /offline
      if (window.__SW_OFFLINE) {
        window.history.replaceState(null, '', '/offline')
      }

      // 移除全屏加载动画
      router.isReady().then(() => {
        const loadingEl = document.getElementById('loading-overlay')
        if (loadingEl) {
          loadingEl.classList.add('hidden')
          setTimeout(() => loadingEl.remove(), 420)
        }
      })
    }
  },
)

import './assets/main.css'
import { ViteSSG } from 'vite-ssg'
import { setup } from '@css-render/vue3-ssr'
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
import NProgress from 'nprogress'
import App from './App.vue'
import { routes, setupRouterGuards } from './router'

// 模块级变量：存储 Naive UI CSS 收集器引用，供 onPageRendered 使用
let collectCss = null

export const createApp = ViteSSG(
  App,
  { routes },
  ({ app, router, isClient }) => {
    // ---- Naive UI 全局组件注册 ----
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

    // ---- Naive UI CSS-in-JS SSR 样式收集 ----
    const { collect } = setup(app)
    collectCss = collect

    // ---- 路由守卫 (NProgress + SEO head) ----
    setupRouterGuards(router)

    // ===== 浏览器专属代码 =====
    if (isClient) {
      // 禁用浏览器自动滚动恢复
      if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual'
      }

      // SW 离线诊断：若 SW 标记了离线状态，在 mount 前修改 URL 为 /offline
      if (window.__SW_OFFLINE) {
        window.history.replaceState(null, '', '/offline')
      }

      // SPA 内部页面切换时，懒加载 chunk 加载失败（如离线）的处理
      router.onError((error) => {
        if (
          error.message.includes('Failed to fetch dynamically imported module') ||
          error.message.includes('Importing a module script failed') ||
          error.message.includes('error loading dynamically imported module')
        ) {
          NProgress.done()
          ;(async () => {
            try {
              const controller = new AbortController()
              const timeoutId = setTimeout(() => controller.abort(), 10000)
              await fetch('https://tool.lonzov.top/', {
                mode: 'no-cors',
                signal: controller.signal,
                cache: 'no-store',
              })
              clearTimeout(timeoutId)
            } catch {
              window.location.href = '/offline'
            }
          })()
        }
      })

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
  {
    headEnabled: true,
    // 预渲染完成后注入 Naive UI SSR 样式
    async onPageRendered(_route, html, _isClient) {
      if (collectCss) {
        const css = collectCss()
        if (css) {
          return html.replace('</head>', `<style data-ssr-css>${css}</style></head>`)
        }
      }
      return html
    },
  },
)

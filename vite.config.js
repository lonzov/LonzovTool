import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { themeCssText } from './src/theme/tokens.js'

/**
 * 把设计 token 生成的 CSS 注入 index.html。
 *
 * 不走 useHead() 是因为 unhead 的 style 权重（60）低于 meta（100），
 * 会被 scripts/reorder-head.js 连同 og:title 之后的整段一起搬走，导致
 * dev 与线上产物的样式顺序不一致。
 *
 * 用 injectTo: 'head' 而不是 'head-prepend' —— 这段样式有 3.6KB，
 * 插到 head 最前面会把 <meta charset> 推到 1024 字节之外，中文环境下
 * 浏览器可能先用回退编码渲染再重解析，出现花屏闪烁。
 */
function injectThemeTokens() {
  return {
    name: 'inject-theme-tokens',
    transformIndexHtml() {
      return [
        {
          tag: 'style',
          attrs: { id: 'theme-tokens' },
          children: themeCssText,
          injectTo: 'head',
        },
      ]
    },
  }
}

/* 构建时剔除 contributors.json 中的 qq 隐私字段，并压缩为单行 */
function stripContributorQQ() {
  return {
    name: 'strip-contributor-qq',
    enforce: 'post',
    transform(code, id) {
      if (!id.includes('contributors.json')) return
      const match = code.match(/^export default (\[[\s\S]*\])\s*$/)
      if (!match) return
      try {
        const data = JSON.parse(match[1])
        const stripped = data.map((c) => {
          if (c && typeof c === 'object' && !Array.isArray(c)) {
            const { qq: _qq, ...rest } = c
            return rest
          }
          return c
        })
        return `export default ${JSON.stringify(stripped)}`
      } catch {
        return null
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    injectThemeTokens(),
    vue(),
    vueDevTools(),
    stripContributorQQ(),
  ],
  // 后端反代：前端在所有环境统一使用 /api、/uploads 相对路径，从而不必引入
  // VITE_API_BASE 之类的环境分支，也不存在跨域与 Cookie 域问题。
  // preview 的 host/port/proxy 默认继承 server，配这一处即可同时覆盖 pnpm dev 与 pnpm preview。
  server: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:8010', changeOrigin: true },
      '/uploads': { target: 'http://127.0.0.1:8010', changeOrigin: true },
    },
  },
  ssgOptions: {
    dirStyle: 'nested',
    // 控制台不参与预渲染：它是登录后才用的管理界面，静态 HTML 没有意义，也不该被收录
    // （robots.txt 另见 scripts/generate-seo.js 的 DISALLOW_PATHS）。
    // 入参是路径字符串数组，且本回调会覆盖 vite-ssg 的默认过滤，故须自行剔除动态路径。
    includedRoutes: (paths) =>
      paths.filter(
        (path) => !path.includes(':') && !path.includes('*') && !path.startsWith('/console'),
      ),
    /**
     * 把 Naive UI 的 CSS-in-JS 样式内联进产物，避免首屏无样式闪烁。
     * collect() 返回的是若干 <style cssr-id> 片段而非纯 CSS，必须整体当标记插入 ——
     * 再套一层 <style> 会形成 style 嵌 style，浏览器在第一个 </style> 就把外层截断。
     */
    onPageRendered(_route, html, context) {
      const collect = globalThis.__ssrCssCollectors?.get(context?.app)
      const css = collect?.()
      return css ? html.replace('</head>', `${css}</head>`) : html
    },
  },
  optimizeDeps: {
    // @unhead/vue 与 @unhead/vue/client 共享内部 headSymbol，必须排除预构建
    // 否则 Vite Dev 模式下两个入口分别打包，符号不同导致 useHead() inject 失败
    exclude: ['@unhead/vue'],
  },
  ssr: {
    // Bundle naive-ui into SSR build (needed for @css-render/vue3-ssr integration)
    noExternal: ['naive-ui', '@css-render/vue3-ssr'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // 仅对 node_modules 进行分包；避免 naive-ui ↔ vue 循环引用
          if (id.includes('node_modules')) {
            if (id.includes('@vicons/fluent')) return 'vicons-fluent'
          }
        },
        // 入口文件（index.js 等）
        entryFileNames: 'assets/js/[name]-[hash].js',
        // 代码分割后的 chunk 文件
        chunkFileNames: 'assets/js/[name]-[hash].js',
        // 静态资源文件（CSS、图片等）
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'assets/css/[name]-[hash].[ext]'
          }
          // 推广图（src/assets/ads/）单独走带哈希的目录：素材按档期覆盖、文件名不变，
          // 不带哈希会与旧图同名，浏览器和 CDN 会一直吃缓存而看不到新图
          const sources = assetInfo.originalFileNames ?? []
          if (sources.some((file) => file.replace(/\\/g, '/').includes('/assets/ads/'))) {
            return 'assets/ads/[name]-[hash].[ext]'
          }
          return 'assets/[name].[ext]'
        },
      },
    },
    // 调整块大小警告限制
    chunkSizeWarningLimit: 300,
  },
})

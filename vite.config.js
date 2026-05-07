import { fileURLToPath, URL } from 'node:url'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SITE_URL = 'https://tool.lonzov.top'

// 被 robots.txt 禁止的路径
const DISALLOW_PATHS = ['/submit']

// 站点所有公开页面路径
const PAGES = [
  '/',
  '/docs',
  '/docs/privacy',
  '/donate',
  '/c/qjzh/',
  '/c/tr/',
  '/c/raw-json/',
  '/c/execute/',
  '/c/fuhao/',
]

/** Vite 插件：构建完成后生成 sitemap.xml 和 robots.txt */
function seoPlugin() {
  return {
    name: 'vite-plugin-seo',
    closeBundle() {
      const distDir = join(__dirname, 'dist')

      // sitemap.xml
      const now = new Date().toISOString()
      const allowedPages = PAGES.filter(p => !DISALLOW_PATHS.some(d => p.startsWith(d)))
      const urls = allowedPages.map(path =>
        `    <url>\n        <loc>${SITE_URL}${path}</loc>\n        <lastmod>${now}</lastmod>\n    </url>`
      ).join('\n')
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
      writeFileSync(join(distDir, 'sitemap.xml'), sitemap, 'utf-8')
      console.log('[seo] 已生成 sitemap.xml')

      // robots.txt
      const disallowRules = DISALLOW_PATHS.map(p => `Disallow: ${p}`).join('\n')
      const robots = `User-agent: *\n${disallowRules}\nSitemap: ${SITE_URL}/sitemap.xml`
      writeFileSync(join(distDir, 'robots.txt'), robots, 'utf-8')
      console.log('[seo] 已生成 robots.txt')
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    seoPlugin(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vue 核心库 - 最高优先级，最先加载
          'vue-core': ['vue'],
          // naive-ui 核心 - 单独分包，按需加载
          'naive-ui': ['naive-ui'],
          // 图标库 - 较大，单独分包
          'vicons-fluent': ['@vicons/fluent'],
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
          return 'assets/[name].[ext]'
        },
      },
    },
    // 调整块大小警告限制
    chunkSizeWarningLimit: 300,
  },
})

import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

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
    vue(),
    vueDevTools(),
    stripContributorQQ(),
  ],
  ssgOptions: {
    dirStyle: 'nested',
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
          return 'assets/[name].[ext]'
        },
      },
    },
    // 调整块大小警告限制
    chunkSizeWarningLimit: 300,
  },
})

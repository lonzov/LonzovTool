import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  ssgOptions: {
    dirStyle: 'nested',
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

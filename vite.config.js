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

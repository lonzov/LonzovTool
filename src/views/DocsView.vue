<script setup>
import { ref, watchEffect, nextTick, computed } from 'vue'
import { createApp } from 'vue'
import MarkdownRenderer from '../components/MarkdownRenderer.vue'
import AboutView from './AboutView.vue'
import NotFoundView from './NotFoundView.vue'
import IframeForm from '../components/IframeForm.vue'
import DonateCard from '../components/DonateCard.vue'
import DonateRecords from '../components/DonateRecords.vue'
import StatsInfoBar from '../components/StatsInfoBar.vue'

const props = defineProps({
  docName: {
    type: String,
    default: '',
  },
})

const processedRaw = ref('')
const loading = ref(true)
const error = ref(null)
const docNotFound = computed(() => error.value && error.value.startsWith('文档不存在'))

// 存储组件实例以便清理
const componentApps = []

// 使用 Vite 的 import.meta.glob 动态加载 markdown 文件
const docsModules = import.meta.glob('../docs/*.md', { query: '?raw', import: 'default' })

// 文档映射：URL 路径 -> 文件路径
const docMap = {
  '': '../docs/index.md',
  '/': '../docs/index.md',
  introduction: '../docs/introduction.md',
  'url-tj': '../docs/url-tj.md',
  privacy: '../docs/privacy.md',
  donate: '../docs/donate.md',
  faq: '../docs/faq.md',
  dev: '../docs/dev.md',
}

// 将组件渲染到 markdown 中的占位符位置
function mountComponentsToPlaceholders() {
  // SSR 安全：DOM 操作仅在客户端执行
  if (typeof window === 'undefined') return

  // 清理旧的组件实例
  componentApps.forEach(app => app.unmount())
  componentApps.length = 0

  nextTick(() => {
    // iframe-form 占位符
    const iframePlaceholders = document.querySelectorAll('.iframe-form-placeholder')
    iframePlaceholders.forEach(placeholder => {
      const id = placeholder.dataset.formId
      const src = placeholder.dataset.formSrc
      const height = parseInt(placeholder.dataset.formHeight) || 600

      const app = createApp(IframeForm, { src, height, id })
      app.mount(placeholder)
      componentApps.push(app)
    })

    // donate-card 占位符
    const donatePlaceholders = document.querySelectorAll('.donate-card-placeholder')
    donatePlaceholders.forEach(placeholder => {
      const app = createApp(DonateCard)
      app.mount(placeholder)
      componentApps.push(app)
    })

    // donate-records 占位符
    const recordsPlaceholders = document.querySelectorAll('.donate-records-placeholder')
    recordsPlaceholders.forEach(placeholder => {
      const app = createApp(DonateRecords)
      app.mount(placeholder)
      componentApps.push(app)
    })

    // stats-info-bar 占位符
    const statsPlaceholders = document.querySelectorAll('.stats-info-bar-placeholder')
    statsPlaceholders.forEach(placeholder => {
      const app = createApp(StatsInfoBar)
      app.mount(placeholder)
      componentApps.push(app)
    })
  })
}

async function loadDoc(name) {
  loading.value = true
  error.value = null

  try {
    const filePath = docMap[name]
    if (!filePath) {
      throw new Error(`文档不存在: ${name}`)
    }
    const loader = docsModules[filePath]
    if (!loader) {
      throw new Error(`文档不存在: ${name}`)
    }
    const raw = await loader()

    // 替换组件标记为占位符
    let result = raw.replace(
      /<iframe-form\s+src="([^"]+)"(?:\s+height="(\d+)")?(?:\s+key="([^"]+)")?\s*\/>/g,
      (match, src, height, key) => {
        const id = key || `form-${src.replace(/[^a-zA-Z0-9]/g, '_')}`
        return `<div class="iframe-form-placeholder" data-form-src="${src}" data-form-height="${height || 600}" data-form-id="${id}"></div>`
      }
    )

    // 替换 donate-card 组件标记
    result = result.replace(
      /<donate-card\s*\/>/g,
      '<div class="donate-card-placeholder"></div>'
    )

    // 替换 donate-records 组件标记
    result = result.replace(
      /<donate-records\s*\/>/g,
      '<div class="donate-records-placeholder"></div>'
    )

    // 替换 stats-info-bar 组件标记
    result = result.replace(
      /<stats-info-bar\s*\/>/g,
      '<div class="stats-info-bar-placeholder"></div>'
    )

    // 处理流光渐变文字标签
    result = result.replace(
      /<gradient-text(?:\s+color="(\w+)")?\s*>(.+?)<\/gradient-text>/gs,
      (match, color, text) => {
        const cls = color ? `shimmer shimmer-${color}` : 'shimmer'
        return `<span class="${cls}">${text}</span>`
      }
    )

    processedRaw.value = result
  } catch (e) {
    error.value = e.message
    processedRaw.value = ''
  } finally {
    loading.value = false
  }
}

// 当 docName 变化时自动加载
watchEffect(() => {
  const name = props.docName || ''
  if (name === '' || name === '/') {
    loading.value = false
    error.value = null
    processedRaw.value = ''
    return
  }
  loadDoc(name)
})
</script>

<template>
  <div class="docs-view">
    <AboutView v-if="!docName || docName === '' || docName === '/'" />

    <NotFoundView v-if="docNotFound" />
    <div v-else-if="loading || error" class="docs-loading" :class="{ 'docs-loading--error': error }">
      <div class="docs-loader-wrapper">
        <div class="docs-loader"></div>
      </div>
      <div class="docs-loading-text">{{ error ? ('加载失败：' + error) : '加载中...' }}</div>
    </div>
    <MarkdownRenderer v-else :raw="processedRaw" @rendered="mountComponentsToPlaceholders" />
  </div>
</template>

<style scoped>
/* 加载动画 */
.docs-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.6em;
  padding: 14em 0;
}

.docs-loader-wrapper {
  font-size: clamp(7px, 1.75vw, 12px);
  line-height: 0;
}

.docs-loader {
  width: 50px;
  aspect-ratio: 1;
  border-radius: 50%;
  border: 8px solid;
  animation: docs-loader-spin 1s infinite;
  filter: drop-shadow(0 0 8px rgba(128, 140, 160, 0.4));
}

[data-theme='dark'] .docs-loader {
  border-color: #e7e7e7 #ffffff00;
}

[data-theme='light'] .docs-loader {
  border-color: #000000 #ffffff00;
}

/* 错误状态：停止转动，颜色变红 */
.docs-loading--error .docs-loader {
  animation: none;
  border-color: #E46962 #ffffff00;
}

@keyframes docs-loader-spin {
  to { transform: rotate(0.5turn); }
}

.docs-loading-text {
  color: var(--text-secondary);
  font-size: 1em;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-align: center;
  position: relative;
}
</style>

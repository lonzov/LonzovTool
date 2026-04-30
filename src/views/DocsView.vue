<script setup>
import { ref, watchEffect, shallowRef, nextTick, onMounted, onUnmounted } from 'vue'
import { createApp } from 'vue'
import { useRouter } from 'vue-router'
import MarkdownIt from 'markdown-it'
import AboutView from './AboutView.vue'
import IframeForm from '../components/IframeForm.vue'
import DonateCard from '../components/DonateCard.vue'
import DonateRecords from '../components/DonateRecords.vue'

const router = useRouter()

const props = defineProps({
  docName: {
    type: String,
    default: '',
  },
})

const md = shallowRef(new MarkdownIt({
  html: true,
  linkTarget: '_blank',
  highlight(str, lang) {
    return `<pre><code class="hljs language-${lang || ''}">${md.value.utils.escapeHtml(str)}</code></pre>`
  },
}))

const content = ref('')
const loading = ref(true)
const error = ref(null)

// 存储组件实例以便清理
const componentApps = []

// 使用 Vite 的 import.meta.glob 动态加载 markdown 文件（非 eager，按需加载）
const docsModules = import.meta.glob('../docs/*.md', { query: '?raw', import: 'default' })

// 文档映射：URL 路径 -> 文件路径
const docMap = {
  '': '../docs/index.md',
  '/': '../docs/index.md',
  introduction: '../docs/introduction.md',
  'url-tj': '../docs/url-tj.md',
  privacy: '../docs/privacy.md',
  donate: '../docs/donate.md',
}

// 将组件渲染到 markdown 中的占位符位置
function mountComponentsToPlaceholders() {
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
  })
}

async function loadDoc(name) {
  loading.value = true
  error.value = null

  try {
    const filePath = docMap[name] || docMap['']
    const loader = docsModules[filePath]
    if (!loader) {
      throw new Error(`文档不存在: ${name || 'index'}`)
    }
    const raw = await loader()

    // 替换组件标记为占位符
    let processedRaw = raw.replace(
      /<iframe-form\s+src="([^"]+)"(?:\s+height="(\d+)")?(?:\s+key="([^"]+)")?\s*\/>/g,
      (match, src, height, key) => {
        const id = key || `form-${src.replace(/[^a-zA-Z0-9]/g, '_')}`
        return `<div class="iframe-form-placeholder" data-form-src="${src}" data-form-height="${height || 600}" data-form-id="${id}"></div>`
      }
    )

    // 替换 donate-card 组件标记
    processedRaw = processedRaw.replace(
      /<donate-card\s*\/>/g,
      '<div class="donate-card-placeholder"></div>'
    )

    // 替换 donate-records 组件标记
    processedRaw = processedRaw.replace(
      /<donate-records\s*\/>/g,
      '<div class="donate-records-placeholder"></div>'
    )

    content.value = md.value.render(processedRaw)

    // DOM 更新后渲染组件到占位符
    mountComponentsToPlaceholders()
  } catch (e) {
    error.value = e.message
    content.value = ''
  } finally {
    loading.value = false
  }
}

// 当 docName 变化时自动加载
watchEffect(() => {
  loadDoc(props.docName || '')
})

// 拦截文档内容中的链接点击，转换为 SPA 内部跳转
let contentClickHandler = null

function setupLinkInterception() {
  // 移除旧的事件监听器
  if (contentClickHandler) {
    document.removeEventListener('click', contentClickHandler)
  }

  // 等待 DOM 更新
  nextTick(() => {
    const docsContent = document.querySelector('.docs-content')
    if (!docsContent) return

    contentClickHandler = (e) => {
      const link = e.target.closest('a')
      if (!link) return

      const href = link.getAttribute('href')
      if (!href) return

      // 检查是否是内部链接（以 /?search= 开头）
      if (href.startsWith('/?search=')) {
        e.preventDefault()
        const searchQuery = href.split('?search=')[1] || ''
        // 解码 search 参数
        try {
          router.push({ path: '/', query: { search: decodeURIComponent(searchQuery) } })
        } catch {
          router.push({ path: '/', query: { search: searchQuery } })
        }
      } else {
        // 非内部链接一律在新标签页打开
        link.setAttribute('target', '_blank')
        link.setAttribute('rel', 'noopener noreferrer')
      }
    }

    document.addEventListener('click', contentClickHandler)
  })
}

onMounted(() => {
  setupLinkInterception()
})

onUnmounted(() => {
  if (contentClickHandler) {
    document.removeEventListener('click', contentClickHandler)
  }
})

// 当文档内容变化时，重新设置链接拦截
watchEffect(() => {
  if (content.value) {
    setupLinkInterception()
  }
})
</script>

<template>
  <div class="docs-view">
    <AboutView v-if="!docName || docName === '' || docName === '/'" />

    <div v-if="loading || error" class="docs-loading" :class="{ 'docs-loading--error': error }">
      <div class="docs-loader-wrapper">
        <div class="docs-loader"></div>
      </div>
      <div class="docs-loading-text">{{ error ? ('加载失败：' + error) : '加载中...' }}</div>
    </div>
    <div v-else-if="!loading && !error" class="docs-content" v-html="content" />
  </div>
</template>

<style scoped>
.docs-content {
  color: var(--text-primary);
  line-height: 1.8;
}

.docs-content :deep(h1) {
  font-size: 2em;
  margin: 0.67em 0;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.3em;
}

.docs-content :deep(h2) {
  font-size: 1.5em;
  margin: 0.83em 0;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.3em;
}

.docs-content :deep(h3) {
  font-size: 1.17em;
  margin: 1em 0;
}

.docs-content :deep(p) {
  margin: 0.8em 0;
}

.docs-content :deep(ul),
.docs-content :deep(ol) {
  padding-left: 2em;
}

.docs-content :deep(code) {
  background: var(--bg-sub);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
}

.docs-content :deep(pre) {
  background: var(--bg-sub);
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
}

.docs-content :deep(pre code) {
  background: transparent;
  padding: 0;
}

.docs-content :deep(blockquote) {
  border-left: 4px solid var(--primary-color);
  padding-left: 16px;
  margin: 16px 0;
  color: var(--text-secondary);
}

.docs-content :deep(img) {
  max-width: 100%;
  height: auto;
}

.docs-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 16px 0;
}

.docs-content :deep(th),
.docs-content :deep(td) {
  border: 1px solid var(--border-color);
  padding: 8px 12px;
  text-align: left;
}

.docs-content :deep(th) {
  background: var(--bg-sub);
  font-weight: 600;
}

.docs-content :deep(hr) {
  border: none;
  height: 1px;
  background: var(--border-color);
  margin: 24px 0;
  transition: background-color 0.4s ease;
}

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

/* 错误状态样式已合并到 .docs-loading--error */
</style>

<style>
/* 深色模式下给 iframe 添加滤镜（非 scoped，确保动态挂载的组件也生效） */
[data-theme='dark'] .docs-content .iframe-form {
  filter: brightness(0.6);
}
</style>

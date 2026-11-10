<script setup>
import { ref, watchEffect, nextTick, computed } from 'vue'
import { createApp } from 'vue'
import MarkdownRenderer from '../components/MarkdownRenderer.vue'
import AboutView from './AboutView.vue'
import NotFoundView from './NotFoundView.vue'
import DonateCard from '../components/DonateCard.vue'
import DonateRecords from '../components/DonateRecords.vue'
import StatsInfoBar from '../components/StatsInfoBar.vue'
import { usePageOutline } from '../composables/usePageOutline.js'

const props = defineProps({
  docName: {
    type: String,
    default: '',
  },
})

const rootEl = ref(null)
// 目录项即 Markdown 渲染出的 h1~h3，故在每次渲染完成后重新采集
const { refresh: refreshOutline } = usePageOutline(
  rootEl,
  () =>
    Array.from(rootEl.value?.querySelectorAll('.md-content :is(h1, h2, h3)') || [])
      .filter((el) => el.id)
      .map((el) => ({
        key: el.id,
        label: el.textContent.trim(),
        level: Number(el.tagName.slice(1)),
      })),
  { id: 'docs' },
)

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
  promotion: '../docs/promotion.md',
  privacy: '../docs/privacy.md',
  donate: '../docs/donate.md',
  faq: '../docs/faq.md',
  dev: '../docs/dev.md',
  'third-party': '../docs/third-party.md',
}

// 将组件渲染到 markdown 中的占位符位置
function mountComponentsToPlaceholders() {
  // SSR 安全：DOM 操作仅在客户端执行
  if (typeof window === 'undefined') return

  // 清理旧的组件实例
  componentApps.forEach(app => app.unmount())
  componentApps.length = 0

  nextTick(() => {
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

// Markdown 渲染完成后：挂载占位组件，并把 h1~h3 目录交给侧边栏分类栏
function handleRendered() {
  mountComponentsToPlaceholders()
  refreshOutline()
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

    // 替换 donate-card 组件标记
    let result = raw.replace(
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
  <div class="docs-view" ref="rootEl">
    <AboutView v-if="!docName || docName === '' || docName === '/'" />

    <NotFoundView v-if="docNotFound" />
    <div v-else-if="loading || error" class="docs-loading" :class="{ 'docs-loading--error': error }">
      <div class="docs-loader-wrapper">
        <div class="docs-loader"></div>
      </div>
      <div class="docs-loading-text">{{ error ? ('加载失败：' + error) : '加载中...' }}</div>
    </div>
    <MarkdownRenderer v-else :raw="processedRaw" @rendered="handleRendered" />
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
  corner-shape: round;
  border: 8px solid;
  border-color: var(--foreground) transparent;
  animation: docs-loader-spin 1s infinite;
  filter: drop-shadow(0 0 8px rgba(128, 140, 160, 0.4));
}

/* 错误状态：停止转动，颜色变红 */
.docs-loading--error .docs-loader {
  animation: none;
  border-color: var(--destructive) transparent;
}

@keyframes docs-loader-spin {
  to { transform: rotate(0.5turn); }
}

.docs-loading-text {
  color: var(--muted-foreground);
  font-size: 1em;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-align: center;
  position: relative;
}
</style>

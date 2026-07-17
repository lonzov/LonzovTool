<script setup>
import { ref, shallowRef, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import MarkdownIt from 'markdown-it'

const router = useRouter()

const props = defineProps({
  raw: { type: String, default: '' },
})

const emit = defineEmits(['rendered'])

const md = shallowRef(new MarkdownIt({
  html: true,
  linkTarget: '_blank',
  highlight(str, lang) {
    return `<pre><code class="hljs language-${lang || ''}">${md.value.utils.escapeHtml(str)}</code></pre>`
  },
}))

const html = ref('')

function render() {
  html.value = md.value.render(props.raw)
  nextTick(() => emit('rendered'))
}

watch(() => props.raw, render, { immediate: true })

// ===== 链接拦截（SPA 内部跳转） =====
let clickHandler = null

onMounted(() => {
  clickHandler = (e) => {
    const link = e.target.closest('a')
    if (!link) return
    // 只处理 .md-content 内的链接
    if (!link.closest('.md-content')) return

    const href = link.getAttribute('href')
    if (!href) return

    let targetURL
    try {
      targetURL = new URL(href, window.location.origin)
    } catch {
      return
    }

    if (targetURL.protocol !== 'http:' && targetURL.protocol !== 'https:') return

    if (targetURL.origin === window.location.origin) {
      e.preventDefault()
      router.push(targetURL.pathname + targetURL.search + targetURL.hash)
      return
    }

    // 外部链接且无 target 属性：通过 window.open 打开新标签页
    if (!link.getAttribute('target')) {
      e.preventDefault()
      window.open(href, '_blank', 'noopener')
    }
  }
  document.addEventListener('click', clickHandler)
})

onUnmounted(() => {
  if (clickHandler) {
    document.removeEventListener('click', clickHandler)
  }
})
</script>

<template>
  <div class="md-content" v-html="html" />
</template>

<style scoped>
/* ===== Markdown 内容基础样式 ===== */
.md-content {
  color: var(--text-primary);
  line-height: 1.8;
}

.md-content :deep(h1) {
  font-size: 1.875rem;
  line-height: 1.2;
  margin: 0.67em 0;
}

.md-content :deep(h2) {
  font-size: 1.5em;
  line-height: 1.333;
  font-weight: 700;
  margin: 1em 0 0.5em;
}

.md-content :deep(h3) {
  font-size: 1.25em;
  line-height: 1.6;
  font-weight: 600;
  margin: 1.6em 0 0.6em;
}

.md-content :deep(p) {
  margin: 0.8em 0;
}

.md-content :deep(ul),
.md-content :deep(ol) {
  padding-left: 2em;
}

.md-content :deep(code) {
  background: var(--bg-sub);
  padding: 0.25rem 0.375rem;
  border-radius: 0.375rem;
  font-size: 0.875em;
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-weight: 400;
  overflow: hidden;
  transition: background-color 0.4s ease;
}

.md-content :deep(pre) {
  background: var(--bg-sub);
  padding: 16px;
  border-radius: 0.75rem;
  overflow-x: auto;
  margin: 1.5em 0;
  transition: background-color 0.4s ease;
}

.md-content :deep(pre code) {
  background: transparent;
  padding: 0;
  border-radius: 0;
  font-size: 0.875em;
  line-height: 1.7142857;
  counter-reset: line;
}

.md-content :deep(pre code span.line:last-child:empty),
.md-content :deep(pre code span.line:last-child:has(> span:empty:only-child)) {
  display: none;
}

.md-content :deep(blockquote) {
  position: relative;
  padding-left: 20px;
  margin: 16px 0;
  color: var(--text-secondary);
  border-left: none !important;
}

.md-content :deep(blockquote::before) {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  width: 3.5px;
  height: 100%;
  background: color-mix(in srgb, var(--primary-color) 22%, transparent);
  border-radius: 3px;
  z-index: 1;
  transition: background 0.4s;
}

.md-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 0.75rem;
}

.md-content :deep(table) {
  border-collapse: separate;
  border-spacing: 0;
  width: 100%;
  margin: 16px 0;
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  corner-shape: squircle;
  overflow: hidden;
  transition: border-color 0.3s cubic-bezier(.4, 0, .2, 1);
}

.md-content :deep(th),
.md-content :deep(td) {
  border-bottom: 1px solid var(--border-color);
  border-right: 1px solid var(--border-color);
  padding: 8px 12px;
  text-align: left;
  transition: border-color 0.3s cubic-bezier(.4, 0, .2, 1);
}

.md-content :deep(tr:last-child td) {
  border-bottom: none;
}

.md-content :deep(th:last-child),
.md-content :deep(td:last-child) {
  border-right: none;
}

.md-content :deep(th) {
  background: var(--bg-sub);
  font-weight: 600;
  transition: background-color 0.3s cubic-bezier(.4, 0, .2, 1),
    border-color 0.3s cubic-bezier(.4, 0, .2, 1);
}

.md-content :deep(hr) {
  border: none;
  height: 0;
  border-top: 1px dashed var(--border-color);
  margin: 2em 0;
  transition: border-color 0.4s ease;
}

/* 相邻标题之间、分割线后接标题：消除前一个元素的下边距 */
.md-content :deep(hr:has(+ :is(h1, h2, h3, h4, h5, h6))),
.md-content :deep(:is(h1, h2, h3, h4, h5, h6):has(+ :is(h1, h2, h3, h4, h5, h6))) {
  margin-bottom: 0;
}

/* ===== 流光渐变文字 ===== */
.md-content :deep(.shimmer),
.md-content :deep(.shimmer *),
.md-content :deep(.shimmer-bluered),
.md-content :deep(.shimmer-bluered *),
.md-content :deep(.shimmer-redgreen),
.md-content :deep(.shimmer-redgreen *) {
  display: inline-block;
  font-weight: 700;
  color: transparent;
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  animation: shimmer-flow 2.8s linear infinite;
}

/* 蓝紫科技（默认） */
.md-content :deep(.shimmer),
.md-content :deep(.shimmer *) {
  background-image: linear-gradient(
    105deg,
    #3B5EF5 0%,
    #6D5AF6 18%,
    #9B6CFA 36%,
    #C0A0FC 50%,
    #9B6CFA 64%,
    #6D5AF6 82%,
    #3B5EF5 100%
  );
}

/* 蓝红光谱 */
.md-content :deep(.shimmer-bluered),
.md-content :deep(.shimmer-bluered *) {
  background-image: linear-gradient(
    105deg,
    #2563EB 0%,
    #7C3AED 18%,
    #DC2626 38%,
    #F87171 50%,
    #DC2626 62%,
    #7C3AED 82%,
    #2563EB 100%
  );
}

/* 红绿跃迁 */
.md-content :deep(.shimmer-redgreen),
.md-content :deep(.shimmer-redgreen *) {
  background-image: linear-gradient(
    105deg,
    #E04040 0%,
    #F59E0B 18%,
    #10B981 38%,
    #6EE7B7 50%,
    #10B981 62%,
    #F59E0B 82%,
    #E04040 100%
  );
}

@keyframes shimmer-flow {
  from { background-position: 200% 0; }
  to   { background-position: -200% 0; }
}

@supports (corner-shape: squircle) {
  .md-content :deep(table) {
    border-radius: 1.275rem;
  }
}
</style>

<style>
/* ===== 超链接下划线样式（unscoped，避免 scoped :deep 提优先级压过子挂载组件） ===== */
.md-content a,
.md-content .trigger-feedback,
.md-content .trigger-url-tj {
  color: var(--text-primary);
  text-decoration: none;
  position: relative;
  padding-bottom: 2px;
  cursor: pointer;
  display: inline-block;
  vertical-align: baseline;
  background: none;
}

.md-content a::before,
.md-content .trigger-feedback::before,
.md-content .trigger-url-tj::before {
  content: '';
  display: block;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 5px;
  height: 1px;
  background-image: repeating-linear-gradient(to right,
      color-mix(in srgb, var(--text-primary), transparent 30%) 0 4px,
      transparent 4px 8px);
  background-repeat: repeat-x;
  background-size: 8px 1px;
  opacity: 1;
  transition: opacity 0.3s;
  pointer-events: none;
  z-index: 2;
}

.md-content a::after,
.md-content .trigger-feedback::after,
.md-content .trigger-url-tj::after {
  content: '';
  display: block;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 5px;
  height: 1px;
  background-color: var(--text-primary);
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
  z-index: 3;
}

.md-content a:hover::before,
.md-content .trigger-feedback:hover::before,
.md-content .trigger-url-tj:hover::before {
  opacity: 0;
}

.md-content a:hover::after,
.md-content .trigger-feedback:hover::after,
.md-content .trigger-url-tj:hover::after {
  opacity: 1;
}

/* iframe 全局超椭圆圆角 */
.md-content iframe {
  border-radius: 18px;
  corner-shape: squircle;
  margin-left: auto;
  margin-right: auto;
  max-width: 100%;
}

@supports (corner-shape: squircle) {
  .md-content iframe {
    border-radius: 30px;
  }
}

/* 深色模式下给 iframe 添加滤镜 */
[data-theme='dark'] .md-content iframe {
  filter: brightness(0.6);
}
</style>

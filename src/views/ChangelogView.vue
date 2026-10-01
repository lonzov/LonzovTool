<script setup>
import { ref, onMounted } from 'vue'
import MarkdownRenderer from '../components/MarkdownRenderer.vue'
import ToolLoading from '../components/ToolLoading.vue'

const raw = ref('')
const loading = ref(true)
const error = ref(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    // 与 SW 对 changelog.md 的处理保持一致：绕开 HTTP 缓存，永远取最新内容
    const res = await fetch('/changelog.md', { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    raw.value = await res.text()
  } catch (e) {
    console.error('[Changelog] 加载失败:', e)
    error.value = new Error('网络异常，请稍后重试')
  } finally {
    loading.value = false
  }
}

// 放在 onMounted：SSG 预渲染阶段没有可用的网络上下文，此时只输出加载态
onMounted(load)
</script>

<template>
  <ToolLoading v-if="loading || error" :error="error" />
  <MarkdownRenderer v-else :raw="raw" />
</template>

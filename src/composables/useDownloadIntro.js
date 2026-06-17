import { ref, watch, nextTick, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import MarkdownIt from 'markdown-it'

const mdModules = import.meta.glob('../data/downloads/md/*.md', { query: '?raw', import: 'default' })

const md = new MarkdownIt({
  html: true,
  linkTarget: '_blank',
  highlight(str, lang) {
    return `<pre><code class="hljs language-${lang || ''}">${md.utils.escapeHtml(str)}</code></pre>`
  },
})

export function useDownloadIntro(getConfig) {
  const router = useRouter()

  const introHtml = ref('')
  const introMdLoading = ref(false)

  async function loadIntroMd(introMdPath) {
    introMdLoading.value = true
    try {
      const key = `../data/downloads/md/${introMdPath}`
      const loader = mdModules[key]
      if (!loader) throw new Error(`Markdown 文件不存在: ${introMdPath}`)
      const raw = await loader()
      introHtml.value = md.render(raw)
    } catch (e) {
      introHtml.value = `<p style="color:var(--text-tertiary)">加载功能介绍失败：${e.message}</p>`
    } finally {
      introMdLoading.value = false
    }
  }

  // 监听配置变化，按需加载 markdown
  watch(getConfig, (val) => {
    if (val?.introMd) {
      loadIntroMd(val.introMd)
    } else {
      introHtml.value = ''
    }
  }, { immediate: true })

  // ===== 链接拦截（照抄文档页） =====
  let introLinkHandler = null

  function setupIntroLinkInterception() {
    if (introLinkHandler) {
      document.removeEventListener('click', introLinkHandler)
    }
    nextTick(() => {
      const container = document.querySelector('.dl-intro-md')
      if (!container) return

      introLinkHandler = (e) => {
        const link = e.target.closest('a')
        if (!link) return

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

        link.setAttribute('target', '_blank')
        link.setAttribute('rel', 'noopener')
        link.setAttribute('referrerpolicy', 'origin')
      }

      document.addEventListener('click', introLinkHandler)
    })
  }

  watch(introHtml, (val) => {
    if (val) setupIntroLinkInterception()
  })

  onUnmounted(() => {
    if (introLinkHandler) {
      document.removeEventListener('click', introLinkHandler)
    }
  })

  return { introHtml, introMdLoading }
}

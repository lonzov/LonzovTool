import { ref, watch } from 'vue'

const mdModules = import.meta.glob('../data/downloads/md/*.md', { query: '?raw', import: 'default' })

export function useDownloadIntro(getConfig) {
  const introRaw = ref('')
  const introMdLoading = ref(false)
  const introError = ref(null)

  async function loadIntroMd(introMdPath) {
    introMdLoading.value = true
    introError.value = null
    try {
      const key = `../data/downloads/md/${introMdPath}`
      const loader = mdModules[key]
      if (!loader) throw new Error(`Markdown 文件不存在: ${introMdPath}`)
      const raw = await loader()
      introRaw.value = raw
    } catch (e) {
      introError.value = e.message
      introRaw.value = ''
    } finally {
      introMdLoading.value = false
    }
  }

  // 监听配置变化，按需加载 markdown
  watch(getConfig, (val) => {
    if (val?.introMd) {
      loadIntroMd(val.introMd)
    } else {
      introRaw.value = ''
      introError.value = null
    }
  }, { immediate: true })

  return { introRaw, introMdLoading, introError }
}

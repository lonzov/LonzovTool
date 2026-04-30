<script>
import { h, ref, watch, nextTick, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import toolsData from '../data/tools.json'

export default {
  name: 'SearchGrid',
  props: {
    searchQuery: {
      type: String,
      default: '',
    },
  },
  setup(props) {
    const lastSearchQuery = ref('')
    const message = useMessage()

    const isDark = ref(document.documentElement.getAttribute('data-theme') === 'dark')

    onMounted(() => {
      new MutationObserver(() => {
        isDark.value = document.documentElement.getAttribute('data-theme') === 'dark'
      }).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
      })
    })

    // 自定义消息渲染函数 - 纯HTML，不用NAlert组件
    const renderMessage = (msgProps) => {
      const bgColor = isDark.value ? '#2a2a2a' : '#fff'
      const borderColor = isDark.value ? '#555' : '#e0e0e0'
      const textColor = isDark.value ? '#e8e8e8' : '#333'
      const titleColor = isDark.value ? '#fff' : '#333'

      return h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            padding: '12px 16px',
            maxWidth: 'calc(100vw - 90px)',
            width: '480px',
            backgroundColor: bgColor,
            border: `1px solid ${borderColor}`,
            borderRadius: '3px',
            boxShadow: 'var(--n-box-shadow)',
          },
        },
        [
          h('span', {
            style: {
              fontSize: '20px',
              lineHeight: '1',
              flexShrink: '0',
              marginTop: '2px',
              color: isDark.value ? '#f0a020' : '#d48806',
            },
            innerHTML: '&#9888;', // 警告图标 ⚠
          }),
          h('div', {
            style: { flex: 1, minWidth: 0 },
          }, [
            h('div', {
              style: {
                color: titleColor,
                fontWeight: 600,
                marginBottom: '4px',
                fontSize: '14px',
              },
            }, '搜索无结果'),
            h('div', {
              style: {
                color: textColor,
                fontSize: '14px',
                lineHeight: '1.5',
              },
            }, msgProps.content),
          ]),
        ],
      )
    }

    watch(
      () => props.searchQuery,
      (newQuery) => {
        const query = (newQuery || '').replace(/\s/g, '') // 去除所有空格
        if (query && query !== lastSearchQuery.value) {
          nextTick(() => {
            const filtered = toolsData.categories
              .map((category) =>
                category.tools.filter(
                  (tool) =>
                    tool.title.replace(/\s/g, '').toLowerCase().includes(query.toLowerCase()) ||
                    tool.description.replace(/\s/g, '').toLowerCase().includes(query.toLowerCase()),
                ),
              )
              .flat()

            if (filtered.length === 0) {
              message.warning(`未找到与 "${query}" 相关的工具，换个关键词试试？`, {
                render: renderMessage,
                closable: true,
                duration: 2500,
              })
            }
          })
        }
        lastSearchQuery.value = query
      },
    )

    return {}
  },
  // 纯逻辑组件，不渲染任何内容
  render() {
    return null
  },
}
</script>

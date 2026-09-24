<script>
import { h, ref, watch, nextTick } from 'vue'
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

    // 自定义消息渲染函数 - 纯HTML，不用NAlert组件
    const renderMessage = (msgProps) => {
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
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-xs)',
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
              // 警告琥珀色：全站没有 warning token，保留固定值（在深浅两套底上都可读）
              color: 'var(--warning)',
            },
            innerHTML: '&#9888;', // 警告图标 ⚠
          }),
          h('div', {
            style: { flex: 1, minWidth: 0 },
          }, [
            h('div', {
              style: {
                color: 'var(--foreground)',
                fontWeight: 600,
                marginBottom: '4px',
                fontSize: '14px',
              },
            }, '搜索无结果'),
            h('div', {
              style: {
                color: 'var(--foreground)',
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

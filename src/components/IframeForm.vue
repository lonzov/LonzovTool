<script>
import { h } from 'vue'

/**
 * IframeForm 组件 - 用于在 markdown 中嵌入可显示/隐藏的 iframe 表单
 *
 * 用法（需要在 markdown 中使用）：
 *   <iframe-form src="https://example.com/form" height="600" key="my-form" />
 *
 * 配合链接触发（使用相同的 key）：
 *   <span class="trigger-my-form">显示表单</span>
 */
export default {
  name: 'IframeForm',
  props: {
    src: {
      type: String,
      required: true,
    },
    height: {
      type: [Number, String],
      default: 600,
    },
    id: {
      type: String,
      default: null,
    },
  },
  data() {
    return {
      isLoaded: false,
      isVisible: false,
    }
  },
  computed: {
    heightStyle() {
      return typeof this.height === 'number' ? `${this.height}px` : this.height
    },
  },
  mounted() {
    const triggerId = this.id
    if (triggerId) {
      const handler = (e) => {
        if (e.target.classList.contains(`trigger-${triggerId}`)) {
          e.preventDefault()
          this.toggle()
        }
      }
      document.addEventListener('click', handler)
      this._removeListener = () => document.removeEventListener('click', handler)
    }
  },
  beforeUnmount() {
    if (this._removeListener) {
      this._removeListener()
    }
  },
  methods: {
    show() {
      this.isVisible = true
      this.isLoaded = true
    },
    hide() {
      this.isVisible = false
    },
    toggle() {
      if (this.isVisible) {
        this.hide()
      } else {
        this.show()
      }
    },
  },
  render() {
    return h(
      'div',
      {
        class: 'iframe-form-wrapper',
        style: {
          display: this.isVisible ? 'block' : 'none',
          width: '100%',
          marginTop: '16px',
        },
      },
      this.isLoaded
        ? [
            h('iframe', {
              src: this.src,
              frameborder: '0',
              allowfullscreen: true,
              class: 'iframe-form',
              style: {
                width: '100%',
                height: this.heightStyle,
                borderRadius: '8px',
                display: 'block',
              },
            }),
          ]
        : []
    )
  },
}
</script>

<style scoped>
/* 深色模式下 iframe 变暗 */
[data-theme='dark'] :deep(.iframe-form) {
  filter: brightness(0.7);
}
</style>

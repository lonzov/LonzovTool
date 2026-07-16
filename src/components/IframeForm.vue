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
      iframeLoaded: false,
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
    const children = []

    if (this.isLoaded) {
      // 骨架屏
      if (!this.iframeLoaded) {
        children.push(
          h('div', {
            class: 'iframe-skeleton',
            style: { height: this.heightStyle },
          })
        )
      }

      // iframe（加载完成后才可见）
      children.push(
        h('iframe', {
          src: this.src,
          frameborder: '0',
          allowfullscreen: true,
          class: 'iframe-form',
          style: {
            width: '100%',
            height: this.heightStyle,
            display: this.iframeLoaded ? 'block' : 'none',
          },
          onLoad: () => {
            this.iframeLoaded = true
          },
        })
      )
    }

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
      children
    )
  },
}
</script>

<style scoped>
/* 骨架屏扫光动画 */
.iframe-skeleton {
  width: 100%;
  border-radius: 18px;
  corner-shape: squircle;
  background: linear-gradient(
    105deg,
    var(--bg-sub) 0%,
    var(--bg-sub) 35%,
    var(--bg-card) 50%,
    var(--bg-sub) 65%,
    var(--bg-sub) 100%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.8s ease-in-out infinite;
}

@supports (corner-shape: squircle) {
  .iframe-skeleton {
    border-radius: 30px;
  }
}

@keyframes skeleton-shimmer {
  from { background-position: 200% 0; }
  to   { background-position: -200% 0; }
}

/* 深色模式下 iframe 变暗 */
[data-theme='dark'] :deep(.iframe-form) {
  filter: brightness(0.7);
}
</style>

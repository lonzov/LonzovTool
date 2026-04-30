<script>
import { h, markRaw } from 'vue'
import { NIcon, NTooltip } from 'naive-ui'
import { Desktop16Regular, WeatherSunny16Regular, WeatherMoon28Regular } from '@vicons/fluent'

// 使用 markRaw 避免 Vue 响应式警告
const icons = {
  auto: markRaw(Desktop16Regular),
  light: markRaw(WeatherSunny16Regular),
  dark: markRaw(WeatherMoon28Regular)
}

export default {
  props: {
    mode: {
      type: String,
      default: 'auto',
      validator: (value) => ['auto', 'light', 'dark'].includes(value)
    },
    forMobile: {
      type: Boolean,
      default: false
    }
  },
  emits: ['click'],
  data() {
    return {
      isPressed: false,
      iconOpacity: 1
    }
  },
  watch: {
    mode() {
      // 图标淡出
      this.iconOpacity = 0
      // 动画完成后淡入
      setTimeout(() => {
        this.iconOpacity = 1
      }, 150)
    }
  },
  methods: {
    handleClick() {
      this.isPressed = true
      this.$emit('click')

      setTimeout(() => {
        this.isPressed = false
      }, 300)
    },
    getTooltip() {
      switch (this.mode) {
        case 'auto':
          return '跟随系统'
        case 'light':
          return '亮色模式'
        case 'dark':
          return '深色模式'
        default:
          return '切换主题'
      }
    }
  },
  render() {
    const tooltip = this.getTooltip()
    const currentIcon = icons[this.mode]

    const buttonSize = this.forMobile ? 32 : 36
    const iconSize = this.forMobile ? 20 : 22

    const containerStyle = {
      position: 'relative',
      overflow: 'hidden',
      display: 'inline-block'
    }

    const buttonStyle = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: buttonSize + 'px',
      height: buttonSize + 'px',
      borderRadius: '50%',
      border: 'none',
      background: 'transparent',
      cursor: 'pointer',
      transition: 'transform 0.3s ease',
      transform: this.isPressed ? 'scale(0.85)' : 'scale(1)',
      position: 'relative',
      overflow: 'hidden'
    }

    const iconStyle = {
      transition: 'opacity 0.15s ease',
      opacity: this.iconOpacity
    }

    return h(
      NTooltip,
      { placement: this.forMobile ? 'bottom' : 'right' },
      {
        trigger: () => h(
          'div',
          { style: containerStyle },
          [
            h(
              'button',
              {
                style: buttonStyle,
                onClick: this.handleClick,
                type: 'button',
                'aria-label': tooltip
              },
              [
                h(NIcon, {
                  component: currentIcon,
                  size: iconSize,
                  color: 'var(--theme-icon-color)',
                  style: iconStyle
                })
              ]
            )
          ]
        ),
        default: () => tooltip
      }
    )
  }
}
</script>

<style>
</style>

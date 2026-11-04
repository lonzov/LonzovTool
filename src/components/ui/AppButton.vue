<script setup>
import { computed, nextTick, onMounted, ref, useAttrs, watch } from 'vue'
import { NIcon } from 'naive-ui'
import { RouterLink } from 'vue-router'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  variant: {
    type: String,
    default: 'outline',
    validator: (value) => ['solid', 'outline', 'text'].includes(value),
  },
  tone: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'danger'].includes(value),
  },
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['xs', 'sm', 'md', 'lg'].includes(value),
  },
  shape: {
    type: String,
    default: 'theme',
    validator: (value) => ['theme', 'pill', 'rect', 'circle'].includes(value),
  },
  icon: {
    type: [Object, Function],
    default: null,
  },
  iconPosition: {
    type: String,
    default: 'start',
    validator: (value) => ['start', 'end'].includes(value),
  },
  iconOnly: {
    type: Boolean,
    default: false,
  },
  label: {
    type: String,
    default: '',
  },
  loading: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  /** 0–1；小于 1 时按钮置灰并显示从左到右的进度填充，归 1 后可点击 */
  progress: {
    type: Number,
    default: 1,
  },
  block: {
    type: Boolean,
    default: false,
  },
  type: {
    type: String,
    default: 'button',
  },
  to: {
    type: [String, Object],
    default: null,
  },
  href: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['click'])
const attrs = useAttrs()
const rootEl = ref(null)
const lockedMinWidth = ref(null)

function measureCountdownWidth() {
  const el = rootEl.value?.$el || rootEl.value
  if (el instanceof HTMLElement) lockedMinWidth.value = el.offsetWidth
}

const tag = computed(() => {
  if (props.to) return RouterLink
  if (props.href) return 'a'
  return 'button'
})

const isLink = computed(() => tag.value !== 'button')
const progressValue = computed(() => {
  if (!Number.isFinite(props.progress)) return 1
  return Math.min(1, Math.max(0, props.progress))
})
const isCountingDown = computed(() => progressValue.value < 1)
const isInactive = computed(() => props.disabled || props.loading || isCountingDown.value)

const resolvedShape = computed(() => {
  if (props.shape !== 'theme') return props.shape
  // icon-only 默认圆角矩形；文字按钮跟随主题的 --button-radius，方便整套换形状
  return props.iconOnly ? 'rect' : 'theme'
})

const variantClass = computed(() => {
  if (props.tone === 'danger') {
    if (props.variant === 'outline') return 'app-btn--danger-outline'
    if (props.variant === 'text') return 'app-btn--danger-text'
    return 'app-btn--danger'
  }
  if (props.variant === 'solid') return 'app-btn--fill'
  if (props.variant === 'text') return 'app-btn--text'
  return 'app-btn--outline'
})

const classes = computed(() => [
  'app-btn',
  variantClass.value,
  props.size !== 'md' ? `app-btn--${props.size}` : '',
  props.iconOnly ? 'app-btn--icon-only' : '',
  props.block ? 'app-btn--block' : '',
  isCountingDown.value ? 'app-btn--counting' : '',
  resolvedShape.value === 'pill' ? 'app-btn--pill' : '',
  resolvedShape.value === 'rect' ? 'app-btn--rect' : '',
  resolvedShape.value === 'circle' ? 'app-btn--circle' : '',
  props.iconPosition === 'end' ? 'app-btn--icon-end' : '',
])

const accessibleLabel = computed(() => props.label || attrs['aria-label'] || undefined)
const titleText = computed(() => attrs.title || (props.iconOnly ? props.label || undefined : undefined))
const progressStyle = computed(() => {
  const style = {
    '--app-btn-progress': progressValue.value,
    '--app-btn-progress-pct': `${progressValue.value * 100}%`,
  }
  if (isCountingDown.value && lockedMinWidth.value) {
    style.minWidth = `${lockedMinWidth.value}px`
  }
  return style
})

watch(isCountingDown, (counting) => {
  if (counting) {
    nextTick(measureCountdownWidth)
  } else {
    lockedMinWidth.value = null
  }
})

watch(progressValue, () => {
  if (isCountingDown.value && !lockedMinWidth.value) {
    nextTick(measureCountdownWidth)
  }
})

onMounted(() => {
  if (isCountingDown.value) nextTick(measureCountdownWidth)
})

function handleClick(event) {
  if (isInactive.value) {
    event.preventDefault()
    event.stopPropagation()
    return
  }
  emit('click', event)
}

if (import.meta.env.DEV && props.iconOnly && !props.label) {
  console.warn('[AppButton] icon-only 按钮需要 label，用来生成无障碍名称')
}
</script>

<template>
  <component
    :is="tag"
    ref="rootEl"
    v-bind="$attrs"
    :type="tag === 'button' ? type : undefined"
    :disabled="tag === 'button' ? isInactive : undefined"
    :to="to || undefined"
    :href="href || undefined"
    :class="classes"
    :style="progressStyle"
    :aria-label="accessibleLabel"
    :aria-disabled="isLink && isInactive ? 'true' : undefined"
    :tabindex="isLink && isInactive ? '-1' : undefined"
    :aria-busy="loading ? 'true' : undefined"
    :title="titleText"
    @click="handleClick"
  >
    <span v-if="isCountingDown" class="app-btn__base" aria-hidden="true" />
    <span v-if="isCountingDown" class="app-btn__progress" aria-hidden="true" />
    <span class="app-btn__content">
      <span v-if="loading || icon || $slots.icon" class="app-btn__icon" aria-hidden="true">
        <span v-if="loading" class="app-btn__spinner" />
        <slot v-else name="icon">
          <NIcon v-if="icon" :component="icon" size="1em" />
        </slot>
      </span>
      <span v-if="!iconOnly" class="app-btn__label"><slot /></span>
    </span>
    <span
      v-if="isCountingDown"
      class="app-btn__content app-btn__content--progress"
      aria-hidden="true"
    >
      <span v-if="loading || icon || $slots.icon" class="app-btn__icon">
        <span v-if="loading" class="app-btn__spinner" />
        <slot v-else name="icon">
          <NIcon v-if="icon" :component="icon" size="1em" />
        </slot>
      </span>
      <span v-if="!iconOnly" class="app-btn__label"><slot /></span>
    </span>
  </component>
</template>

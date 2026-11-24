<script setup>
import { computed } from 'vue'

/**
 * NSplit 的分隔条内容：把 Naive 的默认细线换成一根可聚焦、可微调的抓手。
 * 只负责外观与键盘交互，宽度/比例由调用方持有并持久化。
 */
const props = defineProps({
  /** 分隔条自身朝向：vertical 为竖条（左右分栏），horizontal 为横条（上下分栏） */
  orientation: {
    type: String,
    default: 'vertical',
    validator: (value) => ['vertical', 'horizontal'].includes(value),
  },
  value: { type: Number, required: true },
  min: { type: Number, required: true },
  max: { type: Number, required: true },
  /** value 的单位：px 像素 / ratio 0–1 比例，只影响无障碍属性里报出的数值 */
  unit: {
    type: String,
    default: 'px',
    validator: (value) => ['px', 'ratio'].includes(value),
  },
  label: { type: String, default: '' },
})

const emit = defineEmits(['nudge', 'reset'])

function toReported(value) {
  return Math.round(props.unit === 'ratio' ? value * 100 : value)
}

const reportedValue = computed(() => toReported(props.value))
const reportedMin = computed(() => toReported(props.min))
const reportedMax = computed(() => toReported(props.max))
</script>

<template>
  <div
    class="rj-grip"
    :class="`rj-grip--${orientation}`"
    role="separator"
    :aria-orientation="orientation"
    :aria-label="label || undefined"
    :aria-valuenow="reportedValue"
    :aria-valuemin="reportedMin"
    :aria-valuemax="reportedMax"
    tabindex="0"
    @keydown.up.prevent="emit('nudge', -1)"
    @keydown.down.prevent="emit('nudge', 1)"
    @keydown.left.prevent="emit('nudge', -1)"
    @keydown.right.prevent="emit('nudge', 1)"
    @dblclick="emit('reset')"
  >
    <span class="rj-grip-bar" />
  </div>
</template>

<style scoped>
/* 12px 宽的拖拽带里放一根短条：常态只作面板分界，悬停/聚焦时拉长变色，明确可拖 */
.rj-grip {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: var(--radius-sm);
  outline: none;
}
.rj-grip-bar {
  border-radius: 1px;
  background: var(--border-strong);
  transition:
    background-color 0.15s ease,
    width 0.15s ease,
    height 0.15s ease;
}
.rj-grip--vertical .rj-grip-bar {
  width: 2px;
  height: 24px;
}
.rj-grip--horizontal .rj-grip-bar {
  width: 24px;
  height: 2px;
}
.rj-grip:hover .rj-grip-bar,
.rj-grip:focus-visible .rj-grip-bar {
  background: var(--muted-foreground);
}
.rj-grip--vertical:hover .rj-grip-bar,
.rj-grip--vertical:focus-visible .rj-grip-bar {
  height: 40px;
}
.rj-grip--horizontal:hover .rj-grip-bar,
.rj-grip--horizontal:focus-visible .rj-grip-bar {
  width: 40px;
}
.rj-grip:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: -3px;
}
</style>

<script setup>
/**
 * 控制台骨架屏基础块。
 *
 * 宽高支持数字（按 px）与任意 CSS 长度；文字骨架传 em，高度就能跟着所在行的
 * font-size 走，数据回来时行高不会变。
 */
const props = defineProps({
  width: { type: [String, Number], default: '100%' },
  height: { type: [String, Number], default: 14 },
  radius: { type: [String, Number], default: 'var(--radius-sm)' },
  circle: { type: Boolean, default: false },
})

const toSize = (value) => (typeof value === 'number' ? `${value}px` : value)
</script>

<template>
  <span
    class="console-skeleton"
    :class="{ 'console-skeleton--circle': circle }"
    :style="{
      width: toSize(props.width),
      height: toSize(props.height),
      borderRadius: props.circle ? undefined : toSize(props.radius),
    }"
    aria-hidden="true"
  ></span>
</template>

<style scoped>
.console-skeleton {
  display: block;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  background: linear-gradient(
    100deg,
    color-mix(in srgb, var(--foreground) 9%, transparent) 30%,
    color-mix(in srgb, var(--foreground) 17%, transparent) 45%,
    color-mix(in srgb, var(--foreground) 9%, transparent) 60%
  );
  background-size: 250% 100%;
  animation: console-skeleton-shimmer 1.6s ease-in-out infinite;
  transition: background-color 0.4s ease;
}

.console-skeleton--circle {
  border-radius: var(--radius-full);
  corner-shape: round;
}

@keyframes console-skeleton-shimmer {
  0% {
    background-position: 150% 0;
  }

  100% {
    background-position: -50% 0;
  }
}

html[data-motion='reduced'] .console-skeleton {
  animation: none;
}

@media (prefers-reduced-motion: reduce) {
  .console-skeleton {
    animation: none;
  }
}
</style>

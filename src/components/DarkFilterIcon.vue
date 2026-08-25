<script setup>
import { computed } from 'vue'

// 深色滤镜状态图标：静态月亮 + 可生长/回缩的斜杠叠加层
// 斜杠用 pathLength="1" 归一化后，用 stroke-dashoffset 过渡实现
// "从左上角起点生长到终点 / 从终点回缩到无"的效果（填充路径无法动画，故走描边）

const props = defineProps({
  slash: {
    type: Boolean,
    default: false, // 是否显示斜杠
  },
  size: {
    type: [Number, String],
    default: 18,
  },
  duration: {
    type: Number,
    default: 300, // 斜杠生长/回缩时长 ms
  },
})

// 月亮路径（WeatherMoon28Regular 原路径，fill 填充）
const MOON_D =
  'M13.823 2.302a.75.75 0 0 0-.155.668c.652 2.6 1.105 6.518-.608 9.945c-.859 1.716-2.396 3.02-4.17 4.003c-1.77.98-3.72 1.61-5.32 2.004a.75.75 0 0 0-.468 1.106A11.995 11.995 0 0 0 13.48 26c6.628 0 12-5.372 12-12c0-6.299-4.853-11.464-11.024-11.96a.75.75 0 0 0-.633.262zm1.54 1.366c4.9.887 8.617 5.176 8.617 10.332c0 5.8-4.7 10.5-10.5 10.5c-3.518 0-6.634-1.73-8.54-4.39c1.462-.416 3.122-1.018 4.677-1.88c1.924-1.066 3.742-2.56 4.784-4.644c1.717-3.433 1.501-7.207.961-9.918z'

// 斜杠：左上角起点 → 右下角终点（对齐 Fluent Off 图标整条对角贯穿的走向）
const SLASH_D = 'M3 2.8 L24.4 25.4'

const dashoffset = computed(() => (props.slash ? 0 : 1))
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 28 28"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path :d="MOON_D" fill="currentColor" />
    <path
      :d="SLASH_D"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      pathLength="1"
      stroke-dasharray="1"
      :stroke-dashoffset="dashoffset"
      :style="{ transition: `stroke-dashoffset ${duration}ms ease` }"
    />
  </svg>
</template>
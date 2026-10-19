<script setup>
import { computed, ref, watch } from 'vue'
import { NIcon } from 'naive-ui'
import { getToolIcon } from '../config/categoryIcons.js'

/**
 * 卡片图标的统一渲染，判定规则与首页 ToolCard 保持一致：
 * 以 `/`、`http`、`blob:`、`data:` 开头视为图片来源，其余视为图标名。
 *
 * 三种状态对应三种画法：加载中盖渐变骨架（避免布局跳动）、加载完成显示图片、
 * 加载失败回落通用图标。外链图片不带 Referer——部分图床开了防盗链，带 Referer 会被拒；
 * 也不加 crossorigin，那会触发 CORS 校验反而更容易失败。
 */
const props = defineProps({
  logo: { type: String, default: '' },
  size: { type: Number, default: 32 },
  alt: { type: String, default: '' },
})

const imageError = ref(false)
const imageLoaded = ref(false)

const isImageLogo = computed(
  () => !!props.logo && (props.logo.startsWith('/') || /^(https?:|blob:|data:)/i.test(props.logo)),
)
const isExternalLogo = computed(() => /^https?:/i.test(props.logo))
const iconComponent = computed(() => getToolIcon(isImageLogo.value ? '' : props.logo))

watch(
  () => props.logo,
  () => {
    imageError.value = false
    imageLoaded.value = false
  },
)
</script>

<template>
  <span class="tool-logo" :style="{ width: `${size}px`, height: `${size}px` }">
    <template v-if="isImageLogo && !imageError">
      <img
        class="tool-logo__img"
        :src="logo"
        :alt="alt"
        :referrerpolicy="isExternalLogo ? 'no-referrer' : undefined"
        loading="lazy"
        @load="imageLoaded = true"
        @error="imageError = true"
      />
      <span v-if="!imageLoaded" class="tool-logo__skeleton" />
    </template>
    <NIcon v-else-if="logo" class="tool-logo__icon" :size="Math.round(size * 0.56)" :component="iconComponent" />
    <span v-else class="tool-logo__empty">—</span>
  </span>
</template>

<style scoped>
.tool-logo {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: var(--radius-sm);
  background: var(--card);
  color: var(--foreground);
  transition: background-color 0.4s ease, color 0.4s ease;
}

.tool-logo__img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.tool-logo__skeleton {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    120deg,
    var(--muted) 0%,
    color-mix(in srgb, var(--muted) 88%, var(--foreground)) 100%
  );
}

.tool-logo__empty {
  color: var(--subtle-foreground);
  font-size: 0.7rem;
}
</style>

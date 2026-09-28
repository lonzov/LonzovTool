<script setup>
import { NIcon } from 'naive-ui'

defineProps({
  icon: {
    type: [Object, Function],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  desc: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <div class="page-header">
    <div class="page-title-row">
      <NIcon :component="icon" class="page-title-icon" />
      <h1 class="page-title">{{ title }}</h1>
    </div>
    <p v-if="desc" class="page-desc">{{ desc }}</p>
  </div>
</template>

<style scoped>
.page-header {
  margin-bottom: 0;
}

.page-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.page-title-icon {
  font-size: 26px;
  color: var(--foreground);
  flex-shrink: 0;
  transition: color 0.4s ease;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--foreground);
  line-height: 1.3;
  margin: 0;
  transition: color 0.4s ease;
}

.page-desc {
  font-size: 14px;
  color: var(--muted-foreground);
  line-height: 1.5;
  margin-top: 6px;
  transition: color 0.4s ease;
}
</style>

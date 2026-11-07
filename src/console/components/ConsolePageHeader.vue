<script setup>
import { NIcon } from 'naive-ui'

defineProps({
  icon: {
    type: Object,
    default: null,
  },
  title: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <header class="console-page-header">
    <div class="console-title-row">
      <div class="console-title-main">
        <NIcon v-if="icon" :component="icon" class="console-title-icon" />
        <h1 class="console-title">{{ title }}</h1>
      </div>
      <div class="console-title-extra">
        <slot name="extra" />
      </div>
    </div>
    <p v-if="description" class="console-subtitle">{{ description }}</p>
  </header>
</template>

<style scoped>
.console-page-header {
  margin-bottom: 1.5rem;
}

.console-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.console-title-main {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.console-title-icon {
  font-size: 26px;
  color: var(--foreground);
  flex-shrink: 0;
  transition: color 0.4s ease;
}

.console-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--foreground);
  margin: 0;
  line-height: 1.3;
  transition: color 0.4s ease;
}

.console-title-extra {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.console-subtitle {
  font-size: 14px;
  color: var(--muted-foreground);
  line-height: 1.5;
  margin: 3px 0 0;
  transition: color 0.4s ease;
}

@media (max-width: 768px) {
  .console-title {
    font-size: 20px;
  }

  .console-title-icon {
    font-size: 22px;
  }

  .console-subtitle {
    font-size: 13px;
  }
}

@media (max-width: 560px) {
  .console-title-row {
    flex-wrap: nowrap;
    align-items: center;
    gap: 8px;
  }

  .console-title-main {
    flex: 1 1 auto;
    min-width: 0;
  }

  .console-title {
    overflow: hidden;
    font-size: 19px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .console-title-extra {
    flex-shrink: 0;
    gap: 4px;
    margin-left: auto;
  }
}
</style>

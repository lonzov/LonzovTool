<script setup>
defineProps({
  label: {
    type: String,
    default: '',
  },
  /** 关联控件 id。NSelect 这类没有原生 input 的控件不传，避免 label 指向不存在的元素 */
  htmlFor: {
    type: String,
    default: '',
  },
  help: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <div class="form-field">
    <label v-if="label" :for="htmlFor || undefined">{{ label }}</label>
    <slot />
    <p v-if="help" class="field-hint">{{ help }}</p>
  </div>
</template>

<style scoped>
.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-field label {
  font-size: 13px;
  font-weight: 600;
  color: var(--foreground);
  transition: color 0.4s ease;
}

.field-hint {
  font-size: 13px;
  line-height: 1.5;
  color: var(--muted-foreground);
  margin: 0;
  transition: color 0.4s ease;
}
</style>

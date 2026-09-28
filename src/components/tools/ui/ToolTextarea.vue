<script setup>
const model = defineModel({ type: String, default: '' })

defineProps({
  id: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    default: '',
  },
  readonly: {
    type: Boolean,
    default: false,
  },
})
</script>

<template>
  <textarea
    :id="id || undefined"
    v-model="model"
    class="text-input"
    :placeholder="placeholder"
    :readonly="readonly"
    spellcheck="false"
    autocomplete="off"
    autocapitalize="off"
  ></textarea>
</template>

<style scoped>
.text-input {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 15px;
  font-size: 1rem;
  resize: none;
  background-color: var(--input-background);
  color: var(--foreground);
  transition: border-color 0.4s ease, box-shadow 0.4s ease, background-color 0.4s ease,
    color 0.4s ease;
  font-family: inherit;
  line-height: 1.6;
  min-height: 160px;
}

.text-input:focus {
  outline: none;
  border-color: var(--muted-foreground);
  box-shadow: 0 0 0 2px var(--ring);
}

.text-input::placeholder {
  color: var(--subtle-foreground);
}

@media (max-width: 640px) {
  .text-input {
    padding: 12px;
    min-height: 120px;
  }
}
</style>

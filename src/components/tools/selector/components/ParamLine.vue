<template>
  <div
    class="code-line code-line--param"
    @click="$emit('edit', param.id)"
  >
    <span class="code-key">{{ getParamKey(param) }}</span>
    <span class="code-eq">=</span>
    <span class="code-value">{{ getParamValueText(param) }}</span>
    <span class="code-comma">,</span>
    <div class="code-actions">
      <button
        class="code-act-btn"
        :class="{ 'code-delete-confirmed': deleteConfirmId === param.id }"
        :title="deleteConfirmId === param.id ? '再次点击确认删除' : '删除参数'"
        @click.stop="deleteParam(param.id)"
      >
        <NIcon :component="Delete24Filled" :size="14" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { NIcon } from 'naive-ui'
import { Delete24Filled } from '@vicons/fluent'
import { getParamKey } from '../composables/useParams.js'
import { getParamValueText } from '../composables/useOutput.js'
import { deleteParam } from '../composables/useParams.js'
import { deleteConfirmId } from '../composables/useState.js'

defineProps({
  param: { type: Object, required: true },
})

defineEmits(['edit'])
</script>

<style scoped>
.code-line {
  display: flex;
  align-items: center;
  gap: 0;
  min-height: 34px;
  padding-right: 36px;
  position: relative;
}
.code-line--param {
  cursor: pointer;
  border-radius: var(--radius-xs);
  margin-left: 22px;
  padding-left: 6px;
  padding-right: 40px;
  transition: background-color 0.12s ease;
}
.code-line--param:hover {
  background: var(--accent);
}

.code-key {
  color: var(--foreground);
  font-weight: 500;
  transition: color 0.4s ease;
  flex-shrink: 0;
}
.code-eq {
  color: var(--subtle-foreground);
  margin: 0 0.35em;
  transition: color 0.4s ease;
  flex-shrink: 0;
}
.code-value {
  color: var(--muted-foreground);
  transition: color 0.4s ease;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.code-comma {
  color: var(--subtle-foreground);
  margin-right: 0.35em;
  transition: color 0.4s ease;
}

/* 删除按钮 (hover 显示) */
.code-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0;
  transition: opacity 0.12s ease;
}
.code-line--param:hover .code-actions {
  opacity: 1;
}

.code-act-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  color: var(--muted-foreground);
  cursor: pointer;
  transition:
    background-color 0.12s ease,
    color 0.12s ease,
    transform 0.12s ease;
}
.code-act-btn:hover {
  background: var(--muted);
  color: var(--foreground);
}
.code-act-btn:active {
  transform: scale(0.95);
}
.code-delete-confirmed,
.code-delete-confirmed:hover {
  background: var(--destructive) !important;
  color: var(--destructive-foreground) !important;
  opacity: 1 !important;
}

@media (max-width: 640px) {
  .code-line--param {
    margin-left: 10px;
    padding-left: 6px;
  }
}
</style>

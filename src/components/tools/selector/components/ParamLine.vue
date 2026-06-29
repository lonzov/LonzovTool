<template>
  <div
    class="code-line code-line--param"
    @click="$emit('edit', param.id)"
  >
    <span class="code-key">{{ getParamKey(param) }}</span>
    <span class="code-eq"> = </span>
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
  border-radius: 4px;
  margin-left: 28px;
  transition: background-color 0.12s ease;
}
.code-line--param:hover {
  background: rgba(0, 0, 0, 0.03);
}
[data-theme='dark'] .code-line--param:hover {
  background: rgba(255, 255, 255, 0.04);
}

.code-key {
  color: var(--text-primary);
  font-weight: 500;
  transition: color 0.4s ease;
  flex-shrink: 0;
}
.code-eq {
  color: var(--text-tertiary);
  margin: 0 2px;
  transition: color 0.4s ease;
  flex-shrink: 0;
}
.code-value {
  color: var(--text-secondary);
  transition: color 0.4s ease;
}
.code-comma {
  color: var(--text-tertiary);
  transition: color 0.4s ease;
}

/* 删除按钮 (hover 显示) */
.code-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  position: absolute;
  right: 0;
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
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 5px;
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    background-color 0.12s ease,
    color 0.12s ease;
}
.code-act-btn:hover {
  background: var(--bg-sub);
  color: var(--text-primary);
}
.code-delete-confirmed,
.code-delete-confirmed:hover {
  background: #dc2626 !important;
  color: #fff !important;
  opacity: 1 !important;
}

@media (max-width: 640px) {
  .code-line--param {
    margin-left: 16px;
  }
}
</style>

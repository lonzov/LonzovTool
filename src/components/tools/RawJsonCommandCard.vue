<script setup>
import { Copy24Regular } from '@vicons/fluent'
import AppButton from '../ui/AppButton.vue'
import { commandOutput, copyCommand } from '../../composables/useRawJsonEditor.js'
import RawJsonCard from './RawJsonCard.vue'
</script>

<template>
  <RawJsonCard title="命令">
    <template #actions>
      <AppButton variant="outline" size="sm" :icon="Copy24Regular" @click="copyCommand">
        复制命令
      </AppButton>
    </template>

    <div class="cmd-box">
      <input class="cmd-input" readonly :value="commandOutput" />
    </div>
  </RawJsonCard>
</template>

<style scoped>
.cmd-box {
  padding: 10px 12px;
  background: var(--muted);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow-x: auto;
  transition: background-color 0.4s ease, border-color 0.4s ease;
}
.cmd-input {
  width: 100%; background: transparent; border: none;
  color: var(--foreground);
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: 12px; outline: none; word-break: break-all;
  transition: color 0.4s ease;
}
</style>

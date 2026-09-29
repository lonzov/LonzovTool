<script setup>
import { NButton, NIcon } from 'naive-ui'
import { Copy24Regular } from '@vicons/fluent'
import { commandOutput, copyCommand } from '../../composables/useRawJsonEditor.js'
import RawJsonCard from './RawJsonCard.vue'
</script>

<template>
  <RawJsonCard title="命令">
    <template #actions>
      <NButton size="small" @click="copyCommand">
        <template #icon><NIcon :component="Copy24Regular" :size="14" /></template>
        复制命令
      </NButton>
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

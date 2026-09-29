<script setup>
import { jsonOutput } from '../../composables/useRawJsonEditor.js'
import RawJsonCard from './RawJsonCard.vue'
import RawJsonFormatToggle from './RawJsonFormatToggle.vue'
import RawJsonPreviewBox from './RawJsonPreviewBox.vue'

defineProps({
  /**
   * JSON 模式下 JSON 已经占着大预览区，这里让位给游戏渲染。
   * 桌面端两块内容同屏可见，调用方不传。
   */
  swapJson: { type: Boolean, default: false },
})
</script>

<template>
  <RawJsonCard :title="swapJson ? '游戏渲染' : 'JSON 输出'">
    <template #actions>
      <RawJsonFormatToggle v-if="!swapJson" />
    </template>

    <RawJsonPreviewBox v-if="swapJson" />
    <textarea
      v-else
      class="json-textarea"
      readonly
      :value="jsonOutput"
      spellcheck="false"
    />
  </RawJsonCard>
</template>

<style scoped>
.json-textarea {
  width: 100%; height: 100px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--muted);
  color: var(--foreground);
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: 12px; line-height: 1.6;
  resize: none; outline: none;
  transition: border-color 0.4s ease, background-color 0.4s ease, color 0.4s ease;
}
</style>

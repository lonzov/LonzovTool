<script setup>
import { ref } from 'vue'
import { jsonOutput } from '../../composables/useRawJsonEditor.js'
import AppScrollbar from '../ui/AppScrollbar.vue'
import RawJsonCard from './RawJsonCard.vue'
import RawJsonFormatToggle from './RawJsonFormatToggle.vue'
import RawJsonPreviewBox from './RawJsonPreviewBox.vue'

defineProps({
  /**
   * JSON 模式下 JSON 已经占着大预览区，这里让位给游戏渲染。
   * 桌面端两块内容同屏可见，调用方不传。
   */
  swapJson: { type: Boolean, default: false },
  /** 桌面端分栏里撑满所在面板：文本区吃掉剩余高度，高度由分栏决定 */
  stretch: { type: Boolean, default: false },
})

const scroller = ref(null)
</script>

<template>
  <RawJsonCard :title="swapJson ? '游戏渲染' : 'JSON 输出'" :stretch="stretch">
    <template #actions>
      <RawJsonFormatToggle v-if="!swapJson" />
    </template>

    <RawJsonPreviewBox v-if="swapJson" />
    <div v-else class="json-body" :class="{ 'json-body--fill': stretch }">
      <textarea
        ref="scroller"
        class="json-textarea"
        readonly
        :value="jsonOutput"
        spellcheck="false"
      />
      <AppScrollbar :target="scroller" />
    </div>
  </RawJsonCard>
</template>

<style scoped>
.json-body {
  position: relative;
  display: flex;
  height: 104px;
}
.json-body--fill {
  flex: 1;
  min-height: 0;
  height: auto;
}
.json-textarea {
  flex: 1;
  width: 100%;
  min-height: 0;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--muted);
  color: var(--foreground);
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: 13px;
  line-height: 1.75;
  resize: none;
  outline: none;
  scrollbar-width: none;
  transition: border-color 0.4s ease, background-color 0.4s ease, color 0.4s ease;
}
.json-textarea::-webkit-scrollbar {
  display: none;
}
</style>

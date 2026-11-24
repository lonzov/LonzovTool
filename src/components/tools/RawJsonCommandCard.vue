<script setup>
import { ref } from 'vue'
import { NIcon, useMessage } from 'naive-ui'
import { Copy24Regular, Warning16Filled } from '@vicons/fluent'
import AppButton from '../ui/AppButton.vue'
import AppScrollbar from '../ui/AppScrollbar.vue'
import { cmdLength, commandOutput, copyCommand, errorCount } from '../../composables/useRawJsonEditor.js'
import RawJsonCard from './RawJsonCard.vue'

defineProps({
  /** 桌面端分栏里撑满所在面板：命令区吃掉剩余高度，长命令能整段读到 */
  stretch: { type: Boolean, default: false },
})

const message = useMessage()
const scroller = ref(null)
const cardRef = ref(null)
/** 复制兜底要把临时选区挂进当前容器：移动端这一步发生在设置抽屉里，焦点会被抽屉锁住 */
async function onCopyCommand() {
  const copied = await copyCommand(cardRef.value?.$el)
  if (copied) {
    message.success('命令已复制', { duration: 1800 })
    return
  }
  message.error('复制失败，请手动选择命令文本')
}
</script>

<template>
  <RawJsonCard ref="cardRef" title="命令" :stretch="stretch">
    <template #actions>
      <div class="cmd-actions">
        <span class="cmd-count">{{ cmdLength }} 字符</span>
        <AppButton variant="outline" size="sm" :icon="Copy24Regular" @click="onCopyCommand">
          复制命令
        </AppButton>
      </div>
    </template>

    <p v-if="errorCount" class="cmd-issue">
      <NIcon :component="Warning16Filled" :size="12" />
      <span>有 {{ errorCount }} 处问题，游戏内可能不生效</span>
    </p>

    <div class="cmd-box" :class="{ 'cmd-box--fill': stretch }">
      <textarea
        ref="scroller"
        class="cmd-input"
        :class="{ 'cmd-input--fill': stretch }"
        readonly
        :value="commandOutput"
        spellcheck="false"
      />
      <AppScrollbar :target="scroller" :inset="4" />
    </div>
  </RawJsonCard>
</template>

<style scoped>
.cmd-actions { display: flex; align-items: center; gap: 8px; }
.cmd-issue {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--warning);
}
.cmd-count {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--muted-foreground);
  transition: color 0.4s ease;
}
.cmd-box {
  position: relative;
  padding: 9px 12px;
  background: var(--muted);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: background-color 0.4s ease, border-color 0.4s ease;
}
.cmd-box--fill {
  flex: 1;
  min-height: 0;
  display: flex;
}
/* 命令不再是单行：文本域自动折行，超出部分由浮层拇指指示 */
.cmd-input {
  display: block;
  width: 100%;
  height: 40px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--foreground);
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: 13px;
  line-height: 1.75;
  outline: none;
  resize: none;
  word-break: break-all;
  scrollbar-width: none;
  transition: color 0.4s ease;
}
.cmd-input::-webkit-scrollbar {
  display: none;
}
.cmd-input--fill {
  flex: 1;
  min-height: 0;
  height: auto;
}
</style>

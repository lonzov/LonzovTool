<script setup>
import { onBeforeUnmount } from 'vue'
import { NIcon, useMessage } from 'naive-ui'
import { ArrowSort24Regular, Copy16Regular, Delete24Regular } from '@vicons/fluent'
import { copyText } from '../../../utils/clipboard.js'

const props = defineProps({
  /** 当前转换结果。为空表示还没转换过，复制时给出提示 */
  output: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['convert', 'clear'])

const message = useMessage()

async function handleCopy() {
  if (!props.output) {
    message.warning('请先转换再复制', { duration: 1800 })
    return
  }
  const copied = await copyText(props.output)
  if (copied) message.success('复制成功！', { duration: 1800 })
  else message.error('复制失败', { duration: 1800 })
}

// 清空不可撤销，用两次点击代替模态框：窗口期内第二次点击才真正执行
const CLEAR_CONFIRM_WINDOW = 800
let clearClickCount = 0
let clearClickTimer = null
let clearConfirmMsg = null

function handleClear() {
  clearClickCount++
  if (clearClickCount === 1) {
    clearConfirmMsg = message.warning('双击确认清空', { duration: 1800 })
    clearClickTimer = setTimeout(() => {
      clearClickCount = 0
      clearClickTimer = null
    }, CLEAR_CONFIRM_WINDOW)
  } else if (clearClickCount >= 2) {
    if (clearClickTimer) clearTimeout(clearClickTimer)
    clearClickTimer = null
    clearClickCount = 0
    emit('clear')
    // 先销毁确认提示再重发结果提示，独占展示位并保证完整停留时长
    if (clearConfirmMsg) {
      clearConfirmMsg.destroy()
      clearConfirmMsg = null
    }
    message.success('已清空', { duration: 1800 })
  }
}

onBeforeUnmount(() => {
  if (clearClickTimer) clearTimeout(clearClickTimer)
})
</script>

<template>
  <button class="control-btn" @click="emit('convert')">
    <NIcon :component="ArrowSort24Regular" />
    <span>转换</span>
  </button>
  <button class="control-btn control-btn--ghost" @click="handleCopy">
    <NIcon :component="Copy16Regular" />
    <span>复制</span>
  </button>
  <button class="control-btn control-btn--danger" @click="handleClear">
    <NIcon :component="Delete24Regular" />
    <span>清空</span>
  </button>
</template>

<style scoped>
.control-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  font-size: 0.875rem;
  font-weight: 600;
  font-family: inherit;
  white-space: nowrap;
  cursor: pointer;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background-color: var(--primary);
  color: var(--primary-foreground);
  transition: background-color 0.4s ease, color 0.4s ease, border-color 0.4s ease;
  -webkit-tap-highlight-color: transparent;
}

.control-btn--ghost {
  background-color: var(--accent);
  border-color: var(--border-strong);
  color: var(--foreground);
}

/* 危险操作只做浅底红字，实心红在这类「清空」动作上过重 */
.control-btn--danger {
  background-color: color-mix(in srgb, var(--destructive) 10%, transparent);
  color: var(--destructive);
}

.control-btn :deep(.n-icon) {
  font-size: 15px;
}
</style>

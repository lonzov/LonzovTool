<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { NModal, NConfigProvider, useMessage } from 'naive-ui'
import { darkTheme } from 'naive-ui'
import { useTheme } from '../composables/useTheme'
import { useSWUpdate } from '../composables/useSWUpdate'

const { isDark } = useTheme()
const { showUpdateModal, popupTitle, popupContent, popupButtons, applyUpdate, deferUpdate } = useSWUpdate()
const message = useMessage()

/** 处理按钮点击 */
function handleButtonClick(btn) {
  if (btn.link) {
    window.open(btn.link, '_blank', 'noopener')
  } else if (btn.action === 'update_sw') {
    applyUpdate()
    message.success('更新完成，即将刷新…', { duration: 1800 })
  } else if (btn.action === 'close' || !btn.action) {
    deferUpdate()
  }
}

/** 获取按钮样式类 */
function getBtnClass(btn) {
  const style = btn.style || 'outline'
  if (style === 'fill') return 'btn btn-fill'
  if (style === 'text') return 'btn btn-text'
  return 'btn btn-outline'
}

const darkOverrides = {
  common: { neutralModal: '#191919' },
  Card: { colorModal: '#191919' },
}

const isCompact = ref(false)
let _mq
function _onMqChange(e) { isCompact.value = e.matches }
onMounted(() => {
  _mq = window.matchMedia('(max-width: 640px)')
  isCompact.value = _mq.matches
  _mq.addEventListener('change', _onMqChange)
})
onUnmounted(() => {
  if (_mq) _mq.removeEventListener('change', _onMqChange)
})

const modalStyle = computed(() => ({
  maxWidth: '540px',
  width: 'calc(100% - 32px)',
  maxHeight: isCompact.value ? 'calc(100vh - 120px)' : 'calc(100vh - 48px)',
  borderRadius: '16px',
  cornerShape: 'squircle',
}))

// 模糊遮罩（与 cookie 弹窗一致）
watch(showUpdateModal, (val) => {
  if (val) {
    nextTick(() => {
      if (document.getElementById('update-blur-overlay')) return
      const overlay = document.createElement('div')
      overlay.id = 'update-blur-overlay'
      overlay.style.cssText = [
        'position: fixed', 'top: 0', 'left: 0', 'right: 0', 'bottom: 0',
        'z-index: 1000',
        '-webkit-backdrop-filter: blur(8px)', 'backdrop-filter: blur(8px)',
        'background: rgba(0, 0, 0, 0.1)',
        'pointer-events: none',
        'opacity: 0', 'transition: opacity 0.3s ease',
      ].join(';')
      document.body.appendChild(overlay)
      requestAnimationFrame(() => { overlay.style.opacity = '1' })
    })
  } else {
    const overlay = document.getElementById('update-blur-overlay')
    if (overlay) {
      overlay.style.opacity = '0'
      setTimeout(() => overlay.remove(), 300)
    }
  }
})
</script>

<template>
  <NConfigProvider :theme="isDark ? darkTheme : null" :theme-overrides="isDark ? darkOverrides : undefined">
    <NModal
      v-model:show="showUpdateModal"
      preset="card"
      :style="modalStyle"
      :title="popupTitle || '发现新版本'"
      :bordered="false"
      :closable="true"
      @close="deferUpdate"
      :auto-focus="false"
      content-scrollable
    >
      <div class="update-desc" v-html="popupContent || '小舟工具箱已更新，点击&quot;立即更新&quot;刷新页面获取最新体验。'"></div>
      <template #footer>
        <div class="modal-actions">
          <template v-if="popupButtons.length > 0">
            <button
              v-for="(btn, i) in popupButtons"
              :key="i"
              :class="getBtnClass(btn)"
              @click="handleButtonClick(btn)"
            >{{ btn.text }}</button>
          </template>
          <template v-else>
            <button class="btn btn-outline" @click="deferUpdate">暂不更新</button>
            <button class="btn btn-fill" @click="applyUpdate">立即更新</button>
          </template>
        </div>
      </template>
    </NModal>
  </NConfigProvider>
</template>

<style scoped>
.update-desc {
  font-size: 15px;
  line-height: 1.75;
  letter-spacing: 0.02em;
  color: var(--n-text-color-2);
  padding: 4px 2px;
}

.update-desc :deep(p) {
  margin: 0 0 12px 0;
}

.update-desc :deep(p:last-child) {
  margin-bottom: 0;
}

.update-desc :deep(ul),
.update-desc :deep(ol) {
  padding-left: 20px;
  margin: 8px 0;
}

.update-desc :deep(li) {
  margin-bottom: 6px;
  line-height: 1.7;
}

.update-desc :deep(li:last-child) {
  margin-bottom: 0;
}

.update-desc :deep(strong),
.update-desc :deep(b) {
  font-weight: 600;
  color: var(--n-text-color);
}

.update-desc :deep(code) {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 13px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--n-tag-color);
  color: var(--n-text-color);
}

.update-desc :deep(a) {
  color: var(--n-primary-color);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s;
}

.update-desc :deep(a:hover) {
  border-bottom-color: var(--n-primary-color);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 8px;
}

.btn {
  height: 34px;
  padding: 0 20px;
  border-radius: 17px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  border: none;
}

/* fill - 全填充主按钮 */
[data-theme="light"] .btn-fill {
  background: #1A1A1A;
  color: #fff !important;
}

[data-theme="dark"] .btn-fill {
  background: #fff;
  color: #1A1A1A !important;
}

.btn-fill:hover {
  opacity: 0.85;
}

/* outline - 描边按钮 */
.btn-outline {
  border: 1.5px solid currentColor;
}

[data-theme="light"] .btn-outline {
  background: #fff;
  color: #1A1A1A;
}

[data-theme="light"] .btn-outline:hover {
  background: #E8E8E8;
}

[data-theme="dark"] .btn-outline {
  background: transparent;
  color: rgba(255, 255, 255, 0.87);
}

[data-theme="dark"] .btn-outline:hover {
  background: rgba(255, 255, 255, 0.08);
}

/* text - 仅文字按钮 */
.btn-text {
  background: transparent;
}

[data-theme="light"] .btn-text {
  color: #1A1A1A;
}

[data-theme="light"] .btn-text:hover {
  background: rgba(0, 0, 0, 0.06);
}

[data-theme="dark"] .btn-text {
  color: rgba(255, 255, 255, 0.87);
}

[data-theme="dark"] .btn-text:hover {
  background: rgba(255, 255, 255, 0.08);
}
</style>

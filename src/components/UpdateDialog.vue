<script setup>
import { watch, nextTick } from 'vue'
import { NModal, NConfigProvider } from 'naive-ui'
import { darkTheme } from 'naive-ui'
import { useTheme } from '../composables/useTheme'
import { useSWUpdate } from '../composables/useSWUpdate'

const { isDark } = useTheme()
const { showUpdateModal, popupTitle, popupContent, applyUpdate, deferUpdate } = useSWUpdate()

const darkOverrides = {
  common: { neutralModal: '#191919' },
  Card: { colorModal: '#191919' },
}

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
      :style="{ maxWidth: '540px', width: 'calc(100% - 32px)', borderRadius: '16px' }"
      :title="popupTitle || '发现新版本'"
      :bordered="false"
      :closable="true"
      @close="deferUpdate"
      :auto-focus="false"
    >
      <div class="update-desc" v-html="popupContent || '小舟工具箱已更新，点击&quot;立即更新&quot;刷新页面获取最新体验。'"></div>
      <template #footer>
        <div class="modal-actions">
          <button class="btn btn-later" @click="deferUpdate">暂不更新</button>
          <button class="btn btn-update" @click="applyUpdate">立即更新</button>
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

/* 立即更新 - 主按钮 */
[data-theme="light"] .btn-update {
  background: #1A1A1A;
  color: #fff !important;
}

[data-theme="dark"] .btn-update {
  background: #fff;
  color: #1A1A1A !important;
}

.btn-update:hover {
  opacity: 0.85;
}

/* 暂不更新 - 描边按钮 */
.btn-later {
  border: 1.5px solid currentColor;
}

[data-theme="light"] .btn-later {
  background: #fff;
  color: #1A1A1A;
}

[data-theme="light"] .btn-later:hover {
  background: #E8E8E8;
}

[data-theme="dark"] .btn-later {
  background: transparent;
  color: rgba(255, 255, 255, 0.87);
}

[data-theme="dark"] .btn-later:hover {
  background: rgba(255, 255, 255, 0.08);
}
</style>

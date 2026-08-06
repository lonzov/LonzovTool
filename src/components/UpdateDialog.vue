<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { NModal, NConfigProvider, NTooltip, useMessage } from 'naive-ui'
import { darkTheme } from 'naive-ui'
import { useTheme } from '../composables/useTheme'
import { useSWUpdate } from '../composables/useSWUpdate'
import MarkdownRenderer from './MarkdownRenderer.vue'

const { isDark } = useTheme()
const { showUpdateModal, popupTitle, popupContent, popupVersionInfo, popupNewVersion, popupButtons, applyUpdate, deferUpdate } = useSWUpdate()
const message = useMessage()

/** 版本号只保留前三位，如 3.3.10.1 → 3.3.10 */
const displayVersion = computed(() => {
  const raw = popupNewVersion.value.replace(/^v/, '')
  return 'v' + raw.split('.').slice(0, 3).join('.')
})

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
      :title="popupTitle || '发现新版本'"
      :style="modalStyle"
      :segmented="{ content: true, footer: 'soft' }"
      :closable="true"
      @close="deferUpdate"
      :auto-focus="false"
      content-scrollable
    >
      <div class="update-desc">
        <p class="new-version-banner">{{ displayVersion || '新版本' }} 版本现已可用</p>
        <p class="guide-text">反馈或建议请前往 「侧边栏-关于本站-我要反馈」或 <a href="https://qm.qq.com/q/hjTqUyIKEo" target="_blank" rel="noopener" class="guide-link">加入QQ群</a>。</p>
        <p class="changelog-label">👾 更新日志：</p>
        <MarkdownRenderer v-if="popupContent" :raw="popupContent" />
        <p v-else>小舟工具箱已更新，点击"立即更新"刷新页面获取最新体验。</p>
      </div>
      <template #footer>
        <div class="update-footer">
          <p v-if="popupVersionInfo" class="version-info">{{ popupVersionInfo }}</p>
          <div class="modal-actions">
            <template v-if="popupButtons.length > 0">
              <template v-for="(btn, i) in popupButtons" :key="i">
                <NTooltip v-if="btn.action === 'close'" placement="top">
                  <template #trigger>
                    <button :class="getBtnClass(btn)" @click="handleButtonClick(btn)">{{ btn.text }}</button>
                  </template>
                  若选择暂不更新，将在下次打开网站时自动更新
                </NTooltip>
                <button v-else :class="getBtnClass(btn)" @click="handleButtonClick(btn)">{{ btn.text }}</button>
              </template>
            </template>
            <template v-else>
              <NTooltip placement="top">
                <template #trigger>
                  <button class="btn btn-outline" @click="deferUpdate">暂不更新</button>
                </template>
                若选择暂不更新，将在下次打开网站时自动更新
              </NTooltip>
              <button class="btn btn-fill" @click="applyUpdate">立即更新</button>
            </template>
          </div>
        </div>
      </template>
    </NModal>
  </NConfigProvider>
</template>

<style scoped>
.update-desc {
  padding: 4px 2px;
}

.new-version-banner {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: 0.04em;
  color: var(--n-text-color);
  margin: 0 0 8px 0;
}

.guide-text {
  font-size: 14px;
  line-height: 1.6;
  color: color-mix(in srgb, var(--n-text-color) 78%, transparent);
  margin: 0 0 16px 0;
}

.guide-text :deep(.guide-link) {
  color: var(--n-text-color);
  text-decoration: none;
  position: relative;
  padding-bottom: 2px;
  display: inline-block;
  vertical-align: baseline;
  opacity: 1;
}

.guide-text :deep(.guide-link::before) {
  content: '';
  display: block;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 5px;
  height: 1px;
  background-image: repeating-linear-gradient(to right,
      color-mix(in srgb, var(--n-text-color), transparent 30%) 0 4px,
      transparent 4px 8px);
  background-repeat: repeat-x;
  background-size: 8px 1px;
  opacity: 1;
  transition: opacity 0.3s;
  pointer-events: none;
}

.guide-text :deep(.guide-link::after) {
  content: '';
  display: block;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 5px;
  height: 1px;
  background-color: var(--n-text-color);
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
}

.guide-text :deep(.guide-link:hover::before) {
  opacity: 0;
}

.guide-text :deep(.guide-link:hover::after) {
  opacity: 1;
}

.changelog-label {
  font-size: 15px;
  font-weight: 600;
  color: var(--n-text-color);
  margin: 0 0 8px 0;
}

/* 消除 changelog 第一个 h3 的顶部大间距 */
.update-desc :deep(.md-content h3:first-of-type) {
  margin-top: 0;
}

.update-footer {
  width: 100%;
}

.version-info {
  font-size: 13px;
  color: var(--n-text-color-3);
  margin: 0 0 6px 0;
  text-align: right;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
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

<style>
/* 更新弹窗 Tooltip 深浅色覆盖（popover 渲染到 body，须全局样式） */
.n-popover {
  --n-color: #fff !important;
  --n-text-color: #1A1A1A !important;
}

[data-theme="dark"] .n-popover {
  --n-color: #2A2A2A !important;
  --n-text-color: rgba(255, 255, 255, 0.87) !important;
}
</style>

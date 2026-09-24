<script setup>
import { computed, watch, defineAsyncComponent, h } from 'vue'
import { NTooltip, useMessage } from 'naive-ui'
import { useSWUpdate } from '../composables/useSWUpdate'
import AppModal from './ui/AppModal.vue'
/* MarkdownRenderer 携带 markdown-it（~47K gz），只在弹窗真正展示更新内容时加载 */
const loadMarkdown = () => import('./MarkdownRenderer.vue')
const MarkdownRenderer = defineAsyncComponent(loadMarkdown)

const { showUpdateModal, popupTitle, popupContent, popupVersionInfo, popupNewVersion, popupButtons, forceUpdate, silentUpdated, applyUpdate, deferUpdate } = useSWUpdate()
const message = useMessage()

/**
 * 静默更新（如 v3.4.4 → v3.4.4.1）不弹更新弹窗、页面也不重载，
 * 此时页面仍在跑旧资源，弹提示引导用户刷新
 */
watch(silentUpdated, (val) => {
  if (!val) return
  silentUpdated.value = false
  message.success(
    () =>
      h('div', { class: 'sw-reload-tip' }, [
        h('span', '更新完毕，刷新应用'),
        h(
          'button',
          {
            class: 'sw-reload-tip-btn',
            onClick: () => window.location.reload(),
          },
          '刷新',
        ),
      ]),
    { duration: 8000 },
  )
}, { immediate: true })

/** 版本号只保留前三位，如 3.3.10.1 → 3.3.10 */
const displayVersion = computed(() => {
  const raw = popupNewVersion.value.replace(/^v/, '')
  return 'v' + raw.split('.').slice(0, 3).join('.')
})

/** 是否为「暂不更新」类按钮 */
function isDeferBtn(btn) {
  return btn.action === 'close' || !btn.action
}

const deferTip = computed(() => (forceUpdate.value ? '重要更新无法稍后更新' : '若选择暂不更新，将在下次打开网站时自动更新'))

/** 处理按钮点击 */
function handleButtonClick(btn) {
  if (btn.link) {
    window.open(btn.link, '_blank', 'noopener')
  } else if (btn.action === 'update_sw') {
    applyUpdate()
    message.success('更新完成，即将刷新…', { duration: 1800 })
  } else if (isDeferBtn(btn)) {
    deferUpdate()
  }
}

/** 获取按钮样式类 */
function getBtnClass(btn) {
  const style = btn.style || 'outline'
  const base = style === 'fill'
    ? 'app-btn app-btn--fill'
    : style === 'text'
      ? 'app-btn app-btn--text'
      : 'app-btn app-btn--outline'
  // 大版本强制更新：「暂不更新」置灰不可点
  return forceUpdate.value && isDeferBtn(btn) ? `${base} btn-force-disabled` : base
}

// 弹窗打开即预热 Markdown 渲染 chunk，使更新内容加载与弹窗动画重叠
watch(showUpdateModal, (val) => {
  if (val) loadMarkdown()
})
</script>

<template>
  <AppModal
    :auto-focus="false"
    :bordered="true"
    v-model:show="showUpdateModal"
    :title="popupTitle || '发现新版本'"
    :max-width="540"
    :closable="!forceUpdate"
    :mask-closable="!forceUpdate"
    :close-on-esc="!forceUpdate"
    content-scrollable
    blur-mask
    @close="deferUpdate"
  >
    <div class="update-desc">
      <p class="new-version-banner">
        <template v-if="forceUpdate">【⚠️重要更新】{{ displayVersion || '新版本' }}</template>
        <template v-else>{{ displayVersion || '新版本' }} 版本现已可用</template>
      </p>
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
              <NTooltip v-if="btn.action === 'close'" placement="top" :trigger="forceUpdate ? 'click' : 'hover'">
                <template #trigger>
                  <button :class="getBtnClass(btn)" @click="handleButtonClick(btn)">{{ btn.text }}</button>
                </template>
                {{ deferTip }}
              </NTooltip>
              <button v-else :class="getBtnClass(btn)" @click="handleButtonClick(btn)">{{ btn.text }}</button>
            </template>
          </template>
          <template v-else>
            <NTooltip placement="top" :trigger="forceUpdate ? 'click' : 'hover'">
              <template #trigger>
                <button class="app-btn app-btn--outline" :class="{ 'btn-force-disabled': forceUpdate }" @click="deferUpdate">暂不更新</button>
              </template>
              {{ deferTip }}
            </NTooltip>
            <button class="app-btn app-btn--fill" @click="applyUpdate">立即更新</button>
          </template>
        </div>
      </div>
    </template>
  </AppModal>
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
  color: var(--subtle-foreground);
  margin: 0 0 6px 0;
  text-align: right;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

/* 大版本强制更新：「暂不更新」置灰：无描边、无 hover 反馈，点击仅弹提示 */
.btn-force-disabled,
.btn-force-disabled:hover {
  border: none !important;
  background: transparent !important;
  opacity: 0.5;
  cursor: default;
}
</style>

<style>
/* 静默更新提示条（message 渲染到 body，须全局样式） */
.sw-reload-tip {
  display: flex;
  align-items: center;
  gap: 16px;
}

.sw-reload-tip-btn {
  padding: 2px 12px;
  border: none;
  border-radius: var(--radius-full);
  corner-shape: round;
  font-size: 13px;
  font-family: inherit;
  line-height: 1.6;
  white-space: nowrap;
  cursor: pointer;
  background: var(--primary);
  color: var(--primary-foreground);
  transition: background-color 0.4s ease, color 0.4s ease, opacity 0.2s ease;
}

.sw-reload-tip-btn:hover {
  opacity: 0.85;
}
</style>

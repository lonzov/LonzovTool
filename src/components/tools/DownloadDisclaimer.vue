<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { NModal, NConfigProvider, useMessage } from 'naive-ui'
import { darkTheme } from 'naive-ui'
import { useTheme } from '../../composables/useTheme'

const props = defineProps({
  show: Boolean,
  developer: { type: String, default: '' },
})

const emit = defineEmits(['update:show', 'continue'])

const message = useMessage()
const { isDark } = useTheme()

const showLocal = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val),
})

const DISMISSED_KEY = 'dl_disclaimer_dismissed'

// 5 秒冷却
const COOLDOWN_SECONDS = 5
const cooldownRemaining = ref(COOLDOWN_SECONDS)
const canDismiss = ref(false)
let cooldownTimer = null

function startCooldown() {
  canDismiss.value = false
  cooldownRemaining.value = COOLDOWN_SECONDS
  clearInterval(cooldownTimer)
  cooldownTimer = setInterval(() => {
    cooldownRemaining.value--
    if (cooldownRemaining.value <= 0) {
      canDismiss.value = true
      clearInterval(cooldownTimer)
      cooldownTimer = null
    }
  }, 1000)
}

function handleDismiss() {
  if (!canDismiss.value) {
    message.warning(`请等待 ${cooldownRemaining.value} 秒`, { duration: 1800 })
    return
  }
  try {
    localStorage.setItem(DISMISSED_KEY, 'true')
  } catch { /* ignore */ }
  emit('continue')
  showLocal.value = false
}

function handleContinue() {
  emit('continue')
  showLocal.value = false
}

// 模糊遮罩 + 启动冷却
watch(() => props.show, (val) => {
  if (val) {
    startCooldown()
    nextTick(() => {
      if (document.getElementById('disclaimer-blur-overlay')) return
      const overlay = document.createElement('div')
      overlay.id = 'disclaimer-blur-overlay'
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
    clearInterval(cooldownTimer)
    cooldownTimer = null
    const overlay = document.getElementById('disclaimer-blur-overlay')
    if (overlay) {
      overlay.style.opacity = '0'
      setTimeout(() => overlay.remove(), 300)
    }
  }
})

onUnmounted(() => {
  clearInterval(cooldownTimer)
})

const darkOverrides = {
  common: { neutralModal: '#191919' },
  Card: { colorModal: '#191919' },
}

// 响应式
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
</script>

<template>
  <NConfigProvider :theme="isDark ? darkTheme : null" :theme-overrides="isDark ? darkOverrides : undefined">
    <NModal
      v-model:show="showLocal"
      preset="card"
      :style="modalStyle"
      title="声明"
      :bordered="false"
      :closable="false"
      :mask-closable="false"
      :auto-focus="false"
    >
      <div class="disclaimer-desc">
        本工具由 <strong>{{ developer }}</strong> 开发，小舟工具箱仅提供下载分发服务。感谢使用，请支持原作者！
      </div>
      <template #footer>
        <div class="modal-actions">
          <button
            class="btn btn-outline"
            :class="{ 'btn-disabled': !canDismiss }"
            @click="handleDismiss"
          >不再提醒{{ canDismiss ? '' : ' ' + cooldownRemaining }}</button>
          <button class="btn btn-fill" @click="handleContinue">继续下载</button>
        </div>
      </template>
    </NModal>
  </NConfigProvider>
</template>

<style scoped>
.disclaimer-desc {
  font-size: 15px;
  line-height: 1.75;
  letter-spacing: 0.02em;
  color: var(--n-text-color-2);
  padding: 4px 2px;
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

/* disabled - 置灰：无描边，文字透明度降低 */
.btn-disabled {
  border: none !important;
  opacity: 0.3;
  cursor: default;
}

.btn-disabled:hover {
  background: transparent !important;
}

[data-theme="dark"] .btn-disabled:hover {
  background: transparent !important;
}
</style>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppButton from './ui/AppButton.vue'
import AppModal from './ui/AppModal.vue'
import AnnouncementMarkdown from './AnnouncementMarkdown.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  announcement: { type: Object, default: null },
  preview: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'after-leave'])
const router = useRouter()

const nowMs = ref(Date.now())
const openedAt = ref(Date.now())
let timer = null

const closeConfig = computed(() => props.announcement?.close || {})
const minSeconds = computed(() =>
  Math.max(0, Math.min(Number(closeConfig.value.min_seconds) || 0, 5)),
)
const hasConfiguredClose = computed(() => {
  if (closeConfig.value.show_close_button !== false) return true
  if (closeConfig.value.mask_closable !== false) return true
  return (props.announcement?.buttons || []).some(
    (button) => button.action === 'close' || button.action === 'dismiss',
  )
})
const fallbackVisible = computed(() => !props.preview && !hasConfiguredClose.value)
const lockRemaining = computed(() => {
  if (props.preview) return 0
  return Math.max(0, Math.ceil((openedAt.value + minSeconds.value * 1000 - nowMs.value) / 1000))
})
const locked = computed(() => {
  if (props.preview) return false
  return Math.ceil((openedAt.value + minSeconds.value * 1000 - nowMs.value) / 1000) > 0
})

function startTimer() {
  stopTimer()
  openedAt.value = Date.now()
  nowMs.value = Date.now()
  timer = setInterval(() => {
    nowMs.value = Date.now()
    if (!locked.value && !props.preview) stopTimer()
  }, 200)
}

function stopTimer() {
  if (timer) clearInterval(timer)
  timer = null
}

watch(
  () => props.show,
  (show) => {
    if (show && !props.preview) startTimer()
    else stopTimer()
  },
  { immediate: true },
)

watch(
  () => props.announcement?.id,
  () => {
    if (props.show && !props.preview) startTimer()
  },
)

onBeforeUnmount(stopTimer)

function buttonRemaining(button) {
  if (props.preview) return 0
  const seconds = Math.max(0, Math.min(Number(button?.disabled_seconds) || 0, 5))
  return Math.max(0, Math.ceil((openedAt.value + seconds * 1000 - nowMs.value) / 1000))
}

function buttonDisabled(button) {
  if (props.preview) return false
  const isCloseAction = button?.action === 'close' || button?.action === 'dismiss'
  return buttonRemaining(button) > 0 || (isCloseAction && locked.value)
}

function buttonText(button) {
  const remaining = buttonRemaining(button)
  return remaining > 0 ? `${button.label} (${remaining}s)` : button.label
}

function requestClose() {
  if (locked.value) return
  emit('close')
}

function buttonMemory(button) {
  if (!button) return undefined
  return { remember: button.remember, hours: button.hours }
}

function beforeClose() {
  if (props.preview) {
    emit('close')
    return false
  }
  requestClose()
  // 由父组件更新 show；阻止 Naive 自己改内部状态，避免和受控状态打架
  return false
}

function handleButton(button) {
  if (!button || buttonDisabled(button)) return
  if (props.preview) {
    emit('close')
    return
  }

  if (button.action === 'close' || button.action === 'dismiss') {
    emit('close', buttonMemory(button))
    return
  }

  if (button.action === 'link' && button.target) {
    window.open(button.target, '_blank', 'noopener,noreferrer')
  } else if (button.action === 'route' && button.target) {
    router.push(button.target).catch(() => {})
  }

  if (button.close_on_click) emit('close', buttonMemory(button))
}
</script>

<template>
  <AppModal
    :show="show && !!announcement"
    :title="announcement?.title || undefined"
    :max-width="560"
    :auto-focus="false"
    :closable="closeConfig.show_close_button !== false"
    :mask-closable="closeConfig.mask_closable !== false"
    :close-on-esc="closeConfig.mask_closable !== false"
    :before-close="beforeClose"
    class="announcement-modal"
    @update:show="(value) => !value && requestClose()"
    @after-leave="emit('after-leave')"
  >
    <template v-if="announcement">
      <AnnouncementMarkdown :content="announcement.content" />
      <p v-if="lockRemaining > 0" class="announcement-lock-hint" aria-live="polite">
        可在 {{ lockRemaining }} 秒后关闭
      </p>
    </template>

    <template v-if="announcement?.buttons?.length || fallbackVisible" #footer>
      <div class="announcement-actions">
        <AppButton
          v-for="button in announcement.buttons"
          :key="`${button.label}-${button.action}-${button.target}`"
          :variant="button.variant || 'outline'"
          :tone="button.tone || 'default'"
          :size="button.size || 'md'"
          :disabled="buttonDisabled(button)"
          @click="handleButton(button)"
        >
          {{ buttonText(button) }}
        </AppButton>
        <AppButton
          v-if="fallbackVisible"
          variant="outline"
          :disabled="locked"
          @click="requestClose"
        >
          关闭{{ lockRemaining > 0 ? ` (${lockRemaining}s)` : '' }}
        </AppButton>
      </div>
    </template>
  </AppModal>
</template>

<style scoped>
.announcement-modal :deep(.app-modal-title) {
  font-size: 1.05rem;
}

.announcement-lock-hint {
  margin: 12px 0 0;
  color: var(--subtle-foreground);
  font-size: 0.76rem;
  text-align: right;
}

.announcement-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

@media (width <= 640px) {
  .announcement-actions {
    width: 100%;
  }

  .announcement-actions :deep(.app-btn) {
    flex: 1 1 auto;
  }
}
</style>

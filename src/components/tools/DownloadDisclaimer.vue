<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useMessage } from 'naive-ui'
import AppModal from '../ui/AppModal.vue'

const props = defineProps({
  show: Boolean,
  developer: { type: String, default: '' },
})

const emit = defineEmits(['update:show', 'continue'])

const message = useMessage()

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

// 启动冷却
watch(() => props.show, (val) => {
  if (val) {
    startCooldown()
  } else {
    clearInterval(cooldownTimer)
    cooldownTimer = null
  }
})

onUnmounted(() => {
  clearInterval(cooldownTimer)
})
</script>

<template>
  <AppModal
    :auto-focus="false"
    :segmented="false"
    v-model:show="showLocal"
    title="声明"
    :max-width="540"
    :closable="false"
    :mask-closable="false"
    blur-mask
  >
    <div class="disclaimer-desc">
      本工具由 <strong>{{ developer }}</strong> 开发，小舟工具箱仅提供下载分发服务。感谢使用，请支持原作者！
    </div>
    <template #footer>
      <div class="modal-actions">
        <button
          class="app-btn app-btn--outline"
          :class="{ 'btn-disabled': !canDismiss }"
          @click="handleDismiss"
        >不再提醒{{ canDismiss ? '' : ' ' + cooldownRemaining }}</button>
        <button class="app-btn app-btn--fill" @click="handleContinue">继续下载</button>
      </div>
    </template>
  </AppModal>
</template>

<style scoped>
.disclaimer-desc {
  font-size: 15px;
  line-height: 1.75;
  letter-spacing: 0.02em;
  color: var(--muted-foreground);
  padding: 4px 2px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 8px;
}

/* disabled - 置灰：无描边，文字透明度降低 */
.btn-disabled {
  border: none !important;
  /* 置灰时不该还带着描边按钮的实底 */
  background: transparent !important;
  opacity: 0.3;
  cursor: default;
}

.btn-disabled:hover {
  background: transparent !important;
}
</style>

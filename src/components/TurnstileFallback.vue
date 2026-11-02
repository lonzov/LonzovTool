<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppModal from './ui/AppModal.vue'
import { actualTheme } from '../composables/useTheme.js'
import { TURNSTILE_SCRIPT_URL, TURNSTILE_SITE_KEY } from '../constants/turnstile.js'

/**
 * 极验不可用时的备用验证弹窗。
 *
 * 只在服务端返回 captcha_fallback_required 后由调用方打开：Turnstile 仍必须在
 * 服务端 siteverify 通过，这里只负责拿 token，不承担任何放行判断。
 */
const props = defineProps({
  show: { type: Boolean, default: false },
  action: { type: String, required: true },
  title: { type: String, default: '备用验证' },
  description: {
    type: String,
    default: '主验证码服务暂时不可用，请完成下方验证后继续。',
  },
})

const emit = defineEmits(['update:show', 'success', 'error', 'expired', 'close'])

const host = ref(null)
const errorText = ref('')
const loading = ref(false)
let widgetId = null
let scriptPromise = null

function loadScript() {
  if (window.turnstile?.render) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-turnstile="explicit"]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('load failed')))
      return
    }
    const script = document.createElement('script')
    script.src = TURNSTILE_SCRIPT_URL
    script.async = true
    script.defer = true
    script.dataset.turnstile = 'explicit'
    script.addEventListener('load', () => resolve())
    script.addEventListener('error', () => {
      scriptPromise = null
      reject(new Error('load failed'))
    })
    document.head.appendChild(script)
  })
  return scriptPromise
}

function cleanupWidget() {
  if (widgetId !== null && window.turnstile?.remove) {
    try {
      window.turnstile.remove(widgetId)
    } catch {
      // widget 已被页面卸载时 remove 会抛，忽略即可
    }
  }
  widgetId = null
}

async function renderWidget() {
  if (!props.show) return
  loading.value = true
  errorText.value = ''
  try {
    await loadScript()
    await nextTick()
    if (!props.show || !host.value) return
    if (!window.turnstile?.render) {
      errorText.value = '验证组件加载失败，请检查网络后重试'
      emit('error', 'load_failed')
      return
    }
    cleanupWidget()
    widgetId = window.turnstile.render(host.value, {
      sitekey: TURNSTILE_SITE_KEY,
      action: props.action,
      theme: actualTheme.value === 'dark' ? 'dark' : 'light',
      language: 'zh-cn',
      callback: (token) => {
        errorText.value = ''
        emit('success', token)
      },
      'error-callback': () => {
        errorText.value = '验证组件加载失败，请关闭后重试'
        emit('error', 'turnstile_error')
      },
      'expired-callback': () => {
        errorText.value = '验证已过期，请重新完成'
        emit('expired')
      },
      'timeout-callback': () => {
        errorText.value = '验证超时，请重新完成'
        emit('expired')
      },
    })
  } catch (error) {
    console.warn('[turnstile] 验证组件加载失败', error)
    errorText.value = '验证组件加载失败，请检查网络后重试'
    emit('error', 'load_failed')
  } finally {
    loading.value = false
  }
}

function reset() {
  errorText.value = ''
  if (widgetId !== null && window.turnstile?.reset) {
    try {
      window.turnstile.reset(widgetId)
    } catch {
      // 同上
    }
  }
}

function close() {
  emit('update:show', false)
  emit('close')
}

watch(
  () => props.show,
  (show) => {
    if (show) renderWidget()
    else cleanupWidget()
  },
)

watch(actualTheme, () => {
  if (props.show) renderWidget()
})

onMounted(() => {
  if (props.show) renderWidget()
})

onBeforeUnmount(cleanupWidget)

defineExpose({ reset })
</script>

<template>
  <AppModal
    :show="show"
    :title="title"
    :description="description"
    :max-width="420"
    :z-index="2400"
    :auto-focus="false"
    :mask-closable="false"
    @update:show="emit('update:show', $event)"
    @close="close"
  >
    <div class="turnstile-body">
      <div ref="host" class="turnstile-host" />
      <p v-if="loading" class="turnstile-hint">正在加载验证组件…</p>
      <p v-else-if="errorText" class="turnstile-error" role="alert">{{ errorText }}</p>
      <p v-else class="turnstile-hint">验证通过后会自动继续提交。</p>
    </div>

    <template #footer>
      <div class="turnstile-actions">
        <button class="app-btn app-btn--outline app-btn--sm" type="button" @click="close">
          取消
        </button>
      </div>
    </template>
  </AppModal>
</template>

<style scoped>
.turnstile-body {
  display: flex;
  min-height: 96px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 4px 0 8px;
}

.turnstile-host {
  display: flex;
  min-height: 65px;
  align-items: center;
  justify-content: center;
}

.turnstile-hint,
.turnstile-error {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  text-align: center;
}

.turnstile-hint {
  color: var(--muted-foreground);
}

.turnstile-error {
  color: var(--destructive);
}

.turnstile-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}
</style>

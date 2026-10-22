import { computed, onBeforeUnmount, ref } from 'vue'

/** 服务端按 60 秒窗口限流重发，本地倒计时只是提前把按钮按住，省掉必然失败的那一次请求 */
export const RESEND_COOLDOWN_SECONDS = 60

/**
 * 验证码重发冷却倒计时。
 * 服务端给出的剩余秒数优先（429 带 Retry-After 时按它走），拿不到才回落到默认窗口。
 */
export function useResendCountdown(cooldown = RESEND_COOLDOWN_SECONDS) {
  const remaining = ref(0)
  let timer = null

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
  }

  function start(seconds = cooldown) {
    stop()
    remaining.value = Math.max(1, Math.ceil(seconds))
    timer = setInterval(() => {
      remaining.value -= 1
      if (remaining.value <= 0) stop()
    }, 1000)
  }

  function reset() {
    stop()
    remaining.value = 0
  }

  onBeforeUnmount(reset)

  return { remaining, counting: computed(() => remaining.value > 0), start, reset }
}

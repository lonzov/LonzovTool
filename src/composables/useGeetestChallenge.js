import { onBeforeUnmount, onMounted, ref } from 'vue'
import { GEETEST_CAPTCHA_ID, GEETEST_SCRIPT_URL } from '../constants/geetest.js'

/**
 * 极验 gt4 的挂载与唤起。
 *
 * 组件在页面加载时就初始化：判定依赖用户在本页的行为轨迹，等到点提交才加载会让判定失真。
 * product 用 bind —— 我们用自己的按钮先跑表单校验，再唤验证，成功回调里才真正提交。
 */
export function useGeetestChallenge({ onSuccess, onCancel, onError } = {}) {
  const state = ref('loading')
  let instance = null

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      if (window.initGeetest4) {
        resolve()
        return
      }
      const existing = document.querySelector('script[data-geetest="gt4"]')
      if (existing) {
        existing.addEventListener('load', () => resolve())
        existing.addEventListener('error', () => reject(new Error('load failed')))
        return
      }
      const script = document.createElement('script')
      script.src = url
      script.async = true
      script.dataset.geetest = 'gt4'
      script.addEventListener('load', () => resolve())
      script.addEventListener('error', () => reject(new Error('load failed')))
      document.head.appendChild(script)
    })
  }

  async function setup() {
    try {
      await loadScript(GEETEST_SCRIPT_URL)
    } catch (error) {
      state.value = 'failed'
      console.warn('[geetest] 验证组件脚本加载失败', error)
      return
    }
    if (!window.initGeetest4) {
      state.value = 'failed'
      console.warn('[geetest] 脚本已加载但没有 initGeetest4')
      return
    }

    window.initGeetest4(
      { captchaId: GEETEST_CAPTCHA_ID, product: 'bind', language: 'zho' },
      (captcha) => {
        instance = captcha
        captcha
          .onReady(() => {
            state.value = 'ready'
          })
          .onSuccess(() => {
            const result = captcha.getValidate() || null
            if (!result) {
              // getValidate() 在非成功态返回 false，拿不到就等于没通过
              state.value = 'ready'
              return
            }
            onSuccess?.(result)
          })
          .onClose(() => onCancel?.())
          .onError((error) => {
            state.value = 'failed'
            console.warn('[geetest] 验证出错', error)
            onError?.(error)
          })
      },
    )
  }

  /** 唤起验证。返回 false 表示组件还没准备好，调用方要给用户一句说明而不是干等 */
  function open() {
    if (!instance || state.value !== 'ready') return false
    if (typeof instance.showCaptcha !== 'function') {
      state.value = 'failed'
      return false
    }
    instance.showCaptcha()
    return true
  }

  /** 服务端判定失败后要重新过一次：旧的一次性凭证已经作废 */
  function reset() {
    instance?.reset?.()
  }

  onMounted(setup)

  onBeforeUnmount(() => {
    instance?.destroy?.()
    instance = null
  })

  return { state, open, reset }
}

import { ref } from 'vue'
import { consoleFetch } from './consoleRequest.js'
import { evaluatePassword } from './passwordStrength.js'

/**
 * 密码强度守卫：本地即时判据 + 服务端权威判据。
 *
 * 常见密码字典有两万条，前端复刻必然分叉（本地放行、服务端拒绝最影响体验），
 * 所以“是否常见”交给 `/api/v1/console/password-check`，用的是写库时同一套校验器；
 * 本地只负责长度、纯数字、与邮箱相似这三条能精确对齐的判据，让输入时立刻有反馈。
 */

const REMOTE_DELAY_MS = 450

export function createPasswordGuard() {
  const state = ref({ status: '', message: '', blocked: false, level: '' })
  let timer = 0
  let seq = 0

  function apply(next) {
    state.value = next
  }

  function evaluate(password, email = '') {
    seq += 1
    const ticket = seq
    window.clearTimeout(timer)

    const local = evaluatePassword(password, { email })
    if (local.blocked) {
      apply(local)
      return
    }
    apply(local)
    if (!password) return

    timer = window.setTimeout(async () => {
      try {
        const result = await consoleFetch('/api/v1/console/password-check', {
          method: 'POST',
          body: JSON.stringify({ password, email }),
        })
        if (ticket !== seq) return
        if (result?.ok) return
        apply({
          status: 'error',
          message: result?.reason || '密码不满足服务端要求',
          blocked: true,
          level: '过弱',
        })
      } catch {
        // 预检失败不拦人：真正的提交仍会被服务端校验，这里保持本地结论
      }
    }, REMOTE_DELAY_MS)
  }

  return { state, evaluate }
}

/**
 * 密码位数预检。
 *
 * 只查长度：下限与服务端 `MinimumLengthValidator` 的默认值一致（8 位）。
 * 其余规则（常见密码、纯数字、与邮箱相似）交给服务端，提交时由后端给出结论。
 */

export const MIN_PASSWORD_LENGTH = 8

/**
 * @param {string} password
 * @returns {{ status: ''|'error', message: string, blocked: boolean }}
 */
export function checkPasswordLength(password) {
  const value = password || ''
  if (!value) return { status: '', message: '', blocked: false }
  if (value.length < MIN_PASSWORD_LENGTH) {
    return {
      status: 'error',
      message: `密码至少 ${MIN_PASSWORD_LENGTH} 位`,
      blocked: true,
    }
  }
  return { status: '', message: '', blocked: false }
}

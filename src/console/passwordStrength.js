/**
 * 密码校验：本地只查位数（输入时立刻有反馈），其余规则交给服务端。
 *
 * 服务端的判据是 Django 那四个校验器，其中常见密码字典约两万条，前端复刻必然分叉。
 * 因此提交前调用一次 `checkPasswordRemote()`，把权威结论显示在密码输入框下方，
 * 与「当前密码不正确」这类表单级错误分开呈现。
 */

import { consoleFetch } from './consoleRequest.js'

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

/**
 * 让服务端给出权威结论（提交前调用一次，结论显示在密码输入框下方）。
 *
 * 判据是写库时的同一套校验器，前端不必复刻那两万条常见密码；请求失败时返回放行，
 * 由真正的提交再去撞服务端校验，避免多一次网络故障就把人挡在门外。
 * @param {string} password
 * @param {string} email 目标账号邮箱（建号/重置时传），用于相似度判定
 * @returns {Promise<{ ok: boolean, reason: string }>}
 */
export async function checkPasswordRemote(password, email = '') {
  try {
    const result = await consoleFetch('/api/v1/console/password-check', {
      method: 'POST',
      body: JSON.stringify({ password, email }),
    })
    return { ok: result?.ok !== false, reason: result?.reason || '' }
  } catch {
    return { ok: true, reason: '' }
  }
}

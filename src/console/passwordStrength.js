/**
 * 密码强度预检。
 *
 * 判据刻意与后端对齐：后端用的是 Django 的四个校验器
 * （UserAttributeSimilarityValidator / MinimumLengthValidator /
 * CommonPasswordValidator / NumericPasswordValidator），默认参数下即：
 * 长度 ≥ 8、不能是纯数字、不能是常见弱口令、不能与邮箱过于相似。
 *
 * 前端只做体验，服务端仍是最终判据：这里放行而服务端拒绝时，
 * 页面会把服务端给出的第一条理由显示在同一个输入框下方。
 */

export const MIN_LENGTH = 8

// 常见弱口令的一小份子集：后端持有完整字典（约两万条），前端不复制整份。
// 命中率不高没关系，漏掉的由服务端兜住。
const WEAK_PASSWORDS = new Set([
  'password', 'passw0rd', 'password1', 'password12', 'password123', 'p@ssw0rd',
  '123456', '1234567', '12345678', '123456789', '1234567890', '11111111',
  '00000000', '88888888', '66666666', 'abcd1234', 'abc12345', 'a1234567',
  'qwerty', 'qwertyui', 'qwerty123', 'qwertyuiop', 'asdfghjk', 'zxcvbnm',
  'iloveyou', 'iloveyou1', 'iloveyou2', 'admin123', 'administrator', 'root1234',
  'test1234', 'letmein1', 'abcdefgh', 'abcdefghij', 'abcdefghijk', 'abcd123456',
  'welcome1', 'welcome123', 'monkey123', 'dragon123', 'football', 'baseball',
  'sunshine', 'princess', 'superman', 'trustno1', 'changeme', 'whatever',
  '1qaz2wsx', '1q2w3e4r', 'zaq12wsx', 'qazwsxedc', 'aa123456', 'woaini1314',
  '5201314520', '123qwe123', 'abc123456', 'qwer1234', 'asdf1234', 'a123456789',
])

const SEQUENCES = ['12345678', 'abcdefg', 'qwertyui', 'asdfghjk', 'zxcvbnm,']

/** 两个字符串的二元组相似度（Dice 系数），用来近似 difflib 的 ratio */
function similarity(a, b) {
  if (!a || !b) return 0
  if (a === b) return 1
  const grams = (value) => {
    const map = new Map()
    for (let i = 0; i < value.length - 1; i += 1) {
      const gram = value.slice(i, i + 2)
      map.set(gram, (map.get(gram) || 0) + 1)
    }
    return map
  }
  const left = grams(a)
  const right = grams(b)
  if (!left.size || !right.size) return 0

  let shared = 0
  for (const [gram, count] of left) {
    const other = right.get(gram)
    if (other) shared += Math.min(count, other)
  }
  return (2 * shared) / (a.length - 1 + (b.length - 1))
}

/** 与邮箱的相似度：后端按非字母数字切段，并连同整个邮箱一起比较 */
function similarToEmail(password, email) {
  if (!email) return false
  const lower = email.toLowerCase()
  const parts = [lower, ...lower.split(/\W+/)]
  return parts.some((part) => part.length >= 3 && similarity(password, part) >= 0.7)
}

function hasLower(value) {
  return /[a-z]/.test(value)
}

function hasUpper(value) {
  return /[A-Z]/.test(value)
}

function hasDigit(value) {
  return /\d/.test(value)
}

function hasSymbol(value) {
  return /[^\w]/.test(value)
}

/**
 * 评估密码。
 * @param {string} password 待评估的密码
 * @param {{ email?: string }} context 账号上下文（用于相似度判定）
 * @returns {{ status: ''|'error'|'warning'|'success', message: string, blocked: boolean, level: string }}
 */
export function evaluatePassword(password, { email = '' } = {}) {
  const value = password || ''
  if (!value) return { status: '', message: '', blocked: false, level: '' }

  // ===== 与后端一致的硬性拒绝 =====
  if (value.length < MIN_LENGTH) {
    return {
      status: 'error',
      message: `密码至少 ${MIN_LENGTH} 位`,
      blocked: true,
      level: '太短',
    }
  }
  if (/^\d+$/.test(value)) {
    return { status: 'error', message: '密码不能全是数字', blocked: true, level: '过弱' }
  }
  if (WEAK_PASSWORDS.has(value.toLowerCase())) {
    return {
      status: 'error',
      message: '这是常见的弱口令，换一个',
      blocked: true,
      level: '过弱',
    }
  }
  if (similarToEmail(value.toLowerCase(), email)) {
    return {
      status: 'error',
      message: '密码与邮箱过于相似',
      blocked: true,
      level: '过弱',
    }
  }

  // ===== 仅作提示，不拦提交（后端不会再因为这些拒绝）=====
  const categories = [hasLower(value), hasUpper(value), hasDigit(value), hasSymbol(value)].filter(
    Boolean,
  ).length

  if (SEQUENCES.some((sequence) => value.toLowerCase().includes(sequence))) {
    return {
      status: 'warning',
      message: '包含连续字符，建议打散一下',
      blocked: false,
      level: '一般',
    }
  }
  if (categories === 1) {
    return {
      status: 'warning',
      message: '只用了一种字符，建议混入数字与符号',
      blocked: false,
      level: '一般',
    }
  }
  if (value.length < 12) {
    return {
      status: 'warning',
      message: `已可用，再加几位会更稳（当前 ${value.length} 位）`,
      blocked: false,
      level: '尚可',
    }
  }
  return { status: 'success', message: '强度良好', blocked: false, level: '良好' }
}

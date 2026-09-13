/**
 * JSON 语法错误的定位与友好化描述。
 *
 * 各浏览器 / Node 对 JSON.parse 失败的报错文案不一致（V8 新版给片段、旧版给
 * position、Safari 又是另一套），直接甩给用户既看不懂也不稳定。
 * 这里用一个只读扫描器自己定位第一处语法错误，再拼成带上下文的提示。
 *
 * 有效性仍以 JSON.parse 为准，扫面器只负责「出错在哪、为什么」。
 */

/** 上下文前后各保留的字符数 */
const CONTEXT_SPAN = 14

class JsonSyntaxProblem extends Error {
  constructor(index, token, reason) {
    super(reason)
    this.index = index
    this.token = token
    this.reason = reason
  }
}

/**
 * 扫描文本，定位第一处 JSON 语法错误
 * @param {string} text
 * @returns {{ index: number, token: string, reason: string } | null} 没问题时返回 null
 */
export function locateJsonError(text) {
  const src = String(text ?? '')
  const n = src.length
  let pos = 0

  const isWs = c => c === ' ' || c === '\t' || c === '\n' || c === '\r'
  const skipWs = () => { while (pos < n && isWs(src[pos])) pos++ }
  const problem = (index, reason, len = 1) => {
    throw new JsonSyntaxProblem(index, src.slice(index, index + len), reason)
  }
  const atEnd = () => pos >= n

  function parseValue() {
    skipWs()
    if (atEnd()) problem(n, '内容意外结束，缺少一个值', 0)
    const c = src[pos]
    if (c === '{') return parseObject()
    if (c === '[') return parseArray()
    if (c === '"') return parseString()
    if (c === '-' || (c >= '0' && c <= '9')) return parseNumber()
    for (const lit of ['true', 'false', 'null']) {
      if (src.startsWith(lit, pos)) { pos += lit.length; return }
    }
    problem(pos, `意外的「${c}」`)
  }

  function parseObject() {
    pos++ // {
    skipWs()
    if (src[pos] === '}') { pos++; return }
    for (;;) {
      skipWs()
      if (atEnd()) problem(n, '对象没有闭合，缺少「}」', 0)
      if (src[pos] === '}') problem(pos, '对象末尾多了一个逗号')
      if (src[pos] !== '"') problem(pos, '属性名必须是双引号包起来的字符串')
      parseString()
      skipWs()
      if (src[pos] !== ':') problem(pos, '属性名后面缺少「:」')
      pos++
      parseValue()
      skipWs()
      if (src[pos] === ',') { pos++; continue }
      if (src[pos] === '}') { pos++; return }
      if (atEnd()) problem(n, '对象没有闭合，缺少「}」', 0)
      problem(pos, '这里应该是「,」或「}」')
    }
  }

  function parseArray() {
    pos++ // [
    skipWs()
    if (src[pos] === ']') { pos++; return }
    for (;;) {
      parseValue()
      skipWs()
      if (src[pos] === ',') {
        pos++
        skipWs()
        if (src[pos] === ']') problem(pos, '数组末尾多了一个逗号')
        continue
      }
      if (src[pos] === ']') { pos++; return }
      if (atEnd()) problem(n, '数组没有闭合，缺少「]」', 0)
      problem(pos, '这里应该是「,」或「]」')
    }
  }

  function parseString() {
    pos++ // 开引号
    while (pos < n) {
      const c = src[pos]
      if (c === '\\') {
        const esc = src[pos + 1]
        if (esc === undefined) problem(n, '字符串没有闭合，缺少「"」', 0)
        // JSON 只允许这些转义
        if (!'"\\/bfnrtu'.includes(esc)) problem(pos, `字符串里的转义「\\${esc}」不合法`, 2)
        if (esc === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(src.slice(pos + 2, pos + 6))) {
            problem(pos, '「\\u」后面需要 4 位十六进制数', 2)
          }
          pos += 6
          continue
        }
        pos += 2
        continue
      }
      if (c === '"') { pos++; return }
      // JSON 规范禁止字符串里出现未转义的 U+0000–U+001F 控制字符
      if (c.charCodeAt(0) < 0x20) {
        problem(pos, c === '\n' || c === '\r'
          ? '字符串里不能直接换行（换行要写成 \\n）'
          : '字符串里不能直接放控制字符（制表符要写成 \\t）')
      }
      pos++
    }
    problem(n, '字符串没有闭合，缺少「"」', 0)
  }

  const isDigit = c => c >= '0' && c <= '9'

  function parseNumber() {
    const start = pos
    if (src[pos] === '-') pos++
    const intStart = pos
    while (pos < n && isDigit(src[pos])) pos++
    if (pos === intStart) return problem(start, '这里不是一个合法的数字')
    // JSON 不允许前导零（01 非法），注意看的是整数部分的首位而不是末位
    if (src[intStart] === '0' && pos - intStart > 1) problem(start, '数字不能有前导零')
    if (src[pos] === '.') {
      pos++
      const fracStart = pos
      while (pos < n && isDigit(src[pos])) pos++
      if (pos === fracStart) problem(start, '小数点后面缺少数字')
    }
    if (src[pos] === 'e' || src[pos] === 'E') {
      pos++
      if (src[pos] === '+' || src[pos] === '-') pos++
      const expStart = pos
      while (pos < n && isDigit(src[pos])) pos++
      if (pos === expStart) problem(start, '指数部分缺少数字')
    }
  }

  try {
    parseValue()
    skipWs()
    if (pos < n) problem(pos, `后面还有多余的内容「${src[pos]}」`)
  } catch (e) {
    if (e instanceof JsonSyntaxProblem) {
      return { index: e.index, token: e.token, reason: e.reason }
    }
    throw e
  }
  return null
}

/**
 * 把上下文压成单行：换行/制表符转成可见的 \n \t。
 * 否则出错的正好是换行符时，标记里只剩一对挨着的 >> <<，看不出错在哪。
 */
const flatten = s => s
  .replace(/\r\n/g, '\\n')
  .replace(/[\r\n]/g, '\\n')
  .replace(/\t/g, '\\t')

/**
 * 生成可读的 JSON 语法错误提示。
 * 诊断与位置分两行：原因可能很长，和上下文挤在一起会连成一串读不断句。
 * @param {string} text 原始文本
 * @param {{ index: number, token: string, reason: string }} problem
 * @returns {string} 形如：
 *   JSON结构不规范：意外的「}」
 *   出现在「"rawtext": [>>}<<]」
 */
export function describeJsonError(text, problem) {
  const src = String(text ?? '')
  const index = Math.max(0, Math.min(problem.index, src.length))
  const tokenLen = Math.max(1, problem.token.length)
  const tokenEnd = Math.min(src.length, index + tokenLen)
  const start = Math.max(0, index - CONTEXT_SPAN)
  const end = Math.min(src.length, tokenEnd + CONTEXT_SPAN)

  const before = flatten(src.slice(start, index))
  const bad = flatten(src.slice(index, tokenEnd)) || '（内容末尾）'
  const after = flatten(src.slice(tokenEnd, end))
  const context = `${start > 0 ? '…' : ''}${before}>>${bad}<<${after}${end < src.length ? '…' : ''}`

  // 「意外的字符」这类通用原因已经体现在 token 里，改用统一的句式
  const head = problem.reason.startsWith('意外的')
    ? `意外的「${problem.token || '内容末尾'}」`
    : problem.reason
  return `JSON结构不规范：${head}\n出现在「${context}」`
}

/**
 * 把字符串字面量内部的原始换行改写成 \n 转义序列。
 *
 * 从游戏里复制出来的文本常常在字符串里夹着真实换行，JSON.parse 会直接报错。
 * 这里在解析前主动修好，省得用户自己去补转义。
 *
 * 三个要点：
 *   - 只动字符串内部；字符串之间的换行是合法空白，保持原样
 *   - 已经是 \n 转义的保持原样，不会被二次转义成 \\n
 *   - 反斜杠后的字符整体跳过，所以 \" 不会误判成字符串结束
 * @param {string} text
 * @returns {string} 改写后的文本（无需改动时原样返回）
 */
export function escapeRawNewlines(text) {
  const src = String(text ?? '')
  if (!src.includes('\n') && !src.includes('\r')) return src

  let out = ''
  let inString = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (!inString) {
      if (c === '"') inString = true
      out += c
      continue
    }
    if (c === '\\') {
      // 已有转义序列整体带走，避免把 \n 变成 \\n
      out += c + (src[i + 1] ?? '')
      i++
      continue
    }
    if (c === '"') { inString = false; out += c; continue }
    if (c === '\r') {
      if (src[i + 1] === '\n') i++ // CRLF 只算一个换行
      out += '\\n'
      continue
    }
    if (c === '\n') { out += '\\n'; continue }
    out += c
  }
  return out
}

/**
 * JSON.parse，但失败时抛出带上下文的友好提示。
 * 解析前会先把字符串内部的原始换行修成 \n。
 * @param {string} text
 * @returns {any}
 */
export function parseJsonWithHint(text) {
  const src = String(text ?? '')
  try {
    return JSON.parse(src)
  } catch { /* 下面先尝试修复换行再解析 */ }

  const fixed = escapeRawNewlines(src)
  if (fixed !== src) {
    try {
      return JSON.parse(fixed)
    } catch { /* 修完还是不行，走诊断 */ }
  }

  const problem = locateJsonError(fixed)
  throw new Error(problem ? describeJsonError(fixed, problem) : 'JSON结构不规范，无法解析')
}

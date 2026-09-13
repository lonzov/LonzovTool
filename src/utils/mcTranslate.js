/**
 * Minecraft 基岩版翻译键（rawtext translate）渲染内核 —— 纯函数，无框架依赖。
 *
 * 占位符算法逐行移植自 Lenni0451/MCStructs-bedrock 的 BedrockTranslator
 * （ViaBedrock 的生产依赖，注释自称 "made to comply with the vanilla bedrock client"），
 * 该实现自带的 Mojang 官方测试向量（原版语言文件里的 translation.test.complex / .escape）
 * 已在本项目内逐条验证通过。
 *
 * 关键语义（易错点，改动前先读）：
 *   1. 占位符扫描只作用于 JSON 里的 translate 字面量，不作用于查表得到的语言值。
 *      这解释了为什么 .lang 里写 %s、而 JSON 里要写 %%s —— 两份官方文档其实都没错。
 *   2. $s / $d 会被无条件删除，所以 %1$s 等价于 %1。
 *   3. %N 的索引带偏移：取 args[该串中 %s/%d 的总数 + N - 1]，不是 Java 的纯 1-based。
 *   4. 参数以 % 开头时会被当成子翻译键再查一次表。
 *   5. **条件/变量模式**：with.rawtext 里求不出值的元素（未命中的 selector、
 *      未命中的 score）不占参数槽，会被整个移出参数表，后面的参数整体前移。
 *      于是 {"translate":"%%2","with":{"rawtext":[
 *        {"selector":"@p[scores={a=1}]"},{"text":"1"},{"text":"other"}]}}
 *      在条件成立时 %%2 取到 "1"，不成立时取到 "other"。
 *      注意 text:"" 空串仍占槽，只有 selector / score 会消失。
 */

import { parseJsonWithHint } from './jsonError.js'

/** 翻译嵌套深度上限（参考实现无上限，这里加护栏防止极端数据卡死预览） */
export const MAX_TRANSLATE_DEPTH = 8

/** 预览里的默认文字颜色，与 mcfc 渲染器的入参保持一致 */
export const DEFAULT_TEXT_COLOR = '#FFFFFF'

/** 未命中/无匹配时的灰色占位色 */
export const PLACEHOLDER_GRAY = '#999'

// fillTranslations：%% 或 %单词（后跟非键名字符或串尾）
const RE_TRANSLATION_KEY = '%%|%(?:([\\w.-]+)([^\\w.-]|$))?'
// $s / $d 一律删除
const RE_DOLLAR = '\\$[ds]'
// 顺序参数计数用：只数 %s / %d
const RE_S_ARGS = '%[ds]'
// 参数替换用：%s / %d / %数字
const RE_ARGS = '%([ds\\d])'

/** 与 useRawJsonEditor.escHtml 保持一致；此处本地定义以免 utils 反向依赖 composables 形成循环引用 */
function escapeHtml(str) {
  const d = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
  return String(str).replace(/[&<>"']/g, c => d[c])
}

// ========== .lang / JSON 解析 ==========

/**
 * 解析 .lang 文本。原版文件是纯净的 `key=value` 行式文本，无注释、无空行、无转义序列
 * （实测 en_US/zh_CN 全部 13122 键里唯一的反斜杠是 keyboard.keyName.backslash.short 的值本身），
 * 所以这里只做 BOM 剥离与结构切分，值一律原样保留。
 * @param {string} text
 * @returns {{ entries: Record<string, string>, count: number, skipped: number, format: 'lang' }}
 */
export function parseLangText(text) {
  const entries = {}
  let count = 0
  let skipped = 0
  const lines = String(text).replace(/^﻿/, '').split(/\r?\n/)
  for (const line of lines) {
    const s = line.trim()
    if (!s || s.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) { skipped++; continue }
    const key = line.slice(0, eq).trim()
    if (!key) { skipped++; continue }
    entries[key] = line.slice(eq + 1)
    count++
  }
  return { entries, count, skipped, format: 'lang' }
}

/**
 * 解析 {"键":"值"} 形式的 JSON 语言包
 * @param {string} text
 * @returns {{ entries: Record<string, string>, count: number, skipped: number, format: 'json' }}
 */
export function parseLangJson(text) {
  const raw = String(text).replace(/^﻿/, '').trim()
  const data = parseJsonWithHint(raw)
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('JSON 语言包必须是一个对象')
  }
  const entries = {}
  let count = 0
  let skipped = 0
  for (const [k, v] of Object.entries(data)) {
    if (typeof v !== 'string') { skipped++; continue }
    entries[k] = v
    count++
  }
  return { entries, count, skipped, format: 'json' }
}

/**
 * 自动识别导入格式：`{` 开头按 JSON 解析，否则按 .lang 解析。
 * 两种语法不重叠（JSON 用 `:` 而 .lang 用 `=`），判别无歧义。
 * @param {string} text
 */
export function parseLangAuto(text) {
  // 只对「探测用」的副本做 trim，真正解析时用原文，避免吃掉末行值的尾随空格
  const raw = String(text ?? '').replace(/^﻿/, '')
  const head = raw.trim()
  if (!head) throw new Error('请输入或选择语言包内容')
  // 以 { 开头即认定为 JSON（.lang 的键不会以 { 开头），语法错直接报出来，不再悄悄回退
  if (head.startsWith('{')) return parseLangJson(head)
  const r = parseLangText(raw)
  if (r.count === 0) throw new Error('未解析到任何键值对，请确认为 .lang 或 {"键":"值"} 格式')
  return r
}

/** 把普通对象词表转成查找用 Map（用 Map 而非对象，避免 constructor / __proto__ 这类键名误判） */
export function buildLookup(entries) {
  return entries instanceof Map ? entries : new Map(Object.entries(entries || {}))
}

// ========== 占位符算法 ==========

/**
 * 第一遍：扫描「JSON 里的 translate 字面量」。
 *   %%      → 字面量 %
 *   %单词    → 查表（查不到就原样返回该单词），并补回其后的终止字符
 *   整串无 % → 整串查表（查不到就返回键名本身，这是游戏行为）
 * @param {string} s
 * @param {(key: string) => string|null} lookup
 */
function fillTranslations(s, lookup) {
  const re = new RegExp(RE_TRANSLATION_KEY, 'g')
  let out = ''
  let start = 0
  let m
  while ((m = re.exec(s)) !== null) {
    if (m.index > start) out += s.slice(start, m.index)
    start = m.index + m[0].length
    if (m[0] === '%%') {
      out += '%'
    } else if (m[1] != null) {
      out += lookup(m[1]) ?? m[1]
      if (m[2] != null) out += m[2]
    }
  }
  if (start === 0) out += lookup(s) ?? s
  else if (start < s.length) out += s.slice(start)
  return out
}

/** 参数取值：越界 → 空串；以 % 开头 → 当作子翻译键再查一次表 */
function getArg(params, lookup, index) {
  if (index < 0 || index >= params.length) return ''
  const a = params[index]
  const s = String(a ?? '')
  if (s.startsWith('%')) return lookup(s.slice(1)) ?? s.slice(1)
  return s
}

/** 第二/三遍：删 $s/$d → 参数替换 → 折叠 %% */
function substituteArgs(template, params, lookup) {
  const offset = (template.match(new RegExp(RE_S_ARGS, 'g')) || []).length
  const re = new RegExp(RE_ARGS, 'g')
  let out = ''
  let start = 0
  let seq = 0
  let m
  while ((m = re.exec(template)) !== null) {
    if (m.index > start) out += template.slice(start, m.index)
    start = m.index + m[0].length
    const conv = m[1]
    out += conv === 's' || conv === 'd'
      ? getArg(params, lookup, seq++)
      : getArg(params, lookup, offset + parseInt(conv, 10) - 1)
  }
  if (start < template.length) out += template.slice(start)
  return out
}

/**
 * 渲染一个 translate 元素为纯文本（可能含 § 格式化代码）。
 * @param {string} key           el.translate 的原始值
 * @param {(key: string) => string|null} lookup
 * @param {string[]|undefined} params 已渲染成字符串的参数列表。
 *        传 undefined 表示「元素没有 with 字段」→ 不做参数替换；
 *        传数组（哪怕是空数组）表示「有 with 字段」→ 一定执行替换，
 *        这样所有参数都被条件移除时，占位符会被替换成空而不是原样保留。
 */
export function translateKey(key, lookup, params) {
  let s = fillTranslations(String(key ?? ''), lookup)
  s = s.replace(new RegExp(RE_DOLLAR, 'g'), '')
  if (Array.isArray(params)) s = substituteArgs(s, params, lookup)
  // 折叠转义后的字面量百分号：语言值里 %s%% 应显示为 "50%"（游戏实际行为）
  return s.replace(/%%/g, '%')
}

// ========== 模拟器求值 ==========

/** 'vip, admin;root' → ['vip','admin','root'] */
export function parseTags(value) {
  return [...new Set(String(value ?? '')
    .split(/[,，;；\s]+/)
    .map(t => t.trim().replace(/^tag=/i, ''))
    .filter(Boolean))]
}

/** 按分隔符切分，但忽略 {} / [] 内部的同级分隔符（scores={a=1,b=2} 里的逗号不能被切开） */
function splitTopLevel(str, sep) {
  const out = []
  let depth = 0
  let cur = ''
  for (const ch of str) {
    if (ch === '{' || ch === '[') depth++
    else if (ch === '}' || ch === ']') depth--
    if (ch === sep && depth === 0) { out.push(cur); cur = '' } else cur += ch
  }
  out.push(cur)
  return out
}

/**
 * 判断一条 scores 过滤条件是否成立。
 * 支持 `a=1`、`a=1..5`、`a=..5`、`a=5..`；模拟器里没有该计分项一律不成立。
 * @param {string} cond 形如 "a=1"
 * @param {{player: string, scores: Array}} sim
 */
function scoreFilterMatches(cond, sim) {
  const eq = cond.indexOf('=')
  if (eq < 0) return true
  const objective = cond.slice(0, eq).trim()
  const range = cond.slice(eq + 1).trim()
  const row = (sim?.scores || []).find(s => s.player === sim.player && s.objective === objective)
  if (!row) return false
  const val = Number(row.score)
  if (Number.isNaN(val)) return false
  if (range.includes('..')) {
    const [lo, hi] = range.split('..')
    const loN = lo.trim() === '' ? -Infinity : Number(lo)
    const hiN = hi.trim() === '' ? Infinity : Number(hi)
    return val >= loN && val <= hiN
  }
  return val === Number(range)
}

/**
 * 求目标选择器的显示文本。
 * 模拟器只建模一个实体（玩家名 + 标签 + 计分板），因此 @a/@e 在模型下必然只匹配到它一个，
 * 展开结果就是玩家名本身（游戏里多实体是逗号分隔）。
 *
 * scores={...} 过滤是「条件/变量模式」的核心：条件不成立时返回 null，
 * 该参数会被移出参数表，后面的参数整体前移。
 * @param {string} selector
 * @param {{player: string, tags: string[], scores: Array}} sim
 * @returns {string|null} null 表示「是选择器但没匹配到」——调用方需据此把它从参数表里移除；
 *          不是选择器（如手写的 "Steve"）或语法不认识时，原样返回该字符串，当作普通文本
 */
export function resolveSelector(selector, sim) {
  const src = String(selector ?? '').trim()
  if (!src.startsWith('@')) return src
  const m = /^@([aeprsn])(?:\[(.*)\])?$/.exec(src)
  if (!m) return src
  const name = sim?.player || ''
  if (!name) return null
  const tags = sim?.tags || []
  const filters = splitTopLevel(m[2] || '', ',').map(s => s.trim()).filter(Boolean)
  for (const f of filters) {
    const eq = f.indexOf('=')
    if (eq < 0) continue
    const k = f.slice(0, eq).trim().toLowerCase()
    const v = f.slice(eq + 1).trim().replace(/^"|"$/g, '')
    // 只解释模拟器能求值的过滤器，type= / r= / c= / x= 等一律忽略（不参与过滤）
    if (k === 'tag' && !tags.includes(v)) return null
    if (k === 'name' && name !== v) return null
    if (k === 'scores') {
      const conds = splitTopLevel(v.replace(/^\{|\}$/g, ''), ',').map(s => s.trim()).filter(Boolean)
      if (!conds.every(c => scoreFilterMatches(c, sim))) return null
    }
  }
  return name
}

/**
 * 求记分板项的显示值。
 * @param {{name?: string, objective?: string}} scoreEl el.score
 * @param {{player: string, missing: string|number, scores: Array<{player:string,objective:string,score:string|number}>}} sim
 * @returns {{ value: string, missing: boolean }}
 */
export function resolveScore(scoreEl, sim) {
  const name = String(scoreEl?.name ?? '*')
  const objective = String(scoreEl?.objective ?? '')
  const missingValue = String(sim?.missing ?? '0')
  // '*' = 该文本的阅读者自身，在模拟器里就是被模拟的玩家
  const entityName = name === '*' ? (sim?.player || '')
    : name.startsWith('@') ? resolveSelector(name, sim)
      : name
  if (!entityName || !objective) return { value: missingValue, missing: true }
  const row = (sim?.scores || []).find(s => s.player === entityName && s.objective === objective)
  return row
    ? { value: String(row.score), missing: false }
    : { value: missingValue, missing: true }
}

// ========== 元素 → 参数值 ==========

/**
 * 把一个 rawtext 元素渲染成「参数值」（保留 § 代码）。
 * 与游戏一致：参数在替换发生前就被压平成字符串，随后是纯拼接，样式线性流动。
 * @param {object} el
 * @param {{ lookup: Function, selector: Function, score: Function }} ctx
 * @param {number} depth
 * @returns {string|null} null 表示该元素求不出值，不占参数槽（条件/变量模式的关键）
 */
export function renderElementArg(el, ctx, depth = 0) {
  if (!el || typeof el !== 'object' || depth > MAX_TRANSLATE_DEPTH) return null
  if (el.text !== undefined) return String(el.text)
  if (el.translate !== undefined) return renderTranslate(el, ctx, depth)
  if (el.selector !== undefined) return ctx.selector(String(el.selector))
  if (el.score !== undefined) {
    const r = ctx.score(el)
    return r && !r.missing ? r.value : null
  }
  return null
}

/**
 * 把 el.with 渲染成参数列表。
 *   数组模式：每个字符串是一个参数（空串也占槽）
 *   对象模式：rawtext 里每个元素各自成为一个参数；求不出值的元素（未命中的
 *            selector / score）被移除，后面的参数整体前移 —— 这就是条件写法
 * @param {any} withVal
 * @param {{ lookup: Function, selector: Function, score: Function }} ctx
 * @param {number} depth
 * @returns {string[]}
 */
export function buildParams(withVal, ctx, depth = 0) {
  if (Array.isArray(withVal)) return withVal.map(v => String(v ?? ''))
  if (withVal && Array.isArray(withVal.rawtext)) {
    const out = []
    for (const sub of withVal.rawtext) {
      const v = renderElementArg(sub, ctx, depth + 1)
      if (v !== null) out.push(v)
    }
    return out
  }
  return []
}

/**
 * 渲染一个 translate 元素为纯文本。
 * @param {object} el
 * @param {{ lookup: Function, selector: Function, score: Function }} ctx
 * @param {number} depth
 */
export function renderTranslate(el, ctx, depth = 0) {
  if (depth > MAX_TRANSLATE_DEPTH) return ''
  const hasWith = el.with !== undefined && el.with !== null
  const params = hasWith ? buildParams(el.with, ctx, depth) : undefined
  return translateKey(el.translate, ctx.lookup, params)
}

export { escapeHtml }

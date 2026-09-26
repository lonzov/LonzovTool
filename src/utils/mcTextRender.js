/**
 * rawtext / § 格式化文本 → HTML 渲染内核 —— 纯函数，不依赖 Vue，也不读任何编辑器状态。
 *
 * 与 mcTranslate.js 的分工：那边负责「元素 → 纯文本」（翻译键查表、占位符算法、选择器与
 * 记分板求值），这边负责「纯文本 → HTML」（§ 颜色与样式），以及把元素串起来的调度。
 * 底层用的是 vendor/mcfc 的渲染器，因此和它一样依赖 DOM（document.createElement）。
 *
 * 语言包与模拟器由调用方注入，模块自己不认识它们：
 *   不传 lookup    → 一律查不到，退化为显示键名本身（与游戏查不到键时的行为一致）
 *   不传 simulator → 空模拟器：selector 求值为 null、score 一律判为缺失，两者都落成灰色占位
 * lookup 若来自响应式数据，调用方需自行建立依赖 —— 函数调用本身不会留下依赖，
 * 详见 useRawJsonEditor.previewHtml 里对 langRevision 的读取。
 */

import { parseMinecraftTextToHtmlWithState } from '../vendor/mcfc/mcfc.js'
import {
  DEFAULT_TEXT_COLOR, PLACEHOLDER_GRAY, escapeHtml,
  renderTranslate, resolveScore, resolveSelector,
} from './mcTranslate.js'

/** 查不到键时的兜底：mcTranslate 收到 null 会退化为「显示键名本身」 */
const NO_LOOKUP = () => null
/** 空模拟器。冻结以免调用方误改这个共享单例 */
const NO_SIMULATOR = Object.freeze({})
/** 非法元素（null / 非对象 / 未知类型）的提示色 */
const ERROR_COLOR = '#666'

/**
 * 渲染一段含 § 格式代码的文本，样式状态不跨调用保留。
 * 需要多段之间串联样式时用 renderRawtext。
 * @param {string} text
 * @param {{ defaultColor?: string }} [options]
 * @returns {string} HTML 字符串，可直接交给 v-html
 */
export function renderMcText(text, options = {}) {
  const { defaultColor = DEFAULT_TEXT_COLOR } = options
  return parseMinecraftTextToHtmlWithState(String(text ?? ''), defaultColor, null).html
}

/**
 * 渲染 rawtext 元素数组。
 *
 * 元素类型的分支判定顺序沿用拆分前的 previewHtml：text > translate > selector > score。
 * 注意这与 validate() / getElType() 的 translate > text 不一致 —— 同时带 text 和 translate
 * 的元素，列表里显示为 TRN、预览却按 text 渲染。属于既有分歧，本次拆分原样保留、未作修正。
 *
 * 文本与 translate 都产出纯字符串，走完全相同的渲染路径 —— 基岩版在替换发生前就把 with
 * 参数压平成字符串，之后是纯拼接，§ 状态线性流动（样式会外溢到下一个元素，与游戏一致）。
 *
 * @param {object[]} elements rawtext 数组
 * @param {{
 *   lookup?: (key: string) => string|null,
 *   simulator?: { player?: string, missing?: string|number, tags?: string[], scores?: object[] },
 *   defaultColor?: string,
 * }} [options]
 * @returns {string} HTML 字符串；无内容时返回空串（是否补占位文案由调用方决定）
 */
export function renderRawtext(elements, options = {}) {
  const {
    lookup = NO_LOOKUP,
    simulator = NO_SIMULATOR,
    defaultColor = DEFAULT_TEXT_COLOR,
  } = options
  const ctx = {
    lookup,
    selector: sel => resolveSelector(sel, simulator),
    score: el => resolveScore(el, simulator),
  }

  const errorSpan = `<span style="color:${ERROR_COLOR}">[错误]</span>`
  let state = null
  let html = ''

  const pushText = (text) => {
    const result = parseMinecraftTextToHtmlWithState(String(text ?? ''), defaultColor, state)
    html += result.html
    state = result.finalState
  }
  // 非文本元素：继承当前的非颜色样式（§l/§M/§N/§o），使用自身固定颜色，且不推进样式状态
  const pushPlaceholder = (content, title) => {
    const inheritStyles = state ? state.currentStyles : ''
    html += `<span style="${inheritStyles}color:${PLACEHOLDER_GRAY}" title="${escapeHtml(title)}">${content}</span>`
  }

  for (const el of Array.isArray(elements) ? elements : []) {
    if (!el || typeof el !== 'object') {
      html += errorSpan
    } else if (el.text !== undefined) {
      pushText(el.text)
    } else if (el.translate !== undefined) {
      pushText(renderTranslate(el, ctx))
    } else if (el.selector !== undefined) {
      const resolved = ctx.selector(String(el.selector))
      if (resolved) pushText(resolved)
      else pushPlaceholder(`[${escapeHtml(el.selector)}]`, '模拟器中没有匹配的实体')
    } else if (el.score !== undefined) {
      const { value, missing } = ctx.score(el)
      if (missing) {
        const objective = el.score?.objective || ''
        const name = el.score?.name || ''
        pushPlaceholder(escapeHtml(value), `模拟器中未找到记分板项：${objective} / ${name}`)
      } else {
        pushText(value)
      }
    } else {
      html += errorSpan
    }
  }

  return html
}

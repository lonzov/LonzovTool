/**
 * 基础色阶（Primitive）—— 整站唯一的事实来源。
 * 只放纯色值，不带语义；语义映射一律写在 tokens.js。
 * 组件里禁止直接引用本文件，只能使用 tokens.js 导出的语义变量。
 */

/**
 * 层级不靠"列举灰阶"，而是靠基色 + 透明度派生（见 tokens.js）。
 * 本色阶只承担两件事：底色的实色锚点、以及调色板页的展示与未来主题系统的取色来源。
 */
export const neutral = {
  0: '#FFFFFF',
  50: '#F5F7F9',
  100: '#F0F2F5',
  150: '#E8EAED',
  175: '#E8E8E8',
  200: '#E0E0E0',
  300: '#D0D0D0',
  400: '#A0A0A0',
  500: '#808080',
  600: '#525252',
  700: '#333333',
  800: '#242424',
  825: '#1E1E1E',
  850: '#1A1A1A',
  950: '#111111',
  1000: '#0A0A0A',
}

// 强调色：高亮（搜索命中、标记）
export const highlight = {
  light: '#FADB14',
  dark: '#D4B106',
}

// 强调色：危险操作与警告，所有红色归并到这一组
export const destructive = {
  light: '#DC2626',
  dark: '#DC2626',
}

/**
 * 把 hex 与 alpha 合成 rgba 字符串。
 * 不用 color-mix() 是为了兼容性 —— 老浏览器会让整条声明失效，而 rgba 不会。
 * @param {string} hex 形如 #RRGGBB 或 #RGB
 * @param {number} alpha 0~1
 */
export function alpha(hex, a) {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.replace(/./g, (c) => c + c)
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

/**
 * 开关轨道的参考配色（特殊符号页等仍在用）。
 *
 * 项目里的开关不走 Naive 的 `railColorActive`：那套在深色主题下会把"开启"渲染成浅色轨道，
 * 与"关闭"的观感正好反过来。这里固定两档灰——开启深灰、关闭浅灰，两套主题下层级一致。
 * 全局 NSwitch 已通过 Switch 主题映射到同一组 token；新代码不要再单独传 rail-style。
 *
 * FAQ：为什么不用 token？`--primary` 在深浅主题下是反色的，轨道夹在卡片上会让人分不清
 * 开没开；开关的语义是"状态不同"，不是"强调色"。
 */
const CHECKED_BG = '#333'
const UNCHECKED_BG = '#a0a0a0'

export function switchRailStyle({ focused, checked }) {
  const background = checked ? CHECKED_BG : UNCHECKED_BG
  const style = { background }
  if (focused) style.boxShadow = `0 0 0 2px ${background}40`
  return style
}

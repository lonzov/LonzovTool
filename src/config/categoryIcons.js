/* 卡片分类侧边栏图标配置 */

import {
  Apps24Regular,
  Toolbox24Regular,
  DesktopToolbox20Regular,
  Globe24Regular,
  Link24Regular,
  Book24Regular,
  People24Regular,
  KeyCommand16Filled,
  Edit24Filled,
  Box24Regular,
  Cube24Regular,
} from '@vicons/fluent'

// 图标映射表
export const categoryIconMap = {
  Apps24Regular: Apps24Regular,
  Toolbox24Regular: Toolbox24Regular,
  DesktopToolbox20Regular: DesktopToolbox20Regular,
  Globe24Regular: Globe24Regular,
  Link24Regular: Link24Regular,
  Book24Regular: Book24Regular,
  People24Regular: People24Regular,
  KeyCommand16Filled: KeyCommand16Filled,
  Edit24Filled: Edit24Filled,
  Box24Regular: Box24Regular,
  Cube24Regular: Cube24Regular,
}

export function getCategoryIcon(iconName, defaultIcon = Apps24Regular) {
  return categoryIconMap[iconName] || defaultIcon
}

/* 工具卡片 logo 图标配置：tools.json 中 logo 字段不以 / 或 http 开头时，
   当作图标名在此处查找对应组件（图标统一白底黑 logo 展示，统一使用 Filled 变体） */
import {
  TextCaseTitle24Filled,
  TextGrammarWand24Filled,
  Mention20Filled,
  ArrowTrending20Filled,
  CurrencyDollarEuro20Filled,
  Braces24Filled,
} from '@vicons/fluent'

// 工具图标映射表
export const toolIconMap = {
  TextCaseTitle24Filled: TextCaseTitle24Filled,
  TextGrammarWand24Filled: TextGrammarWand24Filled,
  Mention20Filled: Mention20Filled,
  ArrowTrending20Filled: ArrowTrending20Filled,
  CurrencyDollarEuro20Filled: CurrencyDollarEuro20Filled,
  Braces24Filled: Braces24Filled,
}

export function getToolIcon(iconName, defaultIcon = Apps24Regular) {
  return toolIconMap[iconName] || defaultIcon
}

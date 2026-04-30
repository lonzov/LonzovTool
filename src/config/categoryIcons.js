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
}

export function getCategoryIcon(iconName, defaultIcon = Apps24Regular) {
  return categoryIconMap[iconName] || defaultIcon
}

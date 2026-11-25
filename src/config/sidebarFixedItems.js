/* 常驻侧边栏（固定栏）的菜单条目定义：菜单渲染与「侧边栏菜单」调整抽屉共用同一份。

   这里只声明有哪些入口；每个入口归一级菜单还是折叠进「更多」，由 useSidebarMenuLayout
   维护。 「更多」本身是二级菜单的容器，固定排在末尾，不参与排序。 */

import {
  Home48Regular,
  Person24Regular,
  AddSquare24Regular,
  HeartCircle24Regular,
  PersonFeedback24Regular,
  CalendarWorkWeek24Regular,
  DrawerArrowDownload24Regular,
  Settings24Regular,
  MoreVertical24Regular,
} from '@vicons/fluent'

export const SIDEBAR_MORE_KEY = 'more'

export const SIDEBAR_MORE_ITEM = {
  key: SIDEBAR_MORE_KEY,
  label: '更多',
  icon: MoreVertical24Regular,
}

export const SIDEBAR_FIXED_ITEMS = [
  { key: 'home', label: '首页', icon: Home48Regular },
  { key: 'workspace', label: '工作站', icon: CalendarWorkWeek24Regular },
  { key: 'about', label: '关于本站', icon: Person24Regular },
  { key: 'settings', label: '设置', icon: Settings24Regular },
  { key: 'feedback', label: '建议反馈', icon: PersonFeedback24Regular },
  { key: 'donate', label: '打赏支持', icon: HeartCircle24Regular },
  { key: 'submit', label: '网址提交', icon: AddSquare24Regular },
  { key: 'pwa-install', label: '安装本站', icon: DrawerArrowDownload24Regular },
]

export const SIDEBAR_FIXED_ITEM_MAP = new Map(SIDEBAR_FIXED_ITEMS.map((item) => [item.key, item]))

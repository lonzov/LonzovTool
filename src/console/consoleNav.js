import { Apps24Regular, DataPie24Regular, Send24Regular } from '@vicons/fluent'

/**
 * 控制台目录，同时是侧边栏分类栏与控制台页面标题的唯一来源。
 * 新增子页面时在此登记一项：key 即路由路径，title / description 供页面标题区使用。
 */
export const CONSOLE_NAV = [
  {
    key: '/console',
    label: '概览',
    icon: DataPie24Regular,
    title: '概览',
    description: '站点内容的规模与分布，管理能力的总入口',
  },
  {
    key: '/console/cards',
    label: '卡片管理',
    icon: Apps24Regular,
    title: '卡片管理',
    description: '站点卡片的增删改与隐藏，隐藏后公开接口不再返回',
  },
  {
    key: '/console/submissions',
    label: '网址提交',
    icon: Send24Regular,
    title: '网址提交审核',
    description: '访客投递的网址卡片，审核通过后再整理进内容表',
  },
]

/**
 * 按路径取目录项，未登记的子页面回落到首项（概览）
 * @param {string} path 当前路由路径
 */
export function findConsoleNav(path) {
  const normalized = (path || '').replace(/\/+$/, '')
  return CONSOLE_NAV.find((item) => item.key === normalized) || CONSOLE_NAV[0]
}

import { Apps24Regular, DataPie24Regular, MegaphoneLoud24Regular, Send24Regular, Speaker224Regular } from '@vicons/fluent'

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
    key: '/console/notices',
    label: '公告管理',
    icon: MegaphoneLoud24Regular,
    title: '公告管理',
    description: '首页公告栏的条目，按优先级升序轮播，改动即时推送到站上',
  },
  {
    key: '/console/promo',
    label: '推广位',
    icon: Speaker224Regular,
    title: '推广位',
    description: '首页四个推广位；到期自动下架，改一个未来的到期时间即可恢复',
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

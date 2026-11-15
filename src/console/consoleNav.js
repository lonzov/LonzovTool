import {
  Apps24Regular,
  ArrowDownload24Regular,
  ChannelAlert20Regular,
  ChatHelp24Regular,
  Clipboard24Regular,
  DataPie24Regular,
  Database24Regular,
  Home24Regular,
  MegaphoneLoud24Regular,
  PeopleCommunity24Regular,
  PersonCircle24Regular,
  Send24Regular,
  Settings24Regular,
  Speaker224Regular,
} from '@vicons/fluent'

/**
 * 控制台目录，同时是侧边栏分类栏与控制台页面标题的唯一来源。
 * 新增子页面时在此登记一项：key 即路由路径，title / description 供页面标题区使用，
 * permission 为该页要求的权限点（缺省表示登录即可访问），与路由 meta 保持一致。
 *
 * 侧边栏只分一层：没有 children 的项直接显示，有 children 的项作为可展开分组，
 * 展开状态由 AppMenu 统一持久化到 localStorage。
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
    key: 'console-group-home',
    label: '首页内容',
    icon: Home24Regular,
    children: [
      {
        key: '/console/cards',
        label: '卡片管理',
        icon: Apps24Regular,
        title: '卡片管理',
        description: '站点卡片的增删改与隐藏，隐藏后公开接口不再返回',
        permission: 'cards.write',
      },
      {
        key: '/console/notices',
        label: '公告管理',
        icon: MegaphoneLoud24Regular,
        title: '公告管理',
        description: '首页公告栏的条目，按优先级升序轮播，改动即时推送到站上',
        permission: 'notices.write',
      },
      {
        key: '/console/announcements',
        label: '弹窗公告',
        icon: ChannelAlert20Regular,
        title: '弹窗公告',
        description: '进入站点时展示的公告弹窗，支持条件、按钮和关闭规则',
        permission: 'notices.write',
      },
      {
        key: '/console/promo',
        label: '推广位',
        icon: Speaker224Regular,
        title: '推广位',
        description: '首页四个推广位；到期自动下架，改一个未来的到期时间即可恢复',
        permission: 'promo.write',
      },
    ],
  },
  {
    key: 'console-group-forms',
    label: '表单',
    icon: Clipboard24Regular,
    children: [
      {
        key: '/console/submissions',
        label: '网址提交',
        icon: Send24Regular,
        title: '网址提交审核',
        description: '访客投递的网址卡片，审核通过后再整理进内容表',
        permission: 'cards.review',
      },
      {
        key: '/console/feedback',
        label: '反馈处理',
        icon: ChatHelp24Regular,
        title: '反馈处理',
        description: '站内反馈队列，处理完即标记，删除会一并移除截图',
        permission: 'feedback.manage',
      },
    ],
  },
  {
    key: 'console-group-data',
    label: '其他数据',
    icon: Database24Regular,
    children: [
      {
        key: '/console/people',
        label: '共建者与打赏',
        icon: PeopleCommunity24Regular,
        title: '共建者与打赏',
        description: '首页感谢区的两份名单：共建者与打赏记录，列表顺序即展示顺序',
        permission: 'people.write',
      },
      {
        key: '/console/downloads',
        label: '下载页',
        icon: ArrowDownload24Regular,
        title: '下载页',
        description: '侧边栏「下载」里的页面：链接、版本、功能介绍与可见性',
        permission: 'downloads.write',
      },
    ],
  },
  {
    key: '/console/account',
    label: '我的账号',
    icon: PersonCircle24Regular,
    title: '我的账号',
    description: '修改密码与查看登录设备，撤销不再使用的会话',
  },
  {
    key: '/console/system',
    label: '系统设置',
    icon: Settings24Regular,
    title: '系统设置',
    description: '系统级维护与存储清理',
    permission: 'system.manage',
  },
]

/**
 * 按路径取目录项，未登记的子页面回落到首项（概览）。
 * 分组项本身不是路由，需要继续往 children 里找。
 * @param {string} path 当前路由路径
 */
export function findConsoleNav(path) {
  const normalized = (path || '').replace(/\/+$/, '')

  function find(items) {
    for (const item of items) {
      if (item.key === normalized) return item
      // 根路径 /console 不能按前缀吞掉所有子页；其余一级路由下面允许有子页面
      if (item.key !== '/console' && normalized.startsWith(`${item.key}/`)) return item
      if (item.children) {
        const child = find(item.children)
        if (child) return child
      }
    }
    return null
  }

  return find(CONSOLE_NAV) || CONSOLE_NAV[0]
}

/**
 * 当前账号可见的目录项。没有权限的页面连入口都不出现，直接输地址访问由外壳的
 * 权限闸门拦下（见 ConsoleLayout）。分组只看子项，全部不可见时整组隐藏。
 * @param {(codename: string) => boolean} can 权限判定，取自 usePermissions
 */
export function visibleConsoleNav(can) {
  function filter(items) {
    return items.reduce((result, item) => {
      if (item.children) {
        const children = filter(item.children)
        if (children.length) result.push({ ...item, children })
        return result
      }
      if (!item.permission || can(item.permission)) result.push(item)
      return result
    }, [])
  }

  return filter(CONSOLE_NAV)
}

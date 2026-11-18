import {
  Apps24Regular,
  ArrowDownload24Regular,
  ChannelAlert20Regular,
  ChatHelp24Regular,
  Clock24Regular,
  Clipboard24Regular,
  DataPie24Regular,
  Database24Regular,
  History24Regular,
  Home24Regular,
  Image24Regular,
  MegaphoneLoud24Regular,
  People24Regular,
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

// 系统设置是分组而非页面：三个权限点彼此独立，命中任一个都应有入口。
// 子项顺序同时就是默认落地顺序，见 firstAccessibleConsoleChild。
export const SYSTEM_CONSOLE_GROUP = '/console/system'

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
        description: '站点卡片的增删改与隐藏；隐藏后首页不再展示',
        permission: 'cards.write',
      },
      {
        key: '/console/notices',
        label: '公告管理',
        icon: MegaphoneLoud24Regular,
        title: '公告管理',
        description: '首页公告栏的条目，按优先级升序轮播；保存后立即对访客生效',
        permission: 'notices.write',
      },
      {
        key: '/console/announcements',
        label: '弹窗公告',
        icon: ChannelAlert20Regular,
        title: '弹窗公告',
        description: '访客进入站点时展示的公告弹窗',
        permission: 'notices.write',
      },
      {
        key: '/console/promo',
        label: '推广位',
        icon: Speaker224Regular,
        title: '推广位',
        description: '首页四个推广位，到期后自动下架',
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
        description: '站内反馈队列；删除后不可恢复',
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
    key: SYSTEM_CONSOLE_GROUP,
    label: '系统设置',
    icon: Settings24Regular,
    title: '系统设置',
    description: '系统维护、账号管理与管理日志',
    // 系统设置只作为入口，不在主导航展开二级菜单；三个权限点彼此独立，命中任一个
    // 都应看到入口，进入后由 ConsoleSystem 决定落到当前账号可访问的第一页
    permissions: ['system.manage', 'accounts.manage', 'logs.read'],
  },
]

/** 系统设置内部页面的落地顺序；主导航不展开，但落地仍需与权限对齐 */
export const SYSTEM_CONSOLE_PAGES = [
  {
    key: '/console/system/settings',
    label: '系统设置',
    icon: Settings24Regular,
    permission: 'system.manage',
  },
  {
    key: '/console/system/assets',
    label: '图片资产',
    icon: Image24Regular,
    permission: 'system.manage',
  },
  {
    key: '/console/system/tasks',
    label: '定时任务',
    icon: Clock24Regular,
    permission: 'system.manage',
  },
  {
    key: '/console/system/accounts',
    label: '账号管理',
    icon: People24Regular,
    permission: 'accounts.manage',
  },
  {
    key: '/console/system/logs',
    label: '管理日志',
    icon: History24Regular,
    permission: 'logs.read',
  },
]

/** 目录项是否对所有登录账号可见（缺省 permission 表示登录即可访问） */
function isNavItemAllowed(item, can) {
  const required = item.permissions || (item.permission ? [item.permission] : [])
  if (!required.length) return true
  return typeof can === 'function' && required.some((codename) => !!can(codename))
}

/** 深度优先取第一个可访问叶子项 */
function firstLeaf(items) {
  for (const item of items) {
    if (item.children?.length) {
      const leaf = firstLeaf(item.children)
      if (leaf) return leaf
    } else {
      return item.key
    }
  }
  return ''
}

/**
 * 按路径取目录项，未登记的子页面回落到首项（概览）。
 * 分组项本身不是路由，需要继续往 children 里找；子项优先于父级前缀匹配。
 * @param {string} path 当前路由路径
 */
export function findConsoleNav(path) {
  const normalized = (path || '').replace(/\/+$/, '')

  function find(items) {
    for (const item of items) {
      if (item.key === normalized) return item
      if (item.children) {
        const child = find(item.children)
        if (child) return child
      }
      // 根路径 /console 不能按前缀吞掉所有子页；其余路由下面允许有子页面
      if (item.key !== '/console' && normalized.startsWith(`${item.key}/`)) return item
    }
    return null
  }

  return find(CONSOLE_NAV) || CONSOLE_NAV[0]
}

/**
 * 同一套权限过滤规则，供目录整体与分组子项复用（不要在调用方另写一份）。
 * 分组只看子项，全部不可见时整组隐藏。
 * @param {Array} items 目录项
 * @param {(codename: string) => boolean} can 权限判定，取自 usePermissions
 */
export function filterConsoleNavItems(items, can) {
  return items.reduce((result, item) => {
    if (item.children?.length) {
      const children = filterConsoleNavItems(item.children, can)
      if (children.length) result.push({ ...item, children })
      return result
    }
    if (isNavItemAllowed(item, can)) result.push(item)
    return result
  }, [])
}

/**
 * 当前账号可见的目录项。没有权限的页面连入口都不出现，直接输地址访问由外壳的
 * 权限闸门拦下（见 ConsoleLayout）。
 * @param {(codename: string) => boolean} can 权限判定，取自 usePermissions
 */
export function visibleConsoleNav(can) {
  return filterConsoleNavItems(CONSOLE_NAV, can)
}

/** 取带子项的分组；系统设置是入口项，落地顺序由 SYSTEM_CONSOLE_PAGES 提供 */
function findConsoleNavGroup(key) {
  const group = CONSOLE_NAV.find((item) => item.key === key)
  if (group?.children?.length) return group
  if (key === SYSTEM_CONSOLE_GROUP) return { children: SYSTEM_CONSOLE_PAGES }
  return null
}

/**
 * 分组内第一个有权限的子页路径，顺序即配置顺序（系统设置：settings → assets
 * → tasks → accounts → logs）。没有任何可访问子项时返回空串。
 * 分组本身不是页面，直接打开分组路径时由页面/外壳用它决定落地到哪一页。
 * @param {string} groupKey 分组 key（即路由路径）
 * @param {(codename: string) => boolean} can 权限判定
 */
export function firstAccessibleConsoleChild(groupKey, can) {
  const group = findConsoleNavGroup(groupKey)
  if (!group) return ''
  return firstLeaf(filterConsoleNavItems(group.children, can))
}

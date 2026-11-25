import { createRouter, createWebHistory } from 'vue-router'
import { Clock24Regular, History24Regular, Image24Regular, People24Regular, Settings24Regular } from '@vicons/fluent'

import HomeView from '../components/HomeView.vue'
import OfflineDiagnostic from '../components/OfflineDiagnostic.vue'
import { getDiscreteMessage } from '../utils/discreteMessage'
import { startLoading, finishLoading } from '../utils/loadingBar'
import { useConsoleAuth } from '../console/consoleAuth.js'

// 下载页快照：slug → 快照条目，用于 SEO 与静态路由
import downloadsSnapshot from '../data/downloads.json'
const DOWNLOAD_PAGES = Object.fromEntries(
  (downloadsSnapshot || []).map((item) => [item.slug, item]),
)

/**
 * 下载页 SEO meta：标题用页面名称，简介用页面自己的一句话介绍。
 * 构建后才新增、快照里没有条目的 slug 退回 slug 与通用文案。
 * @param {string} slug - 下载页标识
 * @returns {object|null} 对应的 meta 对象，slug 为空返回 null
 */
function resolveDownloadMeta(slug) {
  const page = DOWNLOAD_PAGES[slug]
  const name = page?.name || slug
  if (!name) return null
  const tagline = (page?.tagline || '').trim()
  return {
    title: `${name} - 文件下载 - 小舟工具箱`,
    description: tagline || `小舟工具箱提供的${name}下载页面，支持快捷直链解析和手动网盘下载。`,
    keywords: `Minecraft,资源下载,${name},MC工具下载,小舟工具箱`,
  }
}

// ===== 路由导航超时机制 =====
const PING_DELAY = 8000
const REFRESH_AT = 15000
const FALLBACK_TIMEOUT = 30000
const SESSION_KEY = 'nav_refreshed'

// ===== 懒加载 chunk 加载失败自愈 =====
// 部署后旧页面的带 hash 资源已被新构建替换，SW 只缓存访问过的懒加载资源，
// 旧页面点新路由时动态导入必然 404；不切到新构建的话，所有未打开过的路由都不可用
const CHUNK_RECOVER_KEY = 'sw_chunk_recover'
// 一次性参数：绕过 SW 对导航请求的缓存命中，否则旧 shell 会被再次返回
const CHUNK_RECOVER_QUERY = '__sw_refresh'
// 恢复刷新后仍失败说明新构建自身也加载不了（服务端/网络异常），不再自动刷新，避免死循环
const CHUNK_RECOVER_WINDOW = 20000

let fallbackTimer = null
let pingTimer = null
let refreshTimer = null
let reloadTimer = null
let abortController = null

/** router 无组件上下文，message 走全局共享的 discrete 实例 */
const getMessage = getDiscreteMessage

/** 清除所有定时器 + 中止在途 ping */
function clearAllTimers() {
  if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null }
  if (pingTimer) { clearTimeout(pingTimer); pingTimer = null }
  if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null }
  if (reloadTimer) { clearTimeout(reloadTimer); reloadTimer = null }
  if (abortController) { abortController.abort(); abortController = null }
}

/** 强制跳转离线诊断页 */
function goOffline(reason) {
  console.error(`[Router] ${reason}，跳转离线页`)
  clearAllTimers()
  finishLoading()
  window.location.href = '/offline'
}

/**
 * ping 本站服务器，成功返回 true
 * @param {AbortSignal} signal
 */
async function pingServer(signal) {
  try {
    const ctrl = new AbortController()
    const tid = setTimeout(() => ctrl.abort(), 10000)
    if (signal) signal.addEventListener('abort', () => ctrl.abort())
    await fetch('https://tool.lonzov.top/', { mode: 'no-cors', signal: ctrl.signal, cache: 'no-store' })
    clearTimeout(tid)
    return !ctrl.signal.aborted
  } catch {
    return false
  }
}

/** 是否为懒加载 chunk 拉取失败的典型报错（部署换 hash 后必现） */
function isChunkLoadError(error) {
  const message = error?.message || ''
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('error loading dynamically imported module') ||
    message.includes('Failed to load module script')
  )
}

/**
 * 切到最新构建：带一次性参数请求目标路由，强制走网络拿新 shell。
 * 不带参数直接刷新时，SW 的导航缓存会再次返回旧 shell，刷新完还是旧资源。
 * @param {import('vue-router').RouteLocationNormalized | undefined} to 加载失败时目标路由
 */
function recoverFromChunkError(to) {
  let lastAttempt = 0
  try { lastAttempt = Number(sessionStorage.getItem(CHUNK_RECOVER_KEY)) || 0 } catch { /* noop */ }

  if (Date.now() - lastAttempt < CHUNK_RECOVER_WINDOW) {
    getMessage()?.error('页面资源加载异常，请手动刷新页面重试', { duration: 8000 })
    return
  }
  try { sessionStorage.setItem(CHUNK_RECOVER_KEY, String(Date.now())) } catch { /* noop */ }

  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
  const url = new URL(to?.fullPath || current, window.location.origin)
  url.searchParams.set(CHUNK_RECOVER_QUERY, Date.now().toString(36))
  const target = `${url.pathname}${url.search}${url.hash}`
  console.warn('[Router] 资源加载失败，切换到最新构建:', target)
  window.location.replace(target)
}

/** 先 ping 排除离线，再决定是跳离线诊断页还是切到最新构建 */
async function recoverAfterCheck(to) {
  const ok = await pingServer()
  if (!ok) {
    goOffline('资源加载失败且服务器不可达')
    return
  }
  recoverFromChunkError(to)
}

/** 清掉自愈刷新带的一次性参数，避免留在地址栏与分享链接里 */
function stripRecoveryQuery() {
  const url = new URL(window.location.href)
  if (!url.searchParams.has(CHUNK_RECOVER_QUERY)) return
  url.searchParams.delete(CHUNK_RECOVER_QUERY)
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

// 内置工具页的 SEO meta 映射（path slug -> meta）
const TOOL_META_MAP = {
  qjzh: {
    title: '艺术字转换工具 - 小舟工具箱',
    description: '在线 Minecraft 艺术字生成器，支持标准艺术字、上角标、下角标、拉丁文等多种模式，一键转换字母数字用于基岩版指令 UI 设计与美化。',
    keywords: 'Minecraft,艺术字,基岩版指令,UI美化,上角标,下角标,Unicode字符,小舟工具箱',
  },
  tr: {
    title: 'T显动画生成器 - 小舟工具箱',
    description: 'Minecraft 基岩版 T显打字机动画在线生成工具。输入文本即可转换为 rawtext 动画序列，支持自定义计分板名称、初始分数等参数，无需手动穷举命令。',
    keywords: 'Minecraft,T显动画,T显生成器,打字机动画,rawtext,基岩版指令,小舟工具箱',
  },
  'raw-json': {
    title: 'T显可视化编辑器 - 小舟工具箱',
    description: 'Minecraft 基岩版 T显 rawJSON 可视化编辑器，0代码轻松实现复杂嵌套文本结构。支持实时预览、导入导出 rawJSON，适用于标题、动作栏、Boss 栏等场景。',
    keywords: 'Minecraft,T显编辑器,T显模板,rawjson编辑器,可视化编辑器,rawtext,基岩版指令,MC工具,雪球菜单,小舟工具箱',
  },
  selector: {
    title: '选择器参数编辑器 - 小舟工具箱',
    description: 'Minecraft 基岩版目标选择器参数可视化编辑器，支持嵌套结构。直观编辑 @a/@e/@p/@r/@s 选择器参数，实时预览生成的选择器指令。',
    keywords: 'Minecraft,选择器,目标选择器,参数编辑器,基岩版指令,@a,@e,@p,@r,@s,指令生成,小舟工具箱',
  },
  execute: {
    title: 'Execute语法升级工具 - 小舟工具箱',
    description: 'Minecraft 基岩版 execute 指令旧版本语法自动升级工具，一键将旧格式 execute 命令转换为新版本语法结构。',
    keywords: 'Minecraft,execute,语法升级,指令转换,基岩版,MC命令,旧版语法,新版本语法,小舟工具箱',
  },
  fuhao: {
    title: 'MC特殊符号大全 - 小舟工具箱',
    description: 'Minecraft 基岩版特殊符号合集，包含鸡腿、M币等私有区 Unicode 字符及常用特殊符号，以及空字符。点击即可复制到剪贴板，有效提升 MC 开发效率与聊天美化体验。',
    keywords: 'Minecraft,特殊符号,特殊字符,MC符号,基岩版符号,私有区字符,Unicode,鸡腿符号,M币符号,空字符,小舟工具箱',
  },
}

// 文档子页的 SEO meta 映射（docName -> meta）
const DOCS_META_MAP = {
  privacy: {
    title: '隐私政策 - 小舟工具箱',
    description: '小舟工具箱隐私政策，说明网站的数据收集、使用及存储方式。',
    keywords: '小舟工具箱,隐私政策,数据保护,用户隐私,Cookie设置,Minecraft工具',
  },
  dev: {
    title: '开发文档 - 小舟工具箱',
    description: '小舟工具箱开发文档，面向第三方开发者，包含 URL 参数等说明，提升双方用户体验。',
    keywords: '小舟工具箱,文档,开发文档,开发规范,URL参数,第三方开发,Minecraft工具',
  },
  faq: {
    title: '常见问题 - 小舟工具箱',
    description: '小舟工具箱常见问题解答，包含使用技巧、常见疑问与解决方案。',
    keywords: '小舟工具箱,常见问题,FAQ,使用帮助,Minecraft工具,故障排查',
  },
  promotion: {
    title: '推广合作 - 小舟工具箱',
    description: '小舟工具箱首页推广位合作说明：收录范围、展示尺寸、价格与周期、免费推广资格、素材要求与联系方式。',
    keywords: '小舟工具箱,推广合作,首页推广位,广告合作,Minecraft推广,广告位投放',
  },
  'third-party': {
    title: '第三方组件与许可声明 - 小舟工具箱',
    description: '小舟工具箱使用的第三方组件、字体资源及其许可证与修改情况说明。',
    keywords: '小舟工具箱,第三方组件,开源声明,开源许可证,字体授权,MIT,Apache',
  },
}

/**
 * 解析 /docs/:docName 动态路由的 SEO meta
 * @param {string} docName - 文档名（如 "privacy"）
 * @returns {object|null} 对应的 meta 对象，无匹配返回 null
 */
function resolveDocsMeta(docName) {
  const slug = docName.replace(/\/+$/, '')
  return DOCS_META_MAP[slug] || null
}

/**
 * 解析 /c/:path 动态路由的 SEO meta
 * @param {string} path - 路由路径（如 "qjzh"、"tr/"）
 * @returns {object|null} 对应的 meta 对象，无匹配返回 null
 */
function resolveToolMeta(path) {
  const slug = path.replace(/\/+$/, '')
  return TOOL_META_MAP[slug] || null
}

// 懒加载组件引用（复用实例避免重复 import）
const DocsView = () => import('../views/DocsView.vue')
const SubmitView = () => import('../views/SubmitView.vue')
const DownView = () => import('../views/DownView.vue')
const WorkspaceView = () => import('../components/WorkspaceView.vue')
const SettingsView = () => import('../views/SettingsView.vue')
const ChangelogView = () => import('../views/ChangelogView.vue')
const NotFoundView = () => import('../views/NotFoundView.vue')
const ConsoleLayout = () => import('../console/ConsoleLayout.vue')
const ConsoleOverview = () => import('../console/pages/ConsoleOverview.vue')
const ConsoleCards = () => import('../console/pages/ConsoleCards.vue')
const ConsoleNotices = () => import('../console/pages/ConsoleNotices.vue')
const ConsoleAnnouncements = () => import('../console/pages/ConsoleAnnouncements.vue')
const ConsolePromo = () => import('../console/pages/ConsolePromo.vue')
const ConsolePeople = () => import('../console/pages/ConsolePeople.vue')
const ConsoleDownloads = () => import('../console/pages/ConsoleDownloads.vue')
const ConsoleLogs = () => import('../console/pages/ConsoleLogs.vue')
const ConsoleSubmissions = () => import('../console/pages/ConsoleSubmissions.vue')
const ConsoleFeedback = () => import('../console/pages/ConsoleFeedback.vue')
const ConsoleAccounts = () => import('../console/pages/ConsoleAccounts.vue')
const ConsoleAccount = () => import('../console/pages/ConsoleAccount.vue')
const ConsoleSystem = () => import('../console/pages/ConsoleSystem.vue')
const ConsoleSystemAssets = () => import('../console/pages/ConsoleSystemAssets.vue')
const ConsoleSystemTasks = () => import('../console/pages/ConsoleSystemTasks.vue')
const ConsoleSystemSettings = () => import('../console/pages/ConsoleSystemSettings.vue')
const ConsoleLogin = () => import('../console/pages/ConsoleLogin.vue')
const DevOptionsView = () => import('../views/DevOptionsView.vue')

// 已知的文档页面路径（具体静态路由，用于 SSG 预渲染）
const KNOWN_DOCS = [
  { slug: 'privacy', meta: DOCS_META_MAP.privacy },
  { slug: 'faq', meta: DOCS_META_MAP.faq },
  { slug: 'dev', meta: DOCS_META_MAP.dev },
  { slug: 'promotion', meta: DOCS_META_MAP.promotion },
  { slug: 'third-party', meta: DOCS_META_MAP['third-party'] },
]

// 已知的下载页面路径（具体静态路由，用于 SSG 预渲染）
const KNOWN_DOWNLOADS = Object.keys(DOWNLOAD_PAGES).map((slug) => ({
  slug,
  meta: resolveDownloadMeta(slug),
}))

// 已知的工具页面路径（具体静态路由，用于 SSG 预渲染）
const KNOWN_TOOLS = [
  { slug: 'qjzh', meta: TOOL_META_MAP.qjzh },
  { slug: 'tr', meta: TOOL_META_MAP.tr },
  { slug: 'raw-json', meta: TOOL_META_MAP['raw-json'] },
  { slug: 'selector', meta: TOOL_META_MAP.selector },
  { slug: 'execute', meta: TOOL_META_MAP.execute },
  { slug: 'fuhao', meta: TOOL_META_MAP.fuhao },
]

export const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
    meta: {
      title: '小舟工具箱 - Minecraft 基岩版指令工具聚合平台',
      description: '小舟工具箱是一个简洁高效的 Minecraft 工具导航网站，聚合各类 MC 相关工具、文档与社区资源。包含指令工具、文档百科、社区论坛、资源素材等分类。',
      keywords: 'Minecraft,基岩版,MC工具,指令生成器,艺术字,T显编辑器,命令助手,小舟工具箱,MC导航',
    },
  },
  {
    path: '/docs',
    name: 'docs-index',
    component: DocsView,
    props: { docName: '' },
    meta: {
      title: '关于本站 - 小舟工具箱',
      description: '查看小舟工具箱的项目文档、隐私政策、使用指南等信息。',
      keywords: '小舟工具箱,项目文档,使用指南,隐私政策',
    },
  },
  // 已知文档页的具体静态路由（SSG 预渲染）
  ...KNOWN_DOCS.map(({ slug, meta }) => ({
    path: `/docs/${slug}`,
    name: `docs-${slug}`,
    component: DocsView,
    props: { docName: slug },
    meta,
  })),
  // 未知文档页的兜底动态路由（客户端 SPA 处理）
  {
    path: '/docs/:docName(.*)',
    name: 'docs',
    component: DocsView,
    props: true,
  },
  {
    path: '/submit',
    name: 'submit',
    component: SubmitView,
    meta: {
      title: '网址提交 - 小舟工具箱',
      description: '向小舟工具箱提交您推荐的 Minecraft 相关工具或资源网址。',
      keywords: '网址提交,Minecraft工具推荐,MC资源投稿',
    },
  },
  {
    path: '/donate',
    name: 'donate',
    component: DocsView,
    props: { docName: 'donate' },
    meta: {
      title: '打赏支持 - 小舟工具箱',
      description: '支持小舟工具箱的持续运营，通过微信、支付宝、QQ打赏，或前往爱发电赞助。所有打赏收入用于补贴服务器与开发成本。',
      keywords: '小舟工具箱,打赏,赞助,爱发电,捐赠,支持',
    },
  },
  // 已知下载页的具体静态路由（SSG 预渲染）
  ...KNOWN_DOWNLOADS.map(({ slug, meta }) => ({
    path: `/down/${slug}`,
    name: `download-${slug}`,
    component: DownView,
    props: { path: slug },
    meta,
  })),
  // 未知下载页的兜底动态路由（客户端 SPA 处理）
  {
    path: '/down/:path(.*)',
    name: 'download',
    component: DownView,
    props: true,
  },
  // 已知工具页的具体静态路由（SSG 预渲染）
  ...KNOWN_TOOLS.map(({ slug, meta }) => ({
    path: `/c/${slug}`,
    name: `tool-${slug}`,
    component: WorkspaceView,
    props: { path: slug },
    meta,
  })),
  // 未知工具页的兜底动态路由（客户端 SPA 处理）
  {
    path: '/c/:path(.*)',
    name: 'workspace',
    component: WorkspaceView,
    props: true,
  },
  // 站外站点 iframe 嵌入路由：复用工作站视图，独立目录 /embed/（robots.txt 已屏蔽）
  {
    path: '/embed/:path(.*)',
    name: 'external',
    component: WorkspaceView,
    props: true,
  },
  {
    path: '/changelog',
    name: 'changelog',
    component: ChangelogView,
    meta: {
      title: '更新日志 - 小舟工具箱',
      description: '小舟工具箱的版本更新记录，按版本倒序列出每个版本的新增、优化与修复内容。',
      keywords: '小舟工具箱,更新日志,版本记录,更新内容,changelog',
    },
  },
  {
    path: '/settings',
    name: 'settings',
    component: SettingsView,
    meta: {
      title: '设置 - 小舟工具箱',
      description: '小舟工具箱全局设置，自定义主题模式等偏好。',
      keywords: '小舟工具箱,设置,主题模式,偏好设置',
    },
  },
  // 控制台：仅客户端使用，不参与预渲染（includedRoutes 在 vite.config.js）也不进 sitemap
  // （见 scripts/generate-seo.js 的 DISALLOW_PATHS）。子页面在 ConsoleLayout 的 children 下登记。
  // 登录页与控制台布局同级：未登录时不该注册控制台目录，登录后由守卫送回 /console。
  {
    path: '/console/login',
    name: 'console-login',
    component: ConsoleLogin,
    meta: {
      title: '控制台登录 - 小舟工具箱',
    },
  },
  {
    path: '/console',
    component: ConsoleLayout,
    children: [
      {
        path: '',
        name: 'console-overview',
        component: ConsoleOverview,
        meta: {
          title: '概览 - 控制台 - 小舟工具箱',
        },
      },
      {
        path: 'cards',
        name: 'console-cards',
        component: ConsoleCards,
        meta: {
          title: '卡片管理 - 控制台 - 小舟工具箱',
          permission: 'cards.write',
        },
      },
      {
        path: 'notices',
        name: 'console-notices',
        component: ConsoleNotices,
        meta: {
          title: '公告管理 - 控制台 - 小舟工具箱',
          permission: 'notices.write',
        },
      },
      {
        path: 'announcements',
        name: 'console-announcements',
        component: ConsoleAnnouncements,
        meta: {
          title: '弹窗公告 - 控制台 - 小舟工具箱',
          permission: 'notices.write',
        },
      },
      {
        path: 'promo',
        name: 'console-promo',
        component: ConsolePromo,
        meta: {
          title: '推广位 - 控制台 - 小舟工具箱',
          permission: 'promo.write',
        },
      },
      {
        path: 'people',
        name: 'console-people',
        component: ConsolePeople,
        meta: {
          title: '共建者与打赏 - 控制台 - 小舟工具箱',
          permission: 'people.write',
        },
      },
      {
        path: 'downloads',
        name: 'console-downloads',
        component: ConsoleDownloads,
        meta: {
          title: '下载页 - 控制台 - 小舟工具箱',
          permission: 'downloads.write',
        },
      },
      {
        path: 'submissions',
        name: 'console-submissions',
        component: ConsoleSubmissions,
        meta: {
          title: '网址提交审核 - 控制台 - 小舟工具箱',
          permission: 'cards.review',
        },
      },
      {
        path: 'feedback',
        name: 'console-feedback',
        component: ConsoleFeedback,
        meta: {
          title: '反馈处理 - 控制台 - 小舟工具箱',
          permission: 'feedback.manage',
        },
      },
      {
        path: 'account',
        name: 'console-account',
        component: ConsoleAccount,
        meta: {
          title: '我的账号 - 控制台 - 小舟工具箱',
        },
      },
      {
        path: 'system',
        component: ConsoleSystem,
        meta: {
          title: '系统设置 - 控制台 - 小舟工具箱',
        },
        // 系统设置是分组而非页面：子页各有权限点（system.manage / accounts.manage /
        // logs.read），父级不再统一要求 system.manage，否则后两者账号会被拦在门外。
        // 精确路径 /console/system 的落地由 ConsoleSystem 按第一个可访问子页决定。
        children: [
          {
            path: 'settings',
            name: 'console-system-settings',
            component: ConsoleSystemSettings,
            meta: {
              title: '系统设置 - 控制台 - 小舟工具箱',
              headerTitle: '系统设置',
              headerDescription: '',
              headerIcon: Settings24Regular,
              permission: 'system.manage',
            },
          },
          {
            path: 'assets',
            name: 'console-system-assets',
            component: ConsoleSystemAssets,
            meta: {
              title: '图片资产 - 系统设置 - 控制台 - 小舟工具箱',
              headerTitle: '图片资产',
              headerDescription: '',
              headerIcon: Image24Regular,
              permission: 'system.manage',
            },
          },
          {
            path: 'tasks',
            name: 'console-system-tasks',
            component: ConsoleSystemTasks,
            meta: {
              title: '定时任务 - 系统设置 - 控制台 - 小舟工具箱',
              headerTitle: '定时任务',
              headerDescription: '',
              headerIcon: Clock24Regular,
              permission: 'system.manage',
            },
          },
          {
            path: 'accounts',
            name: 'console-system-accounts',
            component: ConsoleAccounts,
            meta: {
              title: '账号管理 - 系统设置 - 控制台 - 小舟工具箱',
              headerTitle: '账号管理',
              headerDescription: '',
              headerIcon: People24Regular,
              permission: 'accounts.manage',
            },
          },
          {
            path: 'logs',
            name: 'console-system-logs',
            component: ConsoleLogs,
            meta: {
              title: '管理日志 - 系统设置 - 控制台 - 小舟工具箱',
              headerTitle: '管理日志',
              headerDescription: '',
              headerIcon: History24Regular,
              permission: 'logs.read',
            },
          },
        ],
      },
    ],
  },
  {
    path: '/offline',
    name: 'offline',
    component: OfflineDiagnostic,
    meta: {
      title: '连接失败 - 小舟工具箱',
    },
  },
  // 开发者选项：入口是页脚「本站已运行」连点 5 次。生产环境也注册，方便线上排障，
  // 因此必须排除预渲染与收录（见 vite.config 的 includedRoutes、scripts/generate-seo.js 的 DISALLOW_PATHS）。
  {
    path: '/dev/options',
    name: 'dev-options',
    component: DevOptionsView,
    meta: {
      title: '开发者选项 - 小舟工具箱',
    },
  },
  // 开发专用预览页：仅 dev 注册，不进生产产物、不进 sitemap（见 scripts/route-list.js 的过滤）
  ...(import.meta.env.DEV
    ? [
        {
          path: '/dev/palette',
          name: 'dev-palette',
          component: () => import('../views/DevPaletteView.vue'),
        },
        {
          path: '/dev/markdown',
          name: 'dev-markdown',
          component: () => import('../views/DevMarkdownView.vue'),
        },
      ]
    : []),
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFoundView,
  },
]

export { resolveToolMeta, resolveDocsMeta, resolveDownloadMeta }
export default routes

/** 路径里出现控制字符说明不是正常路由，浏览器/终端可能按各自方式截断 */
function hasControlCharacter(value) {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}

/**
 * 登录成功后的回跳参数只允许站内绝对路径。
 * 反斜杠会被部分浏览器当成斜杠，`//` 与带协议的值都会离开本站，一律回落到控制台概览。
 * @param {unknown} value route.query.redirect
 * @param {string} [fallback] 非法值时的回落路径
 */
function sanitizeConsoleRedirect(value, fallback = '/console') {
  if (typeof value !== 'string') return fallback
  const target = value.trim()
  if (!target.startsWith('/') || target.startsWith('//')) return fallback
  if (target.includes('\\') || hasControlCharacter(target)) return fallback
  return target
}

/**
 * 为给定 router 实例附加导航守卫（顶部加载条 + SEO head）
 * ViteSSG 回调中调用此函数，客户端/SSR 共用
 */
export function setupRouterGuards(router) {
  // 控制台访问控制：没有本地账号痕迹时直接去登录页。
  // 这里判断的只是本地痕迹（非凭证），伪造它也进不了数据 —— 控制台外壳挂载时会向
  // GET /api/v1/console/me 确认会话，服务端不认就送回登录页。
  router.beforeEach((to, from, next) => {
    if (!to.path.startsWith('/console')) { next(); return }

    const { isAuthenticated } = useConsoleAuth()
    const isLoginRoute = to.path === '/console/login'

    // 非法回跳参数在进入登录页前就地规范化，页面读取时不需要再判一次
    if (isLoginRoute && to.query.redirect !== undefined) {
      const redirect = sanitizeConsoleRedirect(to.query.redirect)
      if (redirect !== to.query.redirect) {
        next({ path: '/console/login', query: { ...to.query, redirect } })
        return
      }
    }

    if (!isAuthenticated.value && !isLoginRoute) {
      next({ path: '/console/login', query: { redirect: to.fullPath } })
      return
    }
    if (isAuthenticated.value && isLoginRoute) {
      next({ path: '/console' })
      return
    }
    next()
  })

  // 路由前置守卫：进度条 + 超时 / ping / 刷新 / 兜底（仅客户端）
  router.beforeEach((to, from, next) => {
    if (typeof window === 'undefined') { next(); return }

    if (to.path !== from.path && to.name !== 'offline') {
      clearAllTimers()

      const navStart = Date.now()
      let alreadyRefreshed = false
      try {
        alreadyRefreshed = sessionStorage.getItem(SESSION_KEY) === '1'
      } catch { /* noop */ }

      console.log(
        `[Router] 开始导航: ${from.path} → ${to.path}`,
        `(已刷新:${alreadyRefreshed ? '是' : '否'})`,
      )

      // ---- 定时器 1：8s ping 本站 ----
      // 成功 → 动态安排刷新（对齐 15s 时间线）
      // 失败 → 立即跳 /offline
      abortController = new AbortController()
      pingTimer = setTimeout(async () => {
        const elapsed = Date.now() - navStart
        console.log(`[Router] ${elapsed}ms 未完成，开始 ping 服务器...`)
        const ok = await pingServer(abortController.signal)
        if (abortController.signal.aborted) return

        if (!ok) {
          goOffline('服务器 ping 失败')
        } else {
          console.log('[Router] 服务器连通正常，安排刷新')
          const remaining = Math.max(0, REFRESH_AT - (Date.now() - navStart))
          refreshTimer = setTimeout(() => {
            if (alreadyRefreshed) {
              console.log('[Router] 已刷新过一次，本轮不再刷新，等待 30s 兜底')
              return
            }
            console.warn(`[Router] 加载超过 15s 且服务器连通，跳转目标页: ${to.path}`)
            try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* noop */ }
            if (getMessage()) {
              getMessage().warning('加载过久，正在刷新重试…')
            }
            reloadTimer = setTimeout(() => { window.location.href = to.path }, 600)
          }, remaining)
        }
      }, PING_DELAY)

      // ---- 定时器 2：30s 最终兜底 ----
      fallbackTimer = setTimeout(() => {
        goOffline('30s 兜底超时')
      }, FALLBACK_TIMEOUT)

      startLoading()
    }
    next()
  })

  // 路由错误处理：懒加载 chunk 失败说明页面跑的是旧构建，切到最新构建；先 ping 排除离线
  router.onError((error, to) => {
    if (!isChunkLoadError(error)) return
    clearAllTimers()
    finishLoading()
    recoverAfterCheck(to)
  })

  // 路由后置守卫：导航成功 → 清除所有定时器 + 清除刷新标记
  router.afterEach((to) => {
    clearAllTimers()
    try {
      sessionStorage.removeItem(SESSION_KEY)
      // 导航成功说明当前构建可用，下次再遇到 chunk 失败可以重新触发一次自愈
      sessionStorage.removeItem(CHUNK_RECOVER_KEY)
    } catch { /* noop */ }
    console.log(`[Router] 导航完成: ${to.path}`)

    setTimeout(finishLoading, 100)
  })

  return router
}

/**
 * 创建完整的 router 实例（用于 vite-ssg 和传统 dev 模式）
 * @returns {import('vue-router').Router}
 */
export function createRouterInstance() {
  // 必须在 createWebHistory 读取 location 之前清掉自愈参数，路由初始化后才是干净 URL
  stripRecoveryQuery()
  const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
  })
  return setupRouterGuards(router)
}

// 向后兼容：默认导出一个已创建好的 router 实例（仅客户端可用）
// vite-ssg 在 SSR 构建时使用 createMemoryHistory，不依赖此实例
const router = typeof window !== 'undefined' ? createRouterInstance() : null
export { router }


import { createRouter, createWebHistory } from 'vue-router'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'
import { useHead } from '@unhead/vue'
import HomeView from '../components/HomeView.vue'
import OfflineDiagnostic from '../components/OfflineDiagnostic.vue'

// 预加载所有下载配置，提取 slug → name 映射用于 SEO 动态标题
const downloadModules = import.meta.glob('../data/downloads/*.json', { eager: true })
const DOWNLOAD_NAMES = {}
for (const [path, mod] of Object.entries(downloadModules)) {
  const slug = path.replace('../data/downloads/', '').replace('.json', '')
  const data = mod.default || mod
  DOWNLOAD_NAMES[slug] = data.name || slug
}

// 配置 NProgress（仅在客户端执行）
if (typeof window !== 'undefined') {
  NProgress.configure({
    showSpinner: false,
    trickleSpeed: 200,
    minimum: 0.2,
    speed: 150,
    easing: 'ease',
  })
}

// ===== 路由导航超时机制 =====
// 防止 chunk 加载挂起导致 NProgress 永久卡住（如离线/网络极差场景）
const NAV_TIMEOUT_MS = 8000
let navTimer = null

/** 清除导航超时计时器 */
function clearNavTimer() {
  if (navTimer) {
    clearTimeout(navTimer)
    navTimer = null
  }
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
const DownView = () => import('../views/DownView.vue')
const WorkspaceView = () => import('../components/WorkspaceView.vue')
const SettingsView = () => import('../views/SettingsView.vue')
const NotFoundView = () => import('../views/NotFoundView.vue')

// 已知的文档页面路径（具体静态路由，用于 SSG 预渲染）
const KNOWN_DOCS = [
  { slug: 'privacy', meta: DOCS_META_MAP.privacy },
  { slug: 'faq', meta: DOCS_META_MAP.faq },
  { slug: 'dev', meta: DOCS_META_MAP.dev },
]

// 已知的下载页面路径（具体静态路由，用于 SSG 预渲染）
const KNOWN_DOWNLOADS = Object.keys(DOWNLOAD_NAMES).map((slug) => {
  const name = DOWNLOAD_NAMES[slug]
  return {
    slug,
    meta: {
      title: `${name} - 文件下载 - 小舟工具箱`,
      description: `小舟工具箱提供的${name}下载页面，支持快捷直链解析和手动网盘下载。`,
      keywords: `Minecraft,资源下载,${name},MC工具下载,小舟工具箱`,
    },
  }
})

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
    component: DocsView,
    props: { docName: 'url-tj' },
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
  {
    path: '/offline',
    name: 'offline',
    component: OfflineDiagnostic,
    meta: {
      title: '连接失败 - 小舟工具箱',
    },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFoundView,
  },
]

export { resolveToolMeta, resolveDocsMeta, DOWNLOAD_NAMES }
export default routes

/**
 * 为给定 router 实例附加导航守卫（NProgress + SEO head）
 * ViteSSG 回调中调用此函数，客户端/SSR 共用
 */
export function setupRouterGuards(router) {
  // 路由前置守卫：开始进度条 + 启动超时计时器（仅客户端）
  router.beforeEach((to, from, next) => {
    if (typeof window === 'undefined') { next(); return }

    if (to.path !== from.path && to.name !== 'offline') {
      clearNavTimer()
      navTimer = setTimeout(() => {
        NProgress.done()
        window.location.href = '/offline'
      }, NAV_TIMEOUT_MS)

      NProgress.start()
      setTimeout(() => {
        const bar = document.querySelector('#nprogress .bar')
        if (bar) {
          bar.style.zIndex = '9999999'
        }
        NProgress.set(0.2)
      }, 30)
    }
    next()
  })

  // 路由后置守卫：完成进度条 + 更新页面 head 信息
  router.afterEach((to) => {
    clearNavTimer()

    const meta = to.meta || {}
    let title = meta.title
    let description = meta.description
    let keywords = meta.keywords

    if (!title && !description && !keywords && to.path.startsWith('/c/')) {
      const toolMeta = resolveToolMeta(to.params.path)
      if (toolMeta) {
        title = toolMeta.title
        description = toolMeta.description
        keywords = toolMeta.keywords
      }
    }

    if (!title && !description && !keywords && to.path.startsWith('/down/')) {
      const slug = to.params.path?.replace(/\/+$/, '') || ''
      const name = DOWNLOAD_NAMES[slug] || slug
      title = `${name} - 文件下载 - 小舟工具箱`
      description = `小舟工具箱提供的${name}下载页面，支持快捷直链解析和手动网盘下载。`
      keywords = `Minecraft,资源下载,${name},MC工具下载,小舟工具箱`
    }

    if (!title && !description && !keywords && to.path.startsWith('/docs/') && to.params.docName) {
      const docsMeta = resolveDocsMeta(to.params.docName)
      if (docsMeta) {
        title = docsMeta.title
        description = docsMeta.description
        keywords = docsMeta.keywords
      }
    }

    if (title || description || keywords) {
      useHead({
        title: title || '小舟工具箱',
        meta: [
          ...(description ? [{ name: 'description', content: description }] : []),
          ...(keywords ? [{ name: 'keywords', content: keywords }] : []),
        ],
      })
    }

    // NProgress done 仅在客户端执行
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        const bar = document.querySelector('#nprogress .bar')
        if (bar) {
          bar.style.zIndex = '9999999'
        }
        NProgress.done()
      }, 100)
    }
  })

  return router
}

/**
 * 创建完整的 router 实例（用于 vite-ssg 和传统 dev 模式）
 * @returns {import('vue-router').Router}
 */
export function createRouterInstance() {
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

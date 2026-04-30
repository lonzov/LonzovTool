import { createRouter, createWebHistory } from 'vue-router'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'
import HomeView from '../components/HomeView.vue'

// 配置 NProgress
NProgress.configure({
  showSpinner: false, // 不显示加载转圈
  trickleSpeed: 200,  // 自动递增间隔
  minimum: 0.2,       // 初始最小百分比 20%
  speed: 150,         // 消失动画速度 150ms
  easing: 'ease',     // 缓动函数
})

// 内置工具页的 SEO meta 映射（path slug -> meta）
const TOOL_META_MAP = {
  qjzh: {
    title: '艺术字转换工具 - 小舟工具箱',
    description: '在线 Minecraft 艺术字生成器，支持标准艺术字、上角标、下角标、拉丁文等多种模式，一键转换字母数字用于基岩版指令 UI 设计与美化，点击即复制。',
    keywords: 'Minecraft,艺术字,基岩版指令,UI美化,上角标,下角标,Unicode字符,小舟工具箱',
  },
  tr: {
    title: 'T显动画生成器 - 小舟工具箱',
    description: 'Minecraft 基岩版 T显打字机动画在线生成工具。输入文本即可转换为 rawtext 动画序列，支持自定义计分板名称、初始分数、显示速度等参数，无需手动穷举命令。',
    keywords: 'Minecraft,T显动画,T显生成器,打字机动画,rawtext,基岩版指令,小舟工具箱',
  },
  'raw-json': {
    title: 'T显可视化编辑器 - 小舟工具箱',
    description: 'Minecraft 基岩版 T显 rawJSON 可视化编辑器，0代码轻松实现复杂嵌套文本结构。支持实时预览、导入导出 rawJSON，适用于标题、动作栏、Boss 栏等场景。',
    keywords: 'Minecraft,T显编辑器,rawjson编辑器,可视化编辑器,rawtext,基岩版指令,MC工具,小舟工具箱',
  },
  execute: {
    title: 'Execute语法升级工具 - 小舟工具箱',
    description: 'Minecraft 基岩版 execute 指令旧版本语法自动升级工具。一键将旧格式 execute 命令转换为新版本语法结构，支持 detect/align/run 等复杂嵌套，无需手动学习新版语法。',
    keywords: 'Minecraft,execute,语法升级,指令转换,基岩版,MC命令,旧版语法,新版本语法,小舟工具箱',
  },
  fuhao: {
    title: 'MC特殊符号大全 - 小舟工具箱',
    description: 'Minecraft 基岩版特殊符号合集，包含鸡腿、M币等私有区 Unicode 字符及常用特殊符号。点击即可复制到剪贴板，有效提升 MC 开发效率与聊天美化体验。',
    keywords: 'Minecraft,特殊符号,特殊字符,MC符号,基岩版符号,私有区字符,Unicode,鸡腿符号,M币符号,小舟工具箱',
  },
  down: {
    title: '文件下载 - 小舟工具箱',
    description: '小舟工具箱文件下载页面，提供 Minecraft 相关资源下载，支持快捷直链解析和手动网盘下载。',
    keywords: 'Minecraft,资源下载,蓝奏云,MC工具下载,小舟工具箱',
  },
}

// 文档子页的 SEO meta 映射（docName -> meta）
const DOCS_META_MAP = {
  privacy: {
    title: '隐私政策 - 小舟工具箱',
    description: '小舟工具箱隐私政策，说明网站的数据收集、使用及存储方式。本站为纯前端静态应用，不主动收集用户个人信息，所有数据本地存储。',
    keywords: '小舟工具箱,隐私政策,数据保护,用户隐私,Cookie设置,Minecraft工具',
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
  // 下载页匹配 /down/xxx -> 'down'
  if (slug.startsWith('down/') || slug === 'down') {
    return TOOL_META_MAP['down'] || null
  }
  return TOOL_META_MAP[slug] || null
}

const routes = [
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
    component: () => import('../views/DocsView.vue'),
    props: { docName: '' },
    meta: {
      title: '关于本站 - 小舟工具箱',
      description: '查看小舟工具箱的项目文档、隐私政策、使用指南等信息。',
      keywords: '小舟工具箱,项目文档,使用指南,隐私政策',
    },
  },
  {
    path: '/docs/:docName(.*)',
    name: 'docs',
    component: () => import('../views/DocsView.vue'),
    props: true,
  },
  {
    path: '/submit',
    name: 'submit',
    component: () => import('../views/DocsView.vue'),
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
    component: () => import('../views/DocsView.vue'),
    props: { docName: 'donate' },
    meta: {
      title: '打赏支持 - 小舟工具箱',
      description: '支持小舟工具箱的持续运营，通过微信、支付宝、QQ打赏，或前往爱发电赞助。所有打赏收入用于补贴服务器与开发成本。',
      keywords: '小舟工具箱,打赏,赞助,爱发电,捐赠,支持',
    },
  },
  {
    path: '/down/:path(.*)',
    name: 'download',
    component: () => import('../views/DownView.vue'),
    props: true,
  },
  {
    path: '/c/:path(.*)',
    name: 'workspace',
    component: () => import('../components/WorkspaceView.vue'),
    props: true,
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// 路由前置守卫：开始进度条
router.beforeEach((to, from, next) => {
  if (to.path !== from.path) {
    NProgress.start()
    // 确保进度条在最高层（延迟设置以确保 DOM 已创建）
    setTimeout(() => {
      const bar = document.querySelector('#nprogress .bar')
      if (bar) {
        bar.style.zIndex = '9999999'
      }
      // 确保进度条至少显示 20%
      NProgress.set(0.2)
    }, 30)
  }
  next()
})

// 路由后置守卫：完成进度条 + 更新页面 head 信息
import { useHead } from '@vueuse/head'

router.afterEach((to) => {
  // 解析 SEO head 信息：优先使用 route meta，动态路由走工具映射
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

  // /down/:path 下载页走工具映射（如 /down/指令音符盒）
  if (!title && !description && !keywords && to.path.startsWith('/down/') && to.params.path) {
    const toolMeta = resolveToolMeta(to.params.path)
    if (toolMeta) {
      title = toolMeta.title
      description = toolMeta.description
      keywords = toolMeta.keywords
    }
  }

  // /docs/:docName 子页走文档映射（如 /docs/privacy）
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

  setTimeout(() => {
    // 在 done 前强制提升 z-index，避免离场动画期间被覆盖
    const bar = document.querySelector('#nprogress .bar')
    if (bar) {
      bar.style.zIndex = '9999999'
    }
    NProgress.done()
  }, 100)
})

export default router

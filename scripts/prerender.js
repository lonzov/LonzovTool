/**
 * 预渲染脚本：在 vite build 之后执行，使用 Puppeteer 对指定路由生成静态 HTML
 * 用法：node scripts/prerender.js
 */
import puppeteer from 'puppeteer'
import { fileURLToPath } from 'node:url'
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createServer } from 'node:http'
import serveHandler from 'serve-handler'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DIST_DIR = join(ROOT, 'dist')
const PORT = 18789

// 需要预渲染的路由列表
const ROUTES = [
  '/',
  '/docs',
  '/docs/privacy',
  '/submit',
  // 站内工具页
  '/c/qjzh/',
  '/c/tr/',
  '/c/raw-json/',
  '/c/execute/',
  '/c/fuhao/',
]

// 并发控制：同时渲染的页面数
const CONCURRENCY = 5

/**
 * 渲染单个路由页面
 */
async function renderRoute(browser, route) {
  const page = await browser.newPage()

  try {
    const url = `http://localhost:${PORT}${route}`
    console.log(`[prerender] 正在渲染: ${route}`)

    // 清空 localStorage/sessionStorage，避免 tab 缓存污染跨路由渲染
    await page.evaluateOnNewDocument(() => {
      if (typeof localStorage !== 'undefined') {
        localStorage.clear()
      }
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.clear()
      }
    })

    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    })

    // 等待 Vue Router 初始导航完成 + defineAsyncComponent 子组件完全渲染
    await page.evaluate(() => {
      return new Promise((resolve) => {
        let settled = false

        const done = () => {
          if (settled) return
          settled = true
          resolve()
        }

        const tryRouter = () => {
          const appEl = document.querySelector('#app')
          if (appEl && appEl.__vue_app__) {
            const router = appEl.__vue_app__.config.globalProperties.$router
            if (router && router.isReady) {
              router.isReady().then(() => waitForAsyncComponent(resolve))
              return true
            }
          }
          return false
        }

        function waitForAsyncComponent(callback) {
          const startTime = Date.now()
          const MAX_WAIT = 8000
          const POLL_INTERVAL = 100

          const check = () => {
            const contentEl = document.querySelector('.workspace-content')
            if (contentEl) {
              const hasContent = contentEl.children.length > 0 &&
                !contentEl.querySelector('.n-empty')
              if (hasContent) { callback(); return }
            }
            const appEl = document.querySelector('#app')
            if (appEl && appEl.__vue_app__) {
              const route = appEl.__vue_app__.config.globalProperties.$route
              if (route && !route.path.startsWith('/c/')) { callback(); return }
            }
            if (Date.now() - startTime > MAX_WAIT) {
              console.warn('[prerender] 异步组件等待超时')
              callback()
              return
            }
            setTimeout(check, POLL_INTERVAL)
          }
          check()
        }

        if (!tryRouter()) {
          window.addEventListener('app-rendered', done, { once: true })
        }
        setTimeout(done, 15000)
      })
    })

    // 额外等待确保渲染稳定（含 defineAsyncComponent 解析完成）
    await new Promise((r) => setTimeout(r, 800))

    // 重新注入 loading-overlay（Puppeteer 执行 main.js 时已被移除）
    await page.evaluate(() => {
      if (!document.getElementById('loading-overlay')) {
        const overlay = document.createElement('div')
        overlay.id = 'loading-overlay'
        overlay.innerHTML = '<div class="loader"></div><div class="loading-text">LOADING\u2026</div>'
        document.body.insertBefore(overlay, document.body.firstChild)
      }
    })

    const renderedHtml = await page.content()

    let outputDir = DIST_DIR
    if (route === '/') {
      outputDir = DIST_DIR
    } else {
      const routePath = route.replace(/^\//, '')
      outputDir = join(DIST_DIR, routePath)
      mkdirSync(outputDir, { recursive: true })
    }

    writeFileSync(join(outputDir, 'index.html'), renderedHtml)

    return { route, status: 'ok', size: Buffer.byteLength(renderedHtml, 'utf-8') }
  } catch (err) {
    return { route, status: 'error', message: err.message }
  } finally {
    await page.close()
  }
}

async function prerender() {
  const t0 = Date.now()

  if (!existsSync(DIST_DIR)) {
    console.error('[prerender] 错误: dist 目录不存在，请先运行 vite build')
    process.exit(1)
  }

  // 清理上次预渲染产物（子目录），只保留 vite build 原始输出
  const prerenderDirs = ['docs', 'submit', 'c']
  for (const dir of prerenderDirs) {
    const dirPath = join(DIST_DIR, dir)
    if (existsSync(dirPath)) {
      rmSync(dirPath, { recursive: true, force: true })
      console.log(`[prerender] 已清理旧产物: ${dir}/`)
    }
  }
  // 恢复原始 index.html（去除上次的 #app 注入内容）
  let baseTemplate = readFileSync(join(DIST_DIR, 'index.html'), 'utf-8')
  baseTemplate = baseTemplate.replace(
    /(<div id="app"[^>]*>)([\s\S]*?)(<\/div>)/,
    '$1$3'
  )
  writeFileSync(join(DIST_DIR, 'index.html'), baseTemplate)
  console.log('[prerender] 已重置 index.html 为干净模板')

  // 创建自定义 HTTP 服务器（支持 SPA fallback）
  const server = await new Promise((resolve) => {
    const srv = createServer(async (req, res) => {
      await serveHandler(req, res, {
        public: DIST_DIR,
        rewrites: [{ source: '**', destination: '/index.html' }],
      })
    })
    srv.listen(PORT, () => resolve(srv))
  })

  console.log(`[prerender] 本地服务: http://localhost:${PORT}`)
  console.log(`[prerender] 启动 Puppeteer (并发度: ${CONCURRENCY})...`)

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  // 分批并发执行，每批 CONCURRENCY 个路由
  const results = []
  for (let i = 0; i < ROUTES.length; i += CONCURRENCY) {
    const batch = ROUTES.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.all(batch.map(route => renderRoute(browser, route)))
    for (const result of batchResults) {
      results.push(result)
      if (result.status === 'ok') {
        console.log(`[prerender] ✓ ${result.route} (${(result.size / 1024).toFixed(1)} KB)`)
      } else {
        console.error(`[prerender] ✗ ${result.route}: ${result.message}`)
      }
    }
  }

  await browser.close()

  // 关闭本地服务器
  await new Promise((resolve) => server.close(() => resolve()))

  console.log('\n[prerender] 完成！')
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`[prerender] 总计: ${results.filter(r => r.status === 'ok').length}/${results.length} 个页面，耗时 ${elapsed}s`)

  const failures = results.filter(r => r.status === 'error')
  if (failures.length > 0) {
    console.log('\n[prerender] 失败的路由:')
    failures.forEach(r => console.log(`  - ${r.route}: ${r.message}`))
    process.exit(1)
  }
}

prerender().catch(err => {
  console.error('[prerender] 致命错误:', err)
  process.exit(1)
})

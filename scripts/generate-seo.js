/**
 * SEO 文件生成脚本：生成 sitemap.xml 和 robots.txt
 * 用法：node scripts/generate-seo.js
 * 在 vite build + prerender 之后执行，输出到 dist 目录
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DIST_DIR = join(ROOT, 'dist')

const SITE_URL = 'https://tool.lonzov.top'

// 站点所有公开页面路径（不含被 robots 禁止的路径）
const PAGES = [
  '/',
  '/docs',
  '/docs/privacy',
  '/submit',
  '/c/qjzh/',
  '/c/tr/',
  '/c/raw-json/',
  '/c/execute/',
  '/c/fuhao/',
]

// 被 robots.txt 禁止的路径
const DISALLOW_PATHS = ['/submit']

function generateSitemap() {
  const now = new Date().toISOString()
  // 自动排除 robots.txt 中禁止的路径
  const allowedPages = PAGES.filter(p => !DISALLOW_PATHS.some(d => p.startsWith(d)))
  const urls = allowedPages.map((path) => {
    return `    <url>
        <loc>${SITE_URL}${path}</loc>
        <lastmod>${now}</lastmod>
    </url>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`
}

function generateRobotsTxt() {
  const disallowRules = DISALLOW_PATHS.map((p) => `Disallow: ${p}`).join('\n')
  return `User-agent: *
${disallowRules}
Sitemap: ${SITE_URL}/sitemap.xml`
}

// --- 执行 ---
try {
  const sitemap = generateSitemap()
  writeFileSync(join(DIST_DIR, 'sitemap.xml'), sitemap, 'utf-8')
  console.log('[seo] 已生成 sitemap.xml')

  const robots = generateRobotsTxt()
  writeFileSync(join(DIST_DIR, 'robots.txt'), robots, 'utf-8')
  console.log('[seo] 已生成 robots.txt')
} catch (err) {
  console.error('[seo] 错误:', err.message)
  process.exit(1)
}

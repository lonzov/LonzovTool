/**
 * SEO 文件生成脚本：生成 sitemap.xml 和 robots.txt
 * 用法：node scripts/generate-seo.js
 * 在 vite build 之后执行，输出到 dist 目录
 *
 * 页面路径自动从路由配置和数据目录中提取，无需手动列举。
 * 仅需配置 DISALLOW_PATHS 控制 robots.txt 禁止规则。
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPages } from './route-list.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DIST_DIR = join(ROOT, 'dist')

const SITE_URL = 'https://tool.lonzov.top'

// 唯一需要手动配置的部分：robots.txt 禁止的路径，同时也会从 sitemap 中排除
const DISALLOW_PATHS = ['/submit', '/offline', '/settings']

function generateSitemap(pages) {
  // const now = new Date().toISOString() <lastmod>${now}</lastmod>
  const urls = pages
    .filter(p => !DISALLOW_PATHS.some(d => p.startsWith(d)))
    .map((path) => {
      return `    <url>
        <loc>${SITE_URL}${path}</loc>
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
  const pages = getPages()
  console.log('[seo] 检测到页面路径:', pages)

  const sitemap = generateSitemap(pages)
  writeFileSync(join(DIST_DIR, 'sitemap.xml'), sitemap, 'utf-8')
  console.log('[seo] 已生成 sitemap.xml')

  const robots = generateRobotsTxt()
  writeFileSync(join(DIST_DIR, 'robots.txt'), robots, 'utf-8')
  console.log('[seo] 已生成 robots.txt')
} catch (err) {
  console.error('[seo] 错误:', err.message)
  process.exit(1)
}

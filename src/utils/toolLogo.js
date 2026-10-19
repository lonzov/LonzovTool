import { h } from 'vue'
import { NIcon } from 'naive-ui'
import { getToolIcon } from '../config/categoryIcons'

/* 工具卡片 logo 的渲染：logo 字段不以 / 或 http 开头时按图标名处理（见 config/categoryIcons）。
   标签栏下拉菜单与侧边栏分类栏共用此处，保证两处图标来源一致。 */

export function isIconLogo(logo) {
  return !!logo && !logo.startsWith('/') && !/^https?:/i.test(logo)
}

// 外链 logo 不携带 Referer，避免图床/防盗链服务因来源校验拒绝加载
export function logoReferrerPolicy(logo) {
  return /^https?:/i.test(logo || '') ? 'no-referrer' : undefined
}

/**
 * 生成 Naive 选项 icon 用的渲染函数（图片 / 图标两种来源）
 * @param {string} logo 图标名、站内图片路径或外链
 * @param {number} size 边长 px
 * @returns {(() => import('vue').VNodeChild) | undefined}
 */
export function makeLogoIcon(logo, size = 18) {
  if (!logo) return undefined

  if (isIconLogo(logo)) {
    const comp = getToolIcon(logo)
    // 用站点主题色变量，随深浅色自动适配
    if (!comp) return undefined
    return () => h(NIcon, { component: comp, size, color: 'var(--muted-foreground)' })
  }

  return () =>
    h(
      'span',
      {
        style: `width:${size}px;height:${size}px;border-radius:var(--radius-xs);overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center`,
      },
      [
        h('img', {
          src: logo,
          alt: '',
          referrerpolicy: logoReferrerPolicy(logo),
          style: 'width:100%;height:100%;object-fit:contain;display:block',
        }),
      ],
    )
}

import { neutral, highlight, destructive, warning, success, alpha } from './palette.js'

const BLACK = '#000000'

/**
 * 层级（文字的主次、边框、hover 叠层）一律由 foreground 基色按透明度派生，
 * 而不是各写一个手调灰阶 —— 换主题只需改基色，各级派生自动跟随。
 * 底色、反色块、强调色仍用实色：它们一旦半透明，叠层之间会互相透视，层级会失控。
 */
const lightTokens = {
  // 底色
  background: neutral[50],
  card: neutral[0],
  popover: neutral[0],
  muted: neutral[100],
  footer: neutral[150],
  'input-background': neutral[0],

  // 文字
  foreground: neutral[850],
  'muted-foreground': alpha(neutral[850], 0.75),
  'subtle-foreground': alpha(neutral[850], 0.4),
  'disabled-foreground': alpha(neutral[850], 0.26),

  // 边框与分割线
  border: alpha(neutral[850], 0.13),
  'border-strong': alpha(neutral[850], 0.18),
  input: alpha(neutral[850], 0.13),

  // 叠层：hover / 选中 / 涟漪 / 焦点环
  accent: alpha(neutral[850], 0.055),
  ripple: alpha(neutral[850], 0.08),
  ring: alpha(neutral[850], 0.2),

  // 滚动条
  scrollbar: alpha(neutral[850], 0.2),
  'scrollbar-hover': alpha(neutral[850], 0.3),

  // 毛玻璃层：移动端头部与抽屉标题栏
  'glass-background': alpha(neutral[0], 0.75),
  'glass-border': alpha(neutral[200], 0.5),

  // 反色块
  primary: neutral[850],
  'primary-foreground': neutral[0],

  // 强调色
  highlight: highlight.light,
  'highlight-foreground': neutral[1000],
  destructive: destructive.light,
  'destructive-foreground': neutral[0],
  warning: warning.light,
  'warning-foreground': neutral[1000],
  success: success.light,
  'success-foreground': neutral[0],

  // 阴影
  'shadow-sm': `0 1px 2px ${alpha(BLACK, 0.04)}`,
  'shadow-md': `0 2px 8px ${alpha(BLACK, 0.06)}`,
  'shadow-popover': `0 8px 24px -6px ${alpha(BLACK, 0.14)}, 0 12px 32px 4px ${alpha(BLACK, 0.08)}, 0 16px 48px 16px ${alpha(BLACK, 0.05)}`,
  'shadow-drawer': `0 8px 40px ${alpha(BLACK, 0.5)}`,
}

const darkTokens = {
  background: neutral[950],
  card: neutral[850],
  popover: neutral[825],
  muted: neutral[800],
  footer: neutral[1000],
  'input-background': neutral[825],

  foreground: neutral[175],
  'muted-foreground': alpha(neutral[175], 0.66),
  'subtle-foreground': alpha(neutral[175], 0.35),
  'disabled-foreground': alpha(neutral[175], 0.22),

  border: alpha(neutral[175], 0.09),
  'border-strong': alpha(neutral[175], 0.12),
  input: alpha(neutral[175], 0.09),

  accent: alpha(neutral[175], 0.08),
  ripple: alpha(neutral[175], 0.12),
  ring: alpha(neutral[175], 0.15),

  scrollbar: alpha(neutral[175], 0.22),
  'scrollbar-hover': alpha(neutral[175], 0.29),

  'glass-background': alpha(neutral[850], 0.75),
  'glass-border': alpha(neutral[700], 0.5),

  primary: neutral[175],
  'primary-foreground': neutral[850],

  highlight: highlight.dark,
  'highlight-foreground': neutral[1000],
  destructive: destructive.dark,
  'destructive-foreground': neutral[0],
  warning: warning.dark,
  'warning-foreground': neutral[1000],
  success: success.dark,
  'success-foreground': neutral[1000],

  'shadow-sm': `0 1px 2px ${alpha(BLACK, 0.3)}`,
  'shadow-md': `0 2px 8px ${alpha(BLACK, 0.4)}`,
  'shadow-popover': `0 8px 24px -6px ${alpha(BLACK, 0.6)}, 0 12px 32px 4px ${alpha(BLACK, 0.4)}, 0 16px 48px 16px ${alpha(BLACK, 0.3)}`,
  'shadow-drawer': `0 8px 40px ${alpha(BLACK, 0.5)}`,
}

/** 圆角与非颜色 token：两套主题共用 */
const RADIUS_STEPS = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
}

export const radiusTokens = Object.fromEntries(
  Object.entries(RADIUS_STEPS).map(([k, v]) => [`radius-${k}`, `${v}px`]),
)

const staticTokens = {
  ...radiusTokens,
  // 胶囊与圆形：半径必然达到短边一半，平滑曲率在此会破形，用法见 main.css 的 .corner-round
  'radius-full': '9999px',

  // 抽屉与弹窗遮罩：两套主题下都应为黑，不随主题变化
  mask: alpha(BLACK, 0.4),

  'duration-theme': '0.4s',
  'ease-theme': 'ease',

  // 层级契约：低于 Naive 弹层（≥2000），高于移动端抽屉
  'z-mobile-drawer': '1900',
  'z-mobile-menu': '1950',
  'z-blur-mask': '1990',
}

/**
 * 平滑曲率下同半径的圆角看起来更"方"，必须放大半径才能保持视觉等效。
 * 1.75 这个系数由项目里两处独立实现反推得到（模态框 16→28、Markdown 表格 12→20.4）。
 */
const SQUIRCLE_SCALE = 1.75

function vars(obj) {
  return Object.entries(obj)
    .map(([k, v]) => `  --${k}: ${v};`)
    .join('\n')
}

const squircleRadii = vars(
  Object.fromEntries(
    Object.entries(RADIUS_STEPS).map(([k, v]) => [`radius-${k}`, `${v * SQUIRCLE_SCALE}px`]),
  ),
)

export const themeCssText = `:root,
[data-theme="light"] {
${vars(lightTokens)}
}

/* 深色段必须排在浅色段之后：两者特异性相同，靠顺序决胜 */
[data-theme="dark"] {
${vars(darkTokens)}
}

:root {
${vars(staticTokens)}
}

/* 平滑曲率圆角。corner-shape 按规范不继承（Inherited: no），只能逐元素设置；
   半径同步放大 ${SQUIRCLE_SCALE}× 抵消曲率带来的"变方"感。不支持的浏览器在解析阶段
   就丢弃该属性，自动回退到传统 1/4 圆角。
   圆角达到元素短边一半的场景（胶囊、圆形）必须回退，理由与判定见 main.css 的 .corner-round。 */
@supports (corner-shape: squircle) {
  *,
  *::before,
  *::after {
    corner-shape: squircle;
  }

  :root {
${squircleRadii}
  }
}
`

export { lightTokens, darkTokens, staticTokens }

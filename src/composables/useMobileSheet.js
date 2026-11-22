import { computed } from 'vue'

/* 全站抽屉在移动端统一从底部升起：顶部固定留 64px 露出页面，
   既点明这是临时浮层，也留下点遮罩关闭的落点。桌面端仍按各抽屉原来的方向与宽度停靠。 */
const MOBILE_SHEET_HEIGHT = 'calc(100% - 64px)'
/* 抓手占掉的高度：标题区据此让出位置 */
const MOBILE_SHEET_HANDLE_SPACE = '26px'

/** 底部抽屉的面板外观：上边线与上圆角把它和下层页面分开 */
const MOBILE_SHEET_PANEL_STYLE = {
  background: 'var(--background)',
  borderTop: '1px solid var(--border)',
  borderTopLeftRadius: 'var(--radius-2xl)',
  borderTopRightRadius: 'var(--radius-2xl)',
  boxShadow: 'var(--shadow-drawer)',
  overflow: 'hidden',
}

/**
 * 抽屉布局的绑定值：移动端一律底部抽屉，桌面端维持传入的方向与宽度。
 *
 * @param {import('vue').Ref<boolean> | (() => boolean)} isMobile 窄屏判定
 * @param {object} options
 * @param {number|string} options.width 桌面端宽度
 * @param {'left'|'right'} [options.placement] 桌面端停靠方向
 * @param {object|null} [options.desktopStyle] 桌面端面板外观；不传则沿用 Naive 主题默认
 */
export function useMobileSheet(isMobile, { width, placement = 'right', desktopStyle = null } = {}) {
  const mobile = computed(() =>
    typeof isMobile === 'function' ? Boolean(isMobile()) : Boolean(isMobile?.value),
  )

  return {
    mobile,
    sheetPlacement: computed(() => (mobile.value ? 'bottom' : placement)),
    sheetWidth: computed(() => (mobile.value ? '100%' : width)),
    sheetHeight: computed(() => (mobile.value ? MOBILE_SHEET_HEIGHT : undefined)),
    sheetHeaderStyle: computed(() =>
      mobile.value ? { paddingTop: MOBILE_SHEET_HANDLE_SPACE } : undefined,
    ),
    sheetStyle: computed(() => (mobile.value ? MOBILE_SHEET_PANEL_STYLE : desktopStyle)),
  }
}

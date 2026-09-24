import { lightTokens, darkTokens, staticTokens } from './tokens.js'

/**
 * 语义 token → Naive UI 真实主题变量名的映射。
 *
 * 两条硬约束（写错不会报错，会被静默忽略，只能在调色板页用真实组件看出来）：
 *   1. 变量名必须是 naive-ui 里真实存在的 —— 例如 Menu 没有 itemTextColorPressed，
 *      Divider 没有 dividerColor，common 没有 neutralModal。
 *   2. peer 组件必须写在 peers 下 —— NModal 的卡片是 { peers: { Card: … } }，
 *      写成 { Card: … } 无效。
 *
 * 这里用 var(--token) 书写，再由 materialize() 按主题展开成具体值 —— 之所以不能
 * 直接把 var() 交给 Naive，是因为它对颜色做运算（seemly 的 composite/rgba 解析），
 * 遇到 var() 会抛 "[seemly/rgba]: Invalid color value"。圆角类变量例外，见 materialize。
 */
const baseOverrides = {
  common: {
    bodyColor: 'var(--background)',
    cardColor: 'var(--card)',
    modalColor: 'var(--card)',
    popoverColor: 'var(--popover)',
    tableColor: 'var(--card)',
    tableHeaderColor: 'var(--muted)',
    inputColor: 'var(--input-background)',
    inputColorDisabled: 'var(--muted)',
    actionColor: 'var(--muted)',
    tabColor: 'var(--muted)',
    tagColor: 'var(--muted)',
    codeColor: 'var(--muted)',

    textColorBase: 'var(--foreground)',
    textColor1: 'var(--foreground)',
    textColor2: 'var(--muted-foreground)',
    textColor3: 'var(--subtle-foreground)',
    textColorDisabled: 'var(--disabled-foreground)',
    placeholderColor: 'var(--subtle-foreground)',
    placeholderColorDisabled: 'var(--disabled-foreground)',

    iconColor: 'var(--muted-foreground)',
    iconColorHover: 'var(--foreground)',
    iconColorPressed: 'var(--foreground)',
    iconColorDisabled: 'var(--disabled-foreground)',
    closeIconColor: 'var(--muted-foreground)',
    closeIconColorHover: 'var(--foreground)',
    closeIconColorPressed: 'var(--foreground)',
    closeColorHover: 'var(--accent)',
    closeColorPressed: 'var(--accent)',
    clearColor: 'var(--subtle-foreground)',
    clearColorHover: 'var(--muted-foreground)',
    clearColorPressed: 'var(--foreground)',

    borderColor: 'var(--border)',
    dividerColor: 'var(--border)',
    hoverColor: 'var(--accent)',
    pressedColor: 'var(--accent)',
    railColor: 'var(--border)',
    progressRailColor: 'var(--border)',
    scrollbarColor: 'var(--scrollbar)',
    scrollbarColorHover: 'var(--scrollbar-hover)',

    // 项目没有主题色，primary 承担的是"反色强调"：静止为二级文字色，交互时收敛到一级文字色
    primaryColor: 'var(--muted-foreground)',
    primaryColorHover: 'var(--foreground)',
    primaryColorPressed: 'var(--foreground)',
    primaryColorSuppl: 'var(--foreground)',
    invertedColor: 'var(--primary)',

    borderRadius: 'var(--radius-sm)',
    borderRadiusSmall: 'var(--radius-xs)',

    boxShadow1: 'var(--shadow-sm)',
    boxShadow2: 'var(--shadow-md)',
    boxShadow3: 'var(--shadow-popover)',
  },

  Layout: {
    color: 'var(--background)',
    textColor: 'var(--foreground)',
    siderColor: 'var(--background)',
    headerColor: 'var(--background)',
    footerColor: 'var(--background)',
    siderBorderColor: 'var(--border-strong)',
    headerBorderColor: 'var(--border)',
    footerBorderColor: 'var(--border)',
  },

  Menu: {
    color: 'transparent',
    groupTextColor: 'var(--subtle-foreground)',
    itemTextColor: 'var(--muted-foreground)',
    itemTextColorHover: 'var(--foreground)',
    itemTextColorActive: 'var(--foreground)',
    itemTextColorActiveHover: 'var(--foreground)',
    itemTextColorChildActive: 'var(--foreground)',
    itemTextColorChildActiveHover: 'var(--foreground)',
    itemIconColor: 'var(--muted-foreground)',
    itemIconColorHover: 'var(--foreground)',
    itemIconColorActive: 'var(--foreground)',
    itemIconColorActiveHover: 'var(--foreground)',
    itemIconColorChildActive: 'var(--foreground)',
    itemIconColorChildActiveHover: 'var(--foreground)',
    itemIconColorCollapsed: 'var(--muted-foreground)',
    arrowColor: 'var(--muted-foreground)',
    arrowColorHover: 'var(--foreground)',
    arrowColorActive: 'var(--foreground)',
    arrowColorActiveHover: 'var(--foreground)',
    arrowColorChildActive: 'var(--foreground)',
    arrowColorChildActiveHover: 'var(--foreground)',
    itemColorHover: 'var(--accent)',
    itemColorActive: 'var(--accent)',
    itemColorActiveHover: 'var(--accent)',
    itemColorActiveCollapsed: 'var(--accent)',
    dividerColor: 'var(--border)',
    borderRadius: 'var(--radius-xs)',
    itemHeight: '40px',
    itemPadding: '0 12px',
  },

  Card: {
    color: 'var(--card)',
    colorModal: 'var(--card)',
    colorPopover: 'var(--popover)',
    colorEmbedded: 'var(--muted)',
    colorEmbeddedModal: 'var(--muted)',
    colorEmbeddedPopover: 'var(--muted)',
    textColor: 'var(--foreground)',
    titleTextColor: 'var(--foreground)',
    borderColor: 'var(--border)',
    actionColor: 'var(--muted)',
    closeColorHover: 'var(--accent)',
    closeColorPressed: 'var(--accent)',
    closeIconColor: 'var(--muted-foreground)',
    closeIconColorHover: 'var(--foreground)',
    closeIconColorPressed: 'var(--foreground)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-md)',
  },

  Modal: {
    color: 'var(--card)',
    textColor: 'var(--foreground)',
    boxShadow: 'var(--shadow-popover)',
  },

  Drawer: {
    color: 'var(--background)',
    textColor: 'var(--foreground)',
    titleTextColor: 'var(--foreground)',
    closeIconColor: 'var(--muted-foreground)',
    closeIconColorHover: 'var(--foreground)',
    closeIconColorPressed: 'var(--foreground)',
    closeColorHover: 'var(--accent)',
    closeColorPressed: 'var(--accent)',
    closeBorderRadius: 'var(--radius-xs)',
    boxShadow: 'var(--shadow-drawer)',
  },

  Button: {
    textColor: 'var(--foreground)',
    textColorHover: 'var(--foreground)',
    textColorPressed: 'var(--foreground)',
    textColorFocus: 'var(--foreground)',
    textColorDisabled: 'var(--disabled-foreground)',
    color: 'var(--card)',
    colorHover: 'var(--muted)',
    colorPressed: 'var(--muted)',
    colorFocus: 'var(--muted)',
    colorDisabled: 'var(--muted)',
    border: '1px solid var(--border)',
    borderHover: '1px solid var(--muted-foreground)',
    borderPressed: '1px solid var(--foreground)',
    borderFocus: '1px solid var(--foreground)',
    borderDisabled: '1px solid var(--border)',
    boxShadowFocus: '0 0 0 2px var(--ring)',

    // primary 类型沿用项目既有观感：静止是二级文字色，交互时收敛到一级文字色
    colorPrimary: 'var(--muted-foreground)',
    colorHoverPrimary: 'var(--foreground)',
    colorPressedPrimary: 'var(--foreground)',
    colorFocusPrimary: 'var(--foreground)',
    textColorPrimary: 'var(--primary-foreground)',
    textColorHoverPrimary: 'var(--primary-foreground)',
    textColorPressedPrimary: 'var(--primary-foreground)',
    textColorFocusPrimary: 'var(--primary-foreground)',
    borderPrimary: '1px solid transparent',
    borderHoverPrimary: '1px solid transparent',
    borderPressedPrimary: '1px solid transparent',
    borderFocusPrimary: '1px solid transparent',
    boxShadowFocusPrimary: '0 0 0 2px var(--ring)',

    borderRadiusTiny: 'var(--radius-xs)',
    borderRadiusSmall: 'var(--radius-xs)',
    borderRadiusMedium: 'var(--radius-sm)',
    borderRadiusLarge: 'var(--radius-sm)',
  },

  Input: {
    color: 'var(--input-background)',
    colorDisabled: 'var(--muted)',
    colorFocus: 'var(--input-background)',
    textColor: 'var(--foreground)',
    textColorDisabled: 'var(--disabled-foreground)',
    placeholderColor: 'var(--subtle-foreground)',
    placeholderColorDisabled: 'var(--disabled-foreground)',
    caretColor: 'var(--foreground)',
    border: '1px solid var(--input)',
    borderHover: '1px solid var(--muted-foreground)',
    borderFocus: '1px solid var(--foreground)',
    borderDisabled: '1px solid var(--border)',
    boxShadowFocus: '0 0 0 2px var(--ring)',
    clearColor: 'var(--subtle-foreground)',
    clearColorHover: 'var(--muted-foreground)',
    clearColorPressed: 'var(--foreground)',
    iconColor: 'var(--subtle-foreground)',
    iconColorHover: 'var(--muted-foreground)',
    iconColorPressed: 'var(--foreground)',
    countTextColor: 'var(--subtle-foreground)',
    suffixTextColor: 'var(--muted-foreground)',
    loadingColor: 'var(--muted-foreground)',
    borderRadius: 'var(--radius-sm)',
  },

  Select: {
    menuBoxShadow: 'var(--shadow-popover)',
    peers: {
      InternalSelection: {
        color: 'var(--input-background)',
        colorDisabled: 'var(--muted)',
        colorActive: 'var(--input-background)',
        textColor: 'var(--foreground)',
        textColorDisabled: 'var(--disabled-foreground)',
        placeholderColor: 'var(--subtle-foreground)',
        placeholderColorDisabled: 'var(--disabled-foreground)',
        caretColor: 'var(--foreground)',
        arrowColor: 'var(--subtle-foreground)',
        arrowColorDisabled: 'var(--disabled-foreground)',
        border: '1px solid var(--input)',
        borderHover: '1px solid var(--muted-foreground)',
        borderActive: '1px solid var(--foreground)',
        borderFocus: '1px solid var(--foreground)',
        boxShadowActive: '0 0 0 2px var(--ring)',
        boxShadowFocus: '0 0 0 2px var(--ring)',
        clearColor: 'var(--subtle-foreground)',
        clearColorHover: 'var(--muted-foreground)',
        clearColorPressed: 'var(--foreground)',
        loadingColor: 'var(--muted-foreground)',
        borderRadius: 'var(--radius-sm)',
      },
      InternalSelectMenu: {
        color: 'var(--popover)',
        optionTextColor: 'var(--foreground)',
        optionTextColorActive: 'var(--foreground)',
        optionTextColorPressed: 'var(--foreground)',
        optionTextColorDisabled: 'var(--disabled-foreground)',
        optionCheckColor: 'var(--foreground)',
        optionColorPending: 'var(--accent)',
        optionColorActive: 'var(--accent)',
        optionColorActivePending: 'var(--accent)',
        groupHeaderTextColor: 'var(--subtle-foreground)',
        actionDividerColor: 'var(--border)',
        actionTextColor: 'var(--muted-foreground)',
        loadingColor: 'var(--muted-foreground)',
        borderRadius: 'var(--radius-md)',
      },
    },
  },

  Cascader: {
    menuColor: 'var(--popover)',
    menuDividerColor: 'var(--border)',
    menuBorderRadius: 'var(--radius-md)',
    menuBoxShadow: 'var(--shadow-popover)',
    optionArrowColor: 'var(--subtle-foreground)',
    loadingColor: 'var(--muted-foreground)',
    peers: {
      InternalSelection: {
        color: 'var(--input-background)',
        colorDisabled: 'var(--muted)',
        textColor: 'var(--foreground)',
        placeholderColor: 'var(--subtle-foreground)',
        caretColor: 'var(--foreground)',
        arrowColor: 'var(--subtle-foreground)',
        border: '1px solid var(--input)',
        borderHover: '1px solid var(--muted-foreground)',
        borderActive: '1px solid var(--foreground)',
        borderFocus: '1px solid var(--foreground)',
        boxShadowActive: '0 0 0 2px var(--ring)',
        boxShadowFocus: '0 0 0 2px var(--ring)',
        loadingColor: 'var(--muted-foreground)',
        borderRadius: 'var(--radius-sm)',
      },
      InternalSelectMenu: {
        color: 'var(--popover)',
        optionTextColor: 'var(--foreground)',
        optionTextColorActive: 'var(--foreground)',
        optionTextColorPressed: 'var(--foreground)',
        optionTextColorDisabled: 'var(--disabled-foreground)',
        optionCheckColor: 'var(--foreground)',
        optionColorPending: 'var(--accent)',
        optionColorActive: 'var(--accent)',
        optionColorActivePending: 'var(--accent)',
        groupHeaderTextColor: 'var(--subtle-foreground)',
        actionDividerColor: 'var(--border)',
        loadingColor: 'var(--muted-foreground)',
        borderRadius: 'var(--radius-md)',
      },
    },
  },

  Dropdown: {
    color: 'var(--popover)',
    optionTextColor: 'var(--foreground)',
    optionTextColorHover: 'var(--foreground)',
    optionTextColorActive: 'var(--foreground)',
    optionTextColorChildActive: 'var(--foreground)',
    optionColorHover: 'var(--accent)',
    optionColorActive: 'var(--accent)',
    groupHeaderTextColor: 'var(--subtle-foreground)',
    dividerColor: 'var(--border)',
    prefixColor: 'var(--subtle-foreground)',
    suffixColor: 'var(--subtle-foreground)',
    borderRadius: 'var(--radius-md)',
  },

  Popover: {
    color: 'var(--popover)',
    textColor: 'var(--foreground)',
    dividerColor: 'var(--border)',
    boxShadow: 'var(--shadow-popover)',
    borderRadius: 'var(--radius-md)',
  },

  // 全站统一反色气泡，不随背景色变化
  Tooltip: {
    color: 'var(--primary)',
    textColor: 'var(--primary-foreground)',
    boxShadow: 'var(--shadow-md)',
    borderRadius: 'var(--radius-sm)',
  },

  Scrollbar: {
    color: 'var(--scrollbar)',
    colorHover: 'var(--scrollbar-hover)',
  },

  Checkbox: {
    color: 'var(--card)',
    colorChecked: 'var(--primary)',
    colorDisabled: 'var(--muted)',
    colorDisabledChecked: 'var(--muted)',
    textColor: 'var(--foreground)',
    textColorDisabled: 'var(--disabled-foreground)',
    checkMarkColor: 'var(--primary-foreground)',
    checkMarkColorDisabled: 'var(--disabled-foreground)',
    checkMarkColorDisabledChecked: 'var(--disabled-foreground)',
    border: '1px solid var(--input)',
    borderChecked: '1px solid var(--primary)',
    borderFocus: '1px solid var(--foreground)',
    borderDisabled: '1px solid var(--border)',
    borderDisabledChecked: '1px solid var(--border)',
    boxShadowFocus: '0 0 0 2px var(--ring)',
    borderRadius: 'var(--radius-xs)',
  },

  Switch: {
    railColor: 'var(--border)',
    railColorActive: 'var(--primary)',
    loadingColor: 'var(--primary)',
    textColor: 'var(--foreground)',
    iconColor: 'var(--primary-foreground)',
    boxShadowFocus: '0 0 0 2px var(--ring)',
  },

  Message: {
    color: 'var(--muted)',
    textColor: 'var(--foreground)',
    iconColor: 'var(--muted-foreground)',
    closeIconColor: 'var(--subtle-foreground)',
    closeIconColorHover: 'var(--foreground)',
    closeIconColorPressed: 'var(--foreground)',
    closeColorHover: 'var(--accent)',
    closeColorPressed: 'var(--accent)',
    boxShadow: 'var(--shadow-md)',
    borderRadius: 'var(--radius-md)',
  },

  // Divider 的颜色变量叫 color，没有 dividerColor
  Divider: {
    color: 'var(--border)',
    textColor: 'var(--muted-foreground)',
  },
}

/**
 * 按主题把 var(--token) 展开成具体值。
 * 圆角变量保持原样不展开 —— 它由 CSS 的 @supports 在平滑曲率下放大，
 * 一旦展开成固定 px 就跟不上曲率了，而圆角也不参与 Naive 的颜色运算。
 */
function materialize(node, tokens) {
  if (typeof node === 'string') {
    return node.replace(/var\(--([\w-]+)\)/g, (whole, name) =>
      name.startsWith('radius') ? whole : (tokens[name] ?? whole),
    )
  }
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, materialize(v, tokens)]))
  }
  return node
}

export const lightThemeOverrides = materialize(baseOverrides, { ...lightTokens, ...staticTokens })
export const darkThemeOverrides = materialize(baseOverrides, { ...darkTokens, ...staticTokens })

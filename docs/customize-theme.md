# 主题与设计规范

全站的颜色、圆角、阴影、层级由 `src/theme` 下的 token 统一提供。组件里不写 CSS 硬覆盖，也不自己套 `NConfigProvider`。

## 三层结构

```
palette.js       基础色阶与强调色 —— 纯色值的唯一来源，不带语义
     ↓
tokens.js        语义 token，分 light / dark 两套，并生成注入 <head> 的 CSS 文本
     ↓
naive-theme.js   语义 token → Naive UI 真实主题变量名的映射
```

只允许上游被下游引用。组件里只能用 `tokens.js` 产出的 CSS 变量（`--background` / `--foreground` 这类），不能直接引用 `palette.js` 的色阶，更不能写死色值。

token 生成的 CSS 由 `vite.config.js` 的 `injectThemeTokens` 插件以 `head-prepend` 注入 `index.html`（不走 `useHead`，否则会被 `scripts/reorder-head.js` 搬走导致 dev 与线上顺序不一致）。`[data-theme="dark"]` 段必须排在 `:root` 段之后 —— 两者特异性相同，靠顺序决胜。

## 怎么改

| 想做的事 | 改哪里 |
| --- | --- |
| 调整某个层级 | `tokens.js` 里对应的语义 token |
| 新增一个颜色 | 先在 `palette.js` 加色值，再在 `tokens.js` 给它一个语义名 |
| 让某个 Naive 组件跟上 | `naive-theme.js` 里把该组件变量映射到语义 token |
| 换主题基色 | 只改 `tokens.js` 里那套主题的 `foreground` / `background` / `card`，派生层级自动跟随 |

## 层级靠透明度派生

文字主次、边框、hover 叠层都由基色 `--foreground` 按 alpha 派生：

- `--foreground` → `--muted-foreground` → `--subtle-foreground` → `--disabled-foreground`
- `--border` → `--border-strong`
- `--accent`（hover / 选中叠层）

**不要**在组件里另调一个灰阶。底色（`--background` / `--card` / `--popover` / `--muted`）、反色块（`--primary`）、强调色（`--highlight` 高亮 / `--destructive` 危险 / `--warning` 警告 / `--success` 成功）用实色 —— 它们一旦半透明，叠层之间会互相透视，层级会失控。

强调色共四类，每类都有配套的 `-foreground`：项目没有主题色，彩色只用于传达状态，不做装饰。

## 圆角

六个档位 `--radius-xs|sm|md|lg|xl|full`（4 / 6 / 8 / 12 / 16 / 9999px）。

全站默认走**平滑曲率圆角**（`corner-shape: squircle`）。支持它的浏览器里半径自动放大 1.75× 以保持视觉等效 —— 这个系数由项目里两处独立实现反推得到（模态框 16→28、Markdown 表格 12→20.4）。不支持的浏览器在解析阶段就丢弃该属性，自动回退到传统 1/4 圆角。

### 什么时候必须回退

**圆角半径达到元素短边一半时，必须同时声明 `corner-shape: round`。** 也就是胶囊（`--radius-full` / `9999px` / `100px`）与圆形（`50%`），以及任何会被浏览器 clamp 到短边一半的写死大半径。

原因是几何上的：`corner-shape` 只改变圆角区域内的曲线形状，**不改变它在边上占据的长度** —— 每个角仍沿边各占 `radius`，所以两角曲线相遇的临界点就是 `2 × radius = 短边`。而 squircle 曲线比圆弧更外扩，在相遇处不会像圆弧那样平滑相切，而是互相挤压，形状就垮了。`9999px` 和 `50%` 会被 clamp 到短边的一半，恰好落在临界点上，所以它们必坏。

常规档位配正常尺寸的元素时，两角之间留有直线段，无需回退 —— 例如 80px 的图标配 22px、iframe 配 18/30px 都在安全区。

新写胶囊或圆形时，就地声明 `corner-shape: round`，或给元素加 `.corner-round`（会一并作用于子元素）。

## 模态框

统一用 `src/components/ui/AppModal.vue`，不要直接写 `<NModal preset="card">`。它接管了此前散落在各处的重复实现：

- 宽度与紧凑高度 —— `max-width` / `max-height-offset`，内部按 640px 断点切紧凑模式（紧凑时固定 `calc(100vh - 120px)`）
- 圆角 —— `.app-modal` class 配 `--radius-xl`，平滑曲率下自动放大，各处不用再写 `@supports`
- 毛玻璃遮罩 —— `blur-mask`。NModal 自带遮罩的 `background-color` 是写死在样式里的，改不了，所以额外叠一层（`--mask-blur` + `--z-blur-mask`）
- 页脚按钮 —— `actions` 数组，变体 `fill` / `outline` / `text` / `danger`；特殊布局才用 `#footer` 插槽

事件一律透传（`update:show` / `close` / `esc` / `after-enter` / `after-leave`）。**内容延迟销毁**（`useModalContent`）与**内容高度过渡**（`useHeightTransition`）解决的是不同问题，不冲突，按需在调用方使用。

## 按钮

通用按钮在 `src/assets/main.css` 的 `.app-btn`：基础 + `--sm`（小一号），变体 `--fill`（主操作，反色块）/ `--outline`（次操作）/ `--text`（弱操作）/ `--danger`（危险）。

模态框页脚由 `AppModal` 的 `actions` 渲染成这组类，页面级按钮直接复用同一套。页面特有的设计（关于页带位移阴影的 `.btn-solid`、隐私横幅反色块内部的变体）留在各自的 scoped 样式里 —— 那些是刻意的。

## 硬编码的守卫

`pnpm lint` 会跑 stylelint（`.stylelintrc.json`），禁止在颜色类属性上直接写 hex 或 rgba，颜色必须走语义 token。

刻意保留的固定色（分享海报的独立配色、第三方品牌色、Minecraft 领域数据、模拟游戏内聊天框的预览舞台、`mask-image` 的 alpha 占位等）用 `stylelint-disable` 就地豁免并写明理由 —— 这样新写的硬编码一定会被拦下，而既有的豁免都带着"为什么"。

## 非颜色 token

`--duration-theme`（0.4s）、`--ease-theme`、`--shadow-sm|md|popover|drawer`，以及 z-index 契约 `--z-mobile-drawer|z-mobile-menu|z-blur-mask`（Naive 弹层从 2000 起自动递增，这几个刻意压在它之下）。

## 验收

`pnpm dev` 后访问 `/dev/palette`：色阶、语义 token、WCAG 对比度矩阵、圆角与阴影、以及 Naive 各组件在深浅两套主题下的实际渲染。

变量名写错时 Naive 会静默忽略，只看色块看不出来，所以改完必须在这里对照组件渲染。组件渲染区用嵌套 `NConfigProvider` + `data-theme` 强制两套主题并排，方便直接对比。

## 四个容易踩的点

1. **CSS 里的 `!important` 会压过 `themeOverrides`**。Naive 的主题变量是写在元素行内 style 上的自定义属性，而作者样式表里带 `!important` 的声明优先级高于行内声明 —— 所以任何 `.n-xxx { border-radius: … !important }` 之类的覆盖都会让对应的 themeOverrides 条目失效。改主题前先在 `src/` 里搜一下有没有针对该组件的 `!important` 覆盖（阶段一清掉的是 `main.css` 里那批，组件内联的容易漏）。
2. **带类型变体的组件，颜色变量是成组的**。`Message` / `Button` / `Tag` / `Alert` 这类组件都有 6 组：无后缀 + `Info` / `Success` / `Error` / `Warning` / `Loading`。**只覆盖无后缀那组不够** —— `message.success()` 走的是 `textColorSuccess` / `colorSuccess`，漏了就会退回 Naive 默认值（深色下它的 `textColor2` 偏灰、`popoverColor` 偏紫，与页面底几乎糊在一起）。加映射前先看该组件 `styles/light.mjs` 里 `self()` 返回了哪些键。

3. **Naive 会对颜色做运算**（`seemly` 的 composite / rgba 解析），直接传 `var()` 会抛 `Invalid color value`。所以 `naive-theme.js` 用 `var()` 书写、再由 `materialize()` 按主题展开成具体值；圆角变量不展开，因为它要跟随平滑曲率的放大。
4. **`corner-shape` 不继承**（规范里 `Inherited: no`），只能逐元素设置，所以 `tokens.js` 在 `@supports` 里用了一条 `*` 规则兜底。

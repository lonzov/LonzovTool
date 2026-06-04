<div style="display:flex;">
  <img src="./public/favicon.ico" alt="小舟工具箱" width="108px">
</div>

# 小舟工具箱

[![Vue 3](https://img.shields.io/badge/Vue_3-4FC08D?logo=vuedotjs&logoColor=fff)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=fff)](https://vitejs.dev/)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D9-F69220?logo=pnpm&logoColor=fff)](https://pnpm.io/)
[![Node](https://img.shields.io/badge/Node-%3E%3D20.19-339933?logo=nodedotjs&logoColor=fff)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue?logo=apache&logoColor=fff)](LICENSE)
[![Vibe Coding](https://img.shields.io/badge/Vibe-Coding-7C3AED?colorA=4B6BFB&colorB=7C3AED)](https://x.com/karpathy/status/1886192184808149383)

一个简洁高效的 Minecraft 基岩版命令工具导航网站，聚合各类命令相关工具、文档与社区资源，其中100%的代码由 LLM 生成。

![首页预览](./docs/image/home.webp)
![标签页（工作站）预览](./docs/image/tap.webp)

## 特点

- 🗂️ **分类清晰**： 将工具分为"在线网站"和"本地工具"两大类，方便快速定位
- 🔎 **智能搜索**： 支持多种搜索引擎一键切换，满足不同搜索需求
- 🌙 **主题切换**： 支持明暗模式自由切换，自动记忆用户偏好
- 📑 **标签页布局**： 快速切换不同工具页，大幅提升效率
- 📱 **响应式布局**： 完美适配桌面端与移动端，提供一致的优质体验
- 🍪 **隐私保护**： Cookie 同意管理、隐私政策透明披露、可选的流量分析
- ⚡ **PWA 支持**： 可安装到桌面，支持离线访问

## 技术栈

| 类别     | 技术                                              |
| -------- | ------------------------------------------------- |
| 框架     | Vue 3、Vite                                       |
| UI 库    | Naive UI                                          |
| 路由     | Vue Router                                        |
| SEO      | @vueuse/head、Puppeteer 预渲染                    |
| PWA      | Service Worker (手动)、Web App Manifest           |
| 图标     | @vicons/fluent、@vicons/ionicons5、@remixicon/vue |
| 工具     | markdown-it、nprogress                            |
| 代码质量 | ESLint、Oxlint、Oxfmt                             |

## 特别鸣谢

- **[命令模拟器](https://github.com/missing244/Command_Simulator/)**：execute 语法转换逻辑参考了此项目，特殊符号的符号图片也是由该项目整理。
- **[Webstack网址导航](https://github.com/WebStackPage/WebStackPage.github.io)**： 首页布局参考了此项目。
- **[Mizuki](https://github.com/LyraVoid/Mizuki)**： 部分 UI/UX 效果参考了此项目。
- **[Minecraft 格式化代码渲染器](https://github.com/Spectrollay/minecraft_formatting_code_online)**： T显编辑器 § 颜色代码渲染基于此项目 (MIT)。

## TODO

- [x] ~~**重构T显可视化编辑器**~~
- [ ] **设置页**： 添加全局设置面板，支持标签页行为、性能选项等自定义偏好
- [ ] **自定义性能选项**： 允许自定义控制较为影响性能的功能是否启用，如模糊、部分动画等
- [ ] **站外链接嵌入**： 允许将站外链接以 iframe 形式在标签页中打开，拓展工具工作流
- [ ] **架构优化**： 抽取公共模块与组合式函数，消除跨文件的重复逻辑，优化项目结构
- [x] ~~移除 Herobrine~~

## 开发

```bash
pnpm install          # 安装依赖

pnpm dev              # 启动开发服务器

pnpm build            # 构建生产版本
pnpm preview          # 预览构建结果

pnpm lint             # 代码检查
pnpm format           # 代码格式化
```

> Node.js >= 20.19.0 或 >= 22.12.0

---

<details>
<summary>📂 项目结构（面向 AI Agent 维护）</summary>

项目结构描述已迁移至 YML 文件，详见 [docs/project-structure.yml](docs/project-structure.yml)。

</details>

<details>
<summary>⚙️ 核心实现机制（面向 AI Agent 维护）</summary>

### SEO 预渲染

- **目的**：为爬虫提供完整的页面内容，提升搜索引擎收录效果。
- **实现**：
  - `vite build` 完成后运行 `scripts/generate-seo.js`，自动从路由配置中提取所有公开页面路径生成 `sitemap.xml` 和 `robots.txt`。
  - 随后执行 `scripts/prerender.js`，使用 Puppeteer **并发**爬取自动检测到的路由，等待异步组件完全渲染后生成静态 HTML。
- **关键细节**：
  - 并发控制（默认 5 个路由同时渲染），大幅缩短构建时间。
  - 等待 `router.isReady()` 和 `defineAsyncComponent` 解析完成，确保工具页面内容完整。
  - 重新注入 `#loading-overlay`，保持真实用户访问时的加载动画体验。
  - 清空 localStorage 隔离，避免页面间缓存污染。
  - 输出预渲染总耗时统计。

### 加载动画（Loading Overlay）

- **目的**：覆盖 HTML 渲染到 JavaScript 加载完成的中间态，避免用户看到样式不完整的页面。
- **实现**：
  - `index.html` 内嵌 `#loading-overlay`，包含旋转图标和"LOADING…"文本。
  - `main.js` 中 Vue 应用挂载后，为 `#loading-overlay` 添加 `.hidden` 类触发淡出动画，420ms 后移除元素。
  - 预渲染时重新注入该元素，确保静态 HTML 也包含加载遮罩。

### 页面切换与滚动行为

- **桌面端 & 移动端**：统一使用 Naive UI 的 `NScrollbar` 组件管理滚动（桌面端 `desktopScrollbar`、移动端 `mobileScrollbar`），通过 `scrollTo()` 控制。
- **逻辑**：同页面切换（如首页点击首页）使用平滑滚动（`behavior: 'smooth'`），跨页面切换瞬间回顶（`behavior: 'auto'`）。
- **浏览器 scrollRestoration 禁用**：在 `main.js` 中设置 `history.scrollRestoration = 'manual'`，防止浏览器自动恢复滚动位置覆盖手动控制。

### SEO Head 管理

- **目的**：每个路由页面动态设置 `<title>`、`<meta name="description">`、`<meta name="keywords">`，提升搜索引擎收录效果。
- **实现**：基于 `@vueuse/head` 插件，在 `router.afterEach` 中根据路由 `meta` 或动态工具页映射自动更新 head 标签。
- **静态路由 meta**：直接在路由配置中声明 `meta.title / description / keywords`（首页、文档页、提交页）。
- **动态工具页映射**：`/c/:path` 路径通过 `TOOL_META_MAP` 按 path slug 匹配对应 SEO 信息（艺术字、T显动画、T显编辑器、语法转换、特殊符号、RawJSON 编辑器）。

### 工作区标签系统

- **功能**：多工具页签管理，支持拖拽排序、关闭、持久化存储。
- **组件**：`WorkspaceView.vue` 根据当前路由参数动态加载对应工具组件（`ArtTextTool.vue`、`TrAnimationTool.vue`、`ExecuteTool.vue`、`FuhaoTool.vue`、`RawJsonTool.vue`）。
- **路径归一化**：`getComponent()` 方法对路径进行归一化处理（移除末尾斜杠），确保路由匹配准确。

### 隐私与 Cookie 管理

- **PrivacyBanner.vue**：隐私横幅与 Cookie 设置弹窗，管理用户同意选项（必要 Cookie、分析 Cookie）。
- **Footer.vue**：页脚组件，显示版权信息、运行时间、站点监控、隐私政策链接和"更新 Cookie 选项"入口。
- **两者关系**：独立组件，功能互补。Footer 提供隐私政策入口和 Cookie 设置触发；PrivacyBanner 处理首次访问的同意横幅和详细设置弹窗。

### PWA 与 Service Worker 缓存

- **技术方案**：纯手写 Service Worker（`public/sw.js`），不依赖任何构建插件。
- **预缓存**：无预缓存，所有资源运行时按需缓存。首次成功访问后 index.html 会被写入 INDEX_KEY 固定 key 作为离线 SPA shell。
- **缓存策略**（全局缓存优先，先让用户用上再管更新）：
  - 导航请求：StaleWhileRevalidate（有缓存立即返回 + 后台静默更新），离线回退到 SPA 诊断页（`OfflineDiagnostic.vue`）
  - 带 hash 的 JS/CSS：CacheFirst（长期缓存）
  - 图片/字体：CacheFirst
  - 其他同源请求：StaleWhileRevalidate
- **离线诊断页**：导航请求失败时，SW 注入 `window.__SW_OFFLINE` 标记后返回缓存中的 `index.html`，Vue App 据此自动路由到 `/offline` 诊断页，展示连接诊断动画并 ping `tool.lonzov.top` + `www.baidu.com` 区分服务端异常 / 网络断开。
- **更新机制**：
  - 检测到新 SW → 通过 `GET_VERSION` 消息获取版本号 → 与 `localStorage.current_sw_version` 比较
  - 1-3 级版本差异（如 v3.0.0 → v3.1.0）：弹出更新确认弹窗（`UpdateDialog.vue`），用户选择立即更新或暂不更新
  - 4+ 级版本差异（如 v3.0.0 → v3.0.0.1）：静默 skipWaiting，下次访问自动生效
- **V2 兼容**：SW 激活时清理 V2 旧缓存（`lonzovtool-cache-*`、`my-app-cache-*`），兼容 V2 消息协议（`GET_VERSION`、`GET_POPUP_DATA`、`SKIP_WAITING`），确保老访客平滑过渡。
- **manifest.json**：`id: "com.lonzovtool.app"` 与 V2 保持一致，避免重复安装。

</details>

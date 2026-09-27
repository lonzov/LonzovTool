# 第三方组件与许可声明

本站的构建与运行使用了以下第三方组件与字体资源。除「是否修改」栏标注为「是」的项目外，所有组件均按其原始许可证原样使用，未作任何改动。完整依赖树（含间接依赖）可通过仓库根目录的 `pnpm-lock.yaml` 查看。

## 一、运行时依赖

| 项目                                                                       | 许可证                 | 是否修改 |
| -------------------------------------------------------------------------- | ---------------------- | -------- |
| [@css-render/vue3-ssr](https://www.npmjs.com/package/@css-render/vue3-ssr) | MIT                    | 否       |
| [@remixicon/vue](https://www.npmjs.com/package/@remixicon/vue)             | Remix Icon License 1.0 | 否       |
| [@unhead/vue](https://www.npmjs.com/package/@unhead/vue)                   | MIT                    | 否       |
| [@vicons/ionicons5](https://www.npmjs.com/package/@vicons/ionicons5)       | MIT                    | 否       |
| [html2canvas](https://www.npmjs.com/package/html2canvas)                   | MIT                    | 否       |
| [localforage](https://www.npmjs.com/package/localforage)                   | Apache-2.0             | 否       |
| [markdown-it](https://www.npmjs.com/package/markdown-it)                   | MIT                    | 否       |
| [naive-ui](https://www.npmjs.com/package/naive-ui)                         | MIT                    | 否       |
| [qrcode](https://www.npmjs.com/package/qrcode)                             | MIT                    | 否       |
| [vite-ssg](https://www.npmjs.com/package/vite-ssg)                         | MIT                    | 否       |
| [vue](https://www.npmjs.com/package/vue)                                   | MIT                    | 否       |
| [vue-router](https://www.npmjs.com/package/vue-router)                     | MIT                    | 否       |

## 二、构建与开发依赖

| 项目                                                                               | 许可证       | 是否修改 |
| ---------------------------------------------------------------------------------- | ------------ | -------- |
| [@eslint/js](https://www.npmjs.com/package/@eslint/js)                             | MIT          | 否       |
| [@vicons/fluent](https://www.npmjs.com/package/@vicons/fluent)                     | MIT          | 否       |
| [@vitejs/plugin-vue](https://www.npmjs.com/package/@vitejs/plugin-vue)             | MIT          | 否       |
| [eslint](https://www.npmjs.com/package/eslint)                                     | MIT          | 否       |
| [eslint-config-prettier](https://www.npmjs.com/package/eslint-config-prettier)     | MIT          | 否       |
| [eslint-plugin-oxlint](https://www.npmjs.com/package/eslint-plugin-oxlint)         | MIT          | 否       |
| [eslint-plugin-vue](https://www.npmjs.com/package/eslint-plugin-vue)               | MIT          | 否       |
| [globals](https://www.npmjs.com/package/globals)                                   | MIT          | 否       |
| [node-ssh](https://www.npmjs.com/package/node-ssh)                                 | MIT          | 否       |
| [npm-run-all2](https://www.npmjs.com/package/npm-run-all2)                         | MIT          | 否       |
| [oxfmt](https://www.npmjs.com/package/oxfmt)                                       | MIT          | 否       |
| [oxlint](https://www.npmjs.com/package/oxlint)                                     | MIT          | 否       |
| [pngjs](https://www.npmjs.com/package/pngjs)                                       | MIT          | 否       |
| [postcss-html](https://www.npmjs.com/package/postcss-html)                         | MIT          | 否       |
| [sharp](https://www.npmjs.com/package/sharp)                                       | Apache-2.0   | 否       |
| [stylelint](https://www.npmjs.com/package/stylelint)                               | MIT          | 否       |
| [terser](https://www.npmjs.com/package/terser)                                     | BSD-2-Clause | 否       |
| [vite](https://www.npmjs.com/package/vite)                                         | MIT          | 否       |
| [vite-plugin-vue-devtools](https://www.npmjs.com/package/vite-plugin-vue-devtools) | MIT          | 否       |

## 三、内置的第三方代码

| 项目                                                                                                         | 许可证  | 是否修改                                       |
| ------------------------------------------------------------------------------------------------------------ | ------- | ---------------------------------------------- |
| [MCFC](https://github.com/Spectrollay/minecraft_formating_code_online)（内置于 `src/vendor/mcfc/`）          | MIT     | 是（适配为 ES module，扩展导出接口）           |
| [矩阵方块 T显编译器](https://github.com/mc-str/MC-JZFK)（沿用至 `src/composables/useRawJsonEditor.js`）      | GPL-3.0 | 是（沿用颜色数据表与校验、导入解析逻辑）       |
| [命令模拟器](https://github.com/missing244/Command_Simulator)（译入 `src/components/tools/ExecuteTool.vue`） | MIT     | 是（旧版 execute 语法升级逻辑译为 JavaScript） |

> **MCFC：** 上游仓库已无法访问，本项目副本取自此前版本。MIT 全文见 `src/vendor/mcfc/LICENSE`，`mcfc.js` 与 `mcfc.css` 顶部各保留完整的版权与许可声明。

> **矩阵方块 T显编译器：** 上表沿用部分以 GPL-3.0 开源。本项目已另行取得原作者授权（含再授权权），故本仓库整体仍按 Apache-2.0 分发；其余实现为自行编写。

> **命令模拟器：** MIT 全文见 `LICENSES/MIT.txt`，版权声明见 `ExecuteTool.vue` 头部。

## 四、下载页的第三方工具

以下工具均由第三方作者开发，本站不持有其版权。**本站不代替原作者向任何人授权：第三方如需二次分发这些工具，须自行取得原作者许可。**

| 工具             | 作者           | 许可与分发依据                                                                                                  |
| ---------------- | -------------- | --------------------------------------------------------------------------------------------------------------- |
| 指令音符盒       | QQ3762024811   | 已获作者授权分发；上游仓库 [Music-Minecraft](https://github.com/xukun142857/Music-Minecraft) 未声明许可证       |
| 指令语法高亮包   | 胧\_CB         | 上游仓库 [syntax-by-mt-mtsx](https://github.com/long-or/syntax-by-mt-mtsx) 以 MIT 许可开源，本站依 MIT 条款分发 |
| AIEX-FMBE 编辑器 | 波登可可       | 基于 EX-FMBE 编辑器二次开发；已获作者授权分发                                                                   |
| HOSDLA 工具箱    | 红令颠佬HOSDLA | 已获作者授权分发                                                                                                |

## 五、字体资源

| 字体                                                                                           | 许可证 / 权利归属                                                                                                                               | 是否修改                                                                                                                     |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| unifontdianzhenhei-16.0.04.woff2（基于 [GNU Unifont](https://unifoundry.com/unifont/) 点阵黑） | **复合权利**：基础字形受 GNU GPL-2.0-or-later / SIL OFL-1.1 约束；U+FF00–U+FFFF 替换字形版权归 Mojang Synergies AB / Microsoft Corporation 所有 | 是（全部有墨迹字形左沿对齐落笔点；步进改写为「墨迹宽 + 间距」；U+FF00–U+FFFF 全角段字形替换为游戏资源包中的 `glyph_FF.png`） |
| mc-symbols.woff2（本项目自行构建）                                                             | 项目自建产物，字形取自 Minecraft 游戏内素材，版权归 Mojang Synergies AB / Microsoft Corporation 所有                                            | 是（由游戏字形图生成，补全私有区符号字形）                                                                                   |
| harmonyos-hollow.woff2（基于 HarmonyOS Sans SC Bold）                                          | HarmonyOS Sans Fonts License                                                                                                                    | 是（子集化）                                                                                                                 |

> **⚠️ 关于 unifontdianzhenhei-16.0.04.woff2 的权利分割声明：**
> 该字体文件是一个**权利复合体（Composite Work）**。其中原始 Unifont 字形受 GPL/OFL 开源协议保护；但为了实现 Minecraft 游戏内特殊符号的完美渲染，本项目将 U+FF00–U+FFFF 区段的字形替换为了 Minecraft 游戏资源包中的 `glyph_FF.png`。
> **请注意：** 混入的 Minecraft 素材版权归 Mojang/Microsoft 所有，**不属于且 incompatible（不兼容）于 GPL/OFL 开源许可**。因此，该 `.woff2` 文件**整体不可被视为纯粹的开源字体**进行二次提取、分发或商业使用。第三方若需复用该字体文件，必须遵守 [Minecraft Usage Guidelines](https://www.minecraft.net/en-us/usage-guidelines) 对其中包含的 MC 素材的限制。

> **关于 harmonyos-hollow.woff2：**
> 本项目为实现 Web 端性能优化，对 HarmonyOS Sans 字体进行了必要的技术性子集化处理。该处理仅涉及字符集的裁剪，未对任何字形轮廓、设计风格进行修改或二次创作。本项目尊重并遵守 HarmonyOS Sans 字体许可协议，若权利人认为该处理方式超出许可范围，请联系我们要取官方替代方案或立即移除。

---

除上述第三方组件外，本站的页面设计、文档、下载页介绍及整体数据编排结构由 **小舟工具箱** 原创，采用 **CC BY-NC 4.0** 协议授权（含 Minecraft 素材隔离条款）。完整授权条款见仓库根目录的 [LICENSE](https://github.com/lonzov/LonzovTool/blob/main/LICENSE)。

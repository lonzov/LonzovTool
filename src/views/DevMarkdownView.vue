<script setup>
import MarkdownRenderer from '../components/MarkdownRenderer.vue'

/**
 * Markdown 排版预览 —— 本次重构只把颜色接进 token 体系，排版尺度与外观未动。
 * 这一页作为基线留存，将来重做排版时在此对照迭代。
 */
const sample = `# 一级标题 Heading 1

## 二级标题 Heading 2

### 三级标题 Heading 3

#### 四级标题 Heading 4

正文段落：这是一段用于观察行高、字号与段间距的文字，混排 English words 与 1234 数字，用来看自动盘古之白的效果。下面包含 **加粗**、*斜体*、~~删除线~~ 与 \`行内代码\`。

### 列表

- 无序列表第一项
- 无序列表第二项
  - 嵌套子项
  - 嵌套子项
- 无序列表第三项

1. 有序列表第一项
2. 有序列表第二项
3. 有序列表第三项

### 引用

> 这是一段引用文字，用来观察左侧强调竖线的颜色与缩进。
> 引用可以有多行。

### 代码

行内代码 \`const a = 1\` 与代码块：

\`\`\`js
function greet(name) {
  return \`Hello, \${name}\`
}
\`\`\`

\`\`\`bash
pnpm dev
pnpm build
\`\`\`

### 表格

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| \`mode\` | string | \`auto\` | 主题模式 |
| \`size\` | number | \`16\` | 字号 |
| \`disabled\` | boolean | \`false\` | 是否禁用 |

### 链接与分割线

这是一个[站内链接](/docs)与一个[站外链接](https://www.naiveui.com)。

---

### 流光文字

<span class="shimmer">蓝紫科技流光</span>

<span class="shimmer-bluered">蓝红光谱流光</span>

<span class="shimmer-redgreen">红绿跃迁流光</span>

### 图片

![站点预览](/app-icon/ios/512.png)

引用块与分割线相邻时、标题相邻时的间距表现也一并在此观察。
`
</script>

<template>
  <div class="dev-md">
    <header class="dev-md-head">
      <div>
        <h1>Markdown 排版预览</h1>
        <p>
          开发专用页。当前渲染的是<b>重构前的基线</b> —— 颜色已接入 token，排版尺度与外观保持原样。
          将来重做排版时在此页对照迭代。
        </p>
      </div>
      <RouterLink class="dev-md-link" to="/dev/palette">← 返回调色板</RouterLink>
    </header>

    <article class="dev-md-body">
      <MarkdownRenderer :raw="sample" />
    </article>
  </div>
</template>

<style scoped>
.dev-md {
  color: var(--foreground);
}

.dev-md-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 28px;
}

.dev-md-head h1 {
  font-size: 24px;
  margin-bottom: 8px;
}

.dev-md-head p {
  color: var(--muted-foreground);
  max-width: 640px;
  line-height: 1.7;
  font-size: 14px;
}

.dev-md-link {
  color: var(--foreground);
  text-decoration: none;
  border-bottom: 1px dashed var(--border-strong);
  padding-bottom: 2px;
  white-space: nowrap;
  font-size: 14px;
}

.dev-md-link:hover {
  border-bottom-style: solid;
}

.dev-md-body {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--card);
  padding: 24px 28px;
}
</style>

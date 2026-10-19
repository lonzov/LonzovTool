/**
 * 标题锚点 id 生成器。
 * 保留中英文与数字，其余标点压成连接符；同一文档内重名标题追加序号，
 * 保证目录项与滚动目标一一对应。
 */
export function createHeadingSlugger() {
  const used = new Map()

  return (text) => {
    const base =
      String(text)
        .replace(/<[^>]*>/g, '')
        .trim()
        .toLowerCase()
        .replace(/[^\p{Letter}\p{Number}\s_-]/gu, '')
        .replace(/[\s]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-+|-+$/g, '') || 'section'

    const seen = used.get(base) || 0
    used.set(base, seen + 1)
    return seen === 0 ? base : `${base}-${seen}`
  }
}

<script setup>
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'

const props = defineProps({
  content: { type: String, default: '' },
})

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
})

const defaultLinkOpen = md.renderer.rules.link_open
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const href = token.attrGet('href') || ''
  if (!/^https?:\/\//i.test(href) && !href.startsWith('/')) {
    token.attrSet('href', '#')
  }
  token.attrSet('target', '_blank')
  token.attrSet('rel', 'noopener noreferrer')
  return defaultLinkOpen
    ? defaultLinkOpen(tokens, idx, options, env, self)
    : self.renderToken(tokens, idx, options)
}

const defaultImage = md.renderer.rules.image
md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const src = token.attrGet('src') || ''
  if (!/^https:\/\//i.test(src) && !src.startsWith('/uploads/')) {
    return md.utils.escapeHtml(token.content || '')
  }
  token.attrSet('loading', 'lazy')
  token.attrSet('decoding', 'async')
  return defaultImage
    ? defaultImage(tokens, idx, options, env, self)
    : self.renderToken(tokens, idx, options)
}

const html = computed(() => md.render(props.content || ''))
</script>

<template>
  <div class="announcement-md" v-html="html" />
</template>

<style scoped>
.announcement-md {
  overflow-wrap: anywhere;
  color: var(--foreground);
  font-size: 0.92rem;
  line-height: 1.8;
  transition: color 0.4s ease;
}

.announcement-md :deep(h1),
.announcement-md :deep(h2),
.announcement-md :deep(h3) {
  margin: 1.2em 0 0.5em;
  line-height: 1.35;
}

.announcement-md :deep(h1) {
  font-size: 1.25rem;
}

.announcement-md :deep(h2) {
  font-size: 1.12rem;
}

.announcement-md :deep(h3) {
  font-size: 1rem;
}

.announcement-md :deep(p) {
  margin: 0.6em 0;
}

.announcement-md :deep(a) {
  color: var(--primary);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.announcement-md :deep(ul),
.announcement-md :deep(ol) {
  margin: 0.6em 0;
  padding-left: 1.4em;
}

.announcement-md :deep(blockquote) {
  margin: 0.8em 0;
  padding-left: 12px;
  border-left: 3px solid var(--border-strong);
  color: var(--muted-foreground);
}

.announcement-md :deep(code) {
  padding: 0.15em 0.35em;
  border-radius: var(--radius-xs);
  background: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.86em;
}

.announcement-md :deep(pre) {
  margin: 0.8em 0;
  padding: 12px;
  overflow-x: auto;
  border-radius: var(--radius-md);
  background: var(--muted);
}

.announcement-md :deep(pre code) {
  padding: 0;
  background: transparent;
}

.announcement-md :deep(img) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0.8em auto;
  border-radius: var(--radius-md);
}
</style>

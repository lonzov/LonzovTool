<script setup>
import { useHead } from '@vueuse/head'

useHead({
  title: '页面不存在 - 小舟工具箱',
  meta: [
    { name: 'robots', content: 'noindex' },
  ],
})
</script>

<template>
  <div class="not-found">
    <div class="nf-card">
      <div class="nf-code">404</div>
      <h1 class="nf-title">页面不存在</h1>
      <p class="nf-desc">您访问的页面不存在或已被移除</p>
      <a href="/" class="nf-btn">返回首页</a>
    </div>
  </div>
</template>

<style scoped>
.not-found {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 40px 20px;
}

.nf-card {
  text-align: center;
  max-width: 420px;
}

.nf-code {
  font-size: 7rem;
  font-weight: 800;
  color: var(--text-primary);
  opacity: 0.12;
  line-height: 1;
  margin-bottom: 8px;
  transition: color 0.4s ease;
  user-select: none;
}

.nf-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 10px;
  letter-spacing: -0.02em;
  transition: color 0.4s ease;
}

.nf-desc {
  font-size: 0.95rem;
  color: color-mix(in srgb, var(--text-primary) 65%, transparent);
  margin: 0 0 28px;
  line-height: 1.5;
  transition: color 0.4s ease;
}

.nf-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 38px;
  padding: 0 24px;
  border-radius: 100px;
  font-size: 0.9rem;
  font-weight: 500;
  border: none;
  text-decoration: none;
  transition: opacity 0.2s ease, transform 0.2s ease, background-color 0.4s ease, color 0.4s ease;
}

[data-theme="light"] .nf-btn {
  background: #1A1A1A;
  color: #fff;
}

[data-theme="dark"] .nf-btn {
  background: #fff;
  color: #1A1A1A;
}

.nf-btn:hover {
  opacity: 0.85;
  transform: translateY(-1px);
}

@media (max-width: 480px) {
  .nf-code {
    font-size: 5rem;
  }

  .nf-title {
    font-size: 1.25rem;
  }

  .nf-desc {
    font-size: 0.875rem;
  }
}
</style>

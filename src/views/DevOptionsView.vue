<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getDiscreteMessage } from '../utils/discreteMessage.js'
import { confirmDialog } from '../composables/useConfirm.js'

/* ===== 运行环境 ===== */

const isDev = import.meta.env.DEV
const version = ref('')
const swState = ref('检测中…')

/** 版本号以 SW 缓存版本为准：它随每次发布一起变，是运行时唯一可靠的「装了哪一版」标识 */
async function resolveVersion() {
  const cached = localStorage.getItem('current_sw_version')
  if (cached) return cached.startsWith('v') ? cached : `v${cached}`
  try {
    const res = await fetch('/sw.js', { cache: 'no-store' })
    const match = (await res.text()).match(/CACHE_VERSION\s*=\s*'([^']+)'/)
    if (match) return `v${match[1]}`
  } catch { /* 拉不到就留空，页面其它部分照常可用 */ }
  return ''
}

onMounted(async () => {
  // 进页面就先测一次，不用用户再点
  runPing()
  version.value = await resolveVersion()
  if (!('serviceWorker' in navigator)) {
    swState.value = '浏览器不支持'
    return
  }
  const regs = await navigator.serviceWorker.getRegistrations().catch(() => [])
  swState.value = regs.length ? (navigator.serviceWorker.controller ? '已接管' : '已注册，未接管') : '未注册'
})

/* ===== 服务器连通性 =====
   三次取 /api/health 的往返耗时。站点本身有 CDN 缓存，探它测不出后端死活，
   所以这里打的是后端健康检查。 */
const PING_ROUNDS = 3
const SLOW_MS = 1500
const TIMEOUT_MS = 10000

const pings = ref(Array.from({ length: PING_ROUNDS }, () => ({ tone: 'idle', label: '—' })))
const pinging = ref(false)

const TONE_LABEL = { idle: '待测', ok: '正常', warn: '偏慢', error: '异常' }

async function pingOnce() {
  const started = performance.now()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch('/api/health', { cache: 'no-store', signal: ctrl.signal })
    const ms = Math.round(performance.now() - started)
    if (!res.ok) return { tone: 'error', label: `${ms}ms` }
    return { tone: ms >= SLOW_MS ? 'warn' : 'ok', label: `${ms}ms` }
  } catch {
    // abort 与网络失败对用户是同一件事：这次没拿到响应
    return { tone: 'error', label: '超时' }
  } finally {
    clearTimeout(timer)
  }
}

async function runPing() {
  if (pinging.value) return
  pinging.value = true
  pings.value = Array.from({ length: PING_ROUNDS }, () => ({ tone: 'idle', label: '—' }))
  try {
    for (let i = 0; i < PING_ROUNDS; i++) {
      const result = await pingOnce()
      pings.value = pings.value.map((item, index) => (index === i ? result : item))
    }
  } finally {
    pinging.value = false
  }
}

// 三根柱子的高度：前两次等长，第三次略高，整体不超过一行文字的高度
const BAR_HEIGHTS = [10, 10, 14]

const pingTitle = computed(() => {
  const done = pings.value.some((item) => item.tone !== 'idle')
  if (!done) return '点击重新测试'
  const detail = pings.value
    .map((item, index) => `第 ${index + 1} 次 ${TONE_LABEL[item.tone]} ${item.label}`)
    .join(' · ')
  return `${detail}（点击重新测试）`
})

/* ===== 前往 ===== */

const destinations = computed(() => [
  // 调色板只在开发环境注册（见 router 的 import.meta.env.DEV 分支），生产环境给出去只会 404
  ...(isDev
    ? [{ to: '/dev/palette', title: '调色板与设计规范', desc: '主题 token、圆角、组件样式对照' }]
    : []),
  { to: '/console', title: '控制台', desc: '站点内容管理，需要管理员登录' },
  { to: '/changelog', title: '更新日志', desc: '历次发布记录' },
])

/* ===== 调试选项 ===== */

const message = getDiscreteMessage()
const running = ref('')

async function clearLocalStorage() {
  localStorage.clear()
  return '已清除'
}

async function unregisterServiceWorker() {
  if (!('serviceWorker' in navigator)) return '浏览器不支持'
  const regs = await navigator.serviceWorker.getRegistrations()
  await Promise.all(regs.map((reg) => reg.unregister()))
  return `已注销 ${regs.length} 个`
}

async function clearCacheStorage() {
  if (!('caches' in window)) return '浏览器不支持'
  const keys = await caches.keys()
  await Promise.all(keys.map((key) => caches.delete(key)))
  return `已删除 ${keys.length} 个缓存`
}

const KNOWN_DATABASES = ['lonzovtool-rawjson-lang', 'localforage']

async function clearIndexedDB() {
  if (!('indexedDB' in window)) return '浏览器不支持'
  const names =
    typeof indexedDB.databases === 'function'
      ? (await indexedDB.databases()).map((db) => db.name).filter(Boolean)
      : // 不支持枚举的浏览器（Firefox 126 以前）只能按已知库名删
        KNOWN_DATABASES
  await Promise.all(
    names.map(
      (name) =>
        new Promise((resolve) => {
          const request = indexedDB.deleteDatabase(name)
          request.onsuccess = resolve
          request.onerror = resolve
          // 还有连接开着时删除会被阻塞，不能让 Promise 一直悬着
          request.onblocked = resolve
        }),
    ),
  )
  return `已删除 ${names.length} 个数据库`
}

const DEBUG_ACTIONS = [
  {
    key: 'storage',
    title: '清除 Local Storage',
    desc: '设置、收藏、公告已读记录等全部本地偏好',
    confirm: '清除后所有本地设置与收藏都会丢失，且无法恢复。',
    run: clearLocalStorage,
  },
  {
    key: 'sw',
    title: '注销 Service Worker',
    desc: '解除离线缓存接管，刷新后走网络',
    confirm: '注销后本站离线可用性会失效，需重新注册 Service Worker。',
    run: unregisterServiceWorker,
  },
  {
    key: 'cache',
    title: '清除 Cache Storage',
    desc: '删除 SW 写入的全部缓存，包含预缓存资源',
    confirm: '清除后再次访问需要重新下载全部静态资源。',
    run: clearCacheStorage,
  },
  {
    key: 'idb',
    title: '清除 IndexedDB',
    desc: '删除本地数据库（如语言包缓存）',
    confirm: '删除后本地缓存的较大数据（如语言包）需要重新导入。',
    run: clearIndexedDB,
  },
]

async function runAction(action) {
  if (running.value) return
  const confirmed = await confirmDialog({
    title: action.title,
    message: `${action.confirm}\n此操作只影响当前浏览器。`,
    confirmText: '执行',
    danger: true,
  })
  if (!confirmed) return

  running.value = action.key
  try {
    const result = await action.run()
    message?.success(`${action.title}：${result}`)
  } catch (e) {
    message?.error(`${action.title}失败：${e?.message || '未知错误'}`)
  } finally {
    running.value = ''
  }
}
</script>

<template>
  <div class="dev-options">
    <header class="dev-head">
      <div>
        <h1>开发者选项</h1>
        <p>
          在页脚「本站已运行」上连续点击 5 次即可进入本页。这里的操作只作用于当前浏览器，
          不影响站点本身。
        </p>
      </div>
      <RouterLink class="dev-link" to="/">返回首页</RouterLink>
    </header>

    <section class="dev-block">
      <h2>运行环境</h2>
      <dl class="env-grid">
        <div class="env-item">
          <dt>版本号</dt>
          <dd>{{ version || '读取中…' }}</dd>
        </div>
        <div class="env-item">
          <dt>构建环境</dt>
          <dd>{{ isDev ? '开发（vite dev）' : '生产构建' }}</dd>
        </div>
        <div class="env-item">
          <dt>Service Worker</dt>
          <dd>{{ swState }}</dd>
        </div>
      </dl>
    </section>

    <div class="dev-bar" :title="pingTitle" @click="runPing">
      <span class="dev-bar__label">服务器连通性</span>
      <span class="ping-bars">
        <span
          v-for="(item, index) in pings"
          :key="index"
          class="ping-bar"
          :class="`ping-bar--${item.tone}`"
          :style="{ height: `${BAR_HEIGHTS[index]}px` }"
        ></span>
      </span>
    </div>

    <section class="dev-block">
      <h2>前往</h2>
      <div class="dest-grid">
        <RouterLink v-for="item in destinations" :key="item.to" class="dest-card" :to="item.to">
          <span class="dest-title">{{ item.title }}</span>
          <span class="dest-desc">{{ item.desc }}</span>
        </RouterLink>
      </div>
    </section>

    <section class="dev-block">
      <h2>调试选项</h2>
      <p class="dev-hint">以下操作不可撤销，执行后建议刷新页面确认结果。</p>
      <div class="debug-list">
        <div v-for="action in DEBUG_ACTIONS" :key="action.key" class="debug-row">
          <div class="debug-info">
            <span class="debug-title">{{ action.title }}</span>
            <span class="debug-desc">{{ action.desc }}</span>
          </div>
          <button
            class="app-btn app-btn--outline app-btn--sm"
            type="button"
            :disabled="!!running"
            @click="runAction(action)"
          >
            {{ running === action.key ? '执行中…' : '执行' }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dev-options {
  padding: 8px 0 48px;
  color: var(--foreground);
}

.dev-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

.dev-head h1 {
  font-size: 24px;
  margin: 0 0 8px;
}

.dev-head p {
  margin: 0;
  max-width: 640px;
  color: var(--muted-foreground);
  font-size: 0.86rem;
  line-height: 1.7;
}

.dev-link {
  flex: none;
  color: var(--foreground);
  font-size: 0.82rem;
  text-decoration: none;
  border-bottom: 1px dashed var(--border-strong);
  padding-bottom: 2px;
  transition: color 0.2s ease, border-color 0.2s ease;
}

.dev-link:hover {
  color: var(--muted-foreground);
}

.dev-block {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 16px 18px 18px;
  margin-bottom: 16px;
  transition: background-color 0.4s ease, border-color 0.4s ease;
}

.dev-block h2 {
  margin: 0 0 12px;
  font-size: 0.95rem;
  font-weight: 600;
}

.dev-hint {
  margin: 0 0 12px;
  color: var(--subtle-foreground);
  font-size: 0.78rem;
  line-height: 1.7;
}

.dev-hint code {
  padding: 1px 5px;
  border-radius: var(--radius-xs);
  background: var(--muted);
  font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
  font-size: 0.92em;
}

/* ===== 运行环境 ===== */
.env-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px 16px;
  margin: 0;
}

.env-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.env-item dt {
  color: var(--subtle-foreground);
  font-size: 0.74rem;
}

.env-item dd {
  margin: 0;
  color: var(--foreground);
  font-size: 0.86rem;
  font-variant-numeric: tabular-nums;
}

/* ===== 连通性 =====
   与设置页的独立横条同形：一行一个标签，指示器贴行末。 */
.dev-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
  padding: 18px 20px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  color: var(--foreground);
  font-size: 0.92rem;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.4s ease, border-color 0.4s ease, opacity 0.2s ease;
}

.dev-bar:hover {
  opacity: 0.85;
}

.dev-bar__label {
  min-width: 0;
}

/* 三根柱子：前两次等长、第三次略高，横向按中轴对齐，整体高度不超过一行字 */
.ping-bars {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex: none;
  height: 14px;
}

.ping-bar {
  width: 4px;
  border-radius: var(--radius-full);
  corner-shape: round;
  background: var(--border);
  transition: background-color 0.3s ease, box-shadow 0.3s ease;
}

.ping-bar--ok {
  background: var(--success);
  box-shadow: 0 0 6px color-mix(in srgb, var(--success) 45%, transparent);
}

.ping-bar--warn {
  background: var(--warning);
  box-shadow: 0 0 6px color-mix(in srgb, var(--warning) 45%, transparent);
}

.ping-bar--error {
  background: var(--destructive);
  box-shadow: 0 0 6px color-mix(in srgb, var(--destructive) 45%, transparent);
}

/* ===== 前往 ===== */
.dest-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
}

.dest-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--muted);
  color: inherit;
  text-decoration: none;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.dest-card:hover {
  border-color: var(--border-strong);
  background: var(--accent);
}

.dest-title {
  color: var(--foreground);
  font-size: 0.86rem;
  font-weight: 500;
}

.dest-desc {
  color: var(--subtle-foreground);
  font-size: 0.74rem;
  line-height: 1.5;
}

/* ===== 调试选项 ===== */
.debug-list {
  display: flex;
  flex-direction: column;
}

.debug-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-top: 1px solid var(--border);
}

.debug-row:first-child {
  border-top: none;
  padding-top: 0;
}

.debug-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.debug-title {
  color: var(--foreground);
  font-size: 0.86rem;
}

.debug-desc {
  color: var(--subtle-foreground);
  font-size: 0.74rem;
  line-height: 1.5;
}
</style>

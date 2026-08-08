<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import NProgress from 'nprogress'

const state = ref('diagnosing') // 'diagnosing' | 'server-ok' | 'server-error' | 'network-error'
const latency = ref(null)
const retryCountdown = ref(0)

let countdownTimer = null

/** 参考 v2/detect 的 ping 方案：fetch no-cors 测量延迟 */
async function pingTest(url) {
  const TIMEOUT = 10000
  const MAX_ATTEMPTS = 3
  const results = []
  let consecutiveFailures = 0

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT)
      const startTime = Date.now()
      await fetch(`https://${url}`, { mode: 'no-cors', signal: controller.signal, cache: 'no-store' })
      const ms = Date.now() - startTime
      clearTimeout(timeoutId)
      if (!controller.signal.aborted) {
        results.push(ms)
        consecutiveFailures = 0
      } else {
        consecutiveFailures++
        if (i === 1 && consecutiveFailures === 2) break
      }
    } catch {
      consecutiveFailures++
      if (i === 1 && consecutiveFailures === 2) break
    }
  }

  if (results.length > 0) {
    const avg = results.reduce((a, b) => a + b, 0) / results.length
    latency.value = Math.round(avg)
    return true
  }
  return false
}

async function runDiagnostic() {
  state.value = 'diagnosing'
  latency.value = null

  // 先 ping 自己的服务器
  const serverOk = await pingTest('tool.lonzov.top')
  if (serverOk) {
    // 服务器可达，网络也正常，可能是临时加载失败
    state.value = 'server-ok'
  } else {
    // 服务器不可达，再 ping 外网判断是否本地断网
    const internetOk = await pingTest('www.baidu.com')
    if (internetOk) {
      // 外网通但自己的服务器不通 → 服务端异常
      state.value = 'server-error'
    } else {
      // 外网也不通 → 网络问题
      state.value = 'network-error'
    }
  }

  startRetryCountdown()
}

function startRetryCountdown() {
  retryCountdown.value = 30
  clearInterval(countdownTimer)
  countdownTimer = setInterval(() => {
    retryCountdown.value--
    if (retryCountdown.value <= 0) {
      clearInterval(countdownTimer)
      runDiagnostic()
    }
  }, 1000)
}

function retryNow() {
  clearInterval(countdownTimer)
  runDiagnostic()
}

function goHome() {
  window.location.href = '/'
}

onMounted(() => {
  // 强制清除 NProgress 进度条（无论从哪个路径进入离线页）
  NProgress.done()
  const bar = document.querySelector('#nprogress .bar')
  if (bar) bar.style.zIndex = '9999999'
  runDiagnostic()
})

onUnmounted(() => {
  clearInterval(countdownTimer)
})
</script>

<template>
  <div class="offline-diagnostic">
    <div class="diagnostic-loader-wrapper">
      <div class="diagnostic-loader" :class="{
        'diagnostic-loader--ok': state === 'server-ok',
        'diagnostic-loader--error': state === 'server-error' || state === 'network-error'
      }"></div>
    </div>
    <div class="diagnostic-text">
      <template v-if="state === 'diagnosing'">连接失败，正在诊断……</template>
      <template v-else-if="state === 'server-ok'">测试通过，建议返回首页重试</template>
      <template v-else-if="state === 'server-error'">无法连接至服务器，请稍后再试<br><a class="offline-link" href="https://stats.uptimerobot.com/E0cvH6yiGq" target="_blank" rel="noopener noreferrer">点击前往状态监控</a></template>
      <template v-else>请检查网络后重试</template>
    </div>
    <div v-if="state !== 'diagnosing'" class="diagnostic-actions">
      <template v-if="state === 'server-ok'">
        <button class="offline-btn btn-fill" @click="goHome">返回首页</button>
        <button class="offline-btn btn-outline" @click="retryNow">
          重新检测{{ retryCountdown > 0 ? ` (${retryCountdown}s)` : '' }}
        </button>
      </template>
      <template v-else>
        <button class="offline-btn btn-fill" @click="retryNow">
          重新检测{{ retryCountdown > 0 ? ` (${retryCountdown}s)` : '' }}
        </button>
        <button class="offline-btn btn-outline" @click="goHome">返回首页</button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.offline-diagnostic {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.6em;
  padding: 14em 0;
}

.diagnostic-loader-wrapper {
  font-size: clamp(7px, 1.75vw, 12px);
  line-height: 0;
}

.diagnostic-loader {
  width: 50px;
  aspect-ratio: 1;
  border-radius: 50%;
  border: 8px solid;
  animation: diagnostic-spin 1s infinite;
  filter: drop-shadow(0 0 8px rgba(128, 140, 160, 0.4));
}

[data-theme='dark'] .diagnostic-loader {
  border-color: #e7e7e7 #ffffff00;
}

[data-theme='light'] .diagnostic-loader {
  border-color: #000000 #ffffff00;
}

.diagnostic-loader--error {
  animation: none;
  border-color: #E46962 #ffffff00;
  filter: drop-shadow(0 0 8px rgba(228, 105, 98, 0.4));
}

.diagnostic-loader--ok {
  animation: none;
  border-color: #63E469 #ffffff00;
  filter: drop-shadow(0 0 8px rgba(99, 228, 105, 0.4));
}

@keyframes diagnostic-spin {
  to { transform: rotate(0.5turn); }
}

.diagnostic-text {
  color: var(--text-secondary);
  font-size: 1em;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-align: center;
}

/* 超链接样式（搬自 Markdown 组件） */
.diagnostic-text .offline-link {
  color: var(--text-primary);
  text-decoration: none;
  position: relative;
  padding-bottom: 2px;
  cursor: pointer;
  display: inline-block;
  vertical-align: baseline;
  background: none;
}

.diagnostic-text .offline-link::before {
  content: '';
  display: block;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 5px;
  height: 1px;
  background-image: repeating-linear-gradient(to right,
      color-mix(in srgb, var(--text-primary), transparent 30%) 0 4px,
      transparent 4px 8px);
  background-repeat: repeat-x;
  background-size: 8px 1px;
  opacity: 1;
  transition: opacity 0.3s;
  pointer-events: none;
  z-index: 2;
}

.diagnostic-text .offline-link::after {
  content: '';
  display: block;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 5px;
  height: 1px;
  background-color: var(--text-primary);
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
  z-index: 3;
}

.diagnostic-text .offline-link:hover::before {
  opacity: 0;
}

.diagnostic-text .offline-link:hover::after {
  opacity: 1;
}

.diagnostic-actions {
  display: flex;
  gap: 10px;
  margin-top: 0.4em;
}

.offline-btn {
  height: 34px;
  padding: 0 20px;
  border-radius: 17px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  border: none;
}

/* fill - 实心主按钮 */
[data-theme="light"] .btn-fill {
  background: #1A1A1A;
  color: #fff;
}

[data-theme="dark"] .btn-fill {
  background: #fff;
  color: #1A1A1A;
}

.btn-fill:hover {
  opacity: 0.85;
}

/* outline - 描边按钮 */
.btn-outline {
  border: 1.5px solid currentColor;
}

[data-theme="light"] .btn-outline {
  background: #fff;
  color: #1A1A1A;
}

[data-theme="light"] .btn-outline:hover {
  background: #E8E8E8;
}

[data-theme="dark"] .btn-outline {
  background: transparent;
  color: rgba(255, 255, 255, 0.87);
}

[data-theme="dark"] .btn-outline:hover {
  background: rgba(255, 255, 255, 0.08);
}
</style>

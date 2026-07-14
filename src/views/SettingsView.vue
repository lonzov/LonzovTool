<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { NSelect, NConfigProvider, darkTheme, NModal, NIcon, useMessage } from 'naive-ui'
import { ArrowDownload16Regular, ArrowExportUp24Filled, Settings24Regular, ChevronUp16Regular, ArrowCounterclockwise24Filled } from '@vicons/fluent'
import { useTheme } from '../composables/useTheme'

const { themeMode, setThemeMode, isDark } = useTheme()
const message = useMessage()

const themeOptions = [
  { value: 'auto', label: '跟随系统' },
  { value: 'light', label: '浅色模式' },
  { value: 'dark', label: '深色模式' },
]

const themeValue = computed({
  get: () => themeMode.value,
  set: (val) => setThemeMode(val),
})

/* ========== 折叠状态（持久化）========== */
const COLLAPSED_KEY = 'settings-collapsed'
const savedCollapsed = (() => {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
})()

const collapsedSections = ref({
  personalization: savedCollapsed?.personalization ?? false,
  config: savedCollapsed?.config ?? false,
  cache: savedCollapsed?.cache ?? false,
})

function toggleSection(key) {
  const newVal = !collapsedSections.value[key]
  collapsedSections.value[key] = newVal
  localStorage.setItem(COLLAPSED_KEY, JSON.stringify(collapsedSections.value))
}

/* ========== 重置所有设置 ========== */
function handleReset() {
  if (!confirm('确定要重置所有设置吗？此操作不可恢复。')) return
  localStorage.clear()
  message.success('已重置所有设置，页面即将刷新')
  setTimeout(() => window.location.reload(), 800)
}

/* ========== 配置管理 ========== */

const CONFIG_SCOPES = {
  favorites: {
    label: '首页卡片收藏',
    desc: '右键或长按首页卡片进行收藏',
    keys: ['favorite_cards'],
  },
  workspace: {
    label: '工作站配置',
    desc: '例如已打开的标签页、编辑记录等',
    keysExact: ['workspace-save', 'lonzovtool-rawjson-jzfk', 'lonzovtool-rawjson-jzfk-meta'],
    keysPrefix: ['workspace-tab-data-'],
  },
  personalization: {
    label: '个性化设置',
    desc: '例如深浅主题、搜索偏好',
    keys: ['theme_mode', 'search_engine_selected'],
  },
  all: {
    label: '所有配置',
    desc: '一键导入导出上方全部配置',
    getKeys() {
      const allKeys = []
      for (const key of Object.keys(CONFIG_SCOPES)) {
        if (key === 'all') continue
        allKeys.push(...getScopeKeys(CONFIG_SCOPES[key]))
      }
      return [...new Set(allKeys)]
    },
  },
}

const importModal = ref({
  show: false,
  scope: '',
  scopeLabel: '',
  hasLocalData: false,
  data: null,
  rejectedKeys: [],
})

function getScopeKeys(scope) {
  if (typeof scope.getKeys === 'function') return scope.getKeys()
  const keys = []
  if (scope.keys) keys.push(...scope.keys)
  if (scope.keysExact) keys.push(...scope.keysExact)
  if (scope.keysPrefix) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (scope.keysPrefix.some((p) => key.startsWith(p))) {
        keys.push(key)
      }
    }
  }
  return keys
}

function isKeyInScope(key, scope) {
  if (scope.keys && scope.keys.includes(key)) return true
  if (scope.keysExact && scope.keysExact.includes(key)) return true
  if (scope.keysPrefix && scope.keysPrefix.some((p) => key.startsWith(p))) return true
  if (typeof scope.getKeys === 'function') {
    return getScopeKeys(scope).includes(key)
  }
  return false
}

function collectScopeData(scope) {
  const data = {}
  const keys = getScopeKeys(scope)
  for (const key of keys) {
    const val = localStorage.getItem(key)
    if (val !== null) data[key] = val
  }
  return data
}

function checkLocalData(scope) {
  const keys = getScopeKeys(scope)
  for (const key of keys) {
    const val = localStorage.getItem(key)
    if (val !== null && val !== '[]' && val !== '{}' && val !== '') {
      return true
    }
  }
  return false
}

function handleExport(scopeKey) {
  const scope = CONFIG_SCOPES[scopeKey]
  const data = collectScopeData(scope)
  if (Object.keys(data).length === 0) {
    message.warning('暂无数据可导出')
    return
  }
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const now = new Date().toISOString().slice(0, 10)
  a.download = `lonzovtool-${scopeKey}-${now}.json`
  a.click()
  URL.revokeObjectURL(url)
  message.success('导出成功')
}

function handleImport(scopeKey) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)

      // 校验：必须是普通对象，值必须都是字符串
      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        message.error('文件格式不正确：内容必须是键值对对象，请确认选择了正确的配置文件')
        return
      }
      const entries = Object.entries(data)
      if (entries.length === 0) {
        message.error('文件内容为空，请确认选择了正确的配置文件')
        return
      }
      for (const [, val] of entries) {
        if (typeof val !== 'string') {
          message.error('文件格式不正确：每个值都应为文本类型，请确认选择了正确的配置文件')
          return
        }
      }

      const scope = CONFIG_SCOPES[scopeKey]

      // 白名单过滤
      const validData = {}
      const rejectedKeys = []
      for (const [key, val] of entries) {
        if (isKeyInScope(key, scope)) {
          validData[key] = val
        } else {
          rejectedKeys.push(key)
        }
      }

      if (Object.keys(validData).length === 0) {
        message.error('文件中没有可导入的有效配置项，请确认选择了正确的配置文件')
        return
      }

      const hasLocalData = checkLocalData(scope)

      importModal.value = {
        show: true,
        scope: scopeKey,
        scopeLabel: scope.label,
        hasLocalData,
        data: validData,
        rejectedKeys,
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        message.error('文件格式不正确：无法解析 JSON，请确认选择了正确的配置文件')
      }
    }
  }
  input.click()
}

function confirmImport() {
  const { data } = importModal.value
  for (const [key, val] of Object.entries(data)) {
    localStorage.setItem(key, val)
  }
  importModal.value.show = false
  message.success('导入成功，部分设置可能需要刷新页面后生效')
}

function cancelImport() {
  importModal.value.show = false
}

/* ========== 缓存管理 ========== */

const cacheClearModal = ref({
  show: false,
  sizeMB: '0.0',
})

async function handleCheckUpdate() {
  if (!('serviceWorker' in navigator)) {
    message.warning('当前浏览器不支持此功能', { duration: 2000 })
    return
  }

  const loadingMsg = message.loading('正在检查更新...', { duration: 0 })

  try {
    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) {
      loadingMsg.destroy()
      message.warning('未检测到 Service Worker', { duration: 2000 })
      return
    }

    let updateFound = false
    const onUpdateFound = () => { updateFound = true }
    registration.addEventListener('updatefound', onUpdateFound, { once: true })

    await registration.update()

    // 延迟判断：若 1.5s 内没触发 updatefound 则无更新
    setTimeout(() => {
      loadingMsg.destroy()
      registration.removeEventListener('updatefound', onUpdateFound)
      if (!updateFound) {
        message.success('当前已是最新版本', { duration: 2000 })
      }
      // 有更新时 useSWUpdate 会自动弹出更新弹窗，此处不做额外处理
    }, 1500)
  } catch (error) {
    loadingMsg.destroy()
    console.error('更新检查失败:', error)
    message.error('检查更新失败，请检查网络连接', { duration: 2500 })
  }
}

async function handleResetVersionCache() {
  try {
    const cacheNames = await caches.keys()
    let count = 0
    for (const name of cacheNames) {
      // 清除 lt-v3-xxx 版本缓存，但保留 lt-v3-minor-xxx 和 lt-static
      if (name.startsWith('lt-v3-') && !name.startsWith('lt-v3-minor-')) {
        await caches.delete(name)
        count++
      }
    }
    if (count > 0) {
      message.success(`已清除 ${count} 个版本缓存，刷新页面后将重新加载`, { duration: 2500 })
    } else {
      message.info('没有版本缓存需要清除', { duration: 1800 })
    }
  } catch (e) {
    message.error('重置失败：' + e.message, { duration: 1800 })
  }
}

async function calcResourceCacheSize() {
  const allNames = await caches.keys()
  const targetNames = allNames.filter(
    (n) => n === 'lt-static' || n.startsWith('lt-v3-minor-')
  )
  let totalSize = 0
  for (const name of targetNames) {
    const cache = await caches.open(name)
    const keys = await cache.keys()
    for (const request of keys) {
      const response = await cache.match(request)
      if (response) {
        totalSize += (await response.blob()).size
      }
    }
  }
  return (totalSize / (1024 * 1024)).toFixed(1)
}

async function handleClearResourceCache() {
  try {
    const sizeMB = await calcResourceCacheSize()
    cacheClearModal.value = { show: true, sizeMB }
  } catch (e) {
    message.error('获取缓存信息失败：' + e.message, { duration: 1800 })
  }
}

async function confirmClearResourceCache() {
  try {
    const allNames = await caches.keys()
    const targetNames = allNames.filter(
      (n) => n === 'lt-static' || n.startsWith('lt-v3-minor-')
    )
    let totalSize = 0
    for (const name of targetNames) {
      const cache = await caches.open(name)
      const keys = await cache.keys()
      for (const request of keys) {
        const response = await cache.match(request)
        if (response) {
          totalSize += (await response.blob()).size
        }
      }
      await caches.delete(name)
    }
    const actualMB = (totalSize / (1024 * 1024)).toFixed(1)
    cacheClearModal.value.show = false
    message.success(`已清理 ${actualMB}MB 资源`, { duration: 2500 })
  } catch (e) {
    cacheClearModal.value.show = false
    message.error('清理失败：' + e.message, { duration: 1800 })
  }
}

function cancelClearResourceCache() {
  cacheClearModal.value.show = false
}

// 缓存清理模态框模糊遮罩
watch(() => cacheClearModal.value.show, (val) => {
  if (val) {
    nextTick(() => {
      if (document.getElementById('cache-clear-blur-overlay')) return
      const overlay = document.createElement('div')
      overlay.id = 'cache-clear-blur-overlay'
      overlay.style.cssText = [
        'position: fixed', 'top: 0', 'left: 0', 'right: 0', 'bottom: 0',
        'z-index: 1000',
        '-webkit-backdrop-filter: blur(8px)', 'backdrop-filter: blur(8px)',
        'background: rgba(0, 0, 0, 0.1)',
        'pointer-events: none',
        'opacity: 0', 'transition: opacity 0.3s ease',
      ].join(';')
      document.body.appendChild(overlay)
      requestAnimationFrame(() => { overlay.style.opacity = '1' })
    })
  } else {
    const overlay = document.getElementById('cache-clear-blur-overlay')
    if (overlay) {
      overlay.style.opacity = '0'
      setTimeout(() => overlay.remove(), 300)
    }
  }
})

const darkOverrides = {
  common: { neutralModal: '#191919' },
  Card: { colorModal: '#191919' },
}
</script>

<template>
  <div>
    <NConfigProvider :theme="isDark ? darkTheme : null" style="display: contents">
      <div class="settings-container">
        <!-- 页面头部 -->
        <div class="settings-page-header">
          <div class="page-title-row">
            <NIcon :component="Settings24Regular" class="page-title-icon" />
            <h1 class="settings-h1">设置</h1>
          </div>
          <div class="header-actions">
            <p class="settings-subtitle">自定义你的使用体验</p>
            <button class="reset-btn" @click="handleReset">
              <NIcon :component="ArrowCounterclockwise24Filled" size="14" />
              重置
            </button>
          </div>
        </div>

        <!-- 外观 -->
        <div class="settings-card">
          <div
            class="card-header"
            :class="{ 'card-header--collapsed': collapsedSections.personalization }"
            @click="toggleSection('personalization')"
          >
            <span>个性化</span>
            <NIcon
              :component="ChevronUp16Regular"
              size="16"
              class="chevron-icon"
              :class="{ 'chevron-icon--rotated': collapsedSections.personalization }"
            />
          </div>
          <Transition name="collapse">
            <div v-show="!collapsedSections.personalization" class="card-body">
              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-title">主题模式</span>
                  <p class="setting-desc">设置全站的深浅色模式</p>
                </div>
                <div class="setting-control">
                  <NSelect
                    v-model:value="themeValue"
                    :options="themeOptions"
                    placement="bottom-end"
                    size="medium"
                    class="settings-select"
                  />
                </div>
              </div>
            </div>
          </Transition>
        </div>

        <!-- 配置管理 -->
        <div class="settings-card">
          <div
            class="card-header"
            :class="{ 'card-header--collapsed': collapsedSections.config }"
            @click="toggleSection('config')"
          >
            <span>配置管理</span>
            <NIcon
              :component="ChevronUp16Regular"
              size="16"
              class="chevron-icon"
              :class="{ 'chevron-icon--rotated': collapsedSections.config }"
            />
          </div>
          <Transition name="collapse">
            <div v-show="!collapsedSections.config" class="card-body">
              <div
                v-for="(scope, key) in CONFIG_SCOPES"
                :key="key"
                class="setting-row"
              >
                <div class="setting-info">
                  <span class="setting-title">{{ scope.label }}</span>
                  <p class="setting-desc">{{ scope.desc }}</p>
                </div>
                <div class="setting-control">
                  <div class="config-pill">
                    <button class="config-pill-btn" title="导入" @click="handleImport(key)">
                      <NIcon :component="ArrowDownload16Regular" size="16" />
                    </button>
                    <span class="config-pill-divider"></span>
                    <button class="config-pill-btn" title="导出" @click="handleExport(key)">
                      <NIcon :component="ArrowExportUp24Filled" size="16" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>

        <!-- 缓存管理 -->
        <div class="settings-card">
          <div
            class="card-header"
            :class="{ 'card-header--collapsed': collapsedSections.cache }"
            @click="toggleSection('cache')"
          >
            <span>缓存管理</span>
            <NIcon
              :component="ChevronUp16Regular"
              size="16"
              class="chevron-icon"
              :class="{ 'chevron-icon--rotated': collapsedSections.cache }"
            />
          </div>
          <Transition name="collapse">
            <div v-show="!collapsedSections.cache" class="card-body">
              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-title">检查更新</span>
                  <p class="setting-desc">强制触发更新检查</p>
                </div>
                <div class="setting-control">
                  <button class="cache-btn" @click="handleCheckUpdate">检查</button>
                </div>
              </div>
              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-title">重置版本缓存</span>
                  <p class="setting-desc">无法更新时可尝试重置</p>
                </div>
                <div class="setting-control">
                  <button class="cache-btn cache-btn--danger" @click="handleResetVersionCache">重置</button>
                </div>
              </div>
              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-title">清理资源缓存</span>
                  <p class="setting-desc">清理所有资源缓存释放空间，下次加载会变慢</p>
                </div>
                <div class="setting-control">
                  <button class="cache-btn cache-btn--danger" @click="handleClearResourceCache">清理</button>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </NConfigProvider>

    <!-- 导入确认模态框 -->
    <NConfigProvider :theme="isDark ? darkTheme : null" :theme-overrides="isDark ? darkOverrides : undefined">
      <NModal
        v-model:show="importModal.show"
        preset="card"
        :style="{
          maxWidth: '420px',
          width: 'calc(100% - 32px)',
          borderRadius: '16px',
          cornerShape: 'squircle',
        }"
        title="导入配置"
        :bordered="false"
        :closable="true"
        @close="cancelImport"
        :auto-focus="false"
      >
        <div class="import-modal-body">
          <p v-if="importModal.hasLocalData">
            检测到本地已有「{{ importModal.scopeLabel }}」的配置数据。<br />
            <strong>是否覆盖已有的本地数据？此操作不可恢复。</strong>
          </p>
          <p v-else>
            即将导入「{{ importModal.scopeLabel }}」的配置数据，是否确认导入？
          </p>
          <p
            v-if="importModal.rejectedKeys.length"
            class="import-rejected"
          >
            以下 {{ importModal.rejectedKeys.length }} 项不在白名单中，已自动忽略：<br />
            <code>{{ importModal.rejectedKeys.join('、') }}</code>
          </p>
        </div>
        <template #footer>
          <div class="import-modal-actions">
            <button class="import-btn import-btn--outline" @click="cancelImport">取消</button>
            <button class="import-btn import-btn--fill" @click="confirmImport">
              {{ importModal.hasLocalData ? '覆盖并导入' : '确认导入' }}
            </button>
          </div>
        </template>
      </NModal>
    </NConfigProvider>

    <!-- 缓存清理确认模态框（照搬版本更新模态框样式） -->
    <NConfigProvider :theme="isDark ? darkTheme : null" :theme-overrides="isDark ? darkOverrides : undefined">
      <NModal
        v-model:show="cacheClearModal.show"
        preset="card"
        :style="{
          maxWidth: '420px',
          width: 'calc(100% - 32px)',
          borderRadius: '16px',
          cornerShape: 'squircle',
        }"
        title="清理资源缓存"
        :bordered="false"
        :closable="true"
        @close="cancelClearResourceCache"
        :auto-focus="false"
      >
        <div class="cache-clear-modal-body">
          资源共占用 {{ cacheClearModal.sizeMB }} MB，确认要清理吗？<br />
          下次打开网站时加载速度可能变慢
        </div>
        <template #footer>
          <div class="import-modal-actions">
            <button class="import-btn import-btn--outline" @click="cancelClearResourceCache">取消</button>
            <button class="import-btn import-btn--fill" @click="confirmClearResourceCache">确认清理</button>
          </div>
        </template>
      </NModal>
    </NConfigProvider>
  </div>
</template>

<style scoped>
.settings-container {
  max-width: 1200px;
  padding-top: 24px;
}

/* ========== 页面头部 ========== */
.settings-page-header {
  margin-bottom: 1.5rem;
}

.page-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.page-title-icon {
  font-size: 26px;
  color: var(--text-primary);
  flex-shrink: 0;
}

.settings-h1 {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.3;
}

.header-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 3px;
}

.settings-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0;
}

.reset-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 100px;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.825rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.2s, color 0.2s, border-color 0.4s;
}

.reset-btn:hover {
  background: color-mix(in srgb, var(--text-primary) 6%, transparent);
  color: var(--text-primary);
}

/* ========== 卡片容器 ========== */
.settings-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  overflow: hidden;
  padding-top: 15px;
  padding-bottom: 15px;
  transition: background-color 0.4s ease, border-color 0.4s ease;
}

.settings-card + .settings-card {
  margin-top: 1rem;
}

/* ========== 卡片头部（可折叠）========== */
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--text-primary);
  cursor: pointer;
  user-select: none;
  transition: color 0.4s ease, opacity 0.2s;
}

.card-header:hover {
  opacity: 0.85;
}

.card-header--collapsed {
  border-bottom: none;
}

.chevron-icon {
  color: var(--text-tertiary);
  transition: transform 0.25s ease, color 0.4s ease;
}

.chevron-icon--rotated {
  transform: rotate(180deg);
}

/* ========== 卡片内容区 ========== */
.card-body {
  overflow: hidden;
}

/* ========== 折叠过渡动画 ========== */
.collapse-enter-active,
.collapse-leave-active {
  transition: max-height 0.3s ease, opacity 0.25s ease;
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  max-height: 0 !important;
  opacity: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  max-height: 500px; /* 足够大的值，实际高度由内容决定 */
  opacity: 1;
}

/* ========== 设置行 ========== */
.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  gap: 2rem;
  position: relative;
}

.setting-row + .setting-row::before {
  content: '';
  position: absolute;
  top: 0;
  left: 20px;
  right: 20px;
  height: 1px;
  background: var(--border-color);
  transition: background-color 0.4s ease;
}

.setting-info {
  flex: 1;
  min-width: 0;
}

.setting-title {
  display: block;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-primary);
  transition: color 0.4s ease;
}

.setting-desc {
  font-size: 0.8rem;
  color: var(--text-tertiary);
  line-height: 1.45;
  margin: 3px 0 0;
  transition: color 0.4s ease;
}

.setting-control {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.settings-select {
  min-width: 102px;
}

/* ========== 配置管理胶囊按钮 ========== */

.config-pill {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--border-color);
  border-radius: 100px;
  overflow: hidden;
  transition: border-color 0.4s ease;
}

.config-pill-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 34px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.config-pill-btn:hover {
  background: color-mix(in srgb, var(--text-primary) 8%, transparent);
  color: var(--text-primary);
}

.config-pill-divider {
  width: 1px;
  height: 18px;
  background: var(--border-color);
  flex-shrink: 0;
  transition: background-color 0.4s ease;
}

/* ========== 缓存管理按钮 ========== */
.cache-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 30px;
  padding: 0 16px;
  border-radius: 100px;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.2s, color 0.2s, border-color 0.4s;
}

.cache-btn:hover {
  background: color-mix(in srgb, var(--text-primary) 6%, transparent);
  color: var(--text-primary);
}

.cache-btn--danger {
  color: #E46962;
  border-color: color-mix(in srgb, #E46962 35%, transparent);
}

.cache-btn--danger:hover {
  background: color-mix(in srgb, #E46962 10%, transparent);
  color: #E46962;
}

/* ========== 导入模态框 ========== */

.import-modal-body {
  font-size: 15px;
  line-height: 1.75;
  color: var(--n-text-color-2);
  padding: 4px 2px;
}

.import-modal-body p {
  margin: 0;
}

.import-modal-body strong {
  font-weight: 600;
  color: var(--n-text-color);
}

.import-rejected {
  margin-top: 12px !important;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.6;
  color: color-mix(in srgb, var(--text-primary) 65%, transparent);
  background: color-mix(in srgb, var(--text-primary) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--text-primary) 10%, transparent);
}

.import-rejected code {
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  font-size: 12px;
  word-break: break-all;
}

/* ========== 缓存清理模态框 ========== */
.cache-clear-modal-body {
  font-size: 15px;
  line-height: 1.75;
  color: var(--n-text-color-2);
  padding: 4px 2px;
}

.import-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 8px;
}

.import-btn {
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

/* fill */
[data-theme="light"] .import-btn--fill {
  background: #1A1A1A;
  color: #fff;
}

[data-theme="dark"] .import-btn--fill {
  background: #fff;
  color: #1A1A1A;
}

.import-btn--fill:hover {
  opacity: 0.85;
}

/* outline */
.import-btn--outline {
  border: 1.5px solid currentColor;
}

[data-theme="light"] .import-btn--outline {
  background: #fff;
  color: #1A1A1A;
}

[data-theme="light"] .import-btn--outline:hover {
  background: #E8E8E8;
}

[data-theme="dark"] .import-btn--outline {
  background: transparent;
  color: rgba(255, 255, 255, 0.68);
}

[data-theme="dark"] .import-btn--outline:hover {
  background: rgba(255, 255, 255, 0.08);
}

/* 响应式 */
@media (max-width: 768px) {
  .settings-h1 {
    font-size: 20px;
  }

  .page-title-icon {
    font-size: 22px;
  }

  .settings-subtitle {
    font-size: 13px;
  }

  .card-header {
    padding: 12px 16px;
  }

  .setting-row {
    gap: 1rem;
    padding: 12px 16px;
  }

  .setting-row + .setting-row::before {
    left: 16px;
    right: 16px;
  }

  .setting-title {
    font-size: 0.88rem;
  }

  .setting-desc {
    font-size: 0.78rem;
  }
}

/* 小屏控件缩放 */
@media (max-width: 400px) {
  .config-pill,
  .settings-select {
    transform: scale(0.9);
    transform-origin: right center;
  }
}
</style>

<style>
/* NSelect 触发器 — 胶囊圆角、不换行、focus 不变色 */
.settings-select .n-base-selection,
.settings-select .n-base-selection-label {
  border-radius: 100px !important;
}

.settings-select .n-base-selection-label {
  white-space: nowrap !important;
}

.settings-select .n-base-selection {
  --n-border: 1px solid var(--border-color) !important;
  --n-border-hover: 1px solid var(--border-color) !important;
  --n-border-focus: 1px solid var(--border-color) !important;
  --n-border-active: 1px solid var(--border-color) !important;
  --n-box-shadow-focus: none !important;
  --n-box-shadow-active: none !important;
}

/* NSelect 下拉面板 */
.n-select-menu {
  --n-option-color-hover: var(--bg-sub) !important;
  border: 1px solid var(--border-color) !important;
}

[data-theme='dark'] .n-select-menu {
  --n-option-color-hover: #2A2A2A !important;
}

[data-theme='light'] .n-select-menu,
html:not([data-theme='dark']) .n-select-menu {
  box-shadow:
    0 3px 6px -4px rgba(0, 0, 0, 0.16),
    0 6px 16px 0 rgba(0, 0, 0, 0.12),
    0 9px 28px 8px rgba(0, 0, 0, 0.08) !important;
}

[data-theme='dark'] .n-select-menu {
  box-shadow:
    0 3px 6px -4px rgba(0, 0, 0, 0.48),
    0 6px 12px 0 rgba(0, 0, 0, 0.36),
    0 9px 18px 8px rgba(0, 0, 0, 0.24) !important;
}

/* 小屏下保持下拉菜单宽度 */
@media (max-width: 400px) {
  .n-base-select-menu {
    min-width: 102px !important;
  }
}
</style>

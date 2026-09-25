<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { NSelect, NSwitch, NIcon, useMessage } from 'naive-ui'
import { ArrowDownload16Regular, ArrowExportUp24Filled, Settings24Regular, ChevronUp16Regular, ArrowCounterclockwise24Filled } from '@vicons/fluent'
import AppModal from '../components/ui/AppModal.vue'
import { useTheme } from '../composables/useTheme'
import { confirmDialog } from '../composables/useConfirm'
import { useWorkspaceSettings } from '../composables/useWorkspaceSettings'
import { useWorkspace } from '../composables/useWorkspace'

const { themeMode, setThemeMode } = useTheme()
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

/* ========== 主题写入 URL 参数 ========== */
const URL_THEME_OPTIONS = [
  { value: 'off', label: '关闭' },
  { value: 'always', label: '开启' },
  { value: 'explicit', label: '开启 (跟随系统模式除外)' },
]

const urlThemeValue = computed({
  get: () => urlThemeMode.value,
  set: (val) => setUrlThemeMode(val),
})

/* ========== 卡片高光效果开关 ========== */
const GLOW_KEY = 'mouse_glow_enabled'
const glowEnabled = ref(
  (() => {
    try {
      const v = localStorage.getItem(GLOW_KEY)
      return v === null ? true : v === 'true'
    } catch { return true }
  })(),
)

function onGlowToggle(val) {
  glowEnabled.value = val
  localStorage.setItem(GLOW_KEY, String(val))
  message.info('刷新页面后生效', { duration: 1800 })
}

/* ========== 站外嵌入工作站（模块级共享状态）========== */
const { embedEnabled, setEmbedEnabled, iframeMaskMode, setIframeMaskMode, urlThemeMode, setUrlThemeMode } = useWorkspaceSettings()

// 深色模式 iframe 遮罩选项
const IFRAME_MASK_OPTIONS = [
  { value: 'off', label: '不处理' },
  { value: 'black', label: '降低亮度' },
  { value: 'invert', label: '颜色反转' },
]

const maskValue = computed({
  get: () => iframeMaskMode.value,
  set: (val) => setIframeMaskMode(val),
})

function onEmbedToggle(val) {
  if (val) {
    // 开启：弹第三方内容声明确认
    openEmbedEnableModal()
  } else {
    // 关闭：弹选择模态框（是否清理已打开的站外嵌入标签页）
    embedCloseModal.value.show = true
  }
}

/* ========== 开启站外嵌入：声明确认（5s 倒计时）========== */
const embedEnableModal = ref({ show: false, countdown: 0 })
let embedEnableTimer = null

function openEmbedEnableModal() {
  if (embedEnableTimer) clearInterval(embedEnableTimer)
  embedEnableModal.value = { show: true, countdown: 9 }
  embedEnableTimer = setInterval(() => {
    if (embedEnableModal.value.countdown > 0) {
      embedEnableModal.value.countdown--
      if (embedEnableModal.value.countdown === 0 && embedEnableTimer) {
        clearInterval(embedEnableTimer)
        embedEnableTimer = null
      }
    }
  }, 1000)
}

const embedEnableReady = computed(() => embedEnableModal.value.countdown <= 0)
const embedConfirmLabel = computed(() =>
  embedEnableModal.value.countdown > 0
    ? `我已知晓 ${embedEnableModal.value.countdown}`
    : '我已知晓',
)

function confirmEmbedEnable() {
  if (!embedEnableReady.value) return
  setEmbedEnabled(true)
  closeEmbedEnableModal()
}

function closeEmbedEnableModal() {
  if (embedEnableTimer) {
    clearInterval(embedEnableTimer)
    embedEnableTimer = null
  }
  embedEnableModal.value.show = false
}

onBeforeUnmount(() => {
  if (embedEnableTimer) clearInterval(embedEnableTimer)
})

/* ========== 关闭站外嵌入：选择是否清理标签页 ========== */
const embedCloseModal = ref({ show: false })

function directEmbedClose() {
  // 直接关闭，保留已打开的站外嵌入标签页
  setEmbedEnabled(false)
  embedCloseModal.value.show = false
}

function cleanupEmbedClose() {
  // 关闭并清理已打开的站外嵌入标签页（含本地记录与缓存，重新归并编号）
  setEmbedEnabled(false)
  const { removeExternalTabs } = useWorkspace()
  removeExternalTabs()
  embedCloseModal.value.show = false
}

function cancelEmbedClose() {
  // 取消：保持开启状态
  embedCloseModal.value.show = false
}

/* ========== 开关轨道颜色（参考特殊符号页） ========== */
function switchRailStyle({ focused, checked }) {
  if (checked) {
    const style = { background: '#333' }
    if (focused) style.boxShadow = '0 0 0 2px #33333340'
    return style
  }
  const style = { background: '#a0a0a0' }
  if (focused) style.boxShadow = '0 0 0 2px #a0a0a040'
  return style
}

/* ========== 标签页拖拽触发时长 ========== */
const DRAG_DELAY_KEY = 'tab_drag_delay'
const DRAG_DELAY_DEFAULT = 700

function loadDragDelay() {
  try {
    const v = localStorage.getItem(DRAG_DELAY_KEY)
    const num = parseInt(v, 10)
    return (num >= 100 && num <= 2000) ? num : DRAG_DELAY_DEFAULT
  } catch { return DRAG_DELAY_DEFAULT }
}

const dragDelay = ref(loadDragDelay())
const dragDelayInput = ref(String(dragDelay.value))

function onDragDelayInput(val) {
  dragDelayInput.value = val
}

function onDragDelayBlur() {
  const num = parseInt(dragDelayInput.value, 10)
  const clamped = isNaN(num) ? DRAG_DELAY_DEFAULT : Math.max(100, Math.min(2000, Math.round(num)))
  dragDelay.value = clamped
  dragDelayInput.value = String(clamped)
  localStorage.setItem(DRAG_DELAY_KEY, String(clamped))
}

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
  workspace: savedCollapsed?.workspace ?? false,
  config: savedCollapsed?.config ?? false,
  cache: savedCollapsed?.cache ?? false,
})

function toggleSection(key) {
  const newVal = !collapsedSections.value[key]
  collapsedSections.value[key] = newVal
  localStorage.setItem(COLLAPSED_KEY, JSON.stringify(collapsedSections.value))
}

/* ========== 重置所有设置 ========== */
async function handleReset() {
  const confirmed = await confirmDialog({
    title: '重置所有设置',
    message: '确定要重置所有设置吗？此操作不可恢复。',
    confirmText: '确认重置',
    danger: true,
  })
  if (!confirmed) return
  localStorage.clear()
  // T显编辑器的语言包存在 IndexedDB 里，localStorage.clear() 清不掉，需单独清
  try {
    const { clearAllLangPacks } = await import('../composables/useRawJsonLang.js')
    await clearAllLangPacks()
  } catch { /* 未使用过语言包时无需清理 */ }
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
    keys: ['workspace_embed_external', 'workspace_iframe_mask', 'workspace_iframe_site_dark'],
    keysExact: [
      'workspace-save',
      'lonzovtool-rawjson-jzfk',
      'lonzovtool-rawjson-jzfk-meta',
      'lonzovtool-rawjson-jzfk-sim',
    ],
    keysPrefix: ['workspace-tab-data-'],
  },
  personalization: {
    label: '个性化设置',
    desc: '例如深浅主题、搜索偏好',
    keys: ['theme_mode', 'search_engine_selected', 'tab_drag_delay', 'url_theme_param'],
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

/** 向当前接管页面的 SW 查询版本号，失败返回 null */
function fetchCurrentSWVersion() {
  return new Promise((resolve) => {
    const controller = navigator.serviceWorker.controller
    if (!controller) {
      resolve(null)
      return
    }
    const mc = new MessageChannel()
    const timer = setTimeout(() => resolve(null), 1000)
    mc.port1.onmessage = (e) => {
      clearTimeout(timer)
      resolve(e.data?.version || null)
    }
    controller.postMessage({ type: 'GET_VERSION' }, [mc.port2])
  })
}

async function handleCheckUpdate() {
  if (!('serviceWorker' in navigator)) {
    message.warning('当前浏览器不支持此功能', { duration: 2000 })
    return
  }

  const loadingMsg = message.loading('正在检查更新...', { duration: 0 })

  // 统一收口销毁，避免重复销毁与"新版本提示盖在加载提示上"
  let loadingDismissed = false
  const dismissLoading = () => {
    if (loadingDismissed) return
    loadingDismissed = true
    loadingMsg.destroy()
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) {
      dismissLoading()
      message.warning('未检测到 Service Worker', { duration: 2000 })
      return
    }

    let updateFound = false
    const onUpdateFound = () => {
      updateFound = true
      // 发现更新：立刻撤掉加载提示，后续弹窗/刷新提示不再与它叠在一起
      dismissLoading()
    }
    registration.addEventListener('updatefound', onUpdateFound, { once: true })

    await registration.update()

    // 延迟判断：若 1.5s 内没触发 updatefound 则无更新
    setTimeout(async () => {
      dismissLoading()
      registration.removeEventListener('updatefound', onUpdateFound)
      if (!updateFound) {
        const version = await fetchCurrentSWVersion()
        const versionLabel = version ? ` v${version.replace(/^v/, '')}` : ''
        message.success(`当前已是最新版本${versionLabel}`, { duration: 2000 })
      }
      // 有更新时 useSWUpdate 会自动弹出更新弹窗，此处不做额外处理
    }, 1500)
  } catch (error) {
    dismissLoading()
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

/* ========== 模态框页脚按钮 ========== */
const importActions = computed(() => [
  { text: '取消', variant: 'outline', onClick: cancelImport },
  {
    text: importModal.value.hasLocalData ? '覆盖并导入' : '确认导入',
    variant: 'fill',
    onClick: confirmImport,
  },
])

const cacheClearActions = [
  { text: '取消', variant: 'outline', onClick: cancelClearResourceCache },
  { text: '确认清理', variant: 'fill', onClick: confirmClearResourceCache },
]

const embedCloseActions = [
  { text: '清理', variant: 'outline', onClick: cleanupEmbedClose },
  { text: '直接关闭', variant: 'fill', onClick: directEmbedClose },
]
</script>

<template>
  <div>
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
            <div class="setting-row">
              <div class="setting-info">
                <span class="setting-title">同步主题模式到外部网站</span>
                <p class="setting-desc">需要目标网站支持相关 URL 参数，否则不生效</p>
              </div>
              <div class="setting-control">
                <NSelect
                  v-model:value="urlThemeValue"
                  :options="URL_THEME_OPTIONS"
                  placement="bottom-end"
                  size="medium"
                  class="settings-select"
                  :consistent-menu-width="false"
                  :menu-props="{ class: 'settings-select-menu-wide' }"
                />
              </div>
            </div>
            <div class="setting-row">
              <div class="setting-info">
                <span class="setting-title">边缘高光效果</span>
                <p class="setting-desc">元素边缘跟随鼠标移动的高光效果</p>
              </div>
              <div class="setting-control">
                <NSwitch
                  :value="glowEnabled"
                  @update:value="onGlowToggle"
                  :rail-style="switchRailStyle"
                  class="settings-switch"
                />
              </div>
            </div>
          </div>
        </Transition>
      </div>

      <!-- 工作站 -->
      <div class="settings-card">
        <div
          class="card-header"
          :class="{ 'card-header--collapsed': collapsedSections.workspace }"
          @click="toggleSection('workspace')"
        >
          <span>工作站</span>
          <NIcon
            :component="ChevronUp16Regular"
            size="16"
            class="chevron-icon"
            :class="{ 'chevron-icon--rotated': collapsedSections.workspace }"
          />
        </div>
        <Transition name="collapse">
          <div v-show="!collapsedSections.workspace" class="card-body">
            <div class="setting-row">
              <div class="setting-info">
                <span class="setting-title">标签页长按拖拽时长</span>
                <p class="setting-desc">长按标签页多久后可以拖动，默认 700 ms</p>
              </div>
              <div class="setting-control setting-control--drag-delay">
                <span class="drag-delay-input-wrap">
                  <input
                    type="text"
                    inputmode="numeric"
                    class="drag-delay-input"
                    :value="dragDelayInput"
                    placeholder="700"
                    @input="onDragDelayInput($event.target.value)"
                    @blur="onDragDelayBlur"
                  />
                  <span class="drag-delay-unit">ms</span>
                </span>
              </div>
            </div>
            <div class="setting-row">
              <div class="setting-info">
                <span class="setting-title">在工作站内打开外部网页</span>
                <p class="setting-desc">开启后，点击站外卡片直接在工作站里查看网页；关闭则照旧在浏览器新标签页打开</p>
              </div>
              <div class="setting-control">
                <NSwitch
                  :value="embedEnabled"
                  @update:value="onEmbedToggle"
                  :rail-style="switchRailStyle"
                  class="settings-switch"
                />
              </div>
            </div>
            <div class="setting-row">
              <div class="setting-info">
                <span class="setting-title">深色模式下压暗外部网页</span>
                <p class="setting-desc">将工作站内的外部网页统一调暗（部分浏览器可能不支持颜色反转）</p>
              </div>
              <div class="setting-control">
                <NSelect
                  v-model:value="maskValue"
                  :options="IFRAME_MASK_OPTIONS"
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

    <!-- 导入确认模态框 -->
    <AppModal
      :auto-focus="false"
      :segmented="false"
      v-model:show="importModal.show"
      :max-width="420"
      title="导入配置"
      :closable="true"
      :actions="importActions"
      @close="cancelImport"
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
    </AppModal>

    <!-- 缓存清理确认模态框（照搬版本更新模态框样式） -->
    <AppModal
      :auto-focus="false"
      :segmented="false"
      v-model:show="cacheClearModal.show"
      :max-width="420"
      title="清理资源缓存"
      :closable="true"
      :actions="cacheClearActions"
      @close="cancelClearResourceCache"
    >
      <div class="cache-clear-modal-body">
        资源共占用 {{ cacheClearModal.sizeMB }} MB，确认要清理吗？<br />
        下次打开网站时加载速度可能变慢
      </div>
    </AppModal>

    <!-- 开启站外嵌入：第三方内容声明 + 9s 倒计时确认 -->
    <AppModal
      :auto-focus="false"
      v-model:show="embedEnableModal.show"
      :max-width="540"
      title="在工作站内打开外部网页"
      :closable="true"
      :mask-closable="false"
      content-scrollable
      @close="closeEmbedEnableModal"
    >
      <div class="embed-enable-modal-body">
        <p>开启后，点击站外卡片将直接在工作站内打开网页，方便你同时使用多个工具。<strong>请注意：</strong></p>
        <p>1. 打开的网页均为 <strong>第三方网站</strong>，与本站无关，本站无法保证其稳定性与绝对的安全性，登录账号或填写个人信息时请谨慎。<strong>如遇 BUG 请联系对应网站反馈，本站无法处理第三方网站的问题😥</strong></p>
        <p>2. 部分网站因安全策略 <strong>不支持在工作站内打开</strong>，若遇到无法打开的情况，请点击顶部导航栏中的按钮，改用新标签页打开。</p>
        <p>3. 因浏览器安全策略，打开的网页可能会无法读取 cookie，这会导致无法登录、人机验证卡住、记录消失等问题，此时同样请改用新标签页打开。</p>
      </div>
      <template #footer>
        <div class="app-modal-actions">
          <button
            class="app-btn app-btn--fill"
            :disabled="!embedEnableReady"
            @click="confirmEmbedEnable"
          >
            {{ embedConfirmLabel }}
          </button>
        </div>
      </template>
    </AppModal>

    <!-- 关闭站外嵌入：是否清理已打开的嵌入标签页 -->
    <AppModal
      :auto-focus="false"
      :segmented="false"
      v-model:show="embedCloseModal.show"
      :max-width="420"
      title="关闭站外嵌入"
      :closable="true"
      :mask-closable="true"
      :actions="embedCloseActions"
      @close="cancelEmbedClose"
    >
      <div class="embed-close-modal-body">
        <p>是否需要清理已打开的站外嵌入标签页？</p>
        <p class="embed-close-hint">关闭后，站外卡片将恢复为在浏览器新标签页中打开。</p>
      </div>
    </AppModal>
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
  color: var(--foreground);
  flex-shrink: 0;
}

.settings-h1 {
  font-size: 22px;
  font-weight: 700;
  color: var(--foreground);
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
  color: var(--muted-foreground);
  line-height: 1.5;
  margin: 0;
}

.reset-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: var(--radius-full);
  corner-shape: round;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted-foreground);
  font-size: 0.825rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.2s, color 0.2s, border-color 0.4s;
}

.reset-btn:hover {
  background: var(--accent);
  color: var(--foreground);
}

/* ========== 卡片容器 ========== */
.settings-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
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
  color: var(--foreground);
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
  color: var(--subtle-foreground);
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
  background: var(--border);
  transition: background-color 0.4s ease;
}

.setting-info {
  flex: 1;
  min-width: 0;
  /* 无描述时按"标题+描述"的高度等齐，并让标题在预留高度内垂直居中 */
  min-height: 44px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.setting-title {
  display: block;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--foreground);
  transition: color 0.4s ease;
}

.setting-desc {
  font-size: 0.8rem;
  color: var(--subtle-foreground);
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

/* 拖拽延迟：胶囊输入框，尺寸与主题选择器一致 */
.setting-control--drag-delay {
  display: flex;
  align-items: center;
}

.drag-delay-input-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 102px;
  height: 34px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  corner-shape: round;
  box-sizing: border-box;
  transition: border-color 0.4s ease;
}

.drag-delay-input-wrap:focus-within {
  border-color: var(--subtle-foreground);
}

.drag-delay-input {
  width: 100%;
  height: 100%;
  padding: 0 34px 0 12px;
  border: none;
  border-radius: var(--radius-full);
  corner-shape: round;
  background: transparent;
  color: var(--foreground);
  font-size: 0.85rem;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
  transition: color 0.4s ease;
}

.drag-delay-input::placeholder {
  color: var(--subtle-foreground);
}

.drag-delay-unit {
  position: absolute;
  right: 11px;
  font-size: 0.8rem;
  color: var(--subtle-foreground);
  pointer-events: none;
  white-space: nowrap;
  transition: color 0.4s ease;
}

/* ========== 配置管理胶囊按钮 ========== */

.config-pill {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  corner-shape: round;
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
  color: var(--muted-foreground);
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.config-pill-btn:hover {
  background: var(--accent);
  color: var(--foreground);
}

.config-pill-divider {
  width: 1px;
  height: 18px;
  background: var(--border);
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
  border-radius: var(--radius-full);
  corner-shape: round;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted-foreground);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.2s, color 0.2s, border-color 0.4s;
}

.cache-btn:hover {
  background: var(--accent);
  color: var(--foreground);
}

.cache-btn--danger {
  color: var(--destructive);
  border-color: color-mix(in srgb, var(--destructive) 35%, transparent);
}

.cache-btn--danger:hover {
  background: color-mix(in srgb, var(--destructive) 10%, transparent);
  color: var(--destructive);
}

/* ========== 导入模态框 ========== */

.import-modal-body {
  font-size: 15px;
  line-height: 1.75;
  color: var(--muted-foreground);
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
  border-radius: var(--radius-md);
  font-size: 13px;
  line-height: 1.6;
  color: color-mix(in srgb, var(--foreground) 65%, transparent);
  background: color-mix(in srgb, var(--foreground) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
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
  color: var(--muted-foreground);
  padding: 4px 2px;
}

/* ========== 站外嵌入模态框 ========== */
.embed-enable-modal-body,
.embed-close-modal-body {
  font-size: 15px;
  line-height: 1.75;
  color: var(--muted-foreground);
  padding: 4px 2px;
}

.embed-enable-modal-body p,
.embed-close-modal-body p {
  margin: 0 0 10px;
}

.embed-enable-modal-body p:last-child,
.embed-close-modal-body p:last-child {
  margin-bottom: 0;
}

.embed-enable-modal-body strong {
  font-weight: 600;
  color: var(--n-text-color);
}

.embed-close-hint {
  font-size: 13px;
  color: var(--subtle-foreground);
  opacity: 0.8;
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
  .settings-select,
  .drag-delay-input-wrap {
    transform: scale(0.9);
    transform-origin: right center;
  }
}
</style>

<style>
/* NSelect 触发器 — 胶囊圆角、不换行、focus 不变色 */
/* 设置页的控件一律是胶囊，这里跟着走。
   边框画在 __border / __state-border 上（它们用 border-radius: inherit 取根元素的圆角），
   而 corner-shape 不继承 —— 不显式写的话它们会被全局的 `* { corner-shape: squircle }`
   接管，胶囊 + squircle 会破形（看起来反倒像个圆角矩形）。所以这三层都得写。 */
.settings-select .n-base-selection,
.settings-select .n-base-selection__border,
.settings-select .n-base-selection__state-border,
.settings-select .n-base-selection-label {
  border-radius: var(--radius-full) !important;
  corner-shape: round;
}

.settings-select .n-base-selection-label {
  white-space: nowrap !important;
}

.settings-select .n-base-selection {
  --n-border: 1px solid var(--border) !important;
  --n-border-hover: 1px solid var(--border) !important;
  --n-border-focus: 1px solid var(--border) !important;
  --n-border-active: 1px solid var(--border) !important;
  --n-box-shadow-focus: none !important;
  --n-box-shadow-active: none !important;
}

/* 仅加宽"主题写入 URL 参数"下拉的面板（触发器宽度不变） */
.settings-select-menu-wide {
  min-width: 0 !important;
  --n-option-padding: 0 0px;
}

/* 小屏下保持下拉菜单宽度 */
@media (max-width: 400px) {
  .settings-select-menu-wide.n-base-select-menu {
    min-width: 102px !important;
  }
}

</style>

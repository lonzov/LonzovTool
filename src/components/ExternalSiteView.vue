<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { NIcon } from 'naive-ui'
import { Open20Filled, ArrowClockwise28Filled } from '@vicons/fluent'
import ToolLoading from './ToolLoading.vue'
import DarkFilterIcon from './DarkFilterIcon.vue'
import { useTheme } from '../composables/useTheme.js'
import { useWorkspaceSettings, getStoredSiteDark, saveSiteDark } from '../composables/useWorkspaceSettings.js'
import { attachThemeParams } from '../composables/useUrlTheme.js'

const { isDark } = useTheme()
const { iframeMaskMode } = useWorkspaceSettings()

const props = defineProps({
  url: {
    type: String,
    required: true,
  },
})

// 打开时的站外地址：按设置附加 theme / colorScheme 参数。
// 仅在此页打开时快照一次（不跟随本站后续主题切换，避免重载第三方页面丢失状态）
const iframeSrc = attachThemeParams(props.url)

// 站点开关的 id（域名）
const host = computed(() => {
  try {
    return new URL(props.url).hostname
  } catch {
    return props.url
  }
})

// ===== 当前站点的深色滤镜开关（仅控制滤镜开/关，与滤镜模式无关）=====
// 本地无该站点配置时，默认等于设置页配置（设置页滤镜模式非关闭即为开启）
const storedSiteDark = getStoredSiteDark(host.value)
const siteDarkOn = ref(storedSiteDark !== null ? storedSiteDark : iframeMaskMode.value !== 'off')
// 图标显示状态独立于实际开关：图标切换延迟到缩小到最小时，滤镜本身立即生效
const darkIconOn = ref(siteDarkOn.value)
const darkPressed = ref(false)
const refreshPressed = ref(false)

function toggleSiteDark() {
  // 滤镜开关立即生效并持久化
  siteDarkOn.value = !siteDarkOn.value
  saveSiteDark(host.value, siteDarkOn.value)

  // 图标切换独立：缩小 → 到最小时切换图标 → 恢复，缩放合计 0.3s
  darkPressed.value = true
  setTimeout(() => {
    darkIconOn.value = siteDarkOn.value
    darkPressed.value = false
  }, 150)
}

const darkTitle = computed(() =>
  siteDarkOn.value ? '深色滤镜已开启，点击关闭' : '深色滤镜已关闭，点击开启',
)

// 站点级深色滤镜开关仅在有意义时展示：深色主题（含跟随系统的深色）且设置页为非"不处理"；
// 浅色主题 / 跟随系统浅色 / 设置不处理时隐藏（此时开了也不生效）
const showSiteDarkToggle = computed(() => isDark.value && iframeMaskMode.value !== 'off')

// 深色模式下 iframe 深色适配遮罩（off/black/invert）：浅色模式一律不生效，
// 设置页模式为关闭或当前站点开关关闭时也不叠加
const activeMask = computed(() => {
  if (!isDark.value) return 'off'
  if (iframeMaskMode.value === 'off') return 'off'
  return siteDarkOn.value ? iframeMaskMode.value : 'off'
})

// ===== iframe 加载动画（复用站内工具 ToolLoading）=====
const iframeLoading = ref(true)
const frameKey = ref(0)
let loadTimeout = null

function onFrameLoad() {
  iframeLoading.value = false
  clearTimeout(loadTimeout)
}

function reloadFrame() {
  // 点击缩小 → 恢复（与深色开关按钮一致的反馈）
  refreshPressed.value = true
  setTimeout(() => { refreshPressed.value = false }, 150)

  // 重新加载 iframe：触发 key 变化重建节点 + 重新启用加载动画
  iframeLoading.value = true
  frameKey.value++
  if (loadTimeout) clearTimeout(loadTimeout)
  loadTimeout = setTimeout(() => { iframeLoading.value = false }, 12000)
}

onMounted(() => {
  // 兜底：站点迟迟未触发 onload（如被 X-Frame-Options 拦截时个别浏览器行为），避免动画常驻
  loadTimeout = setTimeout(() => { iframeLoading.value = false }, 12000)
})

onBeforeUnmount(() => {
  if (loadTimeout) clearTimeout(loadTimeout)
})
</script>

<template>
  <div class="ext-view">
    <!-- 浏览器式导航栏：左侧按钮栏 + 右侧网址胶囊 -->
    <div class="ext-nav">
      <div class="ext-nav-buttons">
        <button
        type="button"
        class="ext-nav-btn"
        :class="{ 'ext-nav-btn--pressed': refreshPressed }"
        title="重新加载"
        @click="reloadFrame"
      >
          <NIcon :component="ArrowClockwise28Filled" :size="18" />
        </button>
        <button
          v-if="showSiteDarkToggle"
          type="button"
          class="ext-nav-btn"
          :class="{ 'ext-nav-btn--pressed': darkPressed }"
          :title="darkTitle"
          @click="toggleSiteDark"
        >
          <DarkFilterIcon :slash="!darkIconOn" :size="18" />
        </button>
      </div>
      <div class="ext-urlbar">
        <a
          class="ext-open"
          :href="iframeSrc"
          target="_blank"
          rel="noopener"
          title="在新标签页打开"
        >
          <NIcon :component="Open20Filled" :size="18" />
        </a>
        <span class="ext-url">{{ url }}</span>
      </div>
    </div>

    <div class="ext-frame-wrap">
      <Transition name="ext-fade">
        <div v-if="iframeLoading" class="ext-loading">
          <ToolLoading />
        </div>
      </Transition>
      <!-- sandbox 限制 iframe 权限（保留脚本/表单/弹窗等正常功能） -->
      <iframe
        :key="frameKey"
        class="ext-frame"
        :class="{
          'ext-frame--loading': iframeLoading,
          'ext-frame--invert': activeMask === 'invert',
        }"
        :src="iframeSrc"
        title="站外内容"
        sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin allow-downloads"
        @load="onFrameLoad"
      />
      <div v-if="activeMask === 'black'" class="ext-mask"></div>
    </div>
  </div>
</template>

<style scoped>
.ext-view {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 106px);
  min-height: 420px;
}

/* ===== 浏览器式导航栏 ===== */
.ext-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-bottom: 10px;
}

/* 左侧按钮栏（刷新 + 深色滤镜开关） */
.ext-nav-buttons {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.ext-nav-btn,
.ext-open {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  text-decoration: none;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, transform 0.15s ease;
}

.ext-nav-btn:hover,
.ext-open:hover {
  background: color-mix(in srgb, var(--text-primary) 8%, transparent);
  color: var(--text-primary);
}

.ext-nav-btn--pressed {
  transform: scale(0.85);
}

/* 网址胶囊：占满按钮之外的所有区域 */
.ext-urlbar {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 2px;
  height: 34px;
  padding: 0 14px 0 3px;
  border: 1px solid var(--border-color);
  border-radius: 100px;
  background: var(--bg-sub);
  transition: background-color 0.3s ease, border-color 0.3s ease;
}

/* 深色模式下网址胶囊背景与页面背景一致 */
[data-theme='dark'] .ext-urlbar {
  background: var(--bg-color);
}

/* 网址左侧的"新标签页打开"按钮 */
.ext-open {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ext-url {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  user-select: text;
  transition: color 0.3s ease;
}

/* ===== iframe 容器 ===== */
.ext-frame-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg-color);
  transition: border-color 0.3s ease, background-color 0.3s ease;
}

/* 加载中覆盖层：复用站内工具加载动画 */
.ext-loading {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--bg-color);
  border-radius: inherit;
  transition: background-color 0.3s ease;
}

.ext-frame {
  display: block;
  width: 100%;
  height: 100%;
  border: none;
}

/* 深色模式 iframe 遮罩 */
.ext-frame--invert {
  filter: invert(0.9) hue-rotate(175deg) saturate(1.2) contrast(1.05);
}

.ext-mask {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.6);
  border-radius: inherit;
}

/* 加载完成前隐藏 iframe，避免白色闪屏 */
.ext-frame--loading {
  visibility: hidden;
}

.ext-fade-enter-active,
.ext-fade-leave-active {
  transition: opacity 0.25s ease;
}

.ext-fade-enter-from,
.ext-fade-leave-to {
  opacity: 0;
}
</style>

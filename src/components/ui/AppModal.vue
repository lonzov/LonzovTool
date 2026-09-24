<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { NModal } from 'naive-ui'

/**
 * 全站统一的模态框外壳。
 *
 * 收编此前散落在 19 个模态框里的重复实现：modalStyle（宽度/圆角/紧凑高度）、
 * 640px 断点的 isCompact 样板、模糊遮罩层、以及页脚按钮。
 *
 * 只负责外壳与外观，不接管各模态框自己的业务逻辑：
 * 事件（@after-enter / @after-leave / @close / @esc）一律透传，
 * 内容延迟销毁（useModalContent）与内容高度过渡（useHeightTransition）
 * 各自按需在调用方使用。
 */
const props = defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: undefined },
  /** 数字按 px 处理；传 null 表示不限制高度 */
  maxWidth: { type: [String, Number], default: 520 },
  maxHeightOffset: { type: Number, default: 48 },
  closable: { type: Boolean, default: true },
  maskClosable: { type: Boolean, default: true },
  autoFocus: { type: Boolean, default: false },
  contentScrollable: { type: Boolean, default: false },
  blurMask: { type: Boolean, default: false },
  segmented: { type: [Boolean, Object], default: () => ({ content: true, footer: 'soft' }) },
  /**
   * 页脚按钮。数组项为 { text, variant, disabled, onClick }，
   * variant 可选 fill（主操作，反色块）/ outline（次操作）/ text（弱操作）/ danger（危险）。
   * 需要完全自由布局时改用 #footer 插槽。
   */
  actions: { type: Array, default: null },
})

const emit = defineEmits(['update:show', 'close', 'esc', 'after-enter', 'after-leave'])

// 本组件是多根（Teleport + NModal），$attrs 不会自动继承，显式转交给 NModal，
// 这样调用方仍能传 :z-index / :to 这类没在 props 里列举的 NModal 原生属性。
defineOptions({ inheritAttrs: false })

const isCompact = ref(false)
let mq = null
function onMqChange(e) {
  isCompact.value = e.matches
}
onMounted(() => {
  mq = window.matchMedia('(max-width: 640px)')
  isCompact.value = mq.matches
  mq.addEventListener('change', onMqChange)
})
onUnmounted(() => {
  if (mq) mq.removeEventListener('change', onMqChange)
})

const modalStyle = computed(() => ({
  maxWidth: typeof props.maxWidth === 'number' ? `${props.maxWidth}px` : props.maxWidth,
  width: 'calc(100% - 32px)',
  maxHeight: isCompact.value ? 'calc(100vh - 120px)' : `calc(100vh - ${props.maxHeightOffset}px)`,
  borderRadius: 'var(--radius-xl)',
}))
</script>

<template>
  <!-- 毛玻璃遮罩：NModal 自带遮罩的 background-color 是写死的，改不了，
       所以额外叠一层。挂到 body 上，层级压在移动端汉堡(1950)之上、NModal(≥2000)之下 -->
  <Teleport to="body">
    <Transition name="app-modal-blur">
      <div v-if="show && blurMask" class="app-modal-blur" />
    </Transition>
  </Teleport>

  <NModal
    v-bind="$attrs"
    :show="show"
    preset="card"
    class="app-modal"
    :title="title"
    :style="modalStyle"
    :segmented="segmented"
    :bordered="false"
    :closable="closable"
    :mask-closable="maskClosable"
    :auto-focus="autoFocus"
    :content-scrollable="contentScrollable"
    @update:show="emit('update:show', $event)"
    @close="emit('close')"
    @esc="emit('esc')"
    @after-enter="emit('after-enter')"
    @after-leave="emit('after-leave')"
  >
    <slot />

    <template #footer>
      <slot name="footer">
        <div v-if="actions" class="app-modal-actions">
          <button
            v-for="(action, i) in actions"
            :key="i"
            type="button"
            class="app-modal-btn"
            :class="`app-modal-btn--${action.variant || 'outline'}`"
            :disabled="action.disabled"
            @click="action.onClick"
          >
            {{ action.text }}
          </button>
        </div>
      </slot>
    </template>
  </NModal>
</template>

<style>
/* 类名落在 NCard 上（NModal 会把 $attrs.class 合并过去），
   半径走 token，平滑曲率下自动放大，不需要各处再写 @supports */
.app-modal {
  border-radius: var(--radius-xl);
}

.app-modal-blur {
  position: fixed;
  inset: 0;
  z-index: var(--z-blur-mask);
  background: var(--mask-blur);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  pointer-events: none;
}

.app-modal-blur-enter-active,
.app-modal-blur-leave-active {
  transition: opacity 0.3s ease;
}

.app-modal-blur-enter-from,
.app-modal-blur-leave-to {
  opacity: 0;
}

.app-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 8px;
}

.app-modal-btn {
  height: 34px;
  padding: 0 20px;
  border-radius: var(--radius-full);
  corner-shape: round;
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  border: none;
}

.app-modal-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

/* 小一号，用于模态框正文里的操作按钮 */
.app-modal-btn--sm {
  height: 30px;
  padding: 0 14px;
  font-size: 12px;
}

.app-modal-btn--fill {
  background: var(--primary);
  color: var(--primary-foreground);
}

.app-modal-btn--fill:hover {
  opacity: 0.85;
}

.app-modal-btn--outline {
  border: 1.5px solid currentColor;
  background: var(--card);
  color: var(--foreground);
}

.app-modal-btn--outline:hover {
  background: var(--muted);
}

.app-modal-btn--text {
  background: transparent;
  color: var(--foreground);
}

.app-modal-btn--text:hover {
  background: var(--accent);
}

.app-modal-btn--danger {
  background: var(--destructive);
  color: var(--destructive-foreground);
}

.app-modal-btn--danger:hover {
  opacity: 0.85;
}
</style>

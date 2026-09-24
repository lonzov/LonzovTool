<script>
/**
 * Naive Card 装饰部分的固定高度：header 68 + footer 83 + content 上下 padding 40。
 *
 * 用于反推「卡片内容区最多能有多高」—— 内容区高度过渡动画需要这个上限，
 * 否则目标高度会取成内容完整高度，动画就白做了（可见区域被父级裁剪、高度值变化不体现出来）。
 *
 * 刻意用常量而不是查询 `.n-card-header` / `.n-card-footer` / `.n-scrollbar-content`：
 * 那些是 Naive 内部结构，升级或调整就会静默失效；这几个数值是它的固定样式。
 */
export const MODAL_CARD_CHROME_HEIGHT = 191
</script>

<script setup>
import { ref, computed, toRef } from 'vue'
import { NModal } from 'naive-ui'
import { useHeightTransition } from '../../composables/useHeightTransition.js'

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
  /** 卡片描边。默认关闭（模态框靠阴影区分层级），需要时传 true */
  bordered: { type: Boolean, default: false },
  blurMask: { type: Boolean, default: false },
  /**
   * 内容高度变化时给模态框做高度过渡（增删条目、展开折叠、报错信息出现等）。
   * 内部会自行包一层 overflow:hidden 的动画容器，调用方不用再手写 wrap/inner 两层 DOM。
   */
  animated: { type: Boolean, default: false },
  /**
   * 内容/页脚分段。默认值取项目惯例（绝大多数模态框都用它），
   * 注意与 NModal 的默认 false 不同 —— 不需要分段时显式传 `:segmented="false"`。
   */
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

// 紧凑断点全站只有一份：模态框有十几个实例，各建一个 matchMedia 监听没必要
let compactRef = null
function getCompactRef() {
  if (!compactRef) {
    compactRef = ref(false)
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(max-width: 640px)')
      compactRef.value = mq.matches
      mq.addEventListener('change', (e) => {
        compactRef.value = e.matches
      })
    }
  }
  return compactRef
}
const isCompact = getCompactRef()

// 高度过渡：外层容器的高度由 hook 接管，内层高度自适应。
// 两层都由本组件持有，调用方只需加 animated 属性。
const animWrap = ref(null)
const animInner = ref(null)
useHeightTransition({ show: toRef(props, 'show'), inner: animInner, wrap: animWrap })

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
    :bordered="bordered"
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
    <div v-if="animated" ref="animWrap" class="app-modal-anim">
      <div ref="animInner">
        <slot />
      </div>
    </div>
    <slot v-else />

    <template #footer>
      <slot name="footer">
        <div v-if="actions" class="app-modal-actions">
          <button
            v-for="(action, i) in actions"
            :key="i"
            type="button"
            class="app-btn"
            :class="`app-btn--${action.variant || 'outline'}`"
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

/* 高度过渡容器：外层高度由 useHeightTransition 接管，内层高度自适应 */
.app-modal-anim {
  overflow: hidden;
  transition: height 260ms cubic-bezier(0.4, 0, 0.2, 1);
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
</style>

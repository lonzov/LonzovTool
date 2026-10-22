<script setup>
import { computed, onMounted, ref, watch } from 'vue'

/**
 * 分格验证码输入，观感对齐 shadcn/ui 的 InputOTP。
 *
 * 只有输入框是真的：它绝对定位铺满整块并完全透明，用户看到的分格全是装饰。
 * 粘贴、输入法、移动端数字键盘因此都走浏览器原生行为，不必自己维护格子焦点。
 */
const props = defineProps({
  value: { type: String, default: '' },
  length: { type: Number, default: 6 },
  disabled: { type: Boolean, default: false },
  /** '' 或 'error'，错误态所有格描边走 --destructive */
  status: { type: String, default: '' },
  /** 挂载即聚焦。需要用户先读说明的弹窗里传 false */
  autofocus: { type: Boolean, default: false },
})

const emit = defineEmits(['update:value', 'complete'])

const inputRef = ref(null)
const focused = ref(false)
/** 最近一次报过 complete 的串，避免同一串被反复上报 */
let completed = ''

const digits = computed(() => sanitize(props.value))
/** 三格拼成一个连续控件，组与组之间放一条短横线 */
const groups = computed(() => {
  const result = []
  for (let start = 0; start < props.length; start += 3) {
    const size = Math.min(3, props.length - start)
    result.push(Array.from({ length: size }, (_, offset) => start + offset))
  }
  return result
})
/** 活动格是下一个待输入的位置，填满后退到最后一格 */
const activeIndex = computed(() => Math.min(digits.value.length, props.length - 1))
const showCaret = computed(
  () => focused.value && !props.disabled && digits.value.length < props.length,
)

function sanitize(text) {
  return (typeof text === 'string' ? text : '').replace(/\D/g, '').slice(0, props.length)
}

function commit(next) {
  if (next !== props.value) emit('update:value', next)
  if (next.length !== props.length) {
    completed = ''
    return
  }
  if (next === completed) return
  completed = next
  emit('complete', next)
}

/** 受控：把输入框里的脏字符（字母、超出长度的部分）拨回净数字 */
function syncDom() {
  const input = inputRef.value
  if (input && input.value !== digits.value) input.value = digits.value
}

function focusInput() {
  const input = inputRef.value
  if (!input || props.disabled) return
  input.focus()
  // 视觉槽位不反映真实光标位置，统一钉在末尾，避免数字从中间插进去
  const end = input.value.length
  input.setSelectionRange(end, end)
}

onMounted(() => {
  if (props.autofocus) focusInput()
})

watch(
  () => props.value,
  syncDom,
  { flush: 'post' },
)

function handleInput(event) {
  const next = sanitize(event.target.value)
  if (event.target.value !== next) event.target.value = next
  commit(next)
}

function handleFocus() {
  focused.value = true
  syncDom()
}

function handleBlur() {
  focused.value = false
}

/** 整串粘贴按位填满：覆盖原内容，只取前 length 位数字 */
function handlePaste(event) {
  event.preventDefault()
  const next = sanitize(event.clipboardData?.getData('text') || '')
  if (!next) return
  if (inputRef.value) inputRef.value.value = next
  commit(next)
}

function isActive(index) {
  return focused.value && !props.disabled && index === activeIndex.value
}

defineExpose({ focus: focusInput })
</script>

<template>
  <div
    class="otp"
    :class="{ 'otp--error': status === 'error', 'otp--disabled': disabled }"
    @click="focusInput"
  >
    <template v-for="(group, groupIndex) in groups" :key="groupIndex">
      <div class="otp-group">
        <div
          v-for="index in group"
          :key="index"
          class="otp-slot"
          :class="{ 'otp-slot--active': isActive(index) }"
        >
          <span v-if="digits[index]" class="otp-char">{{ digits[index] }}</span>
          <span v-else-if="showCaret && index === activeIndex" class="otp-caret" />
        </div>
      </div>
      <svg
        v-if="groupIndex < groups.length - 1"
        class="otp-separator"
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M5 12h14" />
      </svg>
    </template>

    <input
      ref="inputRef"
      class="otp-input"
      :value="digits"
      type="text"
      inputmode="numeric"
      autocomplete="one-time-code"
      :maxlength="length"
      pattern="[0-9]*"
      :disabled="disabled"
      :aria-label="`验证码，共 ${length} 位`"
      :aria-invalid="status === 'error' || undefined"
      @input="handleInput"
      @paste="handlePaste"
      @focus="handleFocus"
      @blur="handleBlur"
    />
  </div>
</template>

<style scoped>
.otp {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  cursor: text;
}

/* 真输入框：透明铺满，只承接焦点、键入与粘贴，视觉全部由下面的槽位负责 */
.otp-input {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: transparent;
  opacity: 0;
  cursor: inherit;
  /* 移动端聚焦时字号小于 16px 会被浏览器放大整页 */
  font-size: 1rem;
}

/* 三格共用相邻描边拼成一个连续控件，组内不留缝 */
/* 组作为长度容器：格子随整行等比缩放时，数字与光标按 cqi 一起放大 */
.otp-group {
  display: flex;
  flex: 3 1 0;
  min-width: 0;
  container-type: inline-size;
}

.otp-slot {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 格子随整行等比缩放：flex 平分宽度，正方形由 aspect-ratio 保证，不做横向拉伸 */
  flex: 1 1 0;
  min-width: 0;
  aspect-ratio: 1;
  box-sizing: border-box;
  /* 字号跟着格子走，放大时不至于只有框变大、数字还是 14px */
  font-size: 12cqi;
  border-style: solid;
  /* 左边框只由每组首格补，组内的分界靠前一格的右边框 */
  border-width: 1px 1px 1px 0;
  border-color: var(--border);
  background: transparent;
  font-variant-numeric: tabular-nums;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.4s ease;
}

.otp-group .otp-slot:first-child {
  border-left-width: 1px;
  border-top-left-radius: var(--radius-md);
  border-bottom-left-radius: var(--radius-md);
}

.otp-group .otp-slot:last-child {
  border-top-right-radius: var(--radius-md);
  border-bottom-right-radius: var(--radius-md);
}

/* 深色下格底压一点点前景色，纯透明会让描边控件显得发飘 */
[data-theme='dark'] .otp-slot {
  background: color-mix(in srgb, var(--foreground) 6%, transparent);
}

.otp-slot--active {
  z-index: 10;
  /* 聚焦只把描边提亮一档、外面叠一圈浅灰环；再画一条高亮边框会比 shadcn 重一档 */
  border-color: var(--muted-foreground);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--muted-foreground) 42%, transparent);
}

.otp-char {
  color: var(--foreground);
  line-height: 1;
  transition: color 0.4s ease;
}

.otp-caret {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 1px;
  height: 15cqi;
  background: var(--foreground);
  transform: translate(-50%, -50%);
  animation: caret-blink 1.25s ease-out infinite;
}

.otp-separator {
  flex: 0 0 auto;
  color: var(--foreground);
  transition: color 0.4s ease;
}

/* 错误态优先于聚焦态：正在输入的那一格也要标出问题 */
.otp--error .otp-slot {
  border-color: var(--destructive);
}

.otp--error .otp-slot--active {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--destructive) 20%, transparent);
}

.otp--disabled {
  opacity: 0.5;
  cursor: default;
}

@keyframes caret-blink {
  0%,
  70%,
  100% {
    opacity: 1;
  }

  20%,
  50% {
    opacity: 0;
  }
}

/* 设置页关掉动效时停掉闪烁，光标仍然静态可见 */
html[data-motion='reduced'] .otp-caret {
  animation: none;
}

/* 窄屏按比例缩格，正方形比例不变，整组绝不横向溢出 */
@media (width <= 360px) {
  .otp {
    gap: 6px;
  }
}
</style>

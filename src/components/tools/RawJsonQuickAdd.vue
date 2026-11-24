<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Add16Filled } from '@vicons/fluent'
import AppButton from '../ui/AppButton.vue'

const emit = defineEmits(['add'])

const ADD_ENTRIES = [
  { type: 'text', label: '文本' },
  { type: 'selector', label: '选择器' },
  { type: 'score', label: '记分板' },
  { type: 'translate', label: '翻译键' },
]

const rootEl = ref(null)
const probeEl = ref(null)
/** 四个入口平铺不下时收成一个：入口不减少，只是不再并排 */
const collapsed = ref(false)

let observer = null

function measure() {
  const root = rootEl.value
  const probe = probeEl.value
  if (!root || !probe) return
  const available = root.clientWidth
  if (available <= 0) return
  collapsed.value = probe.scrollWidth > available
}

onMounted(() => {
  measure()
  if (typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver(measure)
  observer.observe(rootEl.value)
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div ref="rootEl" class="quick-add">
    <template v-if="!collapsed">
      <span v-for="entry in ADD_ENTRIES" :key="entry.type" class="quick-add-slot">
        <AppButton
          variant="solid"
          shape="pill"
          size="sm"
          block
          :icon="Add16Filled"
          @click="emit('add', entry.type)"
        >
          {{ entry.label }}
        </AppButton>
      </span>
    </template>
    <span v-else class="quick-add-slot">
      <AppButton
        variant="solid"
        shape="pill"
        size="sm"
        block
        :icon="Add16Filled"
        @click="emit('add', 'text')"
      >
        添加元素
      </AppButton>
    </span>

    <!-- 量一下四个入口平铺需要的宽度：隐藏但参与测量，宽度变化时启用收起态 -->
    <div ref="probeEl" class="quick-add-probe" aria-hidden="true">
      <AppButton
        v-for="entry in ADD_ENTRIES"
        :key="entry.type"
        variant="solid"
        shape="pill"
        size="sm"
      >
        {{ entry.label }}
      </AppButton>
    </div>
  </div>
</template>

<style scoped>
.quick-add {
  position: relative;
  display: flex;
  gap: 6px;
  width: 100%;
  flex-shrink: 0;
}
.quick-add-slot {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
}
.quick-add :deep(.app-btn__label) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.quick-add-probe {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  gap: 6px;
  visibility: hidden;
  pointer-events: none;
}
.quick-add-probe > * {
  flex: 0 0 auto;
}
</style>

<script setup>
import { ref, computed, watch } from 'vue'
import { NDrawer, NDrawerContent } from 'naive-ui'
import { useFeedbackDrawer } from '../composables/useFeedbackDrawer.js'

const FORM_URL = 'https://pcnk2disyt2p.feishu.cn/share/base/form/shrcnSkK8TS3y8eR4bnHkI1wmlc'

const props = defineProps({
  isMobile: { type: Boolean, default: false },
})

const { showFeedbackDrawer } = useFeedbackDrawer()

const drawerStyle = computed(() => ({
  background: 'var(--background)',
  borderLeft: '1px solid var(--border)',
  boxShadow: 'var(--shadow-drawer)',
  // 移动端铺满整屏，去掉左圆角，免得屏边露出下层页面
  ...(props.isMobile ? { borderTopLeftRadius: '0', borderBottomLeftRadius: '0' } : {}),
}))

// 首次打开才挂载 iframe：飞书表单体积不小，没必要每次进站都拉取
const iframeMounted = ref(false)
const iframeLoaded = ref(false)

watch(showFeedbackDrawer, (show) => {
  if (show) iframeMounted.value = true
})
</script>

<template>
  <NDrawer
    :show="showFeedbackDrawer"
    placement="right"
    :width="isMobile ? '100%' : 640"
    :z-index="2100"
    :style="drawerStyle"
    @update:show="showFeedbackDrawer = $event"
  >
    <NDrawerContent
      title="建议反馈"
      closable
      :body-content-style="{ padding: '0', height: '100%', overflow: 'hidden' }"
    >
      <div class="fb-body">
        <div v-if="!iframeLoaded" class="fb-skeleton"></div>
        <iframe
          v-if="iframeMounted"
          :src="FORM_URL"
          class="fb-iframe"
          :class="{ 'is-loaded': iframeLoaded }"
          title="建议反馈表单"
          frameborder="0"
          allowfullscreen
          @load="iframeLoaded = true"
        ></iframe>
      </div>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.fb-body {
  position: relative;
  height: 100%;
}

.fb-iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.fb-iframe.is-loaded {
  opacity: 1;
}

/* 飞书表单底色固定为浅色，深色模式下整体压暗，与文档页 IframeForm 的处理保持一致 */
[data-theme='dark'] .fb-iframe.is-loaded {
  filter: brightness(0.7);
}

.fb-skeleton {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    105deg,
    var(--muted) 0%,
    var(--muted) 35%,
    var(--card) 50%,
    var(--muted) 65%,
    var(--muted) 100%
  );
  background-size: 200% 100%;
  animation: fb-shimmer 1.8s ease-in-out infinite;
}

@keyframes fb-shimmer {
  from { background-position: 200% 0; }
  to   { background-position: -200% 0; }
}
</style>

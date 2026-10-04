<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import AppModal from './ui/AppModal.vue'

// 问卷地址与邀请版本：改写 SURVEY_VERSION 即视为新一轮邀请，
// 填过旧版本的用户会再次看到弹窗
const SURVEY_URL = 'https://f.kdocs.cn/g/UG0bhgFu/'
const SURVEY_VERSION = '261004'
const STORAGE_KEY = 'survey_notice_version'

// 「下次一定」的压制时长：只挡这一段时间，过期后重新弹
const SNOOZE_MS = 12 * 60 * 60 * 1000
const SNOOZE_KEY = 'survey_snooze_until'

const show = ref(false)
let timer = null

onMounted(() => {
  let stored = null
  let snoozeUntil = 0
  try {
    stored = localStorage.getItem(STORAGE_KEY)
    snoozeUntil = Number(localStorage.getItem(SNOOZE_KEY)) || 0
  } catch {
    // 隐私模式等场景读不到，按未填写处理
  }
  if (stored === SURVEY_VERSION || Date.now() < snoozeUntil) return
  // 与首屏渲染错开，避免刚进站就抢注意力
  timer = setTimeout(() => {
    show.value = true
  }, 1500)
})

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})

function handleLater() {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS))
  } catch {
    // 写不进去时只关闭本次弹窗
  }
  show.value = false
}

// 去填写即记下邀请版本，此后不再弹出；「下次一定」不记版本，仅压制 12 小时
function handleFill() {
  try {
    localStorage.setItem(STORAGE_KEY, SURVEY_VERSION)
  } catch {
    // 同上
  }
  window.open(SURVEY_URL, '_blank', 'noopener')
  show.value = false
}
</script>

<template>
  <AppModal
    v-model:show="show"
    title="填份匿名问卷"
    :max-width="470"
    :auto-focus="false"
    :actions="[
      { text: '下次一定', variant: 'outline', onClick: handleLater },
      { text: '去填写', variant: 'fill', onClick: handleFill },
    ]"
  >
    <div class="survey-body">
      <p class="survey-line">想听听你的使用体验，帮助我们改进小舟工具箱 :)</p>
      <p class="survey-line survey-line--sub">约 2~5 分钟，无需登录，打开即填</p>
    </div>
  </AppModal>
</template>

<style scoped>
.survey-body {
  padding: 2px 0;
}

.survey-line {
  margin: 0 0 8px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--foreground);
}

.survey-line:last-child {
  margin-bottom: 0;
}

.survey-line--sub {
  color: var(--muted-foreground);
}
</style>

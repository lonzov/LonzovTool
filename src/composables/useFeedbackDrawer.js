// 共享的反馈抽屉开关状态，供侧边栏菜单与关于页 CTA 共同唤起
import { ref } from 'vue'

const showFeedbackDrawer = ref(false)

export function useFeedbackDrawer() {
  function openFeedbackDrawer() {
    showFeedbackDrawer.value = true
  }

  return { showFeedbackDrawer, openFeedbackDrawer }
}

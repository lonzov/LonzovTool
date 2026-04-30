// 共享的 Cookie 设置弹窗状态，供 Footer 等外部组件触发
import { ref } from 'vue'

const showCookieModal = ref(false)

export function usePrivacyModal() {
  function openModal() {
    showCookieModal.value = true
  }

  return { showCookieModal, openModal }
}

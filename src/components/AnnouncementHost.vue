<script setup>
import { defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  ensureVisitorId,
  fetchAnnouncements,
  hasPrivacyConsent,
  pickAnnouncement,
  rememberDismissal,
} from '../composables/useAnnouncement.js'

const announcementModalPromise = import('./AnnouncementModal.vue')
const AnnouncementModal = defineAsyncComponent(() => announcementModalPromise)

const current = ref(null)
const visible = ref(false)
let loading = false
let loaded = false
let openTimer = null

function shouldSkip() {
  if (typeof window === 'undefined') return true
  const path = window.location.pathname
  return path.startsWith('/console') || path.startsWith('/dev')
}

async function load() {
  if (loaded || loading || shouldSkip() || !hasPrivacyConsent()) return
  loading = true
  try {
    const visitor = ensureVisitorId()
    const items = await fetchAnnouncements(visitor)
    // 等异步组件先挂成 show=false，再翻 show；否则首次打开没有入场过渡
    await announcementModalPromise
    await nextTick()
    current.value = pickAnnouncement(items)
    await nextTick()
    if (!current.value) return

    const delay = Math.max(0, Math.min(Number(current.value.delay_ms) || 0, 10000))
    clearOpenTimer()
    if (delay > 0) {
      openTimer = setTimeout(() => {
        openTimer = null
        visible.value = true
      }, delay)
    } else {
      visible.value = true
    }
  } catch {
    // 公告失败不影响站点可用性
  } finally {
    loading = false
    loaded = true
  }
}

function onConsentChanged() {
  clearOpenTimer()
  loaded = false
  load()
}

function clearOpenTimer() {
  if (openTimer) clearTimeout(openTimer)
  openTimer = null
}

function close(memory = {}) {
  clearOpenTimer()
  if (current.value) rememberDismissal(current.value, memory)
  // 先保留公告数据，等 NModal 的离场动画结束后再卸载
  visible.value = false
}

function handleAfterLeave() {
  current.value = null
}

onMounted(() => {
  window.addEventListener('privacy-consent-changed', onConsentChanged)
  load()
})

onBeforeUnmount(() => {
  clearOpenTimer()
  window.removeEventListener('privacy-consent-changed', onConsentChanged)
})
</script>

<template>
  <AnnouncementModal
    :show="visible"
    :announcement="current"
    @close="close"
    @after-leave="handleAfterLeave"
  />
</template>

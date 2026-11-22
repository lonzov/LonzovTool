<script setup>
import { computed, h, onBeforeUnmount, watch } from 'vue'
import { NDropdown, NIcon, useMessage } from 'naive-ui'
import { Copy24Regular, Open24Regular, Star24Filled, Star24Regular } from '@vicons/fluent'
import { useCardContextMenu } from '../composables/useCardContextMenu.js'
import { favoriteKeyOf, useFavorites } from '../composables/useFavorites.js'
import { attachThemeParams } from '../composables/useUrlTheme.js'
import { useLocalStats } from '../composables/useLocalStats.js'
import { copyText } from '../utils/clipboard.js'

const { cardMenu, closeCardContextMenu } = useCardContextMenu()
const { isFavorite, toggleFavorite } = useFavorites()
const { countNavClick } = useLocalStats()
const message = useMessage()

const renderIcon = (component) => () => h(NIcon, { component, size: 16 })

const favoriteActive = computed(() => isFavorite(favoriteKeyOf(cardMenu.card)))

const options = computed(() => {
  const hasLink = !!cardMenu.card?.link
  return [
    {
      key: 'favorite',
      label: favoriteActive.value ? '取消收藏' : '收藏',
      icon: renderIcon(favoriteActive.value ? Star24Filled : Star24Regular),
    },
    {
      key: 'copy-link',
      label: '复制链接',
      icon: renderIcon(Copy24Regular),
      disabled: !hasLink,
    },
    {
      key: 'open-new-tab',
      label: '新标签页打开',
      icon: renderIcon(Open24Regular),
      disabled: !hasLink,
    },
  ]
})

// 站内卡片补成绝对地址；站外地址沿用带主题参数的版本，与卡片点击时的行为保持一致
function resolveUrl(card, withTheme) {
  const link = card?.link || ''
  if (!link) return ''
  if (link.startsWith('/')) return new URL(link, window.location.origin).href
  return withTheme ? attachThemeParams(link) : link
}

function handleSelect(key) {
  const card = cardMenu.card
  if (!card) return

  if (key === 'favorite') {
    const added = toggleFavorite(favoriteKeyOf(card))
    message.info(added ? '已收藏' : '已取消收藏', { duration: 1500 })
  } else if (key === 'copy-link') {
    copyText(resolveUrl(card)).then((copied) => {
      if (copied) message.success('已复制', { duration: 1000 })
      else message.error('复制失败，请重试', { duration: 1000 })
    })
  } else if (key === 'open-new-tab') {
    const url = resolveUrl(card, true)
    if (!url) return
    window.open(url, '_blank', 'noopener')
    countNavClick()
    if (card.toolId && window.umami) window.umami.track(card.toolId)
  }

  closeCardContextMenu()
}

/* 本菜单是手动定位（x/y）触发的，Naive 不会替我们判断外部点击；
   菜单固定在视口坐标上，滚动后也会跟着错位，所以滚动与缩放时一并关掉 */
let listening = false

function handlePointerDown(event) {
  if (event.target instanceof Element && event.target.closest('.n-dropdown')) return
  closeCardContextMenu()
}

function startListening() {
  if (listening) return
  listening = true
  document.addEventListener('pointerdown', handlePointerDown, true)
  window.addEventListener('scroll', closeCardContextMenu, { capture: true, passive: true })
  window.addEventListener('resize', closeCardContextMenu)
}

function stopListening() {
  if (!listening) return
  listening = false
  document.removeEventListener('pointerdown', handlePointerDown, true)
  window.removeEventListener('scroll', closeCardContextMenu, { capture: true })
  window.removeEventListener('resize', closeCardContextMenu)
}

watch(
  () => cardMenu.show,
  (show) => (show ? startListening() : stopListening()),
)

// 状态在模块级共享，离开首页时重置，避免下次进来带着旧坐标直接弹出
onBeforeUnmount(() => {
  stopListening()
  closeCardContextMenu()
})
</script>

<template>
  <NDropdown
    trigger="manual"
    placement="bottom-start"
    :show="cardMenu.show"
    :x="cardMenu.x"
    :y="cardMenu.y"
    :options="options"
    @select="handleSelect"
    @update:show="cardMenu.show = $event"
  />
</template>

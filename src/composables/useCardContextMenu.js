import { reactive } from 'vue'

// 卡片右键/长按菜单的目标与坐标。全局只挂一个菜单实例，卡片只负责触发，
// 菜单被重复触发时改坐标与目标即可，不需要等上一个实例卸载。
const cardMenu = reactive({
  show: false,
  x: 0,
  y: 0,
  card: null,
})

export function openCardContextMenu({ x, y, card }) {
  cardMenu.x = x
  cardMenu.y = y
  cardMenu.card = card
  cardMenu.show = true
}

export function closeCardContextMenu() {
  cardMenu.show = false
}

export function useCardContextMenu() {
  return { cardMenu, openCardContextMenu, closeCardContextMenu }
}

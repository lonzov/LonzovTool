// 首页推广位图片索引（独立模块：构建后为独立 chunk，由 PromoCarousel 动态导入）
// 单项结构 { id, eventId?, image, title?, link? }；image 为空的条目视为没配（不占位），图片加载失败的滑片渲染灰底图标占位
// eventId 是点击上报的事件名后缀，实际上报为 `Promo+<eventId>`；不配则该滑片不上报
// image 写 src/assets/ads/ 下的文件名——构建时由 Vite 输出为带哈希的同源地址，换图即换 URL，不会残留旧缓存；
// 也接受 http(s) 完整外链，供还没入库的临时素材用

// 素材目录收成「文件名 → 构建后 URL」的表：新增或替换广告图只需往 src/assets/ads/ 丢文件，不用回来补 import
const AD_IMAGE_URLS = import.meta.glob('../assets/ads/*.{webp,png,jpg,jpeg,avif}', {
  eager: true,
  query: '?url',
  import: 'default',
})

// 查不到说明文件名写错或图没放进来，按“没配”处理——只给开发期告警，线上静默降级成灰底占位
function toImageUrl(image) {
  if (typeof image !== 'string' || !image) return ''
  if (/^https?:\/\//i.test(image)) return image
  const url = AD_IMAGE_URLS[`../assets/ads/${image}`]
  if (!url && import.meta.env.DEV) {
    console.warn(`[homePromo] 找不到广告图 ${image}，该位按未配置处理`)
  }
  return url || ''
}

const config = {
  // 首屏位
  first: null,

  // 付费位（交替）：数组下标即付费位序号，没配的位写 null
  paid: [
    null,
    {
      id: 2,
      eventId: 'sampixel',
      image: 'sampixel.webp',
      link: 'https://sam.moe5200.com/',
    },
  ],

  // 免费位
  free: {
    id: 1,
    eventId: 'jzfk',
    image: 'jzfk.webp',
    link: 'https://jzfk.indevs.in/',
  },

  // 公告位
  notice: {
    id: 1,
    eventId: 'notice',
    image: 'notice.webp',
    link: '/docs/promotion',
  },
}

function resolveSlot(slot) {
  if (!slot || typeof slot !== 'object') return null
  return { ...slot, image: toImageUrl(slot.image) }
}

// 组件只认成品 URL，故出口统一把 image 解析掉。按“标量档位 / 数组档位”泛化遍历，
// 以后加档位不必再补一行解析
const resolved = {}
for (const [name, value] of Object.entries(config)) {
  resolved[name] = Array.isArray(value) ? value.map(resolveSlot) : resolveSlot(value)
}

export default resolved

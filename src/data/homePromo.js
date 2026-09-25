// 首页推广位图片索引（独立模块：构建后为独立 chunk，由 PromoCarousel 动态导入）
// 单项结构 { id, eventId?, image, title?, link? }；image 为空的条目视为没配（不占位），图片加载失败的滑片渲染灰底图标占位
// eventId 是点击上报的事件名后缀，实际上报为 `Promo+<eventId>`；不配则该滑片不上报
export default {
  // 首屏位
  first: null,

  // 付费位（交替）：数组下标即付费位序号，没配的位写 null
  paid: [
    null,
    {
      id: 2,
      eventId: 'sampixel',
      image: 'https://bu.dusays.com/2026/09/25/6ab5ca4392ac1.webp',
      link: 'https://sam.moe5200.com/',
    },
  ],

  // 免费位
  free: null,

  // 公告位
  notice: {
    id: 1,
    eventId: 'notice',
    image: 'https://bu.dusays.com/2026/09/11/6aa3c7ccae09a.webp',
    link: '/docs/promotion',
  },
}

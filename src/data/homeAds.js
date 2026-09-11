// 首页广告推广位图片索引（独立模块：构建后为独立 chunk，由 AdCarousel 动态导入）
// 单项结构 { id, image, title?, link? }；image 为空的条目视为没配（不占位），图片加载失败的滑片渲染灰底图标占位
export default {
  // 首屏位
  first: null,

  // 付费位（交替）
  paid: [],

  // 免费位
  free: null,

  // 公告位
  notice: {
    id: 1,
    image: 'https://bu.dusays.com/2026/09/11/6aa3c7ccae09a.webp',
    link: '/docs/promotion',
  },
}

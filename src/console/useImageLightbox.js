/**
 * 截图灯箱：按需加载 Viewer.js。
 *
 * 只在控制台里用，所以不放进首屏包：第一次点开截图时才拉 JS 与 CSS，
 * 公开站访客永远不会为它付出下载成本。
 */

let ViewerClass = null
let viewerInstance = null
let viewerSource = null
let openToken = 0

async function loadViewer() {
  if (ViewerClass) return ViewerClass
  const [module] = await Promise.all([
    import('viewerjs'),
    import('viewerjs/dist/viewer.css'),
  ])
  ViewerClass = module.default
  return ViewerClass
}

function teardownViewer() {
  const viewer = viewerInstance
  const source = viewerSource
  viewerInstance = null
  viewerSource = null
  if (viewer) viewer.destroy()
  if (source) source.remove()
}

/**
 * 打开一组截图。
 * @param {string[]} urls 图片地址（本站鉴权接口，同源请求会带上会话 Cookie）
 * @param {number} startIndex 从第几张开始看
 */
export async function openImageLightbox(urls, startIndex = 0) {
  const list = (urls || []).filter(Boolean)
  if (!list.length) return

  const token = ++openToken
  teardownViewer()

  const Viewer = await loadViewer()
  // 加载期间又打开了另一组图，后发起的请求覆盖先发起的
  if (token !== openToken) return

  const source = document.createElement('div')
  source.className = 'console-image-viewer-source'
  source.style.display = 'none'
  for (const src of list) {
    const image = document.createElement('img')
    image.src = src
    image.alt = '反馈截图'
    image.loading = 'eager'
    source.appendChild(image)
  }
  document.body.appendChild(source)
  viewerSource = source

  const viewer = new Viewer(source, {
    inline: false,
    initialViewIndex: Math.min(Math.max(startIndex, 0), list.length - 1),
    zIndex: 2300,
    navbar: false,
    title: false,
    toolbar: {
      zoomIn: true,
      zoomOut: true,
      oneToOne: true,
      reset: true,
      prev: true,
      next: true,
      rotateLeft: true,
      rotateRight: true,
      play: false,
    },
    loop: false,
    transition: true,
    keyboard: true,
    hidden() {
      teardownViewer()
    },
  })
  viewerInstance = viewer
  viewer.view()
}

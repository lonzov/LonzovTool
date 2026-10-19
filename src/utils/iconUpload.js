const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'ico']

/* 两个上限要分开：
   - MAX_SOURCE_BYTES：允许用户挑多大的原图。本机会先压缩，所以这里可以放宽——
     手机直出的照片动辄几 MB，卡在 1 MB 只会逼用户自己去压；
   - MAX_BYTES：压缩后真正发给后端的体积，与后端 `SUBMISSION_ICON_MAX_BYTES` 对齐。 */
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024
export const MAX_BYTES = 1024 * 1024

/* 与后端 sitedata/images.py 一致的参数：高 ≤128、宽 ≤256、WebP q82、更小的不放大。
   客户端先压是为了省流量与即时预览；服务端仍会再压一次作为规范与兜底。 */
export const LOGO_HEIGHT = 128
export const LOGO_MAX_WIDTH = 256
export const LOGO_QUALITY = 0.82

/**
 * 前端侧的图标预检：只为省一次失败往返，判据仍在服务端。
 * 服务端会用图片解码核对真实格式，这里不做内容嗅探。
 * @returns {string} 错误文案，空串表示通过
 */
export function checkIconFile(file) {
  if (!file) return ''

  const extension = (file.name.split('.').pop() || '').toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return `图标仅支持 ${ALLOWED_EXTENSIONS.map((item) => item.toUpperCase()).join('、')} 格式；SVG 请改用图床链接`
  }
  if (file.size > MAX_SOURCE_BYTES) {
    return '图标文件过大（超过 10 MB），请换一张'
  }
  return ''
}

/**
 * 在浏览器里把图标压成规范 WebP。
 * 任何一步失败都退回原文件——压缩只是优化，不能让用户因此传不上去。
 */
export async function compressIcon(file) {
  if (!file || typeof createImageBitmap !== 'function') return file

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, LOGO_HEIGHT / bitmap.height, LOGO_MAX_WIDTH / bitmap.width)
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', LOGO_QUALITY))
    if (!blob) return file

    const baseName = file.name.replace(/\.[^.]+$/, '')
    return new File([blob], `${baseName}.webp`, { type: 'image/webp' })
  } catch {
    return file
  }
}

/**
 * 一次拿到"可上传的图标"或一句可读的错误。
 * 先压再判体积：压完还超 1 MB 说明本机压缩没生效（老浏览器），此时才拦。
 */
export async function prepareIcon(file) {
  const formatError = checkIconFile(file)
  if (formatError) return { file: null, error: formatError }

  const prepared = await compressIcon(file)
  if (prepared.size > MAX_BYTES) {
    return {
      file: null,
      error: '浏览器无法在本机压缩这张图片，请上传 1 MB 以内的图标，或改用图床链接',
    }
  }
  return { file: prepared, error: '' }
}

export { ALLOWED_EXTENSIONS }

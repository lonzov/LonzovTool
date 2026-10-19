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

/* 推广图是 1200×400 的横幅，与后端 SUBMISSION_PROMO_* 对齐；
   只按宽度封顶、高度等比，避免把 3:1 的图压变形。 */
export const PROMO_MAX_WIDTH = 1200
export const PROMO_MAX_HEIGHT = 600
export const PROMO_QUALITY = 0.82

/**
 * 前端侧的图片预检：只为省一次失败往返，判据仍在服务端。
 * 服务端会用图片解码核对真实格式，这里不做内容嗅探。
 * @returns {string} 错误文案，空串表示通过
 */
export function checkImageFile(file, label = '图标') {
  if (!file) return ''

  const extension = (file.name.split('.').pop() || '').toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return `${label}仅支持 ${ALLOWED_EXTENSIONS.map((item) => item.toUpperCase()).join('、')} 格式；SVG 请改用图床链接`
  }
  if (file.size > MAX_SOURCE_BYTES) {
    return `${label}文件过大（超过 10 MB），请换一张`
  }
  return ''
}

/** 兼容旧调用点：图标预检 */
export function checkIconFile(file) {
  return checkImageFile(file, '图标')
}

/**
 * 在浏览器里把图片压成规范 WebP。
 * 任何一步失败都退回原文件——压缩只是优化，不能让用户因此传不上去。
 * @param {File} file 原图
 * @param {{maxWidth: number, maxHeight: number, quality: number}} bounds 尺寸与质量上限
 */
export async function compressImage(file, bounds) {
  if (!file || typeof createImageBitmap !== 'function') return file

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(
      1,
      bounds.maxHeight / bitmap.height,
      bounds.maxWidth / bitmap.width,
    )
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', bounds.quality))
    if (!blob) return file

    const baseName = file.name.replace(/\.[^.]+$/, '')
    return new File([blob], `${baseName}.webp`, { type: 'image/webp' })
  } catch {
    return file
  }
}

/** 图标压缩：高 ≤128、宽 ≤256 */
export async function compressIcon(file) {
  return compressImage(file, {
    maxWidth: LOGO_MAX_WIDTH,
    maxHeight: LOGO_HEIGHT,
    quality: LOGO_QUALITY,
  })
}

const LOGO_BOUNDS = { maxWidth: LOGO_MAX_WIDTH, maxHeight: LOGO_HEIGHT, quality: LOGO_QUALITY }
const PROMO_BOUNDS = { maxWidth: PROMO_MAX_WIDTH, maxHeight: PROMO_MAX_HEIGHT, quality: PROMO_QUALITY }

/**
 * 一次拿到"可上传的图片"或一句可读的错误。
 * 先压再判体积：压完还超 1 MB 说明本机压缩没生效（老浏览器），此时才拦。
 */
export async function prepareImage(file, bounds, label = '图片') {
  const formatError = checkImageFile(file, label)
  if (formatError) return { file: null, error: formatError }

  const prepared = await compressImage(file, bounds)
  if (prepared.size > MAX_BYTES) {
    return {
      file: null,
      error: `浏览器无法在本机压缩这张图片，请上传 1 MB 以内的${label}，或改用图床链接`,
    }
  }
  return { file: prepared, error: '' }
}

/** 图标：256×128 内的 WebP */
export async function prepareIcon(file) {
  return prepareImage(file, LOGO_BOUNDS, '图标')
}

/** 推广图：宽 ≤1200 的横幅 WebP */
export async function preparePromoImage(file) {
  return prepareImage(file, PROMO_BOUNDS, '推广图')
}

export { ALLOWED_EXTENSIONS }

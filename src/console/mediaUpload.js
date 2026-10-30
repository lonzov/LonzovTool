import { consoleFetch } from './consoleRequest.js'

/**
 * 控制台通用图片上传：按用途落到公开媒体目录并返回 `{ path, width, height, bytes }`。
 * 调用方负责先完成身份确认；这里只做一次请求，不重试。
 */
export function uploadMediaImage(purpose, file) {
  const body = new FormData()
  body.append('purpose', purpose)
  body.append('image', file)
  return consoleFetch('/api/v1/console/media/images', {
    method: 'POST',
    body,
    timeoutMs: 45000,
  })
}

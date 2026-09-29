/**
 * 写入剪贴板，返回是否成功。调用方只管按返回值给提示。
 *
 * navigator.clipboard 只在安全上下文里存在：用 http（比如局域网 IP 调试手机端）打开时它是
 * undefined，直接调 .writeText 会同步抛错，promise 的 catch 兜不住，所以要整体 try 住再退回
 * execCommand。
 */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return copyViaExecCommand(text)
  }
}

function copyViaExecCommand(text) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  // 只读 + 移出视口，避免复制瞬间页面跳动或弹出输入法
  textarea.setAttribute('readonly', '')
  textarea.style.cssText = 'position:fixed;left:-9999px'
  document.body.appendChild(textarea)
  try {
    textarea.select()
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    textarea.remove()
  }
}

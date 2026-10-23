/**
 * 写入剪贴板，返回是否成功。调用方只管按返回值给提示。
 *
 * 两条路径，顺序不能反：
 * 1. `navigator.clipboard`：只在安全上下文（https / localhost）存在。用 http 打开
 *    （比如局域网 IP 调试手机端）时它是 undefined，直接调 .writeText 会同步抛错，
 *    promise 的 catch 兜不住，所以要整体 try 住再退回下一层。
 * 2. 隐藏 textarea + `execCommand('copy')`：老浏览器与 http 下唯一可用的路径。
 *
 * 第二层有两个坑，都在下面处理了：
 * - 焦点被对话框/抽屉锁住时（NModal、NDrawer 都会锁），挂到 body 上的 textarea 会被
 *   立刻夺回焦点，选中区随之失效，而 `execCommand` 仍返回 true——于是"提示复制成功、
 *   剪贴板里什么都没有"。所以允许调用方传入容器元素，把 textarea 挂进当前焦点子树。
 * - 即使如此也可能选不中，因此复制前核对选中长度，对不上就如实返回失败。
 */
export async function copyText(text, options = {}) {
  const value = typeof text === 'string' ? text : ''
  if (!value) return false

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch {
      // 落到下面的兜底路径
    }
  }

  return copyViaSelection(value, options.container)
}

function copyViaSelection(value, container) {
  const host = container?.isConnected ? container : document.body
  const textarea = document.createElement('textarea')
  textarea.value = value
  // 只读 + 移出视口，避免复制瞬间页面跳动或弹出输入法
  textarea.setAttribute('readonly', '')
  textarea.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0'
  host.appendChild(textarea)

  try {
    textarea.focus({ preventScroll: true })
    textarea.select()
    textarea.setSelectionRange(0, value.length)
    if (textarea.selectionEnd - textarea.selectionStart !== value.length) return false
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    textarea.remove()
  }
}

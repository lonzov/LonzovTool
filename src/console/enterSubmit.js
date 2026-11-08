/**
 * 控制台表单的 Enter 提交判定。
 *
 * 输入法组合中的 Enter、文本域换行、按钮/链接自身行为，以及 Naive 的下拉、
 * 日期、数字输入等非文本控件都不应触发表单保存。
 */
export function submitOnEnter(event, submit) {
  if (event.isComposing || event.keyCode === 229 || event.repeat) return

  const target = event.target
  if (target instanceof HTMLElement) {
    if (
      target.closest(
        'button, a, textarea, [role="button"], [contenteditable="true"], ' +
          '.n-select, .n-date-picker, .n-input-number, .n-cascader, ' +
          '.n-checkbox, .n-radio, .n-switch',
      )
    ) {
      return
    }
  }

  event.preventDefault()
  submit()
}

/**
 * 把 User-Agent 压成一句人话："Chrome · Windows"。
 *
 * 只做展示用，判据是 UA 里的品牌与平台标记；认不出来就退回"未知设备"，
 * 原始 UA 仍在界面上以 title 提供，排查时不会被丢掉。
 */

const BROWSERS = [
  { key: 'edge', label: 'Edge', pattern: /Edg(?:e|A|iOS)?\// },
  { key: 'opera', label: 'Opera', pattern: /OPR\/|Opera/ },
  { key: 'firefox', label: 'Firefox', pattern: /Firefox\/|FxiOS\// },
  // Chrome 的 UA 里同时也含 Safari，必须排在 Safari 之前
  { key: 'chrome', label: 'Chrome', pattern: /Chrome\/|CriOS\// },
  { key: 'safari', label: 'Safari', pattern: /Safari\// },
]

const PLATFORMS = [
  { key: 'windows', label: 'Windows', pattern: /Windows NT/ },
  { key: 'ios', label: 'iOS', pattern: /iPhone|iPad|iPod/ },
  { key: 'android', label: 'Android', pattern: /Android/ },
  { key: 'macos', label: 'macOS', pattern: /Mac OS X|Macintosh/ },
  { key: 'linux', label: 'Linux', pattern: /Linux/ },
]

function match(list, value) {
  return list.find((item) => item.pattern.test(value)) || null
}

/**
 * @param {string} userAgent 原始 UA
 * @returns {{ label: string, browser: string, platform: string, mobile: boolean }}
 */
export function describeDevice(userAgent) {
  const ua = userAgent || ''
  const browser = match(BROWSERS, ua)
  const platform = match(PLATFORMS, ua)

  const parts = [browser?.label, platform?.label].filter(Boolean)
  return {
    label: parts.length ? parts.join(' · ') : '未知设备',
    browser: browser?.label || '',
    platform: platform?.label || '',
    mobile: platform?.key === 'ios' || platform?.key === 'android',
  }
}

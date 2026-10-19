/**
 * 极验行为验证（gt4）的公开配置。
 *
 * captcha_id 会随页面下发到浏览器，属公开信息；captcha_key 只在服务端用于签名，
 * 绝不允许出现在前端（构建产物里出现即是泄露）。
 * 允许用 VITE_GEETEST_CAPTCHA_ID 覆盖，便于切到测试号或本地等其它业务模块。
 */
export const GEETEST_CAPTCHA_ID =
  import.meta.env.VITE_GEETEST_CAPTCHA_ID || '8f323a8d3a27c052129e6044e8db0d8f'

/** 官方脚本地址；可用 VITE_GEETEST_SCRIPT_URL 指向自托管副本 */
export const GEETEST_SCRIPT_URL =
  import.meta.env.VITE_GEETEST_SCRIPT_URL || 'https://static.geetest.com/v4/gt4.js'

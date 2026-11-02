/**
 * Cloudflare Turnstile 的公开配置。
 *
 * site key 会随页面下发到浏览器，属公开信息；secret 只在服务端 siteverify 使用，
 * 绝不允许出现在前端。允许用 VITE_TURNSTILE_SITE_KEY 覆盖，便于本地换测试号。
 */
export const TURNSTILE_SITE_KEY =
  import.meta.env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAAFwg0W_iar4Fxb13'

/** 显式渲染模式：只在服务端判定极验不可用、需要降级时才创建 widget */
export const TURNSTILE_SCRIPT_URL =
  import.meta.env.VITE_TURNSTILE_SCRIPT_URL ||
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

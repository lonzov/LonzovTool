import { h } from 'vue'
import { getDiscreteMessage } from '../utils/discreteMessage'

// 荣耀浏览器（HonorBrowser/3.8.1.x）内核会绕开页面资源加载，直接往 DOM 里塞侧边悬浮广告容器，
// 不经过本站响应，HTTPS 与 SRI 均拦不住，只能在渲染后隐藏并向统计端上报。
// 已确认非运营商劫持：回放日志 UA 含 HonorBrowser/3.8.1.305、机型 KOZ-AL00、IP 为电信 IPv6。
// 240e:330:a822:2100:1557:de95:18d8:cac9 - - [23/Sep/2026:18:14:26 +0800] "POST /api/record HTTP/2.0" 200 31 "https://tool.lonzov.top/" "Mozilla/5.0 (Linux; Android 10; KOZ-AL00) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.5845.114 HonorBrowser/3.8.1.305  Mobile Safari/537.36"
// 命中后以元素自身 id 生成标识（fuckHonorAd-<id>），便于用户截图反馈时定位到具体容器。
const AD_RULES = [
  {
    vendor: 'fuck-Honor',
    // 不写死具体 id：凡是 id 同时含 Honor 与 Ad 的都判为荣耀注入的广告容器，
    // 以备其更换容器命名
    selectors: ['[id*="Honor" i][id*="Ad" i]'],
  },
]

const AD_SELECTOR = AD_RULES.flatMap((rule) => rule.selectors).join(',')
const AD_EVENT = 'fuck-honor-ad-blocked'

// 同一条广告（同一容器 id）本次会话只提醒一次。宿主可能周期性重塞容器，
// 而提示为 duration:0 不自动消失、message 又没有数量上限，逐次提醒会无限堆积。
// 模块级而非组件级：跨组件重挂载也要记得已经提醒过。
const notifiedIds = new Set()

// 上报上下文用于评估影响面：ua 区分荣耀机型版本，inIframe 决定隐藏样式能否压住，
// delayMs 区分注入发生在首屏还是延迟注入
function reportAd(id, vendor) {
  const umami = window.umami
  if (!umami || typeof umami.track !== 'function') return
  umami.track(AD_EVENT, {
    id,
    vendor,
    ua: navigator.userAgent,
    inIframe: window.top !== window.self,
    delayMs: Math.round(performance.now()),
  })
}

// 由 useHonorGuard 确认是荣耀浏览器后动态 import 并调用。
// 不做生命周期注册：动态 import 之后已拿不到组件实例，故调用即生效，返回停止函数。
export function useFuckHonorAdGuard() {
  const seen = new WeakSet()

  function handleHit(el, vendor) {
    // 容器与它内部的节点可能都命中选择器（如 HonorWebSideFloatingAdContainer
    // 与 HonorWebSideFloatingObserveId），只处理最外层，避免一次注入弹多条提示
    if (el.parentElement?.closest(AD_SELECTOR)) return
    if (seen.has(el)) return
    seen.add(el)

    el.style.setProperty('display', 'none', 'important')

    const id = el.id ? `fuckHonorAd-${el.id}` : 'fuckHonorAd-unknown'
    reportAd(id, vendor)

    if (notifiedIds.has(id)) return
    notifiedIds.add(id)

    getDiscreteMessage()?.warning(
      () =>
        h('div', { style: { lineHeight: '1.6', wordBreak: 'break-all' } }, [
          '检测到【荣耀浏览器】注入广告，已尝试隐藏，请立即截图并前往关于页反馈！',
          h('br'),
          `(ID: ${id})`,
        ]),
      { duration: 0, closable: true },
    )
  }

  function scanAll() {
    for (const el of document.querySelectorAll(AD_SELECTOR)) {
      const rule = AD_RULES.find((r) => r.selectors.some((s) => el.matches(s)))
      if (rule) handleHit(el, rule.vendor)
    }
  }

  // 只检查新增子树，避免每次 DOM 变动都全量查询
  function inspect(node) {
    for (const rule of AD_RULES) {
      const selector = rule.selectors.join(',')
      if (node.matches(selector)) handleHit(node, rule.vendor)
      for (const el of node.querySelectorAll(selector)) handleHit(el, rule.vendor)
    }
  }

  // 广告可能在 Vue 挂载前就已注入
  scanAll()

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === 1) inspect(node)
      }
    }
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })

  return () => observer.disconnect()
}

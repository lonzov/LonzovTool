// 下载页配置索引（手动维护映射）
export { default as zhilingYinfuhe } from './zhiling-yinfuhe.json'
export { default as mcYufabao } from './mc-yufabao.json'
export { default as AIEXFMBE } from './AIEX-FMBE.json'
export { default as HOSDLA } from './HOSDLA-toolbox.json'

// slug → 模块映射
const moduleMap = {
  'zhiling-yinfuhe': () => import('./zhiling-yinfuhe.json'),
  'mc-yufabao': () => import('./mc-yufabao.json'),
  'AIEX-FMBE': () => import('./AIEX-FMBE.json'),
  'HOSDLA-toolbox': () => import('./HOSDLA-toolbox.json')
}

export function getDownloadConfig(slug) {
  return moduleMap[slug] || null
}

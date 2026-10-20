import { computed, inject, provide } from 'vue'
import { useConsoleAuth } from './consoleAuth.js'

/**
 * 控制台权限判定。
 *
 * 这里只决定「显示什么」，不是安全边界：每次写操作都由服务端独立鉴权，
 * 绕过这个模块最多点出一串 403（契约见后端仓库 docs/api.md）。
 *
 * 判定口径与服务端一致，默认拒绝：
 * - 没有授权就是没有权限，`'*'` 是超管的通配授权；
 * - `scope` 为空串表示该权限点下的全部对象，否则只放行命中的对象；
 * - 不传 `scope` 时只问「有没有这个能力」，用于菜单与整块内容的显隐。
 */

const PERMISSIONS_KEY = Symbol('console-permissions')
const SUPER = '*'

function createPermissions() {
  const { account, permissions, mustChangePassword, permissionsReady } = useConsoleAuth()

  function can(codename, scope) {
    if (!codename) return true
    return permissions.value.some((grant) => {
      if (grant?.codename !== SUPER && grant?.codename !== codename) return false
      if (scope === undefined) return true
      return !grant.scope || grant.scope === scope
    })
  }

  const roles = computed(() => account.value?.roles || [])

  return {
    account,
    roles,
    permissions,
    ready: permissionsReady,
    mustChangePassword,
    can,
  }
}

/**
 * 在控制台壳层建立权限上下文，子页面与导航统一从这里取。
 * 挂在壳层而不是各自建一份，是为了权限刷新（改密码、重新校验会话）只有一处入口。
 */
export function provideConsolePermissions() {
  const api = createPermissions()
  provide(PERMISSIONS_KEY, api)
  return api
}

/** 取权限上下文；脱离壳层（如脚本或测试）时退化为同一份会话状态的独立实例 */
export function usePermissions() {
  return inject(PERMISSIONS_KEY, null) || createPermissions()
}

<script setup>
import { onMounted, ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NCheckbox,
  NCheckboxGroup,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NSwitch,
  useMessage,
} from 'naive-ui'
import {
  Add24Regular,
  ArrowClockwise24Regular,
  Edit24Regular,
  Key24Regular,
  People24Regular,
} from '@vicons/fluent'
import AppModal from '../../components/ui/AppModal.vue'
import ConsolePanel from '../components/ConsolePanel.vue'
import SensitiveActionModal from '../components/SensitiveActionModal.vue'
import { consoleFetch } from '../consoleRequest.js'
import { useConsoleAuth } from '../consoleAuth.js'
import { checkPasswordLength, checkPasswordRemote } from '../passwordStrength.js'

const ACCOUNTS_URL = '/api/v1/console/accounts'
const CATALOG_URL = '/api/v1/console/accounts/roles'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const { account: currentAccount } = useConsoleAuth()

const accounts = ref([])
const catalog = ref({ roles: [], permissions: [] })
const loading = ref(false)
const errorText = ref('')

// mode 为 create 时 form.email 参与提交，edit 时只做展示（邮箱建立后不可改）
const editor = ref({ show: false, mode: 'create', id: 0, email: '', error: '' })
const form = ref({
  email: '',
  displayName: '',
  password: '',
  roles: [],
  grants: [],
  disabled: false,
})
const editorSaving = ref(false)

const reset = ref({ show: false, id: 0, email: '', password: '', error: '', saving: false })
/* 停用账号、重置他人密码都属于敏感操作：先过一次身份确认再执行 */
const sensitiveModal = ref(false)
const editingDisabled = ref(false)
const pendingAction = ref('')
const pendingVerifyToken = ref('')

function askVerify(action) {
  pendingAction.value = action
  pendingVerifyToken.value = ''
  sensitiveModal.value = true
}

function onVerified(token) {
  pendingVerifyToken.value = token
  const action = pendingAction.value
  pendingAction.value = ''
  if (action === 'save') runSave()
  else if (action === 'reset') runReset()
}

function authHeaders() {
  return { 'X-Verify-Token': pendingVerifyToken.value }
}

// 字段级报错：能落到具体输入框的，就不要丢到表单底部的公共报错区
const createSubmitted = ref(false)
const resetSubmitted = ref(false)
const emailFieldError = ref({ status: '', message: '' })

const emailFieldCheck = computed(() => {
  if (createSubmitted.value && !form.value.email.trim()) {
    return { status: 'error', message: '请填写邮箱' }
  }
  return emailFieldError.value
})

// 本地只查位数（输入即时反馈），提交前再向服务端要一次权威结论，显示在密码输入框下方
const createServerCheck = ref({ status: '', message: '' })
const resetServerCheck = ref({ status: '', message: '' })

const createPasswordCheck = computed(() => {
  if (createSubmitted.value && !form.value.password) {
    return { status: 'error', message: '请填写初始密码', blocked: true }
  }
  const local = checkPasswordLength(form.value.password)
  return {
    status: local.status || createServerCheck.value.status,
    message: local.message || createServerCheck.value.message,
    blocked: local.blocked,
  }
})
const resetPasswordCheck = computed(() => {
  if (resetSubmitted.value && !reset.value.password) {
    return { status: 'error', message: '请填写新的临时密码', blocked: true }
  }
  const local = checkPasswordLength(reset.value.password)
  return {
    status: local.status || resetServerCheck.value.status,
    message: local.message || resetServerCheck.value.message,
    blocked: local.blocked,
  }
})

watch(
  () => form.value.password,
  () => {
    createServerCheck.value = { status: '', message: '' }
  },
)
watch(
  () => reset.value.password,
  () => {
    resetServerCheck.value = { status: '', message: '' }
  },
)

const STATUS_TONES = {
  disabled: { text: '已停用', tone: 'destructive' },
  mustChange: { text: '需改密码', tone: 'warning' },
  active: { text: '启用', tone: 'success' },
}

function statusOf(item) {
  if (item.disabled) return STATUS_TONES.disabled
  if (item.must_change_password) return STATUS_TONES.mustChange
  return STATUS_TONES.active
}

function roleLabel(key) {
  return catalog.value.roles.find((role) => role.key === key)?.name || key
}

function grantMeta(codename) {
  return (
    catalog.value.permissions.find((permission) => permission.codename === codename) || {
      codename,
      label: codename,
      scoped: false,
    }
  )
}

function grantText(grant) {
  const label = grant.codename === '*' ? '全部权限' : grant.label || grant.codename
  return grant.scope ? `${label} · ${grant.scope}` : label
}

function scopePlaceholder(codename) {
  const target = codename === 'downloads.write' ? '下载页 slug' : '卡片分类'
  return `${target}，留空表示全部，多个用逗号分隔`
}

function isSelf(item) {
  return !!currentAccount.value?.email && item.email === currentAccount.value.email
}

function formatTime(timestamp) {
  if (!timestamp) return '从未登录'
  return new Date(timestamp * 1000).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function gotUnauthorized(e) {
  if (e?.code !== 'unauthorized') return false
  router.replace({ path: '/console/login', query: { redirect: route.fullPath } })
  return true
}

async function load() {
  loading.value = true
  errorText.value = ''
  try {
    // 角色与权限目录决定表单里的可选项，与列表一起取，避免打开弹窗时再去等一次
    const [catalogPayload, listPayload] = await Promise.all([
      consoleFetch(CATALOG_URL),
      consoleFetch(ACCOUNTS_URL),
    ])
    catalog.value = {
      roles: catalogPayload?.roles || [],
      permissions: catalogPayload?.permissions || [],
    }
    accounts.value = listPayload?.items || []
  } catch (e) {
    if (gotUnauthorized(e)) return
    errorText.value = e?.message || '读取失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

onMounted(load)

/* 授权按权限点一行：勾上即授予，收窄范围只在支持 scope 的权限点上出现。
   同一权限点的多个范围（如多个下载页）在输入框里用逗号分隔，提交时拆成多条授权。 */
function grantRowsOf(grants) {
  return catalog.value.permissions.map((permission) => {
    const scopes = [
      ...new Set(
        grants
          .filter((grant) => grant.codename === permission.codename)
          .map((grant) => grant.scope)
          .filter(Boolean),
      ),
    ]
    return {
      codename: permission.codename,
      checked: grants.some((grant) => grant.codename === permission.codename),
      scope: permission.scoped ? scopes.join(', ') : '',
    }
  })
}

function collectGrants() {
  const grants = []
  for (const row of form.value.grants) {
    if (!row.checked) continue
    const scopes = row.scope
      .split(/[,，\s]+/)
      .map((scope) => scope.trim())
      .filter(Boolean)
    if (!scopes.length) {
      grants.push({ codename: row.codename, scope: '' })
      continue
    }
    for (const scope of new Set(scopes)) grants.push({ codename: row.codename, scope })
  }
  return grants
}

function openCreate() {
  editor.value = { show: true, mode: 'create', id: 0, email: '', error: '' }
  form.value = {
    email: '',
    displayName: '',
    password: '',
    roles: [],
    grants: grantRowsOf([]),
    disabled: false,
  }
}

function openEdit(item) {
  editor.value = { show: true, mode: 'edit', id: item.id, email: item.email, error: '' }
  form.value = {
    email: item.email,
    // 服务端没填显示名时 name 回落到邮箱，编辑框里应当留空而不是把邮箱填进去
    displayName: item.name === item.email ? '' : item.name,
    password: '',
    roles: [...item.roles],
    grants: grantRowsOf(item.grants),
    disabled: item.disabled,
  }
  editingDisabled.value = item.disabled
}

async function save() {
  const roles = [...form.value.roles]
  const grants = collectGrants()

  if (editor.value.mode === 'create') {
    createSubmitted.value = true
    // 必填与格式问题就近显示在各自输入框下，公共报错区只留给跨字段或服务端异常
    if (!form.value.email.trim() || !form.value.password) return
    if (createPasswordCheck.value.blocked) return
  }
  // 默认拒绝：没有任何角色与权限点的账号能登录成功，但进去后什么也看不到
  if (!roles.length && !grants.length) {
    editor.value.error = '至少分配一个角色或权限点，否则该账号无法进入控制台'
    return
  }

  if (editor.value.mode === 'create') {
    const verdict = await checkPasswordRemote(form.value.password, form.value.email.trim())
    if (!verdict.ok) {
      createServerCheck.value = { status: 'error', message: verdict.reason }
      return
    }
  }

  // 停用/启用会改变对方能否登录，属于敏感操作：先确认操作者身份
  if (editor.value.mode === 'edit' && form.value.disabled !== editingDisabled.value) {
    askVerify('save')
    return
  }

  await runSave()
}

async function runSave() {
  const displayName = form.value.displayName.trim()
  const roles = [...form.value.roles]
  const grants = collectGrants()
  editorSaving.value = true
  editor.value.error = ''
  emailFieldError.value = { status: '', message: '' }
  try {
    if (editor.value.mode === 'create') {
      await consoleFetch(ACCOUNTS_URL, {
        method: 'POST',
        body: JSON.stringify({
          email: form.value.email.trim(),
          display_name: displayName,
          password: form.value.password,
          roles,
          grants,
        }),
      })
      message.success('账号已创建，初始密码在首次登录后必须修改')
    } else {
      await consoleFetch(`${ACCOUNTS_URL}/${editor.value.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ display_name: displayName, roles, grants, disabled: form.value.disabled }),
      })
      message.success('已保存修改')
    }
    editor.value.show = false
  } catch (e) {
    if (gotUnauthorized(e)) return
    if (e?.code === 'email_taken') {
      emailFieldError.value = { status: 'error', message: e.message || '该邮箱已被使用' }
    } else {
      editor.value.error = e?.message || '保存失败，请稍后重试'
    }
  } finally {
    editorSaving.value = false
    await load()
  }
}

function openReset(item) {
  reset.value = { show: true, id: item.id, email: item.email, password: '', error: '', saving: false }
  resetSubmitted.value = false
  resetServerCheck.value = { status: '', message: '' }
}

async function submitReset() {
  resetSubmitted.value = true
  if (!reset.value.password) return
  if (resetPasswordCheck.value.blocked) return
  askVerify('reset')
}

async function runReset() {

  const verdict = await checkPasswordRemote(reset.value.password, reset.value.email)
  if (!verdict.ok) {
    resetServerCheck.value = { status: 'error', message: verdict.reason }
    return
  }
  reset.value.saving = true
  reset.value.error = ''
  try {
    await consoleFetch(`${ACCOUNTS_URL}/${reset.value.id}/password`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ password: reset.value.password }),
    })
    message.success('密码已重置，该账号已登录的设备全部退出')
    reset.value.show = false
    await load()
  } catch (e) {
    if (gotUnauthorized(e)) return
    reset.value.error = e?.message || '重置失败，请稍后重试'
  } finally {
    reset.value.saving = false
  }
}
</script>

<template>
  <div class="console-accounts">
    <div class="accounts-toolbar">
      <span class="summary-text">{{ loading ? '读取中…' : `共 ${accounts.length} 个账号` }}</span>
      <div class="toolbar-actions">
        <button class="app-btn app-btn--outline app-btn--sm" type="button" :disabled="loading" @click="load">
          <NIcon :component="ArrowClockwise24Regular" :size="14" />
          <span class="btn-label">刷新</span>
        </button>
        <button
          class="app-btn app-btn--fill app-btn--sm"
          type="button"
          :disabled="loading"
          @click="openCreate"
        >
          <NIcon :component="Add24Regular" :size="14" />
          <span class="btn-label">新建账号</span>
        </button>
      </div>
    </div>

    <p v-if="errorText" class="inline-hint inline-hint--error">{{ errorText }}</p>

    <ConsolePanel
      :icon="People24Regular"
      title="账号列表"
      description="角色决定权限点集合，单点授权在角色之外追加或收窄范围"
    >
      <p v-if="!accounts.length" class="inline-hint">
        {{ loading ? '读取中…' : '还没有可管理的账号' }}
      </p>

      <div v-else class="account-table">
        <div class="account-row account-row--head">
          <span>邮箱</span>
          <span>显示名</span>
          <span>角色 / 授权</span>
          <span>状态</span>
          <span>最后登录</span>
          <span class="col-actions">操作</span>
        </div>
        <div v-for="item in accounts" :key="item.id" class="account-row">
          <span class="cell-email">
            {{ item.email }}
            <span v-if="isSelf(item)" class="self-tag">当前账号</span>
          </span>
          <span class="cell-name">{{ item.name }}</span>
          <span class="cell-tags">
            <span v-for="role in item.roles" :key="role" class="role-tag">{{ roleLabel(role) }}</span>
            <span v-for="grant in item.grants" :key="`${grant.codename}·${grant.scope}`" class="grant-tag">
              {{ grantText(grant) }}
            </span>
            <span v-if="!item.roles.length && !item.grants.length" class="cell-muted">无授权</span>
          </span>
          <span>
            <span class="status-pill" :class="`status-pill--${statusOf(item).tone}`">
              {{ statusOf(item).text }}
            </span>
          </span>
          <span class="cell-time">{{ formatTime(item.last_login) }}</span>
          <span class="col-actions">
            <button
              class="icon-btn"
              type="button"
              title="编辑"
              :disabled="isSelf(item)"
              @click="openEdit(item)"
            >
              <NIcon :component="Edit24Regular" :size="14" />
            </button>
            <button
              class="icon-btn"
              type="button"
              title="重置密码"
              :disabled="isSelf(item)"
              @click="openReset(item)"
            >
              <NIcon :component="Key24Regular" :size="14" />
            </button>
          </span>
        </div>
      </div>

      <p class="table-note">
        自己的账号不在这里修改：停用、改权与重置密码都需要另一名管理员操作，跳过这一步也过不了服务端校验。
      </p>
    </ConsolePanel>

    <AppModal
      v-model:show="editor.show"
      :title="editor.mode === 'create' ? '新建账号' : '编辑账号'"
      :max-width="620"
      :auto-focus="false"
      :actions="[
        { text: '取消', variant: 'outline', onClick: () => (editor.show = false) },
        {
          text: editorSaving ? '保存中…' : '保存',
          variant: 'fill',
          disabled: editorSaving,
          onClick: save,
        },
      ]"
      content-scrollable
    >
      <NForm label-placement="top">
        <NFormItem
          v-if="editor.mode === 'create'"
          label="邮箱"
          required
          :validation-status="emailFieldCheck.status || undefined"
          :feedback="emailFieldCheck.message || undefined"
        >
          <NInput
            v-model:value="form.email"
            type="email"
            maxlength="150"
            placeholder="name@example.com，即登录账号"
          />
        </NFormItem>
        <p v-else class="form-note">
          登录账号 <span class="mono">{{ editor.email }}</span> 建立后不可修改。
        </p>

        <NFormItem label="显示名">
          <NInput v-model:value="form.displayName" maxlength="64" placeholder="留空则显示邮箱" />
        </NFormItem>

        <NFormItem
          v-if="editor.mode === 'create'"
          label="初始密码"
          required
          :validation-status="createPasswordCheck.status || undefined"
          :feedback="createPasswordCheck.message || undefined"
        >
          <NInput
            v-model:value="form.password"
            type="password"
            show-password-on="click"
            maxlength="1024"
            placeholder="一次性密码，本人首次登录后必须修改"
          />
        </NFormItem>

        <NFormItem label="角色">
          <NCheckboxGroup v-model:value="form.roles" class="role-group">
            <NCheckbox v-for="role in catalog.roles" :key="role.key" :value="role.key" class="role-option">
              <span class="role-text">
                <span class="role-name">{{ role.name }}<span class="role-key">{{ role.key }}</span></span>
                <span class="role-desc">{{ role.description }}</span>
              </span>
            </NCheckbox>
          </NCheckboxGroup>
        </NFormItem>

        <div class="grants-block">
          <span class="grants-title">单点授权</span>
          <p class="form-note">
            默认拒绝：勾选即追加该权限点；支持范围的权限点可限定到具体对象，留空表示全部。
          </p>
          <div v-for="row in form.grants" :key="row.codename" class="grant-row">
            <NCheckbox v-model:checked="row.checked">
              <span class="grant-name">{{ grantMeta(row.codename).label }}</span>
              <span class="grant-code">{{ row.codename }}</span>
            </NCheckbox>
            <NInput
              v-if="row.checked && grantMeta(row.codename).scoped"
              v-model:value="row.scope"
              size="small"
              class="grant-scope"
              :placeholder="scopePlaceholder(row.codename)"
            />
          </div>
        </div>

        <div v-if="editor.mode === 'edit'" class="setting-row">
          <div class="setting-info">
            <span class="setting-title">停用账号</span>
            <span class="setting-desc">停用后立即无法再登录，已有会话在到期前仍然有效</span>
          </div>
          <NSwitch v-model:value="form.disabled" />
        </div>

        <p v-if="editor.error" class="editor-error">{{ editor.error }}</p>
      </NForm>
    </AppModal>

    <AppModal
      v-model:show="reset.show"
      title="重置密码"
      :max-width="420"
      :auto-focus="false"
      :actions="[
        { text: '取消', variant: 'outline', onClick: () => (reset.show = false) },
        {
          text: reset.saving ? '重置中…' : '重置',
          variant: 'fill',
          disabled: reset.saving,
          onClick: submitReset,
        },
      ]"
    >
      <NForm label-placement="top">
        <p class="form-note">
          为 <span class="mono">{{ reset.email }}</span> 设置一次性密码：该账号已登录的设备全部退出，
          本人下次登录后必须先修改密码。
        </p>
        <NFormItem
          label="新的临时密码"
          :validation-status="resetPasswordCheck.status || undefined"
          :feedback="resetPasswordCheck.message || undefined"
        >
          <NInput
            v-model:value="reset.password"
            type="password"
            show-password-on="click"
            maxlength="1024"
            placeholder="至少满足服务端的密码强度要求"
          />
        </NFormItem>
        <p v-if="reset.error" class="editor-error">{{ reset.error }}</p>
      </NForm>
    </AppModal>

    <SensitiveActionModal v-model:show="sensitiveModal" @verified="onVerified" />
  </div>
</template>

<style scoped>
.console-accounts {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
  min-width: 0;
}

.accounts-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.summary-text {
  color: var(--subtle-foreground);
  font-size: 0.76rem;
  transition: color 0.4s ease;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-actions .app-btn {
  gap: 6px;
}

.account-table {
  display: flex;
  flex-direction: column;
}

.account-row {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 0.8fr) minmax(0, 1.5fr) 78px 116px 64px;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
  transition: border-color 0.4s ease;
}

.account-row:last-child {
  border-bottom: none;
}

.account-row--head {
  padding-top: 0;
  color: var(--subtle-foreground);
  font-size: 0.74rem;
  transition: color 0.4s ease;
}

.cell-email {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  color: var(--foreground);
  font-size: 0.84rem;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.4s ease;
}

.self-tag {
  padding: 1px 7px;
  border-radius: var(--radius-full);
  corner-shape: round;
  background: var(--accent);
  color: var(--subtle-foreground);
  font-size: 0.68rem;
  transition: color 0.4s ease, background-color 0.4s ease;
}

.cell-name {
  overflow: hidden;
  color: var(--muted-foreground);
  font-size: 0.8rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
}

.role-tag {
  padding: 1px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  corner-shape: round;
  color: var(--foreground);
  font-size: 0.7rem;
  white-space: nowrap;
  transition: color 0.4s ease, border-color 0.4s ease;
}

.grant-tag {
  padding: 1px 8px;
  border-radius: var(--radius-full);
  corner-shape: round;
  background: var(--accent);
  color: var(--subtle-foreground);
  font-size: 0.7rem;
  white-space: nowrap;
  transition: color 0.4s ease, background-color 0.4s ease;
}

.cell-muted {
  color: var(--subtle-foreground);
  font-size: 0.72rem;
  transition: color 0.4s ease;
}

.cell-time {
  color: var(--muted-foreground);
  font-size: 0.76rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 9px;
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  corner-shape: round;
  font-size: 0.72rem;
  white-space: nowrap;
  transition: color 0.4s ease, background-color 0.4s ease, border-color 0.4s ease;
}

.status-pill--success {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 14%, transparent);
  border-color: color-mix(in srgb, var(--success) 28%, transparent);
}

.status-pill--warning {
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 14%, transparent);
  border-color: color-mix(in srgb, var(--warning) 28%, transparent);
}

.status-pill--destructive {
  color: var(--destructive);
  background: color-mix(in srgb, var(--destructive) 14%, transparent);
  border-color: color-mix(in srgb, var(--destructive) 28%, transparent);
}

.col-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease;
}

.icon-btn:hover:not(:disabled) {
  color: var(--foreground);
}

.icon-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.table-note {
  margin: 10px 0 0;
  color: var(--subtle-foreground);
  font-size: 0.72rem;
  line-height: 1.6;
  transition: color 0.4s ease;
}

.inline-hint {
  margin: 0;
  padding: 8px 0;
  color: var(--subtle-foreground);
  font-size: 0.8rem;
  text-align: center;
}

.inline-hint--error {
  color: var(--destructive);
  text-align: left;
}

/* ===== 编辑器 ===== */
.mono {
  color: var(--muted-foreground);
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  font-size: 0.76rem;
  overflow-wrap: anywhere;
}

.form-note {
  margin: -4px 0 16px;
  color: var(--subtle-foreground);
  font-size: 0.74rem;
  line-height: 1.6;
}

.role-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.role-option {
  align-items: flex-start;
}

.role-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.role-name {
  color: var(--foreground);
  font-size: 0.82rem;
  transition: color 0.4s ease;
}

.role-key {
  margin-left: 6px;
  color: var(--subtle-foreground);
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  font-size: 0.68rem;
}

.role-desc {
  color: var(--subtle-foreground);
  font-size: 0.72rem;
  line-height: 1.5;
}

.grants-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
  transition: border-color 0.4s ease;
}

.grants-title {
  color: var(--foreground);
  font-size: 0.84rem;
  transition: color 0.4s ease;
}

.grants-block .form-note {
  margin: 0;
}

.grant-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 10px;
  padding: 4px 0;
}

.grant-name {
  color: var(--foreground);
  font-size: 0.8rem;
  transition: color 0.4s ease;
}

.grant-code {
  margin-left: 6px;
  color: var(--subtle-foreground);
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  font-size: 0.68rem;
}

.grant-scope {
  flex: 1 1 220px;
  min-width: 0;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 4px;
  padding: 12px 0;
  border-top: 1px solid var(--border);
  transition: border-color 0.4s ease;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.setting-title {
  color: var(--foreground);
  font-size: 0.84rem;
  transition: color 0.4s ease;
}

.setting-desc {
  color: var(--subtle-foreground);
  font-size: 0.72rem;
  line-height: 1.5;
}

.editor-error {
  margin: 6px 0 0;
  color: var(--destructive);
  font-size: 0.8rem;
}

/* 窄屏：邮箱与操作各占一行，显式列（显示名、最后登录）让位给可见内容 */
@media (width <= 720px) {
  .account-row--head {
    display: none;
  }

  .account-row {
    grid-template-columns: minmax(0, 1fr) auto;
    row-gap: 6px;
  }

  .account-row > .cell-email {
    grid-column: 1 / -1;
  }

  .account-row > .cell-name,
  .account-row > .cell-time {
    display: none;
  }
}
</style>

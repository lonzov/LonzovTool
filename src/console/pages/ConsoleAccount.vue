<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NForm, NFormItem, NIcon, NInput, useMessage } from 'naive-ui'
import {
  ArrowClockwise24Regular,
  Desktop24Regular,
  Key24Regular,
  PersonCircle24Regular,
  SignOut24Regular,
} from '@vicons/fluent'
import ConsolePanel from '../components/ConsolePanel.vue'
import { confirmDialog } from '../../composables/useConfirm.js'
import { consoleFetch } from '../consoleRequest.js'
import { useConsoleAuth } from '../consoleAuth.js'

const SESSIONS_URL = '/api/v1/console/sessions'
const PASSWORD_URL = '/api/v1/console/password'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const { account, mustChangePassword, verify } = useConsoleAuth()

const passwordForm = ref({ current: '', next: '' })
const passwordError = ref('')
const passwordSaving = ref(false)

const sessions = ref([])
const sessionsLoading = ref(false)
const sessionsError = ref('')
const revokingId = ref(0)

const roles = computed(() => account.value?.roles || [])

function formatTime(timestamp) {
  if (!timestamp) return '—'
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

async function loadSessions() {
  sessionsLoading.value = true
  sessionsError.value = ''
  try {
    const payload = await consoleFetch(SESSIONS_URL)
    sessions.value = payload?.items || []
  } catch (e) {
    if (gotUnauthorized(e)) return
    sessionsError.value = e?.message || '读取失败，请稍后重试'
  } finally {
    sessionsLoading.value = false
  }
}

onMounted(loadSessions)

async function changePassword() {
  passwordError.value = ''
  if (!passwordForm.value.current || !passwordForm.value.next) {
    passwordError.value = '请填写当前密码与新密码'
    return
  }

  passwordSaving.value = true
  try {
    await consoleFetch(PASSWORD_URL, {
      method: 'POST',
      body: JSON.stringify({
        current_password: passwordForm.value.current,
        new_password: passwordForm.value.next,
      }),
    })
    passwordForm.value = { current: '', next: '' }
    message.success('密码已修改，其他设备上的会话已退出')
    // 临时密码标记由服务端清除，这里顺带把 /me 的状态（含权限与账号信息）拉回最新
    try {
      await verify()
    } catch (e) {
      if (gotUnauthorized(e)) return
      message.warning('密码已修改，但账号状态未能刷新，请重新进入控制台确认')
    }
    await loadSessions()
  } catch (e) {
    if (gotUnauthorized(e)) return
    passwordError.value = e?.message || '修改失败，请稍后重试'
  } finally {
    passwordSaving.value = false
  }
}

async function revoke(session) {
  if (session.current) return

  const confirmed = await confirmDialog({
    title: '撤销会话',
    message: `撤销后该设备需要重新登录。\n${session.user_agent || '未知设备'} · ${session.last_ip || session.created_ip || '未知地址'}`,
    confirmText: '撤销',
    danger: true,
  })
  if (!confirmed) return

  revokingId.value = session.id
  try {
    await consoleFetch(`${SESSIONS_URL}/${session.id}`, { method: 'DELETE' })
    message.success('已撤销该会话')
    await loadSessions()
  } catch (e) {
    if (gotUnauthorized(e)) return
    message.error(e?.message || '撤销失败，请稍后重试')
  } finally {
    revokingId.value = 0
  }
}
</script>

<template>
  <div class="console-account">
    <div class="account-columns">
      <ConsolePanel
        :icon="PersonCircle24Regular"
        title="账号信息"
        description="登录身份与当前挂载的角色"
      >
        <ul class="info-list">
          <li class="info-row">
            <span class="info-label">邮箱</span>
            <span class="info-value">{{ account?.email || account?.name || '—' }}</span>
          </li>
          <li class="info-row">
            <span class="info-label">角色</span>
            <span class="info-value info-tags">
              <span v-for="role in roles" :key="role" class="role-tag">{{ role }}</span>
              <span v-if="!roles.length" class="info-muted">无角色，权限来自单点授权</span>
            </span>
          </li>
          <li class="info-row">
            <span class="info-label">密码</span>
            <span class="info-value">
              <span v-if="mustChangePassword" class="status-pill status-pill--warning">
                临时密码，待修改
              </span>
              <span v-else class="info-muted">已设置</span>
            </span>
          </li>
        </ul>
      </ConsolePanel>

      <ConsolePanel
        :icon="Key24Regular"
        title="修改密码"
        description="改完会作废其他设备上的会话，当前设备保持登录"
      >
        <NForm label-placement="top">
          <div class="password-grid">
            <NFormItem label="当前密码">
              <NInput
                v-model:value="passwordForm.current"
                type="password"
                show-password-on="click"
                maxlength="1024"
                autocomplete="current-password"
                placeholder="请输入当前使用的密码"
              />
            </NFormItem>
            <NFormItem label="新密码">
              <NInput
                v-model:value="passwordForm.next"
                type="password"
                show-password-on="click"
                maxlength="1024"
                autocomplete="new-password"
                placeholder="不能与当前密码相同"
              />
            </NFormItem>
          </div>
          <p class="form-note">新密码的强度由服务端校验，过短或过于简单会被拒绝。</p>
          <p v-if="passwordError" class="form-error">{{ passwordError }}</p>
          <div class="form-actions">
            <button
              class="app-btn app-btn--fill app-btn--sm"
              type="button"
              :disabled="passwordSaving"
              @click="changePassword"
            >
              {{ passwordSaving ? '提交中…' : '修改密码' }}
            </button>
          </div>
        </NForm>
      </ConsolePanel>
    </div>

    <ConsolePanel
      :icon="Desktop24Regular"
      title="登录设备"
      description="当前有效的会话；撤销后该设备需要重新登录"
    >
      <template #extra>
        <button
          class="app-btn app-btn--outline app-btn--sm"
          type="button"
          :disabled="sessionsLoading"
          @click="loadSessions"
        >
          <NIcon :component="ArrowClockwise24Regular" :size="14" />
          <span class="btn-label">刷新</span>
        </button>
      </template>

      <p v-if="sessionsError" class="inline-hint inline-hint--error">{{ sessionsError }}</p>
      <p v-else-if="!sessions.length" class="inline-hint">
        {{ sessionsLoading ? '读取中…' : '没有有效会话' }}
      </p>

      <div v-else class="session-table">
        <div class="session-row session-row--head">
          <span>设备</span>
          <span>来源地址</span>
          <span>最近使用</span>
          <span>有效期至</span>
          <span class="col-actions">操作</span>
        </div>
        <div v-for="session in sessions" :key="session.id" class="session-row">
          <span class="cell-agent">
            <span class="agent-text" :title="session.user_agent">{{ session.user_agent || '未知设备' }}</span>
            <span v-if="session.current" class="self-tag">当前会话</span>
          </span>
          <span class="cell-meta">{{ session.last_ip || session.created_ip || '未知地址' }}</span>
          <span class="cell-meta">{{ formatTime(session.last_used_at || session.created_at) }}</span>
          <span class="cell-meta">{{ formatTime(session.expires_at) }}</span>
          <span class="col-actions">
            <button
              class="app-btn app-btn--outline app-btn--sm revoke-btn"
              type="button"
              :disabled="session.current || revokingId === session.id"
              :title="session.current ? '当前会话请用右上角「退出」结束' : '撤销该会话'"
              @click="revoke(session)"
            >
              <NIcon :component="SignOut24Regular" :size="14" />
              <span class="btn-label">撤销</span>
            </button>
          </span>
        </div>
      </div>
    </ConsolePanel>
  </div>
</template>

<style scoped>
.console-account {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
  min-width: 0;
}

.account-columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  align-items: start;
  gap: 16px;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.info-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 8px 0;
}

.info-row + .info-row {
  border-top: 1px solid var(--border);
  transition: border-color 0.4s ease;
}

.info-label {
  flex: 0 0 48px;
  color: var(--subtle-foreground);
  font-size: 0.78rem;
  transition: color 0.4s ease;
}

.info-value {
  flex: 1;
  min-width: 0;
  color: var(--foreground);
  font-size: 0.82rem;
  overflow-wrap: anywhere;
  transition: color 0.4s ease;
}

.info-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.role-tag {
  padding: 1px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  corner-shape: round;
  color: var(--foreground);
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  font-size: 0.7rem;
  transition: color 0.4s ease, border-color 0.4s ease;
}

.info-muted {
  color: var(--subtle-foreground);
  font-size: 0.78rem;
  transition: color 0.4s ease;
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

.status-pill--warning {
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 14%, transparent);
  border-color: color-mix(in srgb, var(--warning) 28%, transparent);
}

.password-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0 12px;
}

.form-note {
  margin: -4px 0 10px;
  color: var(--subtle-foreground);
  font-size: 0.74rem;
  line-height: 1.6;
}

.form-error {
  margin: 0 0 10px;
  color: var(--destructive);
  font-size: 0.78rem;
}

.form-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.session-table {
  display: flex;
  flex-direction: column;
}

.session-row {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) 120px 116px 116px 88px;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
  transition: border-color 0.4s ease;
}

.session-row:last-child {
  border-bottom: none;
}

.session-row--head {
  padding-top: 0;
  color: var(--subtle-foreground);
  font-size: 0.74rem;
  transition: color 0.4s ease;
}

.cell-agent {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.agent-text {
  overflow: hidden;
  color: var(--foreground);
  font-size: 0.8rem;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.4s ease;
}

.self-tag {
  flex-shrink: 0;
  padding: 1px 7px;
  border-radius: var(--radius-full);
  corner-shape: round;
  background: var(--accent);
  color: var(--subtle-foreground);
  font-size: 0.68rem;
  transition: color 0.4s ease, background-color 0.4s ease;
}

.cell-meta {
  color: var(--muted-foreground);
  font-size: 0.76rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.col-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}

.revoke-btn {
  gap: 5px;
}

.revoke-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
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

/* 窄屏：设备一行、时间与操作一行，来源地址与有效期让位 */
@media (width <= 720px) {
  .session-row--head {
    display: none;
  }

  .session-row {
    grid-template-columns: minmax(0, 1fr) auto;
    row-gap: 6px;
  }

  .session-row > .cell-agent {
    grid-column: 1 / -1;
  }

  .session-row > .cell-meta:nth-child(2),
  .session-row > .cell-meta:nth-child(4) {
    display: none;
  }
}
</style>

<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  NDrawer,
  NDrawerContent,
  NIcon,
  NInput,
  useMessage,
} from 'naive-ui'
import { Delete24Regular, ShieldProhibited24Regular } from '@vicons/fluent'
import AppButton from '../../components/ui/AppButton.vue'
import { confirmDialog } from '../../composables/useConfirm.js'
import { useIsMobile } from '../../composables/useIsMobile.js'
import { consoleFetch } from '../consoleRequest.js'

const URL = '/api/v1/console/ip-bans'

const props = defineProps({
  show: { type: Boolean, default: false },
})
const emit = defineEmits(['update:show'])

const router = useRouter()
const message = useMessage()
const { isMobile } = useIsMobile()

const items = ref([])
const loading = ref(false)
const adding = ref(false)
const deletingId = ref(0)
const errorText = ref('')
const form = ref({ text: '', note: '' })

function formatTime(value) {
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  return new Date(seconds * 1000).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

async function load() {
  loading.value = true
  errorText.value = ''
  try {
    const payload = await consoleFetch(URL)
    items.value = Array.isArray(payload?.items) ? payload.items : []
  } catch (e) {
    if (e?.code === 'unauthorized') {
      emit('update:show', false)
      router.replace({ path: '/console/login', query: { redirect: router.currentRoute.value.fullPath } })
      return
    }
    errorText.value = e?.message || '读取失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

async function add() {
  if (!form.value.text.trim()) {
    message.error('请输入 IP、CIDR 或范围')
    return
  }
  adding.value = true
  try {
    const payload = await consoleFetch(URL, {
      method: 'POST',
      body: JSON.stringify({ text: form.value.text, note: form.value.note }),
    })
    items.value = Array.isArray(payload?.items) ? payload.items : items.value
    form.value = { text: '', note: '' }
    message.success('已添加封禁')
  } catch (e) {
    if (e?.code === 'unauthorized') {
      emit('update:show', false)
      router.replace({ path: '/console/login', query: { redirect: router.currentRoute.value.fullPath } })
      return
    }
    message.error(e?.message || '添加失败，请稍后重试')
  } finally {
    adding.value = false
  }
}

async function remove(item) {
  const confirmed = await confirmDialog({
    title: '删除封禁',
    message: `确定解除「${item.label}」的提交封禁吗？`,
    confirmText: '解除',
    cancelText: '取消',
  })
  if (!confirmed) return
  deletingId.value = item.id
  try {
    await consoleFetch(`${URL}/${item.id}`, { method: 'DELETE' })
    items.value = items.value.filter((row) => row.id !== item.id)
    message.success('已解除封禁')
  } catch (e) {
    if (e?.code === 'unauthorized') {
      emit('update:show', false)
      router.replace({ path: '/console/login', query: { redirect: router.currentRoute.value.fullPath } })
      return
    }
    message.error(e?.message || '删除失败，请稍后重试')
  } finally {
    deletingId.value = 0
  }
}

watch(
  () => props.show,
  (visible) => {
    if (visible) load()
  },
)
</script>

<template>
  <NDrawer
    :show="show"
    placement="right"
    :width="isMobile ? '100%' : 560"
    :z-index="2100"
    :auto-focus="false"
    @update:show="emit('update:show', $event)"
  >
    <NDrawerContent title="IP 封禁" closable :body-content-style="{ padding: '0' }">
      <div class="ban-body">
        <section class="ban-create">
          <div class="ban-create-head">
            <NIcon :component="ShieldProhibited24Regular" :size="18" />
            <span>阻止新的网址提交与反馈</span>
          </div>
          <NInput
            v-model:value="form.text"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 6 }"
            maxlength="4000"
            placeholder="192.0.2.1、198.51.100.0/24、2001:db8::1"
          />
          <p class="ban-help">支持单 IP、IPv6、CIDR、范围；多条用逗号分隔，范围和逗号不能混用。</p>
          <NInput
            v-model:value="form.note"
            maxlength="200"
            placeholder="备注（可选）"
          />
          <AppButton variant="solid" size="md" :loading="adding" :disabled="adding" @click="add">
            添加封禁
          </AppButton>
        </section>

        <p v-if="errorText" class="ban-error" role="alert">{{ errorText }}</p>
        <p v-else-if="loading" class="ban-empty">读取中…</p>
        <p v-else-if="!items.length" class="ban-empty">还没有封禁规则</p>
        <ul v-else class="ban-list">
          <li v-for="item in items" :key="item.id" class="ban-row">
            <div class="ban-row-main">
              <code class="ban-label">{{ item.label }}</code>
              <span class="ban-kind">{{ item.kind_label }}</span>
              <span v-if="item.note" class="ban-note">{{ item.note }}</span>
              <span class="ban-meta">
                {{ formatTime(item.created_at) }}
                <template v-if="item.created_by"> · {{ item.created_by }}</template>
              </span>
            </div>
            <AppButton
              class="row-delete"
              variant="text"
              size="sm"
              icon-only
              label="解除封禁"
              :icon="Delete24Regular"
              :loading="deletingId === item.id"
              :disabled="deletingId === item.id"
              @click="remove(item)"
            />
          </li>
        </ul>
      </div>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.ban-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 100%;
  padding: 18px 20px 22px;
}

.ban-create {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--border);
}

.ban-create-head {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--foreground);
  font-size: 0.875rem;
  font-weight: 600;
}

.ban-help {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 0.75rem;
  line-height: 1.5;
}

.ban-error {
  margin: 0;
  color: var(--danger);
  font-size: 0.8125rem;
}

.ban-empty {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 0.8125rem;
}

.ban-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* 列表内解除封禁保持中性，悬停才提示危险色；不可逆确认在弹窗里 */
.row-delete:hover:not(:disabled) {
  color: var(--destructive);
}

.ban-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}

.ban-row-main {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.ban-label {
  color: var(--foreground);
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  font-size: 0.8125rem;
  overflow-wrap: anywhere;
}

.ban-kind {
  align-self: flex-start;
  padding: 1px 6px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--muted-foreground);
  font-size: 0.75rem;
}

.ban-note {
  color: var(--foreground);
  font-size: 0.75rem;
  line-height: 1.5;
}

.ban-meta {
  color: var(--subtle-foreground);
  font-size: 0.75rem;
}

@media (max-width: 720px) {
  .ban-body {
    padding: 16px;
  }
}
</style>

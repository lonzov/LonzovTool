<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NDatePicker, NForm, NFormItem, NIcon, NInput, useMessage } from 'naive-ui'
import {
  Add24Regular,
  ArrowClockwise24Regular,
  Delete24Regular,
  Edit24Regular,
  Gift24Regular,
  Open24Regular,
  PeopleCommunity24Regular,
  ReOrderDotsVertical16Regular,
} from '@vicons/fluent'
import { createConsoleSortable } from '../sortable.js'
import AppButton from '../../components/ui/AppButton.vue'
import AppModal from '../../components/ui/AppModal.vue'
import ImageUploadField from '../components/ImageUploadField.vue'
import { uploadMediaImage } from '../mediaUpload.js'
import ConsolePanel from '../components/ConsolePanel.vue'
import { confirmDialog } from '../../composables/useConfirm.js'
import { submitOnEnter } from '../enterSubmit.js'
import { consoleFetch } from '../consoleRequest.js'
import { useSensitiveTrust } from '../useSensitiveTrust.js'

const { ensureTrust } = useSensitiveTrust()

const PEOPLE_URL = '/api/v1/console/people'
const CONTRIBUTORS_URL = `${PEOPLE_URL}/contributors`
const DONATIONS_URL = `${PEOPLE_URL}/donations`

const TABS = [
  {
    key: 'contributors',
    label: '共建者',
    icon: PeopleCommunity24Regular,
    title: '共建者名单',
    description: '首页「共建者」一栏，从上到下按这里的顺序展示，可拖动调整',
  },
  {
    key: 'donations',
    label: '打赏记录',
    icon: Gift24Regular,
    title: '打赏记录',
    description: '首页「打赏」一栏，按时间从新到旧自动排序；金额是自由文本，不做数字换算',
  },
]

const route = useRoute()
const router = useRouter()
const message = useMessage()

const tab = ref('contributors')
const contributors = ref([])
const donations = ref([])
const loading = ref(false)
const errorText = ref('')
const pendingId = ref(0)
const reordering = ref(false)

const listEl = ref(null)
let sortable = null

const editor = ref({ show: false, kind: 'contributors', editing: false, id: 0, error: '' })
const contributorForm = ref({ name: '', avatar: '', link: '', qq: '' })
// 选中的头像先留在本地，保存时再上传（上传属于写操作，要跟保存一起过身份确认）
const pendingAvatar = ref(null)
const donationForm = ref({ dateAt: null, name: '', amount: '', note: '', link: '' })
const editorSaving = ref(false)
const fieldErrors = ref({})

const activeTab = computed(() => TABS.find((item) => item.key === tab.value) || TABS[0])
const rows = computed(() =>
  tab.value === 'contributors' ? contributors.value : donations.value,
)
const isContributor = computed(() => tab.value === 'contributors')
const emptyText = computed(() => {
  if (loading.value) return '读取中…'
  return isContributor.value ? '还没有共建者，新增一位试试' : '还没有打赏记录'
})
const countText = computed(() =>
  isContributor.value ? `共 ${contributors.value.length} 位` : `共 ${donations.value.length} 笔`,
)
const avatarPreview = computed(() => {
  const value = contributorForm.value.avatar.trim()
  if (!value) return ''
  return value.startsWith('/') || /^https?:\/\//i.test(value) ? value : ''
})

/** 列表里只露前三位与后两位：截图、投屏时不至于把整串 QQ 带出去。 */
function maskQq(qq) {
  if (!qq) return ''
  if (qq.length <= 5) return qq
  return `${qq.slice(0, 3)}***${qq.slice(-2)}`
}

/** 桌面列表只露月-日：完整时间在 title 里，移动端仍显示全文。 */
function shortDate(text) {
  const match = /^\d{4}-(\d{2}-\d{2})/.exec(text || '')
  return match ? match[1] : text || ''
}

/** 库里存的是站点本地的墙上时间（2026-03-24 23:28），解析不了就回落到当前时间。 */
function parseStoredTime(text) {
  const stamp = Date.parse((text || '').replace(' ', 'T'))
  return Number.isNaN(stamp) ? Date.now() : stamp
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
    const [contributorPayload, donationPayload] = await Promise.all([
      consoleFetch(CONTRIBUTORS_URL),
      consoleFetch(DONATIONS_URL),
    ])
    contributors.value = contributorPayload?.items || []
    donations.value = donationPayload?.items || []
  } catch (e) {
    if (gotUnauthorized(e)) return
    errorText.value = e?.message || '读取失败，请稍后重试'
  } finally {
    loading.value = false
    await nextTick()
    setupSortable()
  }
}

/* 只有共建者能拖：打赏按时间排序，顺序由数据决定 */
function setupSortable() {
  sortable?.destroy()
  sortable = null
  if (!listEl.value || !isContributor.value) return
  sortable = createConsoleSortable(listEl.value, {
    handle: '.drag-handle',
    animation: 150,
    ghostClass: 'person-row--ghost',
    chosenClass: 'person-row--chosen',
    onEnd: handleDragEnd,
  })
}

function orderedIds() {
  return [...listEl.value.querySelectorAll('[data-person-id]')].map((el) =>
    Number(el.dataset.personId),
  )
}

async function handleDragEnd(event) {
  const { item, from, oldIndex } = event
  const ids = orderedIds()
  const previous = contributors.value.map((row) => row.id)

  // Sortable 直接改了 DOM，Vue 的虚拟 DOM 并不知道：先原地挪回去，顺序只由数据驱动
  from.removeChild(item)
  from.insertBefore(item, from.children[oldIndex] || null)

  if (ids.join() === previous.join()) return
  if (!(await ensureTrust())) {
    await load()
    return
  }

  const byId = new Map(contributors.value.map((row) => [row.id, row]))
  contributors.value = ids.map((id) => byId.get(id)).filter(Boolean)

  reordering.value = true
  if (sortable) sortable.option('disabled', true)
  try {
    const payload = await consoleFetch(`${CONTRIBUTORS_URL}/reorder`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
    contributors.value = payload?.items || contributors.value
    message.success('顺序已保存')
  } catch (e) {
    if (gotUnauthorized(e)) return
    message.error(e?.message || '顺序保存失败，已恢复原顺序')
    await load()
  } finally {
    reordering.value = false
    if (sortable) sortable.option('disabled', false)
  }
}

function openCreate() {
  fieldErrors.value = {}
  pendingAvatar.value = null
  if (isContributor.value) {
    contributorForm.value = { name: '', avatar: '', link: '', qq: '' }
  } else {
    donationForm.value = { dateAt: Date.now(), name: '', amount: '', note: '', link: '' }
  }
  editor.value = { show: true, kind: tab.value, editing: false, id: 0, error: '' }
}

function openEdit(row) {
  fieldErrors.value = {}
  pendingAvatar.value = null
  if (isContributor.value) {
    contributorForm.value = {
      name: row.name,
      avatar: row.avatar || '',
      link: row.link || '',
      qq: row.qq || '',
    }
  } else {
    donationForm.value = {
      dateAt: parseStoredTime(row.time),
      name: row.name,
      amount: row.amount,
      note: row.note || '',
      link: row.link || '',
    }
  }
  editor.value = { show: true, kind: tab.value, editing: true, id: row.id, error: '' }
}

function validate() {
  const errors = {}
  if (editor.value.kind === 'contributors') {
    const form = contributorForm.value
    if (!form.name.trim()) errors.name = '请填写昵称'
    if (form.qq.trim() && !/^\d{5,12}$/.test(form.qq.trim())) errors.qq = 'QQ 号是 5-12 位数字'
    if (!pendingAvatar.value && form.avatar.trim() && !avatarPreview.value) {
      errors.avatar = '头像要填 http(s) 地址，或以 / 开头的站内路径'
    }
    if (form.link.trim() && !/^https?:\/\//i.test(form.link.trim())) {
      errors.link = '链接必须以 http:// 或 https:// 开头'
    }
  } else {
    const form = donationForm.value
    if (!form.dateAt) errors.dateAt = '请选择时间'
    if (!form.name.trim()) errors.name = '请填写昵称'
    if (!form.amount.trim()) errors.amount = '请填写金额'
    if (form.link.trim() && !/^https?:\/\//i.test(form.link.trim())) {
      errors.link = '链接必须以 http:// 或 https:// 开头'
    }
  }
  fieldErrors.value = errors
  return !Object.keys(errors).length
}

async function save() {
  if (!validate()) return
  if (!(await ensureTrust())) return

  const kind = editor.value.kind
  editorSaving.value = true
  editor.value.error = ''
  if (kind === 'contributors' && pendingAvatar.value) {
    try {
      // 上传损坏或尺寸不合规时这里就会失败，下面的写入不应发生
      const media = await uploadMediaImage('avatar', pendingAvatar.value)
      contributorForm.value.avatar = media.path
      pendingAvatar.value = null
    } catch (e) {
      if (gotUnauthorized(e)) return
      editor.value.error = e?.message || '头像上传失败，请稍后重试'
      editorSaving.value = false
      return
    }
  }

  const payload =
    kind === 'contributors'
      ? {
          name: contributorForm.value.name.trim(),
          avatar: contributorForm.value.avatar.trim(),
          link: contributorForm.value.link.trim(),
          qq: contributorForm.value.qq.trim(),
        }
      : {
          time: new Date(donationForm.value.dateAt).toISOString(),
          name: donationForm.value.name.trim(),
          amount: donationForm.value.amount.trim(),
          note: donationForm.value.note.trim(),
          link: donationForm.value.link.trim(),
        }

  try {
    const url = editor.value.editing
      ? `${PEOPLE_URL}/${kind}/${editor.value.id}`
      : `${PEOPLE_URL}/${kind}`
    await consoleFetch(url, {
      method: editor.value.editing ? 'PATCH' : 'POST',
      body: JSON.stringify(payload),
    })
    message.success(editor.value.editing ? '已保存修改' : '已新增')
    editor.value.show = false
  } catch (e) {
    if (gotUnauthorized(e)) return
    editor.value.error = e?.message || '保存失败，请稍后重试'
  } finally {
    editorSaving.value = false
    await load()
  }
}

async function remove(row) {
  const label = isContributor.value ? row.name : `${row.name} · ${row.amount}`
  const confirmed = await confirmDialog({
    title: isContributor.value ? '删除共建者' : '删除打赏记录',
    message: `确定删除「${label}」吗？\n删除后首页立即不再展示，且无法恢复。`,
    confirmText: '删除',
    danger: true,
  })
  if (!confirmed) return
  if (!(await ensureTrust())) return

  pendingId.value = row.id
  try {
    await consoleFetch(`${PEOPLE_URL}/${tab.value}/${row.id}`, { method: 'DELETE' })
    message.success('已删除')
  } catch (e) {
    if (gotUnauthorized(e)) return
    message.error(e?.message || '删除失败，请稍后重试')
  } finally {
    pendingId.value = 0
    await load()
  }
}

watch(tab, async () => {
  await nextTick()
  setupSortable()
})

onMounted(load)

onBeforeUnmount(() => {
  sortable?.destroy()
  sortable = null
})
</script>

<template>
  <div class="console-people">
    <div class="people-toolbar">
      <div class="tab-group" role="tablist">
        <button
          v-for="item in TABS"
          :key="item.key"
          class="tab-btn"
          :class="{ 'tab-btn--on': tab === item.key }"
          type="button"
          role="tab"
          :aria-label="item.label"
          :aria-selected="tab === item.key"
          @click="tab = item.key"
        >
          <NIcon :component="item.icon" :size="15" />
          <span class="tab-label">{{ item.label }}</span>
        </button>
      </div>

      <div class="toolbar-actions">
        <AppButton
          variant="outline"
          size="sm"
          :icon="ArrowClockwise24Regular"
          :disabled="loading"
          @click="load"
        >
          刷新
        </AppButton>
        <AppButton variant="solid" size="sm" :icon="Add24Regular" @click="openCreate">
          新增
        </AppButton>
      </div>
    </div>

    <p v-if="errorText" class="inline-hint inline-hint--error">{{ errorText }}</p>

    <ConsolePanel
      :icon="activeTab.icon"
      :title="activeTab.title"
      :description="activeTab.description"
    >
      <template #extra>
        <span class="count-tag">{{ countText }}</span>
      </template>

      <p v-if="!rows.length" class="inline-hint">{{ emptyText }}</p>

      <div
        v-else
        class="person-list"
        :class="{ 'person-list--busy': reordering, 'person-list--donations': !isContributor }"
      >
        <div ref="listEl" class="person-rows">
          <div
            v-for="row in rows"
            :key="row.id"
            :data-person-id="row.id"
            class="person-row"
            :class="{ 'person-row--contributor': isContributor, 'person-row--donation': !isContributor }"
          >
            <span
              v-if="isContributor"
              class="drag-handle"
              title="按住拖动调整顺序"
              aria-hidden="true"
            >
              <NIcon :component="ReOrderDotsVertical16Regular" :size="16" />
            </span>

            <template v-if="isContributor">
              <span class="person-avatar">
                <img v-if="row.avatar" :src="row.avatar" :alt="row.name" loading="lazy" />
                <span v-else class="person-avatar-fallback">{{ row.name.slice(0, 1) }}</span>
              </span>
              <div class="person-main">
                <span class="person-name" :title="row.name">{{ row.name }}</span>
                <a
                  v-if="row.link"
                  class="person-sub"
                  :href="row.link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ row.link }}
                  <NIcon :component="Open24Regular" :size="11" />
                </a>
                <span v-else class="person-sub person-sub--dim">未填写链接</span>
              </div>
              <span class="person-qq" :class="{ 'person-qq--empty': !row.qq }">
                {{ row.qq ? maskQq(row.qq) : '未填 QQ' }}
              </span>
            </template>

            <template v-else>
              <span class="person-time" :title="row.time">
                <span class="person-time-full">{{ row.time }}</span>
                <span class="person-time-short">{{ shortDate(row.time) }}</span>
              </span>
              <div class="person-main">
                <span class="person-name">{{ row.name }}</span>
                <a
                  v-if="row.link"
                  class="person-sub"
                  :href="row.link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ row.link }}
                  <NIcon :component="Open24Regular" :size="11" />
                </a>
                <span v-else-if="row.note" class="person-sub">{{ row.note }}</span>
                <span v-else class="person-sub person-sub--dim">未填写备注</span>
              </div>
              <span class="person-amount">{{ row.amount }}</span>
            </template>

            <span class="col-actions">
              <AppButton
                variant="outline"
                size="xs"
                icon-only
                label="编辑"
                :icon="Edit24Regular"
                @click="openEdit(row)"
              />
              <AppButton
                variant="outline"
                tone="danger"
                size="xs"
                icon-only
                label="删除"
                :icon="Delete24Regular"
                :disabled="pendingId === row.id"
                @click="remove(row)"
              />
            </span>
          </div>
        </div>
      </div>
    </ConsolePanel>

    <AppModal
      v-model:show="editor.show"
      :title="`${editor.editing ? '编辑' : '新增'}${editor.kind === 'contributors' ? '共建者' : '打赏记录'}`"
      :max-width="520"
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
      <NForm
        v-if="editor.kind === 'contributors'"
        label-placement="top"
        @keydown.enter="submitOnEnter($event, save)"
      >
        <NFormItem
          label="昵称"
          required
          :validation-status="fieldErrors.name ? 'error' : undefined"
          :feedback="fieldErrors.name || undefined"
        >
          <NInput v-model:value="contributorForm.name" maxlength="64" placeholder="展示在首页的名字" />
        </NFormItem>
        <NFormItem label="头像">
          <div class="avatar-field">
            <ImageUploadField
              v-model="contributorForm.avatar"
              v-model:pending-file="pendingAvatar"
              :fallback="contributorForm.name.trim().slice(0, 1) || '头'"
            />
          </div>
          <NInput
            v-model:value="contributorForm.avatar"
            class="avatar-url"
            maxlength="512"
            placeholder="也可以直接填站内路径或 http(s) 图片地址"
            :status="fieldErrors.avatar ? 'error' : undefined"
          />
          <p v-if="fieldErrors.avatar" class="field-error">{{ fieldErrors.avatar }}</p>
        </NFormItem>
        <NFormItem
          label="链接"
          :validation-status="fieldErrors.link ? 'error' : undefined"
          :feedback="fieldErrors.link || undefined"
        >
          <NInput
            v-model:value="contributorForm.link"
            maxlength="512"
            placeholder="可选，填了之后首页名字可点击，以 http:// 或 https:// 开头"
          />
        </NFormItem>
        <NFormItem
          label="QQ"
          :validation-status="fieldErrors.qq ? 'error' : undefined"
          :feedback="fieldErrors.qq || undefined"
        >
          <NInput v-model:value="contributorForm.qq" maxlength="16" placeholder="可选，5-12 位数字" />
        </NFormItem>
        <p class="field-hint">
          QQ 只用于服务端抓取头像与人工核对：公开接口与站点产物都不会带上它，列表里也只露前三位与后两位。
        </p>
        <p v-if="editor.error" class="editor-error">{{ editor.error }}</p>
      </NForm>

      <NForm v-else label-placement="top" @keydown.enter="submitOnEnter($event, save)">
        <NFormItem
          label="时间"
          required
          :validation-status="fieldErrors.dateAt ? 'error' : undefined"
          :feedback="fieldErrors.dateAt || undefined"
        >
          <NDatePicker
            v-model:value="donationForm.dateAt"
            type="datetime"
            format="yyyy-MM-dd HH:mm"
            :clearable="false"
            placeholder="选择打赏时间"
            class="date-input"
          />
        </NFormItem>
        <NFormItem
          label="昵称"
          required
          :validation-status="fieldErrors.name ? 'error' : undefined"
          :feedback="fieldErrors.name || undefined"
        >
          <NInput v-model:value="donationForm.name" maxlength="64" placeholder="打赏者昵称" />
        </NFormItem>
        <NFormItem
          label="金额"
          required
          :validation-status="fieldErrors.amount ? 'error' : undefined"
          :feedback="fieldErrors.amount || undefined"
        >
          <NInput
            v-model:value="donationForm.amount"
            maxlength="64"
            placeholder="自由文本，例如 ￥5、3.4 贝壳、一个 API key"
          />
        </NFormItem>
        <NFormItem label="备注">
          <NInput
            v-model:value="donationForm.note"
            type="textarea"
            maxlength="256"
            show-count
            :autosize="{ minRows: 2, maxRows: 4 }"
            placeholder="可选，例如「小舟充电第一人」"
          />
        </NFormItem>
        <NFormItem
          label="链接"
          :validation-status="fieldErrors.link ? 'error' : undefined"
          :feedback="fieldErrors.link || undefined"
        >
          <NInput
            v-model:value="donationForm.link"
            maxlength="512"
            placeholder="可选，以 http:// 或 https:// 开头"
          />
        </NFormItem>
        <p class="field-hint">
          列表按时间从新到旧自动排序，改时间会改变它出现的位置；金额不做数字解析，写什么就展示什么。
        </p>
        <p v-if="editor.error" class="editor-error">{{ editor.error }}</p>
      </NForm>
    </AppModal>
  </div>
</template>

<style scoped>
.console-people {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
  min-width: 0;
}

.people-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.tab-group {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--muted);
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 12px;
  border: none;
  border-radius: calc(var(--radius-lg) - 3px);
  background: transparent;
  color: var(--muted-foreground);
  font-family: inherit;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: color 0.2s ease, background-color 0.2s ease;
}

.tab-btn:hover {
  color: var(--foreground);
}

.tab-btn--on {
  background: var(--card);
  color: var(--foreground);
  box-shadow: var(--shadow-sm);
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.count-tag {
  color: var(--subtle-foreground);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.person-rows {
  display: flex;
  flex-direction: column;
}

.person-row {
  display: grid;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
  transition: background-color 0.2s ease, border-color 0.4s ease;
}

.person-row--contributor {
  grid-template-columns: 22px 34px minmax(0, 1fr) 92px 64px;
}

.person-row--donation {
  grid-template-columns: auto minmax(0, 1fr) 104px 64px;
}

.person-row:last-child {
  border-bottom: none;
}

.person-row--ghost {
  opacity: 0.4;
  background: var(--accent);
}

.person-list--busy .person-row {
  pointer-events: none;
}

.drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--subtle-foreground);
  cursor: grab;
}

.drag-handle:active {
  cursor: grabbing;
}

.person-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: var(--radius-full);
  corner-shape: round;
  background: var(--muted);
  color: var(--muted-foreground);
  overflow: hidden;
  font-size: 0.8rem;
  font-weight: 600;
}

.person-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.person-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.person-name {
  color: var(--foreground);
  font-size: 0.86rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.person-sub {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--muted-foreground);
  font-size: 0.74rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.2s ease;
}

a.person-sub:hover {
  color: var(--foreground);
}

.person-sub--dim {
  color: var(--subtle-foreground);
}

.person-qq,
.person-amount {
  color: var(--muted-foreground);
  font-size: 0.76rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.person-qq--empty {
  color: var(--subtle-foreground);
}

.person-time {
  color: var(--muted-foreground);
  font-size: 0.76rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.person-time-short {
  display: inline;
}

.person-time-full {
  display: none;
}

.col-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}

.avatar-field {
  width: 100%;
}

.avatar-url {
  margin-top: 8px;
}

.date-input {
  width: 100%;
}

.field-hint {
  margin: 0 0 8px;
  color: var(--subtle-foreground);
  font-size: 0.75rem;
  line-height: 1.6;
}

.field-error,
.editor-error {
  margin: 6px 0 0;
  color: var(--destructive);
  font-size: 0.78rem;
}

/* 窄屏：工具条压成一行，页签与刷新只剩图标；打赏行折成两行，别让时间与金额互相挤 */
@media (width <= 720px) {
  .people-toolbar {
    flex-wrap: nowrap;
    gap: 8px;
  }

  .tab-group {
    padding: 2px;
  }

  .tab-btn {
    padding: 0 10px;
  }

  .tab-label {
    display: none;
  }

  .toolbar-actions {
    gap: 6px;
  }

  .person-row--contributor {
    grid-template-columns: 18px 30px minmax(0, 1fr) auto;
    gap: 8px;
  }

  .person-row--donation {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'time amount'
      'main actions';
    row-gap: 4px;
    padding: 12px 0;
  }

  .person-row--donation .person-time {
    grid-area: time;
  }

  .person-time-full {
    display: inline;
  }

  .person-time-short {
    display: none;
  }

  .person-row--donation .person-main {
    grid-area: main;
  }

  .person-row--donation .person-amount {
    grid-area: amount;
    font-size: 0.82rem;
    color: var(--foreground);
  }

  .person-row--donation .col-actions {
    grid-area: actions;
  }

  .person-qq {
    display: none;
  }

  .person-avatar {
    width: 30px;
    height: 30px;
  }
}
</style>

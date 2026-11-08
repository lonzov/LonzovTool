<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NDatePicker, NForm, NFormItem, NIcon, NInput, NSwitch, useMessage } from 'naive-ui'
import {
  AppsListDetail24Regular,
  CalendarClock24Regular,
  DataBarVertical24Regular,
  Edit24Regular,
} from '@vicons/fluent'
import AppButton from '../../components/ui/AppButton.vue'
import AppModal from '../../components/ui/AppModal.vue'
import ConsolePanel from '../components/ConsolePanel.vue'
import { submitOnEnter } from '../enterSubmit.js'
import { consoleFetch } from '../consoleRequest.js'
import { useSensitiveTrust } from '../useSensitiveTrust.js'
import { preparePromoImage } from '../../utils/iconUpload.js'

const { ensureTrust } = useSensitiveTrust()

const PROMO_URL = '/api/v1/console/promo'

// 埋点事件名形如 Promo+jzfk，查询参数交给 URLSearchParams 编码，避免标识里有特殊字符时拼错
const ANALYTICS_BASE = 'https://imamu.lonzov.top/share/FmUyTde668rZaCXX/events'

function analyticsUrl(item) {
  const query = new URLSearchParams({
    date: '30day',
    page: '1',
    event: `eq.Promo+${item.event_id}`,
  })
  return `${ANALYTICS_BASE}?${query.toString()}`
}

const DATE_SHORTCUTS = {
  一周后: () => Date.now() + 7 * 24 * 3600 * 1000,
  一个月后: () => Date.now() + 30 * 24 * 3600 * 1000,
}

const route = useRoute()
const router = useRouter()
const message = useMessage()

const items = ref([])
const loading = ref(false)
const errorText = ref('')

const editor = ref({ show: false, slot: '', error: '', uploading: false })
const form = ref({ title: '', image: '', link: '', eventId: '', expiresAt: null, hidden: false })
const saving = ref(false)
// 配图先留本地（对象 URL 预览），保存时再随其他字段一起上传
const pendingImage = ref(null)
const pendingImagePreview = ref('')
const imagePreview = computed(() => pendingImagePreview.value || form.value.image)

function setPendingImage(file) {
  if (pendingImagePreview.value) URL.revokeObjectURL(pendingImagePreview.value)
  pendingImage.value = file
  pendingImagePreview.value = file ? URL.createObjectURL(file) : ''
}

const imageInput = ref(null)
const dragging = ref(false)

const emptyText = computed(() => (loading.value ? '读取中…' : '没有推广位数据'))

function gotUnauthorized(e) {
  if (e?.code !== 'unauthorized') return false
  router.replace({ path: '/console/login', query: { redirect: route.fullPath } })
  return true
}

/* 状态：到期由服务端算，前端不再按浏览器时间判断——时钟不准会把已下架的广告显示成在架 */
function statusOf(item) {
  if (item.expired) return { text: '已到期', tone: 'muted' }
  if (item.hidden) return { text: '已隐藏', tone: 'muted' }
  if (!item.image) return { text: '未配置', tone: 'muted' }
  return { text: '显示中', tone: 'live' }
}

function formatExpiry(timestamp) {
  if (!timestamp) return '永不过期'
  return new Date(timestamp * 1000).toLocaleString('zh-CN', {
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
    const payload = await consoleFetch(PROMO_URL)
    items.value = payload?.items || []
  } catch (e) {
    if (gotUnauthorized(e)) return
    errorText.value = e?.message || '读取失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

function openEdit(item) {
  setPendingImage(null)
  editor.value = { show: true, slot: item.slot, error: '', uploading: false }
  form.value = {
    title: item.title,
    image: item.image,
    link: item.link,
    eventId: item.event_id,
    // 秒 → 毫秒；空表示不过期
    expiresAt: item.expires_at ? item.expires_at * 1000 : null,
    hidden: item.hidden,
  }
}

function applyItem(updated) {
  items.value = items.value.map((item) => (item.slot === updated.slot ? updated : item))
}

async function prepareImage(file) {
  if (!file) return
  editor.value.error = ''
  editor.value.uploading = true

  const { file: prepared, error } = await preparePromoImage(file)
  editor.value.uploading = false
  if (error || !prepared) {
    editor.value.error = error
    return
  }
  setPendingImage(prepared)
  message.success('图片已就绪，保存后上传')
}

function pickImage() {
  imageInput.value?.click()
}

function onImagePicked(event) {
  const [file] = event.target.files || []
  event.target.value = ''
  prepareImage(file)
}

function onDrop(event) {
  dragging.value = false
  const [file] = event.dataTransfer?.files || []
  prepareImage(file)
}

// 编辑器打开时接管粘贴：截图直接 Cmd/Ctrl+V 进来
function onPaste(event) {
  const file = [...(event.clipboardData?.items || [])]
    .find((item) => item.type.startsWith('image/'))
    ?.getAsFile()
  if (!file) return
  event.preventDefault()
  prepareImage(file)
}

onMounted(() => {
  load()
  document.addEventListener('paste', onPaste)
})

onBeforeUnmount(() => {
  document.removeEventListener('paste', onPaste)
  setPendingImage(null)
})

async function save() {
  if (!(await ensureTrust())) return
  saving.value = true
  editor.value.error = ''
  try {
    if (pendingImage.value) {
      const body = new FormData()
      body.append('image_file', pendingImage.value)
      const uploaded = await consoleFetch(`${PROMO_URL}/${editor.value.slot}/image`, {
        method: 'POST',
        body,
      })
      form.value.image = uploaded.image
      setPendingImage(null)
    }
    const updated = await consoleFetch(`${PROMO_URL}/${editor.value.slot}`, {
      method: 'PATCH',
      body: JSON.stringify({
        title: form.value.title.trim(),
        image: form.value.image,
        link: form.value.link.trim(),
        event_id: form.value.eventId.trim(),
        expires_at: form.value.expiresAt ? new Date(form.value.expiresAt).toISOString() : null,
        hidden: form.value.hidden,
      }),
    })
    applyItem(updated)
    editor.value.show = false
    message.success('已保存')
  } catch (e) {
    if (gotUnauthorized(e)) return
    message.error(e?.message || '保存失败，请稍后重试')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="console-promo">
    <p v-if="errorText" class="inline-hint inline-hint--error">{{ errorText }}</p>

    <ConsolePanel :icon="AppsListDetail24Regular" title="槽位明细">
      <p v-if="!items.length" class="inline-hint">{{ emptyText }}</p>

      <div v-else class="promo-list">
        <div v-for="item in items" :key="item.slot" class="promo-row">
          <div class="promo-thumb">
            <img v-if="item.image" :src="item.image" :alt="item.label" loading="lazy" />
            <span v-else class="promo-thumb__empty">未配图</span>
          </div>

          <div class="promo-main">
            <div class="promo-title-line">
              <span class="promo-label">{{ item.label }}</span>
              <span class="promo-status" :class="`promo-status--${statusOf(item).tone}`">
                {{ statusOf(item).text }}
              </span>
            </div>
            <span class="promo-sub">{{ item.title || '（未填标题）' }}</span>
            <span class="promo-meta">
              <NIcon :component="CalendarClock24Regular" :size="12" />
              {{ formatExpiry(item.expires_at) }}
              <template v-if="item.link"> · {{ item.link }}</template>
            </span>
          </div>

          <div class="promo-actions">
            <AppButton
              v-if="item.event_id"
              variant="outline"
              size="xs"
              icon-only
              label="查看埋点数据"
              :icon="DataBarVertical24Regular"
              :href="analyticsUrl(item)"
              target="_blank"
              rel="noopener noreferrer"
            />
            <AppButton
              v-else
              variant="outline"
              size="xs"
              icon-only
              label="填写埋点标识后可查看数据"
              :icon="DataBarVertical24Regular"
              disabled
            />
            <AppButton
              variant="outline"
              size="xs"
              icon-only
              label="编辑"
              :icon="Edit24Regular"
              @click="openEdit(item)"
            />
          </div>
        </div>
      </div>
    </ConsolePanel>

    <AppModal
      v-model:show="editor.show"
      :title="`编辑推广位 · ${items.find((i) => i.slot === editor.slot)?.label || ''}`"
      :max-width="560"
      :auto-focus="false"
      :actions="[
        { text: '取消', variant: 'outline', onClick: () => (editor.show = false) },
        { text: saving ? '保存中…' : '保存', variant: 'fill', disabled: saving, onClick: save },
      ]"
      content-scrollable
    >
      <NForm label-placement="top" @keydown.enter="submitOnEnter($event, save)">
        <NFormItem label="推广图">
          <div
            class="image-drop"
            :class="{ 'image-drop--active': dragging }"
            @click="pickImage"
            @dragover.prevent="dragging = true"
            @dragleave.prevent="dragging = false"
            @drop.prevent="onDrop"
          >
            <img v-if="imagePreview" :src="imagePreview" alt="推广图预览" />
            <span v-else class="image-drop__hint">
              {{ editor.uploading ? '处理中…' : '点击、拖入或粘贴图片（保存后上传，建议 1200×400）' }}
            </span>
          </div>
          <input
            ref="imageInput"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            class="hidden-input"
            @change="onImagePicked"
          />
        </NFormItem>

        <p class="form-note">
          上传后服务端统一转 WebP、宽压到 1200 以内；也可以直接填外链地址。
        </p>

        <NFormItem label="图片地址">
          <NInput v-model:value="form.image" maxlength="512" placeholder="留空表示这一档不投放" />
        </NFormItem>

        <NFormItem label="标题">
          <NInput v-model:value="form.title" maxlength="64" placeholder="可选，仅供自己辨认" />
        </NFormItem>

        <NFormItem label="跳转链接">
          <NInput
            v-model:value="form.link"
            maxlength="512"
            placeholder="完整网址，或站内路径（如 /docs/promotion）"
          />
        </NFormItem>

        <NFormItem label="埋点标识">
          <NInput v-model:value="form.eventId" maxlength="32" placeholder="可选，点击上报为 Promo+<标识>" />
        </NFormItem>

        <NFormItem label="到期时间">
          <NDatePicker
            v-model:value="form.expiresAt"
            type="datetime"
            format="yyyy-MM-dd HH:mm"
            :shortcuts="DATE_SHORTCUTS"
            clearable
            placeholder="留空 = 永不过期"
            class="date-input"
          />
        </NFormItem>

        <NFormItem label="隐藏">
          <NSwitch v-model:value="form.hidden" />
        </NFormItem>

        <p v-if="editor.error" class="editor-error">{{ editor.error }}</p>
      </NForm>
    </AppModal>
  </div>
</template>

<style scoped>
.console-promo {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
  min-width: 0;
}

.promo-list {
  display: flex;
  flex-direction: column;
}

.promo-row {
  display: grid;
  /* 3:1 的缩略图，201px 宽即 67px 高，与右侧三行文案的高度相称 */
  grid-template-columns: 201px minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}

.promo-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.promo-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 3 / 1;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--muted);
}

.promo-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.promo-thumb__empty {
  color: var(--subtle-foreground);
  font-size: 0.7rem;
}

.promo-main {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.promo-title-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.promo-label {
  color: var(--foreground);
  font-size: 0.88rem;
  font-weight: 600;
}

.promo-status {
  padding: 1px 8px;
  border-radius: var(--radius-full);
  corner-shape: round;
  font-size: 0.7rem;
  transition: color 0.4s ease;
}

.promo-status--live {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 12%, transparent);
}

.promo-status--muted {
  color: var(--subtle-foreground);
  background: var(--muted);
}

.promo-sub {
  overflow: hidden;
  color: var(--muted-foreground);
  font-size: 0.8rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.promo-meta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  color: var(--subtle-foreground);
  font-size: 0.72rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.promo-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.promo-actions .app-btn {
  flex-shrink: 0;
}

/* ===== 编辑器 ===== */
.image-drop {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  flex: 1 1 100%;
  aspect-ratio: 3 / 1;
  overflow: hidden;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--muted);
  color: var(--subtle-foreground);
  font-size: 0.76rem;
  cursor: pointer;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.image-drop:hover,
.image-drop--active {
  border-color: var(--foreground);
  background: var(--accent);
}

.image-drop img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.image-drop__hint {
  padding: 0 12px;
  text-align: center;
  line-height: 1.6;
}

.hidden-input {
  display: none;
}

.date-input {
  width: 100%;
  max-width: 260px;
}

.form-note {
  margin: -4px 0 16px;
  color: var(--subtle-foreground);
  font-size: 0.74rem;
  line-height: 1.6;
}

.editor-error {
  margin: 6px 0 0;
  color: var(--destructive);
  font-size: 0.8rem;
}

.inline-hint {
  margin: 0;
  padding: 8px 0;
  color: var(--subtle-foreground);
  font-size: 0.8rem;
}

.inline-hint--error {
  color: var(--destructive);
}

/* 竖屏手机：图占满一行，文案与操作另起一行，避免文字列被压成一两个字宽 */
@media (width <= 520px) {
  .promo-row {
    grid-template-columns: minmax(0, 1fr) auto;
    row-gap: 8px;
  }

  .promo-thumb {
    grid-column: 1 / -1;
  }

  .promo-actions {
    justify-content: flex-end;
  }

  .promo-meta {
    align-items: flex-start;
    white-space: normal;
    overflow-wrap: anywhere;
  }
}
</style>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NForm, NFormItem, NIcon, NInput, NSwitch, useMessage } from 'naive-ui'
import {
  Add24Regular,
  ArrowClockwise24Regular,
  ArrowDownload24Regular,
  Delete24Regular,
  Dismiss24Regular,
  Edit24Regular,
  Open24Regular,
} from '@vicons/fluent'
import AppButton from '../../components/ui/AppButton.vue'
import AppModal from '../../components/ui/AppModal.vue'
import ConsolePanel from '../components/ConsolePanel.vue'
import ImageUploadField from '../components/ImageUploadField.vue'
import { submitOnEnter } from '../enterSubmit.js'
import { uploadMediaImage } from '../mediaUpload.js'
import { confirmDialog } from '../../composables/useConfirm.js'
import { consoleFetch } from '../consoleRequest.js'
import { useSensitiveTrust } from '../useSensitiveTrust.js'
import { usePermissions } from '../usePermissions.js'

const { ensureTrust } = useSensitiveTrust()
const { can } = usePermissions()
// 新建页不属于任何既有范围：接口要求不限范围的 downloads.write，只有范围授权的账号不显示入口
const canCreatePage = computed(() => can('downloads.write', ''))

const URL = '/api/v1/console/downloads'

const route = useRoute()
const router = useRouter()
const message = useMessage()

const pages = ref([])
const loading = ref(false)
const errorText = ref('')
const pendingSlug = ref('')

const editor = ref({ show: false, editing: false, slug: '' })
const form = ref(emptyForm())
const fieldErrors = ref({})
const saving = ref(false)
// 封面图先留本地，保存时再上传
const pendingIcon = ref(null)

function emptyForm() {
  return {
    slug: '',
    name: '',
    icon: '',
    version: '',
    tagline: '',
    intro: '',
    developer: '',
    developerLink: '',
    quark: '',
    fileSize: '',
    hidden: false,
    links: [],
  }
}

const iconPreview = computed(() => {
  const value = (form.value.icon || '').trim()
  return value.startsWith('/') || /^https?:\/\//i.test(value) ? value : ''
})

const totalDownloads = computed(() =>
  pages.value.reduce((sum, page) => sum + (page.downloads || 0), 0),
)

function gotUnauthorized(e) {
  if (e?.code !== 'unauthorized') return false
  router.replace({ path: '/console/login', query: { redirect: route.fullPath } })
  return true
}

async function load() {
  loading.value = true
  errorText.value = ''
  try {
    const payload = await consoleFetch(URL)
    pages.value = payload?.items || []
  } catch (e) {
    if (gotUnauthorized(e)) return
    errorText.value = e?.message || '读取失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

function openCreate() {
  fieldErrors.value = {}
  pendingIcon.value = null
  form.value = emptyForm()
  form.value.links = [emptyLink()]
  editor.value = { show: true, editing: false, slug: '' }
}

function openEdit(page) {
  fieldErrors.value = {}
  pendingIcon.value = null
  form.value = {
    slug: page.slug,
    name: page.name,
    icon: page.icon || '',
    version: page.version || '',
    tagline: page.tagline || '',
    intro: page.intro || '',
    developer: page.developer || '',
    developerLink: page.developerLink || '',
    quark: page.quark || '',
    fileSize: page.fileSize || '',
    hidden: !!page.hidden,
    links: (page.links || []).map((link) => ({ ...link })),
  }
  editor.value = { show: true, editing: true, slug: page.slug }
}

function emptyLink() {
  return { version: '', url: '', password: '' }
}

function addLink() {
  form.value.links.push(emptyLink())
}

function removeLink(index) {
  form.value.links.splice(index, 1)
}

function validate() {
  const errors = {}
  const value = form.value
  if (!editor.value.editing && !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value.slug.trim())) {
    errors.slug = '标识只能用字母、数字、下划线与连字符，且不能以符号开头'
  }
  if (!value.name.trim()) errors.name = '请填写名称'
  if (!pendingIcon.value && value.icon.trim() && !iconPreview.value) {
    errors.icon = '图标要填 http(s) 地址，或以 / 开头的站内路径'
  }
  if (value.developerLink.trim() && !/^(https?:\/\/|mailto:)/i.test(value.developerLink.trim())) {
    errors.developerLink = '开发者链接必须以 http://、https:// 或 mailto: 开头'
  }
  if (value.quark.trim() && !/^https?:\/\//i.test(value.quark.trim())) {
    errors.quark = '网盘链接必须以 http:// 或 https:// 开头'
  }
  const links = value.links.filter((link) => link.url.trim() || link.version.trim())
  if (!links.length) errors.links = '至少填一个下载链接'
  if (links.some((link) => !link.version.trim() || !link.url.trim())) {
    errors.links = '每个下载链接都要有版本与地址'
  } else if (links.some((link) => !/^https?:\/\//i.test(link.url.trim()))) {
    errors.links = '下载链接必须以 http:// 或 https:// 开头'
  }
  fieldErrors.value = errors
  return !Object.keys(errors).length
}

async function save() {
  if (!validate()) return
  if (!(await ensureTrust())) return

  saving.value = true
  if (pendingIcon.value) {
    try {
      const media = await uploadMediaImage('download', pendingIcon.value)
      form.value.icon = media.path
      pendingIcon.value = null
    } catch (e) {
      if (gotUnauthorized(e)) return
      message.error(e?.message || '封面上传失败，请稍后重试')
      saving.value = false
      return
    }
  }

  const value = form.value
  const payload = {
    name: value.name.trim(),
    icon: value.icon.trim(),
    version: value.version.trim(),
    tagline: value.tagline.trim(),
    intro: value.intro.trim(),
    developer: value.developer.trim(),
    developerLink: value.developerLink.trim(),
    quark: value.quark.trim(),
    fileSize: value.fileSize.trim(),
    hidden: !!value.hidden,
    links: value.links
      .filter((link) => link.url.trim() || link.version.trim())
      .map((link) => ({
        version: link.version.trim(),
        url: link.url.trim(),
        password: link.password.trim(),
      })),
  }
  if (!editor.value.editing) payload.slug = value.slug.trim()

  try {
    await consoleFetch(
      editor.value.editing ? `${URL}/${encodeURIComponent(editor.value.slug)}` : URL,
      { method: editor.value.editing ? 'PATCH' : 'POST', body: JSON.stringify(payload) },
    )
    message.success(editor.value.editing ? '已保存修改' : '已新增下载页')
    editor.value.show = false
  } catch (e) {
    if (gotUnauthorized(e)) return
    message.error(e?.message || '保存失败，请稍后重试')
  } finally {
    saving.value = false
    await load()
  }
}

async function remove(page) {
  const confirmed = await confirmDialog({
    title: '删除下载页',
    message: `确定删除「${page.name}」吗？\n删除后 /down/${page.slug} 会变成 404，且无法恢复。`,
    confirmText: '删除',
    danger: true,
  })
  if (!confirmed) return
  if (!(await ensureTrust())) return

  pendingSlug.value = page.slug
  try {
    await consoleFetch(`${URL}/${encodeURIComponent(page.slug)}`, { method: 'DELETE' })
    message.success('已删除')
    if (editor.value.editing && editor.value.slug === page.slug) editor.value.show = false
  } catch (e) {
    if (gotUnauthorized(e)) return
    message.error(e?.message || '删除失败，请稍后重试')
  } finally {
    pendingSlug.value = ''
    await load()
  }
}

function formatCount(value) {
  return Number(value || 0).toLocaleString('zh-CN')
}

onMounted(load)
</script>

<template>
  <div class="console-downloads">
    <div class="downloads-toolbar">
      <AppButton
        variant="outline"
        size="sm"
        :icon="ArrowClockwise24Regular"
        :disabled="loading"
        @click="load"
      >
        刷新
      </AppButton>
      <AppButton
        v-if="canCreatePage"
        variant="solid"
        size="sm"
        :icon="Add24Regular"
        @click="openCreate"
      >
        新增
      </AppButton>
    </div>

    <p v-if="errorText" class="inline-hint inline-hint--error" role="alert">{{ errorText }}</p>

    <ConsolePanel
      :icon="ArrowDownload24Regular"
      title="下载页列表"
    >
      <template #extra>
        <span class="count-tag">共 {{ pages.length }} 页 · {{ formatCount(totalDownloads) }} 次下载</span>
      </template>

      <p v-if="loading" class="inline-hint">读取中…</p>
      <p v-else-if="!pages.length" class="inline-hint">还没有下载页，新增一个试试</p>

      <div v-else class="download-rows">
        <div v-for="page in pages" :key="page.slug" class="download-row">
          <span class="download-icon">
            <img v-if="page.icon" :src="page.icon" :alt="page.name" loading="lazy" />
            <NIcon v-else :component="ArrowDownload24Regular" :size="18" />
          </span>

          <div class="download-main">
            <div class="download-title-line">
              <span class="download-name">{{ page.name }}</span>
              <span v-if="page.hidden" class="tag tag--muted">已隐藏</span>
              <span class="download-version">{{ page.version || '未填版本' }}</span>
            </div>
            <p class="download-sub">{{ page.tagline || '未填写一句话介绍' }}</p>
          </div>

          <div class="download-meta">
            <span class="download-slug" :title="page.slug">{{ page.slug }}</span>
            <span class="download-count">{{ formatCount(page.downloads) }} 次</span>
          </div>

          <span class="download-actions">
            <AppButton
              variant="outline"
              size="xs"
              icon-only
              label="查看页面"
              :icon="Open24Regular"
              :href="`/down/${page.slug}`"
              target="_blank"
              rel="noopener noreferrer"
            />
            <AppButton
              variant="outline"
              size="xs"
              icon-only
              label="编辑"
              :icon="Edit24Regular"
              @click="openEdit(page)"
            />
          </span>
        </div>
      </div>
    </ConsolePanel>

    <AppModal
      v-model:show="editor.show"
      :title="editor.editing ? '编辑下载页' : '新增下载页'"
      :max-width="640"
      :auto-focus="false"
      :actions="[
        { text: '取消', variant: 'outline', onClick: () => (editor.show = false) },
        {
          text: saving ? '保存中…' : '保存',
          variant: 'fill',
          disabled: saving,
          onClick: save,
        },
      ]"
      content-scrollable
    >
      <NForm label-placement="top" @keydown.enter="submitOnEnter($event, save)">
        <div class="form-grid">
          <NFormItem
            label="名称"
            required
            :validation-status="fieldErrors.name ? 'error' : undefined"
            :feedback="fieldErrors.name || undefined"
          >
            <NInput v-model:value="form.name" maxlength="64" placeholder="展示在下载页与侧边栏的名字" />
          </NFormItem>
          <NFormItem
            label="标识"
            :required="!editor.editing"
            :validation-status="fieldErrors.slug ? 'error' : undefined"
            :feedback="fieldErrors.slug || undefined"
          >
            <NInput
              v-model:value="form.slug"
              :disabled="editor.editing"
              maxlength="64"
              placeholder="如 lonzovtool，建好后不可改"
            />
          </NFormItem>
        </div>

        <NFormItem
          label="图标"
          :validation-status="fieldErrors.icon ? 'error' : undefined"
          :feedback="fieldErrors.icon || undefined"
        >
          <div class="icon-field">
            <ImageUploadField
              v-model="form.icon"
              v-model:pending-file="pendingIcon"
              label="上传封面"
              :fallback="form.name.trim().slice(0, 1) || '图'"
            />
            <NInput
              v-model:value="form.icon"
              maxlength="512"
              placeholder="也可以直接填站内路径或 http(s) 图片地址"
              :status="fieldErrors.icon ? 'error' : undefined"
            />
          </div>
        </NFormItem>

        <div class="form-grid">
          <NFormItem label="最新版本">
            <NInput v-model:value="form.version" maxlength="32" placeholder="如 v1.0.39" />
          </NFormItem>
          <NFormItem label="文件大小">
            <NInput v-model:value="form.fileSize" maxlength="32" placeholder="如 69.8" />
          </NFormItem>
        </div>

        <NFormItem label="一句话介绍">
          <NInput v-model:value="form.tagline" maxlength="120" placeholder="标题下面的一行说明" />
        </NFormItem>

        <div class="form-grid">
          <NFormItem label="开发者">
            <NInput v-model:value="form.developer" maxlength="64" placeholder="留空则不展示" />
          </NFormItem>
          <NFormItem
            label="开发者链接"
            :validation-status="fieldErrors.developerLink ? 'error' : undefined"
            :feedback="fieldErrors.developerLink || undefined"
          >
            <NInput
              v-model:value="form.developerLink"
              maxlength="512"
              placeholder="http(s) 或 mailto:"
            />
          </NFormItem>
        </div>

        <NFormItem
          label="夸克网盘"
          :validation-status="fieldErrors.quark ? 'error' : undefined"
          :feedback="fieldErrors.quark || undefined"
        >
          <NInput
            v-model:value="form.quark"
            maxlength="512"
            placeholder="可选，留空则只展示蓝奏云链接"
          />
        </NFormItem>

        <NFormItem label="下载链接" required :validation-status="fieldErrors.links ? 'error' : undefined">
          <div class="link-list">
            <div v-for="(link, index) in form.links" :key="index" class="link-row">
              <NInput v-model:value="link.version" maxlength="32" placeholder="版本" />
              <NInput v-model:value="link.url" maxlength="512" placeholder="https://…" />
              <NInput v-model:value="link.password" maxlength="32" placeholder="提取码（可空）" />
              <AppButton
                class="row-delete"
                variant="outline"
                size="xs"
                icon-only
                label="移除这一条"
                :icon="Dismiss24Regular"
                @click="removeLink(index)"
              />
            </div>
            <AppButton variant="outline" size="sm" :icon="Add24Regular" @click="addLink">
              添加一条
            </AppButton>
            <p v-if="fieldErrors.links" class="field-error">{{ fieldErrors.links }}</p>
            <p class="field-hint">按填写顺序展示，最新的版本放最上面。</p>
          </div>
        </NFormItem>

        <NFormItem label="功能介绍（Markdown）">
          <NInput
            v-model:value="form.intro"
            type="textarea"
            maxlength="20000"
            show-count
            :autosize="{ minRows: 6, maxRows: 14 }"
            placeholder="支持标题、列表、链接等 Markdown 语法"
            class="intro-input"
          />
        </NFormItem>

        <NFormItem label="隐藏">
          <div class="switch-field">
            <NSwitch v-model:value="form.hidden" />
            <span class="field-hint">隐藏后不会出现在下载页入口，直接访问链接仍可打开</span>
          </div>
        </NFormItem>

        <NFormItem v-if="editor.editing" label="删除">
          <div class="switch-field">
            <AppButton
              variant="outline"
              :icon="Delete24Regular"
              :disabled="saving || pendingSlug === editor.slug"
              @click="remove({ name: form.name, slug: editor.slug })"
            >
              删除这个下载页
            </AppButton>
            <span class="field-hint">删除后页面与版本链接一并移除，且不可恢复。</span>
          </div>
        </NFormItem>

      </NForm>
    </AppModal>
  </div>
</template>

<style scoped>
.console-downloads {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
  min-width: 0;
}

.downloads-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.count-tag {
  color: var(--subtle-foreground);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.download-rows {
  display: flex;
  flex-direction: column;
}

.download-row {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 170px 112px;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}

.download-row:last-child {
  border-bottom: none;
}

.download-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  overflow: hidden;
  border-radius: var(--radius-lg);
  background: var(--muted);
  color: var(--muted-foreground);
}

.download-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.download-main {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.download-title-line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.download-name {
  overflow: hidden;
  color: var(--foreground);
  font-size: 0.9rem;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.download-version {
  flex-shrink: 0;
  color: var(--subtle-foreground);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.download-sub {
  margin: 0;
  overflow: hidden;
  color: var(--muted-foreground);
  font-size: 0.76rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.download-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: right;
}

.download-slug {
  overflow: hidden;
  color: var(--muted-foreground);
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: 0.75rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.download-count {
  color: var(--subtle-foreground);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.download-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}

/* 列表内删除只保留中性外观，危险色推迟到确认弹窗 */
.row-delete:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--destructive) 45%, var(--border));
  color: var(--destructive);
}

.tag {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  corner-shape: round;
  font-size: 0.75rem;
}

.tag--muted {
  background: var(--muted);
  color: var(--muted-foreground);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 12px;
}

.icon-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.link-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.link-row {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr) 120px 32px;
  align-items: center;
  gap: 6px;
}

.field-hint {
  margin: 0;
  color: var(--subtle-foreground);
  font-size: 0.75rem;
  line-height: 1.5;
}

.field-error {
  margin: 2px 0 0;
  color: var(--destructive);
  font-size: 0.75rem;
}

.switch-field {
  display: flex;
  align-items: center;
  gap: 10px;
}

.intro-input :deep(textarea) {
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: 0.82rem;
}

@media (width <= 720px) {
  .download-row {
    grid-template-columns: 34px minmax(0, 1fr) auto;
    gap: 8px;
  }

  .download-meta {
    display: none;
  }

  .download-icon {
    width: 34px;
    height: 34px;
  }

  .form-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .link-row {
    grid-template-columns: 80px minmax(0, 1fr) 32px;
  }

  .link-row > :nth-child(3) {
    display: none;
  }
}
</style>

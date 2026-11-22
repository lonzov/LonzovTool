<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { NForm, NFormItem, NIcon, NInput, NCascader, NSwitch, useMessage } from 'naive-ui'
import { ArrowUpload24Regular, Send16Regular } from '@vicons/fluent'
import ToolCard from '../components/ToolCard.vue'
import TurnstileFallback from '../components/TurnstileFallback.vue'
import { cardsData, parentMenusData } from '../composables/useSiteData.js'
import { confirmDialog } from '../composables/useConfirm.js'
import { GEETEST_CAPTCHA_ID, GEETEST_SCRIPT_URL } from '../constants/geetest.js'
import { prepareIcon } from '../utils/iconUpload.js'

const SUBMIT_URL = '/api/v1/submissions'
/* 未选图标时预览用站点自身的图标，避免出现空白卡或通用图标 */
const DEFAULT_ICON = '/app-icon/ios/180.png'

/* 草稿只存在本地：刷新或误关页面不该让填了一半的表单白填。
   不含蜜罐字段与已选文件——前者恢复出非空会把正常提交当脚本丢掉，
   后者是浏览器不允许跨会话保留的对象，重新选择即可。 */
const DRAFT_KEY = 'lt_submit_draft_v1'
const DRAFT_FIELDS = [
  'title',
  'link',
  'summary',
  'category',
  'detail',
  'contact',
  'isCoreDeveloper',
  'iconMode',
  'iconUrl',
]
const DRAFT_DELAY_MS = 400

const message = useMessage()

const formRef = ref(null)
const categoryItemRef = ref(null)
const categoryError = ref('')
const fileInput = ref(null)
const iconFile = ref(null)
const iconFilePreview = ref('')
const iconCompressing = ref(false)

const form = reactive({
  title: '',
  link: '',
  summary: '',
  category: null,
  detail: '',
  contact: '',
  isCoreDeveloper: false,
  iconMode: 'file',
  iconUrl: '',
  fax: '',
})

const submitting = ref(false)
const formError = ref('')

watch(formError, (text) => {
  if (!text) return
  if (text.includes('已取消')) message.info(text)
  else if (text.includes('正在加载')) message.warning(text)
  else message.error(text)
  formError.value = ''
})
/* 验证组件的生命周期状态：showCaptcha 在未 ready 时调用不会有任何反应，
   所以必须自己跟踪，否则用户点了按钮看起来像"没响应" */
const captchaState = ref('loading')

let captchaInstance = null
let validateResult = null
/* 用户确认覆盖后要替换的记录 id；验证通过前先存在这里 */
let pendingReplaceId = 0
/* 极验不可用时服务端签发的降级票据；只用于换 Turnstile，不放行 */
let fallbackTicket = ''
const turnstileVisible = ref(false)
const turnstileRef = ref(null)

/* 分类复用首页卡片数据源：投稿只能落到既有分类，避免脏分类进审核队列。
   同名分类可能挂在不同的父级菜单下，按侧边栏的层级拆成一级/二级，
   值优先用分类 id；旧快照还没有 id 时退回名称，提交接口仍能兼容。 */
const categoryOptions = computed(() => {
  const parents = parentMenusData.value?.parentMenus || []
  const groups = new Map()
  const standalone = []

  for (const category of cardsData.value.categories || []) {
    const option = { label: category.name, value: category.id ?? category.name }
    if (!category.parentMenuId) {
      standalone.push(option)
      continue
    }
    if (!groups.has(category.parentMenuId)) {
      const parent = parents.find((item) => item.id === category.parentMenuId)
      groups.set(category.parentMenuId, {
        label: parent?.name || category.parentMenuId,
        value: `parent-${category.parentMenuId}`,
        children: [],
      })
    }
    groups.get(category.parentMenuId).children.push(option)
  }

  return [...parents.map((parent) => groups.get(parent.id)).filter(Boolean), ...standalone]
})

const categoryLeaves = computed(() =>
  categoryOptions.value.flatMap((item) => item.children || [item]),
)

function validateCategory() {
  const selected = categoryLeaves.value.find((item) => item.value === form.category)
  categoryError.value = selected ? '' : '请选择分类'
  return !!selected
}

function onCategoryChange(value) {
  form.category = value
  categoryError.value = ''
  nextTick(() => categoryItemRef.value?.restoreValidation())
}

const previewLogo = computed(() => {
  if (form.iconMode === 'file') return iconFilePreview.value || DEFAULT_ICON
  return form.iconUrl.trim() || DEFAULT_ICON
})

const hasIcon = computed(() =>
  form.iconMode === 'file' ? !!iconFile.value : !!form.iconUrl.trim(),
)

const rules = {
  title: { required: true, message: '请填写标题', trigger: ['input', 'blur'] },
  link: {
    required: true,
    message: '请填写完整网址（含 https://）',
    trigger: ['input', 'blur'],
  },
  summary: { required: true, message: '请填写卡片介绍', trigger: ['input', 'blur'] },
  contact: { required: true, message: '请填写联系方式', trigger: ['input', 'blur'] },
  iconUrl: {
    validator(_rule, value) {
      if (form.iconMode !== 'url') return true
      if (!value.trim()) return new Error('请填写图片链接，或改为上传图片')
      if (!/^https?:\/\//i.test(value.trim())) return new Error('图片链接需以 http:// 或 https:// 开头')
      return true
    },
    trigger: ['input', 'blur'],
  },
}

/* ===== 极验 =====
   页面加载即初始化：验证会读取用户在页面上的行为轨迹，等到点提交才加载会让判定失效。 */
function loadScript(url) {
  return new Promise((resolve, reject) => {
    if (window.initGeetest4) {
      resolve()
      return
    }
    const existing = document.querySelector('script[data-geetest="gt4"]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('load failed')))
      return
    }
    const script = document.createElement('script')
    script.src = url
    script.async = true
    script.dataset.geetest = 'gt4'
    script.addEventListener('load', () => resolve())
    script.addEventListener('error', () => reject(new Error('load failed')))
    document.head.appendChild(script)
  })
}

async function setupCaptcha() {
  try {
    await loadScript(GEETEST_SCRIPT_URL)
  } catch (error) {
    captchaState.value = 'failed'
    console.warn('[geetest] 验证组件脚本加载失败', error)
    return
  }
  if (!window.initGeetest4) {
    captchaState.value = 'failed'
    console.warn('[geetest] 脚本已加载但没有 initGeetest4')
    return
  }

  // product 必须是 bind：我们要用自己的提交按钮先跑表单校验，再触发验证。
  // popup / float 会把极验自己的按钮插进页面，与"提交按钮始终可见"冲突。
  window.initGeetest4(
    { captchaId: GEETEST_CAPTCHA_ID, product: 'bind', language: 'zho' },
    (captcha) => {
      captchaInstance = captcha
      captcha
        .onReady(() => {
          captchaState.value = 'ready'
        })
        .onSuccess(() => {
          // getValidate() 在非成功态会返回 false（官方行为），直接提交必然 403
          validateResult = captcha.getValidate() || null
          performSubmit(pendingReplaceId)
        })
        .onClose(() => {
          validateResult = null
          formError.value = '需要完成验证才能提交'
        })
        .onError((error) => {
          captchaState.value = 'failed'
          console.warn('[geetest] 验证出错', error)
          formError.value = '人机验证出错了，请刷新页面重试'
        })
    },
  )
}

function openCaptcha() {
  const captcha = captchaInstance
  if (!captcha || captchaState.value !== 'ready') return captchaState.value
  if (typeof captcha.showCaptcha !== 'function') {
    console.warn('[geetest] 实例上没有 showCaptcha，无法唤起验证')
    return 'failed'
  }
  captcha.showCaptcha()
  return 'ready'
}

/* ===== 草稿 ===== */

let draftTimer = null

function saveDraft() {
  if (draftTimer) {
    clearTimeout(draftTimer)
    draftTimer = null
  }
  const draft = {}
  for (const key of DRAFT_FIELDS) draft[key] = form[key]
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // 隐私模式或配额用尽时静默放弃：草稿不该阻断填写
  }
}

function clearDraft() {
  if (draftTimer) {
    clearTimeout(draftTimer)
    draftTimer = null
  }
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* 同上 */
  }
}

function scheduleSave() {
  if (draftTimer) clearTimeout(draftTimer)
  draftTimer = setTimeout(saveDraft, DRAFT_DELAY_MS)
}

function restoreDraft() {
  let draft
  try {
    draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null')
  } catch {
    return
  }
  if (!draft || typeof draft !== 'object') return

  for (const key of DRAFT_FIELDS) {
    const value = draft[key]
    if (value === undefined || value === null) continue
    if (typeof form[key] === 'boolean') {
      form[key] = Boolean(value)
    } else if (typeof value === 'string' || (key === 'category' && typeof value === 'number')) {
      form[key] = value
    }
  }

  // 旧草稿存的是分类名，新草稿存 id；当前选项里没有时先保留原值，
  // 等接口分类替换快照后再归一，避免在加载前把有效 id 清成 null。
  if (form.category != null && categoryLeaves.value.length) {
    const selected = categoryLeaves.value.find((item) => item.value === form.category)
    if (!selected) {
      const byLabel = categoryLeaves.value.find((item) => item.label === form.category)
      if (byLabel) form.category = byLabel.value
    }
  }
  if (!['url', 'file'].includes(form.iconMode)) form.iconMode = 'file'
}

// 运行时同步到带 id 的分类后，把按名称恢复的旧草稿重新归一到 id；
// 暂时找不到也保留原值，等分类资源到齐后再匹配。
watch(categoryLeaves, (leaves) => {
  if (form.category == null) return
  if (leaves.some((item) => item.value === form.category)) return
  const byLabel = leaves.find((item) => item.label === form.category)
  if (byLabel) form.category = byLabel.value
})

watch(form, scheduleSave, { deep: true })

/* ===== 提交 ===== */

function toggleIconMode() {
  form.iconMode = form.iconMode === 'file' ? 'url' : 'file'
  formRef.value?.restoreValidation()
}

function pickFile() {
  fileInput.value?.click()
}

function setPreviewUrl(url) {
  if (iconFilePreview.value) URL.revokeObjectURL(iconFilePreview.value)
  iconFilePreview.value = url
}

async function onIconFileChange(event) {
  const [file] = event.target.files || []
  formError.value = ''
  if (!file) return

  // 先在本机压成规范 WebP（省流量、预览即时）；服务端还会再压一次作为规范与兜底
  iconCompressing.value = true
  const { file: prepared, error } = await prepareIcon(file)
  iconCompressing.value = false

  if (error || !prepared) {
    formError.value = error
    event.target.value = ''
    iconFile.value = null
    setPreviewUrl('')
    return
  }

  iconFile.value = prepared
  setPreviewUrl(URL.createObjectURL(prepared))
  formRef.value?.restoreValidation()
}

function buildPayload(replaceId = 0, turnstileToken = '') {
  const data = new FormData()
  if (replaceId) data.append('replace_id', String(replaceId))
  data.append('title', form.title.trim())
  data.append('link', form.link.trim())
  data.append('summary', form.summary.trim())
  const selectedCategory = categoryLeaves.value.find((item) => item.value === form.category)
  data.append('category', selectedCategory?.label || '')
  if (selectedCategory && typeof selectedCategory.value === 'number') {
    data.append('category_id', String(selectedCategory.value))
  }
  data.append('detail', form.detail.trim())
  data.append('contact', form.contact.trim())
  data.append('is_core_developer', form.isCoreDeveloper ? 'true' : 'false')
  data.append('fax', form.fax)
  if (form.iconMode === 'url') {
    data.append('icon_url', form.iconUrl.trim())
  } else if (iconFile.value) {
    data.append('icon_file', iconFile.value)
  }
  if (turnstileToken) {
    data.append('turnstile_token', turnstileToken)
    data.append('fallback_token', fallbackTicket)
  } else if (validateResult) {
    data.append('lot_number', validateResult.lot_number || '')
    data.append('captcha_output', validateResult.captcha_output || '')
    data.append('pass_token', validateResult.pass_token || '')
    data.append('gen_time', validateResult.gen_time || '')
  }
  return data
}

async function handleSubmit() {
  formError.value = ''
  if (!validateCategory()) {
    formError.value = '请选择分类'
    await nextTick()
    document
      .querySelector('.n-form-item-feedback--error')
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    return
  }
  try {
    await formRef.value?.validate()
  } catch (errors) {
    // Naive 只把字段标红、不会滚动，用户从底部点提交时看不到哪里错了，
    // 于是表现为"点了没反应"。这里补上文案与滚动定位。
    formError.value = errors?.[0]?.[0]?.message || '请检查表单中标红的必填项'
    await nextTick()
    document
      .querySelector('.n-form-item-feedback--error')
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    return
  }

  if (form.iconMode === 'file' && !iconFile.value) {
    formError.value = '请选择图标文件'
    return
  }

  const state = openCaptcha()
  if (state === 'loading') {
    formError.value = '验证组件正在加载，请稍后再点一次'
    return
  }
  if (state === 'failed') {
    formError.value = '验证组件未能加载，请刷新页面重试'
  }
}

async function performSubmit(replaceId = 0, turnstileToken = '') {
  if (submitting.value) return
  if (!validateResult && !turnstileToken) {
    // 没拿到验证结果就发请求，后端只会回 403；在这里拦住并说明原因
    formError.value = '请先完成人机验证再提交'
    return
  }
  submitting.value = true
  formError.value = ''

  try {
    const response = await fetch(SUBMIT_URL, {
      method: 'POST',
      body: buildPayload(replaceId, turnstileToken),
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      const error = payload?.error

      // 同一网址 + 同一联系方式：先问清楚要不要覆盖，取消则保留表单内容
      if (error?.code === 'duplicate_confirm') {
        submitting.value = false
        const confirmed = await confirmDialog({
          title: '该网址你已提交过',
          message: '是否用本次填写的内容覆盖上一次提交？\n取消将放弃本次提交，已填内容会保留。',
          confirmText: '覆盖',
          cancelText: '取消',
          danger: true,
        })
        if (!confirmed) {
          formError.value = '已取消，表单内容已保留'
          return
        }
        // 409 发生在验证码校验之前，本轮凭证尚未被服务端消费，可以直接重发
        pendingReplaceId = error.meta?.existing_id || 0
        if (turnstileToken) {
          await performSubmit(pendingReplaceId, turnstileToken)
          return
        }
        if (validateResult) {
          await performSubmit(pendingReplaceId)
          return
        }
        if (openCaptcha() !== 'ready') {
          formError.value = '验证组件未能重新唤起，请刷新页面后重试'
        }
        return
      }

      if (error?.code === 'ip_banned') {
        formError.value = '你已被封禁，如有疑问请联系站长'
        return
      }

      formError.value = error?.message || '提交失败，请稍后重试'
      if (error?.code === 'rate_limited') {
        // 提示里承诺"草稿已保存"，就得当场落盘，不能等防抖那一拍
        saveDraft()
      }
      if (error?.code === 'captcha_fallback_required') {
        const ticket = error.meta?.fallback_token || ''
        if (!ticket) {
          formError.value = '备用验证不可用，请稍后重试'
          return
        }
        fallbackTicket = ticket
        turnstileVisible.value = true
        formError.value = ''
        return
      }
      if (error?.code === 'captcha_fallback_invalid') {
        turnstileVisible.value = false
        fallbackTicket = ''
        validateResult = null
        captchaInstance?.reset?.()
        formError.value = error.message || '备用验证已失效，请重新提交'
        return
      }
      if (error?.code === 'captcha_failed' && error.meta?.provider === 'turnstile') {
        turnstileRef.value?.reset()
        turnstileVisible.value = true
        formError.value = error.message || '备用验证未通过，请重试'
        return
      }
      if (error?.code === 'captcha_unavailable') {
        turnstileVisible.value = false
        formError.value = error.message || '暂时无法完成人机验证，请稍后重试'
        return
      }
      if (error?.code === 'captcha_failed') {
        validateResult = null
        fallbackTicket = ''
        captchaInstance?.reset?.()
      }
      return
    }

    validateResult = null
    fallbackTicket = ''
    turnstileVisible.value = false
    pendingReplaceId = 0
    clearFields()
    message.success('提交成功，审核后会通过你留下的联系方式通知你', { duration: 6000 })
  } catch {
    formError.value = '网络异常，请检查网络后重试'
  } finally {
    submitting.value = false
  }
}

function onTurnstileSuccess(token) {
  turnstileVisible.value = false
  performSubmit(pendingReplaceId, token)
}

function closeTurnstile() {
  turnstileVisible.value = false
  fallbackTicket = ''
}

function clearFields() {
  Object.assign(form, {
    title: '',
    link: '',
    summary: '',
    category: null,
    detail: '',
    contact: '',
    isCoreDeveloper: false,
    iconMode: 'file',
    iconUrl: '',
    fax: '',
  })
  iconFile.value = null
  setPreviewUrl('')
  if (fileInput.value) fileInput.value.value = ''
  clearDraft()
  formRef.value?.restoreValidation()
  formError.value = ''
  validateResult = null
  fallbackTicket = ''
  turnstileVisible.value = false
}

onMounted(() => {
  restoreDraft()
  setupCaptcha()
})

onBeforeUnmount(() => {
  // 防抖未触发的最后一次输入也要落盘，否则离开页面的瞬间会丢
  saveDraft()
  captchaInstance?.destroy?.()
  captchaInstance = null
  setPreviewUrl('')
})
</script>

<template>
  <div class="submit-view">
    <header class="submit-header">
      <h1 class="submit-title">网址提交</h1>
    </header>

    <section class="submit-card">
      <p class="card-hint">
        推荐一个 Minecraft 相关的工具或资源站。提交后由人工审核，通过后会整理进首页卡片。
      </p>

      <NForm
        ref="formRef"
        :model="form"
        :rules="rules"
        label-placement="top"
        require-mark-placement="right-hanging"
        :disabled="submitting"
      >
        <div class="form-grid">
          <NFormItem label="标题" path="title">
            <NInput v-model:value="form.title" maxlength="10" show-count placeholder="卡片上显示的名称" />
          </NFormItem>

          <NFormItem label="网址" path="link">
            <NInput v-model:value="form.link" maxlength="500" placeholder="https://example.com" />
          </NFormItem>

          <NFormItem class="field--wide" label="卡片介绍" path="summary">
            <NInput
              v-model:value="form.summary"
              maxlength="30"
              show-count
              placeholder="一句话说明它是什么、解决什么问题"
            />
          </NFormItem>

          <NFormItem
            ref="categoryItemRef"
            label="分类"
            path="category"
            required
            :validation-status="categoryError ? 'error' : undefined"
            :feedback="categoryError || undefined"
          >
            <NCascader
              v-model:value="form.category"
              :options="categoryOptions"
              placement="bottom-start"
              placeholder="选择首页已有的分类"
              check-strategy="child"
              :menu-props="{ class: 'compact-cascader-menu' }"
              @update:value="onCategoryChange"
            />
          </NFormItem>

          <NFormItem label="图标" path="iconUrl" required>
            <div class="icon-field">
              <div class="icon-row">
                <span
                  class="icon-preview"
                  :class="{ 'is-default': !hasIcon }"
                  aria-hidden="true"
                >
                  <img :src="previewLogo" alt="" />
                </span>

                <template v-if="form.iconMode === 'file'">
                  <button
                    class="app-btn app-btn--outline app-btn--sm file-btn"
                    type="button"
                    :disabled="iconCompressing"
                    @click="pickFile"
                  >
                    <NIcon :component="ArrowUpload24Regular" :size="14" />
                    {{ iconCompressing ? '处理中…' : iconFile ? '更换图片' : '选择图片' }}
                  </button>
                  <span v-if="iconFile" class="file-name">{{ iconFile.name }}</span>
                  <input
                    ref="fileInput"
                    class="file-input-hidden"
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,.ico"
                    @change="onIconFileChange"
                  />
                </template>
                <NInput
                  v-else
                  v-model:value="form.iconUrl"
                  class="icon-url"
                  maxlength="500"
                  size="small"
                  placeholder="粘贴图片链接"
                />

                <button class="icon-mode-switch" type="button" @click="toggleIconMode">
                  {{ form.iconMode === 'file' ? '改用图片链接' : '改用上传' }}
                </button>
              </div>
              <span class="field-hint">
                {{
                  form.iconMode === 'file'
                    ? '没有现成图标，用任意清晰截图也行，会自动压缩。'
                    : '链接打开后要能直接看到图片。'
                }}
              </span>
            </div>
          </NFormItem>

          <div class="form-divider" role="separator" aria-hidden="true"></div>

          <NFormItem label="你的联系方式" path="contact">
            <NInput
              v-model:value="form.contact"
              maxlength="120"
              placeholder="建议留邮箱，用于审核通知"
            />
          </NFormItem>

          <NFormItem label="我是核心开发者">
            <div class="switch-row">
              <span class="switch-desc">仅个别项目需要确认。</span>
              <NSwitch v-model:value="form.isCoreDeveloper" />
            </div>
          </NFormItem>

          <NFormItem class="field--wide" label="详细介绍（选填 · 仅站长可见）">
            <NInput
              v-model:value="form.detail"
              type="textarea"
              :autosize="{ minRows: 3, maxRows: 6 }"
              maxlength="300"
              show-count
              placeholder="想补充的说明、来源、授权情况等，不会公开展示"
            />
          </NFormItem>
        </div>

        <input
          v-model="form.fax"
          class="honeypot"
          type="text"
          tabindex="-1"
          autocomplete="off"
          aria-hidden="true"
        />

        <div class="form-footer">
          <button class="app-btn app-btn--fill" type="button" :disabled="submitting" @click="handleSubmit">
            <NIcon :component="Send16Regular" :size="16" />
            {{ submitting ? '提交中…' : '提交' }}
          </button>
        </div>
      </NForm>
    </section>

    <section class="preview">
      <h2 class="section-title">卡片预览</h2>
      <p class="section-hint">与首页卡片同一组件渲染，最终样式以上架时为准。</p>
      <div class="preview-frame">
        <ToolCard
          :title="form.title || '标题'"
          :description="form.summary || '卡片介绍会显示在这里'"
          :logo="previewLogo"
          :link="form.link"
        />
      </div>
    </section>

    <section class="rules">
      <h2 class="section-title">提交须知</h2>
      <ul class="rules-list">
        <li>只收与 Minecraft 相关的工具或资源站，需可公开访问，不接受强制注册墙。</li>
        <li>社区论坛类必须先加本站友链后再申请，否则不会通过。</li>
        <li>一条提交只放一个网址；同为工具集的请分开投稿。</li>
        <li>图标支持 1 MB 以内的 PNG / JPG / WebP / ICO，或直接填图片链接；SVG 请用链接。</li>
        <li>审核为人工进行，不一定逐条回复；联系方式建议留邮箱。</li>
        <li>不接受侵权、破解、含推广返利或与站点定位无关的网址。</li>
      </ul>
    </section>

    <TurnstileFallback
      ref="turnstileRef"
      :show="turnstileVisible"
      action="submission"
      description="极验服务暂时不可用，请完成下方备用验证后继续提交。"
      @update:show="turnstileVisible = $event"
      @success="onTurnstileSuccess"
      @close="closeTurnstile"
    />
  </div>
</template>

<style scoped>
/* 页面本身不再加内边距：外层容器已有，叠加会明显压掉移动端的横向空间 */
.submit-view {
  max-width: 760px;
  margin: 0 auto;
}

.submit-header {
  margin-bottom: 12px;
}

.submit-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--foreground);
}

.submit-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--card);
  transition: background-color 0.4s ease, border-color 0.4s ease;
}

.card-hint {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 0.85rem;
  line-height: 1.6;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 14px;
}

.form-grid :deep(.n-form-item) {
  margin-bottom: 4px;
}

.field--wide {
  grid-column: 1 / -1;
}

/* 上半是卡片本身的信息，下半是人/联系方式；用虚线分隔，但不增加额外大段留白 */
.form-divider {
  grid-column: 1 / -1;
  margin: 2px 0 12px;
  border-top: 1px dashed var(--border-strong);
}

.icon-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

/* 图标是第一眼最容易显得麻烦的字段：预览、上传、切换来源压成一行，链接模式按需展开 */
.icon-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 34px;
}

.icon-preview {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--muted);
}

.icon-preview img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.icon-preview.is-default img {
  opacity: 0.5;
}

.icon-url {
  flex: 1 1 200px;
  min-width: 150px;
}

.file-btn {
  gap: 6px;
  flex-shrink: 0;
}

.file-name {
  flex: 1;
  overflow: hidden;
  min-width: 0;
  color: var(--muted-foreground);
  font-size: 0.74rem;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.4s ease;
}

/* 高级来源用弱化的文字入口，不占一整行单选 */
.icon-mode-switch {
  flex-shrink: 0;
  padding: 2px 0;
  border: 0;
  background: transparent;
  color: var(--muted-foreground);
  font-size: 0.74rem;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
  transition: color 0.2s ease;
}

.icon-mode-switch:hover {
  color: var(--foreground);
}

.file-input-hidden {
  display: none;
}

.field-hint {
  color: var(--subtle-foreground);
  font-size: 0.72rem;
  line-height: 1.5;
}

/* 开关与说明同排：说明占输入框位置，开关靠右，行高与输入项一致 */
.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  min-height: 34px;
}

.switch-desc {
  color: var(--subtle-foreground);
  font-size: 0.875rem;
  line-height: 1.5;
}

.honeypot {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.form-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 4px;
}

.form-footer .app-btn {
  gap: 6px;
}

.preview,
.rules {
  margin-top: 24px;
}

.section-title {
  margin: 0 0 6px;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--foreground);
}

.section-hint {
  margin: 0 0 10px;
  color: var(--subtle-foreground);
  font-size: 0.76rem;
}

/* 预览只做渲染对照，不响应点击，避免误跳转 */
.preview-frame {
  max-width: 240px;
  pointer-events: none;
}

.rules-list {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--muted-foreground);
  font-size: 0.8rem;
  line-height: 1.65;
}

@media (width <= 640px) {
  .form-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

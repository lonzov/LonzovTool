<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NRadio,
  NRadioGroup,
  useMessage,
} from 'naive-ui'
import {
  CheckmarkCircle24Regular,
  ChevronDown24Regular,
  Delete24Regular,
  Image24Regular,
  Send24Regular,
} from '@vicons/fluent'
import { useFeedbackDrawer } from '../composables/useFeedbackDrawer.js'
import AppButton from './ui/AppButton.vue'
import { confirmDialog } from '../composables/useConfirm.js'
import { GEETEST_CAPTCHA_ID, GEETEST_SCRIPT_URL } from '../constants/geetest.js'
import TurnstileFallback from './TurnstileFallback.vue'
import { prepareFeedbackImage } from '../utils/iconUpload.js'

const FEEDBACK_URL = '/api/v1/feedback'
const MAX_IMAGES = 3

/* 草稿只存文字字段：图片是浏览器不允许跨会话保留的对象，重新选即可；
   蜜罐不入草稿，否则恢复出非空值会让后端的脚本判定把正常提交丢掉。 */
const DRAFT_KEY = 'lt_feedback_draft_v1'
const DRAFT_FIELDS = ['kind', 'title', 'contact', 'pagePath', 'detail']
/* 判断「表单是否有内容」不含类型：kind 永远有默认值，拿它判断会让清空按键每次都弹确认 */
const CONTENT_FIELDS = ['title', 'contact', 'pagePath', 'detail']
const DRAFT_DELAY_MS = 400

const KIND_OPTIONS = [
  { value: 'bug', label: 'BUG' },
  { value: 'suggestion', label: '建议' },
  { value: 'reminder', label: '提醒' },
]

/* 示例按类型分开：出问题的人需要说清"预期 vs 实际"，
   想要新功能的人需要说清"做什么、什么时候用、大概怎么操作"——
   只写"希望增加 XX 生成器"这种工具名，等于把最难的部分留给读的人去猜。
   数组里 strong 的片段是重点词，渲染时加粗提亮，扫一眼就能抓住句式。 */
const EXAMPLE_PARTS = {
  bug: [
    [{ text: '我以为', strong: true }, { text: '点「复制指令」会把整段指令复制下来，' }],
    [{ text: '实际', strong: true }, { text: '只复制了第一行，贴到游戏里就少了几条。' }],
    [{ text: '我是在「指令工具」页用的，用的手机。' }],
    [{ text: '如果是我操作不对，也告诉我应该怎么点。' }],
  ],
  suggestion: [
    [
      { text: '我想做的', strong: true },
      { text: '：把一段指令里的数字批量换成别的数字。' },
    ],
    [
      { text: '用在哪', strong: true },
      { text: '：调参数时要一条条改，十几条改起来很麻烦。' },
    ],
    [
      { text: '大概长这样', strong: true },
      { text: '：上面贴指令，下面填「把 10 换成 20」，点一下全改完。' },
    ],
    [{ text: '不一定要做成「批量替换生成器」，能这样用就行。' }],
  ],
  reminder: [
    [{ text: '想提醒', strong: true }, { text: '：某条指令在新版本里已经不能用了。' }],
    [{ text: '我遇到的情况', strong: true }, { text: '：照着站里的说明填，进游戏提示语法错误。' }],
  ],
}

const DETAIL_PLACEHOLDER = {
  bug: '照平常说话写：你本来想做什么、它实际做了什么、你希望它怎么做',
  suggestion: '写清想让它做什么、你什么时候会用到、大概怎么操作，不用起工具名',
  reminder: '说清要提醒的是哪件事、你是怎么发现的',
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const QQ_PATTERN = /^\d{5,12}$/

const props = defineProps({
  isMobile: { type: Boolean, default: false },
})

const route = useRoute()
const { showFeedbackDrawer } = useFeedbackDrawer()

const formRef = ref(null)
const message = useMessage()
const imageInput = ref(null)
const images = ref([])

const form = reactive({
  kind: 'bug',
  title: '',
  contact: '',
  pagePath: '',
  detail: '',
  fax: '',
})

/* form：填写中；success：提交成功后的结果页 */
const mode = ref('form')
const resultId = ref(0)
const submitting = ref(false)
const formError = ref('')

watch(formError, (text) => {
  if (!text) return
  if (text.includes('已取消')) message.info(text)
  else if (text.includes('正在加载')) message.warning(text)
  else message.error(text)
  formError.value = ''
})
const imageError = ref('')
const imageBusy = ref(false)
const dragActive = ref(false)
const exampleOpen = ref(false)

// form 是 reactive，不是 ref：写成 form.value.kind 会在渲染时抛错，整个抽屉都打不开
const exampleLines = computed(() => EXAMPLE_PARTS[form.kind] || EXAMPLE_PARTS.bug)
const detailPlaceholder = computed(() => DETAIL_PLACEHOLDER[form.kind] || DETAIL_PLACEHOLDER.bug)

/* 验证组件的生命周期状态：showCaptcha 在未 ready 时调用不会有任何反应，
   用户点提交看起来就会像"没响应"，所以必须自己跟踪并在按钮旁给出说明 */
const captchaState = ref('loading')

let captchaInstance = null
let validateResult = null
/* 极验不可用时服务端签发的降级票据；只用于换 Turnstile，不放行 */
let fallbackTicket = ''
const turnstileVisible = ref(false)
const turnstileRef = ref(null)
let draftTimer = null
let draftRestored = false
let captchaSetupStarted = false
let imageSeq = 0

const drawerStyle = computed(() => ({
  background: 'var(--background)',
  borderLeft: '1px solid var(--border)',
  boxShadow: 'var(--shadow-drawer)',
  // 移动端铺满整屏，去掉左圆角，免得屏边露出下层页面
  ...(props.isMobile ? { borderTopLeftRadius: '0', borderBottomLeftRadius: '0' } : {}),
}))

const rules = {
  title: { required: true, message: '请用一句话说清哪里不对', trigger: ['input', 'blur'] },
  contact: [
    { required: true, message: '请填写联系方式', trigger: ['input', 'blur'] },
    {
      validator(_rule, value) {
        const text = (value || '').trim()
        if (!text) return new Error('请填写邮箱或 QQ 号')
        if (EMAIL_PATTERN.test(text) || QQ_PATTERN.test(text)) return true
        return new Error('请填写有效的邮箱，或 5–12 位数字 QQ 号')
      },
      trigger: ['input', 'blur'],
    },
  ],
  detail: [
    { required: true, message: '请描述一下发生了什么', trigger: ['input', 'blur'] },
    { min: 15, message: '详细描述至少 15 个字', trigger: ['input', 'blur'] },
  ],
}

/* ===== 极验 =====
   脚本在抽屉首次打开时才加载：反馈不是首屏路径，没必要为它拖慢站点。 */
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
  captchaState.value = 'loading'
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

  // product 必须是 bind：要先用抽屉里的表单校验拦下缺项，再唤起验证。
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
          performSubmit()
        })
        .onClose(() => {
          validateResult = null
          formError.value = '需要完成人机验证才能提交'
        })
        .onError((error) => {
          captchaState.value = 'failed'
          console.warn('[geetest] 验证出错', error)
          formError.value = '人机验证出错了，请关闭抽屉后重试'
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

function saveDraft() {
  if (draftTimer) {
    clearTimeout(draftTimer)
    draftTimer = null
  }
  const draft = {}
  for (const key of DRAFT_FIELDS) draft[key] = form[key]
  try {
    // 清空或提交后表单归零，deep watch 仍会走这里：空草稿等于没有草稿，顺手把键删掉，
    // 免得 localStorage 里长期留一条无意义的记录
    if (CONTENT_FIELDS.every((key) => !(draft[key] || '').trim())) {
      localStorage.removeItem(DRAFT_KEY)
      return
    }
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
    if (typeof value === 'string') form[key] = value
  }
  if (!KIND_OPTIONS.some((option) => option.value === form.kind)) form.kind = 'bug'
}

watch(form, scheduleSave, { deep: true })

/* ===== 图片 ===== */

function pickImages() {
  imageInput.value?.click()
}

function onImagesPicked(event) {
  // 先把 FileList 拍成数组再清空 input：清空会把这个活引用一起清掉，
  // 留着原对象传下去等于传了个空列表，表现就是"选完图什么都没发生"
  const files = Array.from(event.target.files || [])
  event.target.value = ''
  addFiles(files)
}

function onDrop(event) {
  dragActive.value = false
  addFiles(event.dataTransfer?.files || [])
}

async function addFiles(list) {
  const files = Array.from(list || [])
  if (!files.length || submitting.value) return

  imageError.value = ''
  imageBusy.value = true
  try {
    for (const file of files) {
      if (images.value.length >= MAX_IMAGES) {
        imageError.value = `最多只能上传 ${MAX_IMAGES} 张截图，多余的请先删一张`
        break
      }
      const { file: prepared, error } = await prepareFeedbackImage(file)
      if (error || !prepared) {
        imageError.value = error || '这张图片无法处理，请换一张'
        continue
      }
      imageSeq += 1
      images.value.push({ id: imageSeq, file: prepared, url: URL.createObjectURL(prepared) })
    }
  } finally {
    imageBusy.value = false
  }
}

function removeImage(index) {
  const [removed] = images.value.splice(index, 1)
  if (removed) URL.revokeObjectURL(removed.url)
  imageError.value = ''
}

function releaseImages() {
  for (const image of images.value) URL.revokeObjectURL(image.url)
  images.value = []
  if (imageInput.value) imageInput.value.value = ''
}

function onPaste(event) {
  if (mode.value !== 'form' || submitting.value) return
  const files = [...(event.clipboardData?.items || [])]
    .filter((item) => item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter(Boolean)
  if (!files.length) return
  event.preventDefault()
  addFiles(files)
}

/* ===== 提交 ===== */

function fillCurrentPage() {
  form.pagePath = route.fullPath
  formRef.value?.restoreValidation()
}

function buildPayload(turnstileToken = '') {
  const data = new FormData()
  data.append('kind', form.kind)
  data.append('title', form.title.trim())
  data.append('contact', form.contact.trim())
  data.append('page_path', form.pagePath.trim())
  data.append('detail', form.detail.trim())
  data.append('fax', form.fax)
  images.value.forEach((image, index) => {
    // 服务端按 image1 / image2 / image3 顺序落库，命名必须与选择顺序一致
    data.append(`image${index + 1}`, image.file, image.file.name)
  })
  if (turnstileToken) {
    data.append('turnstile_token', turnstileToken)
    data.append('fallback_token', fallbackTicket)
  } else {
    data.append('lot_number', validateResult?.lot_number || '')
    data.append('captcha_output', validateResult?.captcha_output || '')
    data.append('pass_token', validateResult?.pass_token || '')
    data.append('gen_time', validateResult?.gen_time || '')
  }
  return data
}

/** 服务端信封的 code 决定提示口径，状态码只作兜底 */
function readableError(error, response) {
  if (!error) return '提交失败，请稍后重试'

  if (error.code === 'rate_limited') {
    const seconds = Math.ceil(Number(response.headers.get('Retry-After')) || 0)
    const text = error.message || '提交过于频繁，请稍后再试'
    return seconds > 0 ? `${text}（请在 ${seconds} 秒后重试）` : text
  }
  if (error.code === 'ip_banned') {
    return '你已被封禁，如有疑问请联系站长'
  }
  if (error.code === 'captcha_failed') {
    return error.message || '人机验证未通过，请重新完成验证后再提交'
  }
  if (error.code === 'invalid_request') {
    return error.message || '提交内容有误，请检查后重试'
  }
  return error.message || '提交失败，请稍后重试'
}

async function handleSubmit() {
  formError.value = ''
  if (imageBusy.value) {
    formError.value = '截图还在处理中，请稍等再提交'
    return
  }
  try {
    await formRef.value?.validate()
  } catch (errors) {
    // Naive 只把字段标红、不会滚动，抽屉里的表单比页面更长，用户看不到哪里错了
    formError.value = errors?.[0]?.[0]?.message || '请检查表单中标红的必填项'
    await nextTick()
    document
      .querySelector('.n-form-item-feedback--error')
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    return
  }

  const state = openCaptcha()
  if (state === 'loading') {
    formError.value = '验证组件正在加载，请稍后再点一次'
    return
  }
  if (state === 'failed') {
    formError.value = '验证组件未能加载，请关闭抽屉后重试'
  }
}

async function performSubmit(turnstileToken = '') {
  if (submitting.value) return
  if (!validateResult && !turnstileToken) {
    // 没拿到验证结果就发请求，后端只会回 403；在这里拦住并说明原因
    formError.value = '请先完成人机验证再提交'
    return
  }

  submitting.value = true
  formError.value = ''
  try {
    const response = await fetch(FEEDBACK_URL, {
      method: 'POST',
      body: buildPayload(turnstileToken),
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      const error = payload?.error
      formError.value = readableError(error, response)
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
        return
      }
      if (error?.code === 'captcha_failed' && error.meta?.provider === 'turnstile') {
        turnstileRef.value?.reset()
        turnstileVisible.value = true
        return
      }
      if (error?.code === 'captcha_unavailable') {
        turnstileVisible.value = false
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
    resultId.value = Number(payload?.id) || 0
    clearDraft()
    resetForm()
    mode.value = 'success'
  } catch {
    formError.value = '网络异常，请检查网络后重试'
  } finally {
    submitting.value = false
  }
}

function onTurnstileSuccess(token) {
  turnstileVisible.value = false
  performSubmit(token)
}

function closeTurnstile() {
  turnstileVisible.value = false
  fallbackTicket = ''
}

watch(showFeedbackDrawer, (show) => {
  if (show) return
  turnstileVisible.value = false
  fallbackTicket = ''
})

function resetForm() {
  Object.assign(form, {
    kind: 'bug',
    title: '',
    contact: '',
    pagePath: '',
    detail: '',
    fax: '',
  })
  releaseImages()
  exampleOpen.value = false
  formError.value = ''
  imageError.value = ''
  validateResult = null
  formRef.value?.restoreValidation()
}

async function clearAll() {
  if (submitting.value) return
  const hasContent = CONTENT_FIELDS.some((key) => (form[key] || '').trim())
  if (hasContent || images.value.length) {
    const confirmed = await confirmDialog({
      title: '清空已填内容',
      message: '清空后草稿不会保留，确定继续吗？',
      confirmText: '清空',
      danger: true,
    })
    if (!confirmed) return
  }
  resetForm()
  clearDraft()
}

function startAnother() {
  mode.value = 'form'
  resetForm()
}

function closeDrawer() {
  showFeedbackDrawer.value = false
}

function prepareOnOpen() {
  if (!draftRestored) {
    draftRestored = true
    restoreDraft()
  }
  if (!captchaSetupStarted) {
    captchaSetupStarted = true
    setupCaptcha()
  }
}

watch(showFeedbackDrawer, (show) => {
  if (show) {
    prepareOnOpen()
    return
  }
  // 结果页只属于当次提交：抽屉关掉再打开应当是一张干净的空白表单
  if (mode.value === 'success') {
    mode.value = 'form'
    resetForm()
  }
})

onMounted(() => {
  document.addEventListener('paste', onPaste)
})

onBeforeUnmount(() => {
  // 防抖未触发的最后一次输入也要落盘，否则关掉抽屉的瞬间会丢
  saveDraft()
  document.removeEventListener('paste', onPaste)
  captchaInstance?.destroy?.()
  captchaInstance = null
  releaseImages()
})
</script>

<template>
  <NDrawer
    :show="showFeedbackDrawer"
    placement="right"
    :width="isMobile ? '100%' : 640"
    :z-index="2100"
    :style="drawerStyle"
    @update:show="showFeedbackDrawer = $event"
  >
    <NDrawerContent
      title="建议反馈"
      closable
      :body-content-style="{ padding: '0' }"
    >
      <div class="fb-body">
      <div v-if="mode === 'success'" class="fb-done">
        <NIcon :component="CheckmarkCircle24Regular" :size="42" class="fb-done-icon" />
        <p class="fb-done-title">反馈已提交</p>
        <p class="fb-done-text">
          反馈编号 <strong>{{ resultId }}</strong>，处理结果会按你留下的联系方式通知，无需重复提交。
        </p>
        <div class="fb-done-actions">
          <button class="app-btn app-btn--outline app-btn--sm" type="button" @click="startAnother">
            再提一条
          </button>
          <button class="app-btn app-btn--fill app-btn--sm" type="button" @click="closeDrawer">
            关闭
          </button>
        </div>
      </div>

      <NForm
        v-else
        ref="formRef"
        :model="form"
        :rules="rules"
        label-placement="top"
        require-mark-placement="right-hanging"
        :disabled="submitting"
        class="fb-form"
      >
        <NFormItem label="类型">
          <NRadioGroup v-model:value="form.kind" name="feedback-kind" class="fb-type">
            <NRadio v-for="option in KIND_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </NRadio>
          </NRadioGroup>
        </NFormItem>

        <NFormItem label="标题" path="title">
          <NInput
            v-model:value="form.title"
            maxlength="100"
            show-count
            placeholder="一句话说清哪里不对，比如「复制指令只复制了一部分」"
          />
        </NFormItem>

        <NFormItem label="联系方式" path="contact">
          <NInput v-model:value="form.contact" maxlength="120" placeholder="留个能联系到你的邮箱或 QQ" />
        </NFormItem>

        <NFormItem label="发生问题的页面（选填）">
          <div class="fb-page-row">
            <NInput
              v-model:value="form.pagePath"
              maxlength="200"
              placeholder="不确定就点下面的按钮自动填"
            />
            <button
              class="app-btn app-btn--outline app-btn--sm fb-page-btn"
              type="button"
              @click="fillCurrentPage"
            >
              填入当前页面
            </button>
          </div>
        </NFormItem>

        <NFormItem label="详细描述" path="detail">
          <div class="fb-detail">
            <NInput
              v-model:value="form.detail"
              type="textarea"
              :autosize="{ minRows: 3, maxRows: 8 }"
              minlength="15"
              maxlength="2000"
              show-count
              :placeholder="detailPlaceholder"
            />
            <button
              class="fb-example-toggle"
              type="button"
              :aria-expanded="exampleOpen"
              @click="exampleOpen = !exampleOpen"
            >
              <NIcon :component="ChevronDown24Regular" :size="12" :class="{ 'is-open': exampleOpen }" />
              不知道怎么描述？照这个样子说就行
            </button>
            <div class="fb-example" :class="{ 'is-open': exampleOpen }">
              <div class="fb-example-inner">
                <p v-for="(line, index) in exampleLines" :key="index" class="fb-example-text">
                  <template v-for="(part, partIndex) in line" :key="partIndex">
                    <strong v-if="part.strong">{{ part.text }}</strong>
                    <template v-else>{{ part.text }}</template>
                  </template>
                </p>
              </div>
            </div>
          </div>
        </NFormItem>

        <NFormItem label="图片上传（选填）">
          <div class="fb-images">
            <div class="fb-image-grid">
              <figure v-for="(image, index) in images" :key="image.id" class="fb-image-item">
                <img :src="image.url" :alt="`截图 ${index + 1}`" />
                <button
                  class="fb-image-remove"
                  type="button"
                  :aria-label="`删除第 ${index + 1} 张截图`"
                  @click="removeImage(index)"
                >
                  <NIcon :component="Delete24Regular" :size="12" />
                </button>
              </figure>

              <button
                v-if="images.length < MAX_IMAGES"
                class="fb-image-add"
                :class="{ 'is-dragging': dragActive }"
                type="button"
                @click="pickImages"
                @dragover.prevent="dragActive = true"
                @dragleave.prevent="dragActive = false"
                @drop.prevent="onDrop"
              >
                <NIcon :component="Image24Regular" :size="16" />
                <span>{{ imageBusy ? '处理中…' : '添加截图' }}</span>
              </button>
            </div>

            <input
              ref="imageInput"
              class="fb-image-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              @change="onImagesPicked"
            />

            <p class="fb-hint">
              最多 3 张。可以点这里选图，也可以直接把截图粘贴进来。
            </p>
            <p v-if="imageError" class="fb-error">{{ imageError }}</p>
          </div>
        </NFormItem>

        <input
          v-model="form.fax"
          class="fb-honeypot"
          type="text"
          tabindex="-1"
          autocomplete="off"
          aria-hidden="true"
        />

        <div class="fb-actions">
          <AppButton variant="outline" :disabled="submitting" @click="clearAll">
            清空
          </AppButton>
          <AppButton
            variant="solid"
            :icon="Send24Regular"
            :disabled="submitting || imageBusy"
            @click="handleSubmit"
          >
            {{ submitting ? '提交中…' : '提交反馈' }}
          </AppButton>
        </div>
      </NForm>
      </div>
    </NDrawerContent>
  </NDrawer>

  <TurnstileFallback
    ref="turnstileRef"
    :show="turnstileVisible"
    action="feedback"
    description="极验服务暂时不可用，请完成下方备用验证后继续提交反馈。"
    @update:show="turnstileVisible = $event"
    @success="onTurnstileSuccess"
    @close="closeTurnstile"
  />
</template>

<style scoped>
/* 抽屉内容自己做内边距：NDrawerContent 的 body padding 在部分版本下不生效，
   表单会直接贴到抽屉左右边缘 */
.fb-body {
  padding: 20px;
}
/* 末项不留下 18px 的默认下边距，否则底部操作区与图片区之间会空一大块 */
.fb-form :deep(.n-form-item:last-of-type) {
  margin-bottom: 4px;
}

/* 单选项的指示器必须是正圆：主题的通用圆角会把 14px 的圆点压成圆角方块 */
.fb-type :deep(.n-radio__dot) {
  border-radius: 50%;
  corner-shape: round;
}

.fb-type :deep(.n-radio) {
  margin-right: 18px;
}

/* 输入框与「填入当前页面」同高，窄屏下按钮换到下一行也不挤扁输入框 */
.fb-page-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  width: 100%;
}

.fb-page-row :deep(.n-input) {
  flex: 1 1 160px;
  min-width: 0;
}

.fb-page-btn {
  flex-shrink: 0;
  white-space: nowrap;
}

.fb-detail {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.fb-example-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--muted-foreground);
  font-family: inherit;
  font-size: 0.74rem;
  cursor: pointer;
  transition: color 0.4s ease;
}

.fb-example-toggle:hover {
  color: var(--foreground);
}

.fb-example-toggle :deep(.n-icon) {
  transition: transform 0.25s ease;
}

.fb-example-toggle :deep(.n-icon.is-open) {
  transform: rotate(180deg);
}

/* 用 grid 行高过渡代替测量高度：展开区的内容是定长文本，不需要 JS 参与 */
.fb-example {
  display: grid;
  grid-template-rows: 0fr;
  border-radius: var(--radius-lg);
  transition: grid-template-rows 0.28s ease, margin-top 0.28s ease;
}

.fb-example.is-open {
  grid-template-rows: 1fr;
  margin-top: 2px;
}

.fb-example-inner {
  min-height: 0;
  overflow: hidden;
}

/* 示例里的重点词要跳出来：正文是次级灰，重点词用一级前景色 + 加粗 */
.fb-example-text strong {
  color: var(--foreground);
  font-weight: 600;
}

.fb-example-text {
  margin: 0 0 6px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--muted);
  color: var(--muted-foreground);
  font-size: 0.74rem;
  line-height: 1.7;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  transition: background-color 0.4s ease, border-color 0.4s ease, color 0.4s ease;
}

.fb-images {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.fb-image-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.fb-image-item {
  position: relative;
  aspect-ratio: 1 / 1;
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--muted);
  transition: border-color 0.3s ease, background-color 0.4s ease;
}

.fb-image-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 缩略图上的删除键压在图片上：底色用固定的深色遮罩，浅深色下图标都看得清 */
.fb-image-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 50%;
  corner-shape: round;
  background: var(--mask);
  color: var(--on-solid);
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.fb-image-remove:hover {
  opacity: 0.75;
}

.fb-image-add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  aspect-ratio: 1 / 1;
  padding: 0 6px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--muted);
  color: var(--subtle-foreground);
  font-family: inherit;
  font-size: 0.72rem;
  cursor: pointer;
  transition: border-color 0.2s ease, background-color 0.4s ease, color 0.2s ease;
}

.fb-image-add:hover,
.fb-image-add.is-dragging {
  border-color: var(--foreground);
  background: var(--accent);
  color: var(--foreground);
}

.fb-image-input {
  display: none;
}

.fb-hint {
  margin: 0;
  color: var(--subtle-foreground);
  font-size: 0.72rem;
  line-height: 1.5;
}

.fb-honeypot {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.fb-error {
  margin: 0;
  color: var(--destructive);
  font-size: 0.8rem;
  line-height: 1.5;
}

.fb-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 8px;
}

.fb-done {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 48px 8px 24px;
  text-align: center;
}

.fb-done-icon {
  color: var(--success);
  transition: color 0.4s ease;
}

.fb-done-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--foreground);
  transition: color 0.4s ease;
}

.fb-done-text {
  margin: 0;
  max-width: 380px;
  color: var(--muted-foreground);
  font-size: 0.82rem;
  line-height: 1.7;
  transition: color 0.4s ease;
}

.fb-done-text strong {
  color: var(--foreground);
}

.fb-done-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
}
</style>

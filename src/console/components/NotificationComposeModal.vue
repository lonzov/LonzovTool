<script setup>
import { computed, reactive, watch } from 'vue'
import { NInput, useMessage } from 'naive-ui'
import { Copy24Regular } from '@vicons/fluent'
import AppButton from '../../components/ui/AppButton.vue'
import AppModal from '../../components/ui/AppModal.vue'
import { copyText } from '../../utils/clipboard.js'

const props = defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: '发送通知' },
  templateLabel: { type: String, default: '' },
  contact: { type: String, default: '' },
  recipient: { type: String, default: '' },
  subject: { type: String, default: '' },
  body: { type: String, default: '' },
  sending: { type: Boolean, default: false },
})

const emit = defineEmits(['update:show', 'submit'])
const message = useMessage()

const form = reactive({ recipient: '', subject: '', body: '' })

const contactIsEmail = computed(() => (props.contact || '').includes('@'))

watch(
  () => props.show,
  (show) => {
    if (!show) return
    form.recipient = props.recipient || ''
    form.subject = props.subject || ''
    form.body = props.body || ''
  },
)

function close() {
  if (props.sending) return
  emit('update:show', false)
}

function submitEmail() {
  const recipient = form.recipient.trim()
  if (!recipient) {
    message.error('请填写收件人邮箱')
    return
  }
  if (!recipient.includes('@')) {
    message.error('收件人邮箱格式不正确')
    return
  }
  if (!form.subject.trim()) {
    message.error('请填写邮件主题')
    return
  }
  if (!form.body.trim()) {
    message.error('请填写邮件正文')
    return
  }
  emit('submit', {
    channel: 'email',
    recipient,
    subject: form.subject.trim(),
    body: form.body,
  })
}

function submitManual() {
  emit('submit', { channel: 'manual' })
}

async function copyBody() {
  if (!form.body.trim()) {
    message.error('正文为空，没有可复制的内容')
    return
  }
  const ok = await copyText(form.body)
  if (ok) message.success('已复制正文')
  else message.error('复制失败，请手动选中')
}
</script>

<template>
  <AppModal
    :show="show"
    :title="title"
    :max-width="620"
    :auto-focus="false"
    content-scrollable
    :before-close="() => !sending"
    @update:show="emit('update:show', $event)"
  >
    <div class="notify-form">
      <p v-if="templateLabel" class="template-hint">使用模板：{{ templateLabel }}</p>
      <p v-if="contact" class="contact-hint">
        原联系方式：<strong>{{ contact }}</strong>
        <template v-if="!contactIsEmail">
          （不是邮箱，可在下方手动补全，例如 QQ 号补成 <code>123456@qq.com</code>）
        </template>
      </p>

      <label class="field">
        <span class="field-label">收件人</span>
        <NInput
          v-model:value="form.recipient"
          maxlength="254"
          placeholder="name@example.com"
          :disabled="sending"
        />
      </label>

      <label class="field">
        <span class="field-label">主题</span>
        <NInput
          v-model:value="form.subject"
          maxlength="200"
          show-count
          :disabled="sending"
        />
      </label>

      <label class="field">
        <span class="field-label">正文</span>
        <NInput
          v-model:value="form.body"
          type="textarea"
          :autosize="{ minRows: 8, maxRows: 18 }"
          maxlength="5000"
          show-count
          :disabled="sending"
        />
      </label>

      <p class="manual-hint">
        对方只留了 QQ / 微信等联系方式时，可复制文案后自行联系，并在下方标记“已人工通知”。
      </p>
    </div>

    <template #footer>
      <div class="notify-footer">
        <div class="footer-left">
          <AppButton
            variant="text"
            size="sm"
            :icon="Copy24Regular"
            :disabled="sending"
            @click="copyBody"
          >
            复制正文
          </AppButton>
          <AppButton
            variant="text"
            size="sm"
            :disabled="sending"
            @click="submitManual"
          >
            标记已人工通知
          </AppButton>
        </div>
        <div class="footer-main">
          <AppButton variant="outline" size="sm" :disabled="sending" @click="close">
            取消
          </AppButton>
          <AppButton
            variant="solid"
            size="sm"
            :loading="sending"
            :disabled="sending"
            @click="submitEmail"
          >
            发送邮件
          </AppButton>
        </div>
      </div>
    </template>
  </AppModal>
</template>

<style scoped>
.notify-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.template-hint,
.contact-hint,
.manual-hint {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 0.8125rem;
  line-height: 1.5;
}

.contact-hint strong {
  color: var(--foreground);
  font-weight: 600;
}

.contact-hint code {
  padding: 1px 4px;
  border-radius: var(--radius-sm);
  background: var(--muted);
  color: var(--foreground);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  color: var(--muted-foreground);
  font-size: 0.8125rem;
}

.notify-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.footer-main {
  display: flex;
  align-items: center;
  gap: 8px;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

@media (max-width: 560px) {
  .notify-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .footer-main {
    justify-content: flex-end;
  }
}
</style>

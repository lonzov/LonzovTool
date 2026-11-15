<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { NInput, NSelect, useMessage } from 'naive-ui'
import AppButton from '../../components/ui/AppButton.vue'
import AppModal from '../../components/ui/AppModal.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: '发送通知' },
  templateLabel: { type: String, default: '' },
  templates: { type: Array, default: () => [] },
  defaultEvent: { type: String, default: '' },
  contact: { type: String, default: '' },
  recipient: { type: String, default: '' },
  subject: { type: String, default: '' },
  body: { type: String, default: '' },
  sending: { type: Boolean, default: false },
})

const emit = defineEmits(['update:show', 'submit'])
const message = useMessage()

const form = reactive({ recipient: '', subject: '', body: '' })
const selectedEvent = ref('')

const contactIsEmail = computed(() => (props.contact || '').includes('@'))
const templateOptions = computed(() =>
  props.templates.map((item) => ({ label: item.label || item.event, value: item.event })),
)

watch(
  () => props.show,
  (show) => {
    if (!show) return
    selectedEvent.value = props.defaultEvent || props.templates[0]?.event || ''
    applyTemplate()
  },
)

watch(selectedEvent, () => {
  if (props.show) applyTemplate()
})

function applyTemplate() {
  const template = props.templates.find((item) => item.event === selectedEvent.value)
  if (template) {
    form.recipient = template.recipient || ''
    form.subject = template.subject || ''
    form.body = template.body || ''
    return
  }
  form.recipient = props.recipient || ''
  form.subject = props.subject || ''
  form.body = props.body || ''
}

function fillQqEmail() {
  form.recipient = `${(props.contact || '').trim()}@qq.com`
}

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
    event: selectedEvent.value || undefined,
  })
}

function submitManual() {
  emit('submit', { channel: 'manual', event: selectedEvent.value || undefined })
}
</script>

<template>
  <AppModal
    :show="show"
    :title="title"
    :max-width="620"
    :z-index="2300"
    :auto-focus="false"
    content-scrollable
    :before-close="() => !sending"
    @update:show="emit('update:show', $event)"
  >
    <div class="notify-form">
      <label v-if="templateOptions.length" class="field">
        <span class="field-label">使用模板</span>
        <NSelect
          v-model:value="selectedEvent"
          :options="templateOptions"
          :menu-props="{ class: 'notify-template-menu' }"
        />
      </label>
      <p v-else-if="templateLabel" class="template-hint">使用模板：{{ templateLabel }}</p>
      <p v-if="contact" class="contact-hint">
        原联系方式：<strong>{{ contact }}</strong>
        <AppButton
          v-if="!contactIsEmail"
          class="contact-fill"
          variant="text"
          size="xs"
          @click="fillQqEmail"
        >
          补全QQ邮箱
        </AppButton>
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
    </div>

    <template #footer>
      <div class="notify-footer">
        <div class="footer-left">
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
.contact-hint {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 0.8125rem;
  line-height: 1.5;
}

.contact-hint strong {
  color: var(--foreground);
  font-weight: 600;
}

.contact-fill {
  margin-left: 6px;
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
  min-width: 0;
  flex-wrap: nowrap;
}

.footer-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
</style>

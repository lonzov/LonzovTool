<script setup>
import { computed, ref } from 'vue'
import { NIcon, useMessage } from 'naive-ui'
import { ArrowUpload24Regular, Image24Regular } from '@vicons/fluent'
import { consoleFetch } from '../consoleRequest.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  /** 服务端按用途决定落盘目录与所需权限：avatar → people.write，download → downloads.write */
  purpose: { type: String, required: true },
  label: { type: String, default: '上传图片' },
  /** 预览用的兜底文字（如昵称首字） */
  fallback: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])

const UPLOAD_URL = '/api/v1/console/media/images'

const message = useMessage()
const input = ref(null)
const uploading = ref(false)

const preview = computed(() => {
  const value = (props.modelValue || '').trim()
  if (!value) return ''
  return value.startsWith('/') || /^https?:\/\//i.test(value) ? value : ''
})

function pick() {
  input.value?.click()
}

async function onPick(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  const body = new FormData()
  body.append('purpose', props.purpose)
  body.append('image', file)

  uploading.value = true
  try {
    const payload = await consoleFetch(UPLOAD_URL, { method: 'POST', body })
    emit('update:modelValue', payload.path)
    message.success('图片已上传')
  } catch (e) {
    message.error(e?.message || '上传失败，请稍后重试')
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <div class="image-upload">
    <span class="image-upload__preview">
      <img v-if="preview" :src="preview" alt="" loading="lazy" />
      <NIcon v-else :component="Image24Regular" :size="18" />
      <span v-if="!preview && fallback" class="image-upload__fallback">{{ fallback }}</span>
    </span>
    <div class="image-upload__body">
      <div class="image-upload__actions">
        <button
          class="app-btn app-btn--outline app-btn--sm"
          type="button"
          :disabled="uploading"
          @click="pick"
        >
          <NIcon :component="ArrowUpload24Regular" :size="13" />
          <span>{{ uploading ? '上传中…' : label }}</span>
        </button>
        <button
          v-if="modelValue"
          class="app-btn app-btn--text app-btn--sm"
          type="button"
          :disabled="uploading"
          @click="emit('update:modelValue', '')"
        >
          移除
        </button>
        <input
          ref="input"
          class="image-upload__input"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/x-icon"
          @change="onPick"
        />
      </div>
      <p class="image-upload__hint">PNG / JPG / WebP / ICO，不超过 2 MB；上传后自动转为 WebP</p>
    </div>
  </div>
</template>

<style scoped>
.image-upload {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.image-upload__preview {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--muted);
  color: var(--muted-foreground);
}

.image-upload__preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-upload__fallback {
  position: absolute;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--muted-foreground);
}

.image-upload__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.image-upload__actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.image-upload__input {
  display: none;
}

.image-upload__hint {
  margin: 0;
  color: var(--subtle-foreground);
  font-size: 0.72rem;
  line-height: 1.5;
}
</style>

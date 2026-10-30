<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { NIcon, useMessage } from 'naive-ui'
import { ArrowUpload24Regular, Image24Regular } from '@vicons/fluent'

/**
 * 图片选择与本地预览。选中后只留在本地，由调用方在保存时上传：
 * 上传是写操作，应该和数据一起过身份确认；取消编辑也不该在服务端留下孤儿文件。
 */
const props = defineProps({
  modelValue: { type: String, default: '' },
  pendingFile: { type: Object, default: null },
  label: { type: String, default: '上传图片' },
  /** 预览用的兜底文字（如昵称首字） */
  fallback: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'update:pendingFile'])

const MAX_BYTES = 2 * 1024 * 1024

const message = useMessage()
const input = ref(null)
const localPreview = ref('')

function revokeLocal() {
  if (localPreview.value) {
    URL.revokeObjectURL(localPreview.value)
    localPreview.value = ''
  }
}

watch(
  () => props.pendingFile,
  (file) => {
    revokeLocal()
    if (file) localPreview.value = URL.createObjectURL(file)
  },
  { immediate: true },
)

onBeforeUnmount(revokeLocal)

const preview = computed(() => {
  if (localPreview.value) return localPreview.value
  const value = (props.modelValue || '').trim()
  if (!value) return ''
  return value.startsWith('/') || /^https?:\/\//i.test(value) ? value : ''
})

function pick() {
  input.value?.click()
}

function onPick(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    message.error('请选择图片文件')
    return
  }
  if (file.size > MAX_BYTES) {
    message.error('图片不能超过 2 MB')
    return
  }
  emit('update:modelValue', '')
  emit('update:pendingFile', file)
}

function clear() {
  emit('update:pendingFile', null)
  emit('update:modelValue', '')
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
        <button class="app-btn app-btn--outline app-btn--sm" type="button" @click="pick">
          <NIcon :component="ArrowUpload24Regular" :size="13" />
          <span>{{ label }}</span>
        </button>
        <button
          v-if="modelValue || pendingFile"
          class="app-btn app-btn--text app-btn--sm"
          type="button"
          @click="clear"
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
      <p class="image-upload__hint">PNG / JPG / WebP / ICO，不超过 2 MB；保存时上传并转为 WebP</p>
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

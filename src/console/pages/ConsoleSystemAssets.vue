<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NIcon, useMessage } from 'naive-ui'
import { Image24Regular, ImageOff24Regular, LockClosed24Regular } from '@vicons/fluent'
import AppButton from '../../components/ui/AppButton.vue'
import ConsolePanel from '../components/ConsolePanel.vue'
import ConsoleSkeleton from '../components/ConsoleSkeleton.vue'
import { confirmDialog } from '../../composables/useConfirm.js'
import { consoleFetch } from '../consoleRequest.js'
import { openImageLightbox } from '../useImageLightbox.js'

const ORPHANS_URL = '/api/v1/console/system/assets/orphans'
const PRUNE_URL = '/api/v1/console/system/assets/orphans/prune'

const KIND_LABELS = {
  card_logo: '卡片图标',
  avatar: '头像',
  download_cover: '下载页封面',
  promo_image: '推广图',
  submission_icon: '提交图标',
  feedback_image: '反馈截图',
}

const route = useRoute()
const router = useRouter()
const message = useMessage()

const overview = ref(null)
const loading = ref(false)
const pruning = ref(false)
const errorText = ref('')

const items = computed(() => overview.value?.items || [])
const ready = computed(() => Number(overview.value?.ready) || 0)
const total = computed(() => Number(overview.value?.total) || 0)
const graceHours = computed(() => Number(overview.value?.grace_hours) || 24)

/* 私有资产（反馈截图）不在公开媒体目录下，浏览器拿不到地址，只能展示类型与元信息 */
const brokenAssets = ref(new Set())

function kindLabel(item) {
  return KIND_LABELS[item.kind] || item.kind
}

function assetUrl(item) {
  return item.visibility === 'public' ? `/uploads/${item.key}` : ''
}

function canPreview(item) {
  return Boolean(assetUrl(item)) && !brokenAssets.value.has(item.id)
}

function markBroken(id) {
  brokenAssets.value.add(id)
}

function openAsset(item) {
  const previewable = items.value.filter((entry) => canPreview(entry))
  const index = previewable.findIndex((entry) => entry.id === item.id)
  if (index < 0) return
  openImageLightbox(
    previewable.map((entry) => assetUrl(entry)),
    index,
  )
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
    overview.value = await consoleFetch(ORPHANS_URL)
  } catch (e) {
    if (gotUnauthorized(e)) return
    errorText.value = e?.message || '读取图片资产失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

async function askPrune() {
  if (!ready.value || pruning.value) return
  pruning.value = true
  try {
    // 先按当前引用状态预演一次：确认框里的数量与真正会跳过的资产都以服务端为准
    const preview = await consoleFetch(`${PRUNE_URL}?dry_run=true`, { method: 'POST' })
    const deletable = Number(preview?.deleted) || 0
    const skipped = Number(preview?.skipped_referenced) || 0
    if (!deletable) {
      await load()
      message.info(
        skipped > 0 ? '可清理的资产仍被引用，已全部跳过' : '当前没有可清理的孤儿文件',
      )
      return
    }
    const skipText = skipped > 0 ? `，另有 ${skipped} 个仍被引用会跳过` : ''
    const confirmed = await confirmDialog({
      title: '清理孤儿图片',
      message: `将永久删除 ${deletable} 个已解绑超过 ${graceHours.value} 小时的图片资产${skipText}，此操作不可撤销。`,
      confirmText: '继续',
      danger: true,
    })
    if (!confirmed) return

    const result = await consoleFetch(PRUNE_URL, { method: 'POST' })
    const deleted = Number(result?.deleted) || 0
    const skippedAfter = Number(result?.skipped_referenced) || 0
    const remaining = Number(result?.remaining) || 0
    message.success(
      `已清理 ${deleted} 个孤儿文件，释放 ${formatBytes(result?.freed_bytes)}`,
    )
    if (skippedAfter > 0) message.info(`跳过 ${skippedAfter} 个仍被引用的资产`)
    if (remaining > 0) message.info(`还有 ${remaining} 个待清理，可稍后再次执行`)
    await load()
  } catch (e) {
    if (gotUnauthorized(e)) return
    message.error(e?.message || '清理失败，请稍后重试')
  } finally {
    pruning.value = false
  }
}

function formatBytes(value) {
  const bytes = Number(value) || 0
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTime(timestamp) {
  const date = new Date((Number(timestamp) || 0) * 1000)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

onMounted(load)
</script>

<template>
  <div class="system-assets">
    <p v-if="errorText" class="system-error" role="alert">{{ errorText }}</p>

    <ConsolePanel
      title="孤儿文件清理"
      description="删除超过宽限期的孤儿图片；仍被引用的资产会保留"
      :icon="Image24Regular"
    >
      <template #extra>
        <AppButton
          variant="solid"
          size="sm"
          :disabled="!ready || loading"
          :loading="pruning"
          @click="askPrune"
        >
          立即清理
        </AppButton>
      </template>
      <div class="orphan-stats">
        <div class="orphan-stat">
          <span class="orphan-stat-label">待清理</span>
          <strong class="orphan-stat-value">
            <ConsoleSkeleton v-if="loading" width="3em" height="1.4em" />
            <template v-else>{{ ready }}</template>
          </strong>
          <span class="orphan-stat-note">转为孤儿超过 {{ graceHours }} 小时</span>
        </div>
        <div class="orphan-stat">
          <span class="orphan-stat-label">全部孤儿</span>
          <strong class="orphan-stat-value">
            <ConsoleSkeleton v-if="loading" width="3em" height="1.4em" />
            <template v-else>{{ total }}</template>
          </strong>
          <span class="orphan-stat-note">含仍在宽限期内的资产</span>
        </div>
        <div class="orphan-stat">
          <span class="orphan-stat-label">可释放空间</span>
          <strong class="orphan-stat-value">
            <ConsoleSkeleton v-if="loading" width="3em" height="1.4em" />
            <template v-else>{{ formatBytes(overview?.ready_bytes) }}</template>
          </strong>
          <span class="orphan-stat-note">仅统计待清理项</span>
        </div>
      </div>

      <div v-if="loading && !items.length" class="asset-gallery" aria-hidden="true">
        <div v-for="index in 8" :key="index" class="asset-tile asset-tile--skeleton">
          <ConsoleSkeleton
            width="100%"
            :height="index % 3 === 0 ? 132 : index % 2 ? 88 : 112"
            radius="var(--radius-sm)"
          />
          <div class="asset-tile__meta">
            <ConsoleSkeleton width="44%" height="1.1em" />
            <ConsoleSkeleton width="26%" height="1.1em" />
          </div>
        </div>
      </div>
      <p v-else-if="!items.length" class="orphan-empty">
        当前没有可清理的孤儿文件。
      </p>
      <div v-else class="asset-gallery">
        <button
          v-for="item in items"
          :key="item.id"
          type="button"
          class="asset-tile"
          :class="{ 'asset-tile--private': !assetUrl(item) }"
          :disabled="!canPreview(item)"
          :title="item.key"
          :aria-label="
            canPreview(item)
              ? `查看${kindLabel(item)}原图`
              : assetUrl(item)
                ? `${kindLabel(item)}（图片不可用）`
                : `${kindLabel(item)}（私有，不可预览）`
          "
          @click="openAsset(item)"
        >
          <span class="asset-tile__thumb">
            <img
              v-if="canPreview(item)"
              class="asset-tile__image"
              :src="assetUrl(item)"
              :alt="kindLabel(item)"
              loading="lazy"
              @error="markBroken(item.id)"
            />
            <span v-else class="asset-tile__fallback">
              <NIcon
                :component="assetUrl(item) ? ImageOff24Regular : LockClosed24Regular"
                :size="20"
              />
              <span>{{ assetUrl(item) ? '图片不可用' : '私有图片' }}</span>
            </span>
          </span>
          <span class="asset-tile__meta">
            <span class="asset-tile__kind">{{ kindLabel(item) }}</span>
            <span class="asset-tile__facts">
              {{ formatBytes(item.bytes) }} · {{ formatTime(item.orphaned_at) }}
            </span>
          </span>
        </button>
      </div>
      <p v-if="!loading && items.length && overview?.has_more" class="gallery-more">
        仅展示前 {{ items.length }} 项，实际待清理 {{ overview.ready }} 项。
      </p>
    </ConsolePanel>
  </div>
</template>

<style scoped>
.system-assets {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.system-error {
  margin: 0;
  color: var(--destructive);
  font-size: 0.8rem;
}

.orphan-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.orphan-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--background);
  transition: background-color 0.4s ease, border-color 0.4s ease;
}

.orphan-stat-label {
  color: var(--muted-foreground);
  font-size: 0.76rem;
}

.orphan-stat-value {
  color: var(--foreground);
  font-size: 1.15rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.orphan-stat-note {
  color: var(--subtle-foreground);
  font-size: 0.75rem;
}

.orphan-empty {
  margin: 14px 0 0;
  padding: 18px 14px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  color: var(--subtle-foreground);
  font-size: 0.8rem;
}

/* 瀑布流：按图片原始比例分列，列高自然错落 */
.asset-gallery {
  margin-top: 14px;
  column-width: 200px;
  column-gap: 12px;
}

.asset-tile {
  display: flex;
  width: 100%;
  flex-direction: column;
  margin: 0 0 12px;
  padding: 0;
  overflow: hidden;
  break-inside: avoid;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--card);
  color: inherit;
  font-family: inherit;
  text-align: left;
  cursor: zoom-in;
  transition: border-color 0.2s ease, transform 0.2s ease, background-color 0.4s ease;
}

.asset-tile:hover:not(:disabled) {
  border-color: var(--border-strong);
  transform: translateY(-1px);
}

.asset-tile:disabled {
  cursor: default;
}

.asset-tile--skeleton {
  gap: 8px;
  padding: 8px;
  cursor: default;
}

.asset-tile--skeleton .asset-tile__meta {
  padding: 0;
  border-top: none;
}

.asset-tile__thumb {
  display: block;
  overflow: hidden;
  background: var(--muted);
  transition: background-color 0.4s ease;
}

.asset-tile__image {
  display: block;
  width: 100%;
  height: auto;
  max-height: 320px;
  object-fit: contain;
}

.asset-tile__fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  aspect-ratio: 4 / 3;
  color: var(--subtle-foreground);
  font-size: 0.75rem;
}

.asset-tile__meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
  padding: 8px 10px;
  border-top: 1px solid var(--border);
  transition: border-color 0.4s ease;
}

.asset-tile__kind {
  flex-shrink: 0;
  color: var(--foreground);
  font-size: 0.76rem;
  font-weight: 500;
  transition: color 0.4s ease;
}

.asset-tile__facts {
  color: var(--subtle-foreground);
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
  transition: color 0.4s ease;
}

.gallery-more {
  margin: 4px 0 0;
  color: var(--subtle-foreground);
  font-size: 0.75rem;
}

@media (width <= 640px) {
  .orphan-stats {
    grid-template-columns: minmax(0, 1fr);
  }

  .asset-gallery {
    column-width: 150px;
    column-gap: 8px;
  }

  .asset-tile {
    margin-bottom: 8px;
  }
}
</style>

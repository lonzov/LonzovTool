<script setup>
import { computed, ref } from 'vue'
import { NIcon, NTabPane, NTabs, useMessage } from 'naive-ui'
import AppButton from '../ui/AppButton.vue'
import AppModal from '../ui/AppModal.vue'
import { ArrowImport24Regular, Delete24Regular, Edit24Filled } from '@vicons/fluent'
import {
  showLangModal, langPackList, activePackId, langLoading, langStorageFallback,
  langImportOpen, langImportName, langImportText, langImportDraft,
  langImportError, langImporting, langRenamingId, langRenamingName,
  closeLangModal, activatePack, importLangPack, deletePack,
  startRename, cancelRename, confirmRename, setImportFile, clearImportFile, formatBytes,
} from '../../composables/useRawJsonLang.js'
import { confirmDialog } from '../../composables/useConfirm.js'

const message = useMessage()
const fileInput = ref(null)

// 关闭按钮 / 遮罩 / Esc 统一走 closeLangModal，Esc 的展开下拉判断交给 NModal
function onShowChange(visible) {
  if (visible) showLangModal.value = true
  else closeLangModal()
}

const activePack = computed(() => langPackList.value.find(p => p.id === activePackId.value) || null)
const sourceLabel = { lang: '.lang', json: 'JSON', paste: '粘贴', pack: '资源包' }
const modalDescription = computed(() => (
  activePack.value ? `当前生效：${activePack.value.name}` : '尚未加载语言包'
))

/** 标签页与 composable 的 langImportOpen 双向对应：打开时按是否已有语言包决定落在哪一页 */
const activeTab = computed({
  get: () => (langImportOpen.value ? 'import' : 'list'),
  set: (value) => {
    langImportOpen.value = value === 'import'
    if (value === 'import') langImportError.value = ''
  },
})

/** 导入视图里一次只用一种来源，两者不并列，避免「选文件还是贴内容」的歧义 */
const importSource = ref('file')
const canImport = computed(() => (
  importSource.value === 'file'
    ? !!langImportDraft.value
    : !!langImportText.value.trim()
))

/** 资源包读出来的旁证：原文件名、版本、实际取用的词表 */
const draftSummary = computed(() => {
  const draft = langImportDraft.value
  if (!draft) return ''
  return [
    draft.fileName,
    draft.version ? `v${draft.version}` : '',
    draft.langPath ? draft.langPath.split('/').pop() : '',
  ].filter(Boolean).join(' · ')
})

function formatDate(ts) {
  const d = new Date(ts)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function pickFile() {
  const input = fileInput.value
  if (!input) return
  input.value = ''
  input.click()
}

async function onFileChange(event) {
  const file = event.target.files?.[0]
  if (file) await setImportFile(file)
}

async function doImport() {
  const fromFile = importSource.value === 'file'
  const draft = langImportDraft.value
  const text = fromFile ? (draft?.text ?? '') : langImportText.value
  if (!text.trim()) {
    langImportError.value = fromFile ? '请先选择语言包文件' : '请先粘贴语言包内容'
    return
  }
  langImporting.value = true
  langImportError.value = ''
  try {
    const meta = await importLangPack({
      text,
      name: langImportName.value,
      source: fromFile ? (draft?.source || 'lang') : 'paste',
      iconUrl: fromFile ? (draft?.iconUrl ?? '') : '',
      description: fromFile ? (draft?.description ?? '') : '',
      version: fromFile ? (draft?.version ?? '') : '',
    })
    message.success(`已导入「${meta.name}」，共 ${meta.keyCount.toLocaleString('zh-CN')} 个键`)
    langImportName.value = ''
    langImportText.value = ''
    clearImportFile()
    langImportOpen.value = false
  } catch (e) {
    langImportError.value = e?.message || '导入失败'
  } finally {
    langImporting.value = false
  }
}

async function doActivate(id) {
  const ok = await activatePack(id)
  if (!ok) message.error('语言包数据读取失败，请刷新网页后重试')
}

async function doDelete(id) {
  const pack = langPackList.value.find(p => p.id === id)
  const confirmed = await confirmDialog({
    title: '删除语言包',
    message: `删除「${pack?.name ?? ''}」？删除后对应的 translate 会显示键名。`,
    confirmText: '删除',
    danger: true,
  })
  if (confirmed) deletePack(id)
}
</script>

<template>
  <AppModal
    :show="showLangModal"
    title="语言包"
    :description="modalDescription"
    :max-width="560"
    :max-height-offset="110"
    content-scrollable
    animated
    :auto-focus="false"
    @update:show="onShowChange"
  >
    <NTabs v-model:value="activeTab" type="line" animated class="lang-tabs">
      <NTabPane name="list" :tab="`已导入（${langPackList.length}）`">
        <div class="lang-section">
          <p v-if="langPackList.length === 0" class="lang-muted">还没有语言包</p>

          <ul v-else class="lang-list">
            <li
              v-for="p in langPackList" :key="p.id"
              class="lang-item" :class="{ 'lang-item--active': p.id === activePackId }"
            >
              <img v-if="p.iconUrl" class="lang-item-icon" :src="p.iconUrl" alt="" />

              <template v-if="langRenamingId === p.id">
                <input
                  v-model="langRenamingName"
                  type="text" class="lang-input"
                  @keydown.enter="confirmRename"
                  @keydown.esc="cancelRename"
                />
                <div class="lang-actions">
                  <AppButton variant="outline" size="xs" @click="cancelRename">取消</AppButton>
                  <AppButton variant="solid" size="xs" @click="confirmRename">保存</AppButton>
                </div>
              </template>

              <template v-else>
                <div class="lang-item-main">
                  <span class="lang-item-name">{{ p.name }}</span>
                  <span class="lang-item-meta">
                    {{ p.keyCount.toLocaleString('zh-CN') }} 个键 · {{ formatBytes(p.bytes) }}
                    · {{ sourceLabel[p.source] || p.source }}{{ p.version ? ` v${p.version}` : '' }}
                    · {{ formatDate(p.importedAt) }}
                  </span>
                </div>
                <div class="lang-actions">
                  <span v-if="p.id === activePackId" class="lang-badge">生效中</span>
                  <button
                    v-else class="lang-link" :disabled="langLoading"
                    @click="doActivate(p.id)"
                  >设为当前</button>
                  <button class="lang-icon-btn" title="重命名" @click="startRename(p.id)">
                    <NIcon :component="Edit24Filled" :size="14" />
                  </button>
                  <button class="lang-icon-btn" title="删除" @click="doDelete(p.id)">
                    <NIcon :component="Delete24Regular" :size="14" />
                  </button>
                </div>
              </template>
            </li>
          </ul>

          <p v-if="langStorageFallback" class="lang-note">
            当前浏览器不支持复杂存储，语言包已降级到小容量的普通存储，建议更换为标准浏览器
          </p>
        </div>
      </NTabPane>

      <NTabPane name="import" tab="导入">
        <div class="lang-section">
          <input
            ref="fileInput"
            class="lang-file-input"
            type="file"
            accept=".lang,.txt,.json,.mcpack,.zip,application/zip"
            @change="onFileChange"
          />

          <div class="lang-field">
            <span class="lang-label">来源</span>
            <div class="lang-source">
              <button
                class="lang-source-btn"
                :class="{ 'lang-source-btn--active': importSource === 'file' }"
                @click="importSource = 'file'"
              >
                选择文件
              </button>
              <button
                class="lang-source-btn"
                :class="{ 'lang-source-btn--active': importSource === 'paste' }"
                @click="importSource = 'paste'"
              >
                粘贴内容
              </button>
            </div>
          </div>

          <div v-if="importSource === 'file'" class="lang-field">
            <div v-if="langImportDraft" class="lang-file">
              <img v-if="langImportDraft.iconUrl" class="lang-file-icon" :src="langImportDraft.iconUrl" alt="" />
              <div class="lang-file-main">
                <span class="lang-file-name">{{ langImportDraft.name || langImportDraft.fileName }}</span>
                <span v-if="draftSummary" class="lang-file-meta">{{ draftSummary }}</span>
              </div>
              <button class="lang-file-remove" title="移除" @click="clearImportFile">×</button>
            </div>
            <button v-else class="lang-drop" @click="pickFile">
              <NIcon :component="ArrowImport24Regular" :size="18" />
              <span>选择 .lang、.json 或资源包</span>
            </button>
          </div>

          <div v-else class="lang-field">
            <textarea
              v-model="langImportText"
              class="lang-textarea"
              spellcheck="false"
              placeholder="key=value 形式的 .lang 内容，或 {&quot;键&quot;:&quot;值&quot;} 的 JSON"
            />
          </div>

          <div class="lang-field">
            <label class="lang-label" for="lang-import-name">名称（可选）</label>
            <input
              id="lang-import-name"
              v-model="langImportName"
              type="text" class="lang-input"
              placeholder="默认按导入日期命名"
            />
          </div>

          <p v-if="langImportError" class="lang-error">{{ langImportError }}</p>
        </div>
      </NTabPane>
    </NTabs>

    <template #footer>
      <div v-if="langImportOpen" class="app-modal-actions">
        <span class="lang-footer-hint">保存在本地浏览器，不会上传</span>
        <button
          class="app-btn app-btn--fill"
          :disabled="!canImport || langImporting"
          @click="doImport"
        >
          {{ langImporting ? '导入中…' : '导入并启用' }}
        </button>
      </div>
    </template>
  </AppModal>
</template>

<style scoped>
.lang-section { display: flex; flex-direction: column; gap: 12px; }
.lang-tabs :deep(.n-tab-pane) { padding-top: 18px; }
.lang-file-input { display: none; }
.lang-muted {
  margin: 0; padding: 2px;
  font-size: 12px; line-height: 1.6; color: var(--muted-foreground);
  transition: color 0.4s ease;
}
.lang-note { margin: 2px 0 0; font-size: 12px; line-height: 1.5; color: var(--muted-foreground); transition: color 0.4s ease; }

.lang-list { list-style: none; display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; }
.lang-item {
  display: flex; align-items: center; flex-wrap: wrap; gap: 12px;
  padding: 10px 12px;
  background: var(--muted); border: 1px solid var(--border); border-radius: var(--radius-md);
  transition: background-color 0.4s ease, border-color 0.4s ease;
}
/* 窄屏把状态与操作压到第二行：名称与元信息独占一整行，不再被按钮挤成省略号 */
@media (width <= 520px) {
  .lang-item { row-gap: 8px; }
  .lang-item-main { flex: 1 1 auto; }
  /* 元信息一行放不下时换行显示，窄屏宁可多一行也不省略 */
  .lang-item-meta,
  .lang-file-meta { white-space: normal; }
  .lang-actions { flex: 1 0 100%; justify-content: flex-end; margin-left: 0; }
}
.lang-item--active { border-color: var(--muted-foreground); }
.lang-item-icon {
  width: 36px; height: 36px; flex-shrink: 0;
  border-radius: var(--radius-sm);
  object-fit: cover;
  background: var(--card);
  border: 1px solid var(--border);
  transition: background-color 0.4s ease, border-color 0.4s ease;
}
.lang-item-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.lang-item-name {
  font-size: 13px; font-weight: 500; color: var(--foreground);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  transition: color 0.4s ease;
}
.lang-item-meta {
  font-size: 11px; color: var(--muted-foreground);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  transition: color 0.4s ease;
}
.lang-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; margin-left: auto; }

/* 与站点其它状态标签同款：success 底色 + 描边 */
.lang-badge {
  display: inline-flex; align-items: center;
  padding: 2px 9px;
  border: 1px solid color-mix(in srgb, var(--success) 28%, transparent);
  border-radius: var(--radius-full);
  corner-shape: round;
  font-size: 12px; white-space: nowrap;
  color: var(--success);
  background: color-mix(in srgb, var(--success) 14%, transparent);
  transition: color 0.4s ease, background-color 0.4s ease, border-color 0.4s ease;
}

.lang-link {
  border: none; background: transparent; cursor: pointer;
  font-size: 12px; font-family: inherit; padding: 2px 4px; border-radius: var(--radius-xs);
  color: var(--muted-foreground);
  transition: color 0.15s ease, background-color 0.15s ease;
}
.lang-link:hover { background: var(--card); color: var(--foreground); }
.lang-link:disabled { opacity: 0.5; cursor: default; }

.lang-icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; padding: 0;
  border: none; border-radius: var(--radius-sm); background: transparent;
  color: var(--muted-foreground); cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease;
}
.lang-icon-btn:hover { background: var(--card); color: var(--foreground); }

.lang-field { margin-bottom: 16px; }
.lang-field:last-child { margin-bottom: 0; }
.lang-label {
  display: block; margin-bottom: 6px;
  font-size: 12px; font-weight: 400; color: var(--muted-foreground);
  transition: color 0.4s ease;
}
.lang-input {
  width: 100%; height: 34px; padding: 0 12px;
  border: 1px solid var(--border); border-radius: var(--radius-md);
  background: var(--muted); color: var(--foreground);
  font-size: 13px; font-family: inherit; outline: none; box-sizing: border-box;
  transition: border-color 0.3s ease, background-color 0.4s ease, color 0.4s ease;
}
.lang-input:focus { border-color: var(--muted-foreground); }
.lang-item .lang-input { flex: 1; }

/* 来源二选一：分段控件，选中态用卡片底抬起 */
.lang-source {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border-radius: var(--radius-md);
  background: var(--muted);
  transition: background-color 0.4s ease;
}
.lang-source-btn {
  padding: 5px 14px;
  border: none; border-radius: var(--radius-sm);
  background: transparent; color: var(--muted-foreground);
  font-size: 12px; font-family: inherit;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.lang-source-btn:hover { color: var(--foreground); }
.lang-source-btn--active {
  background: var(--card); color: var(--foreground);
  box-shadow: var(--shadow-sm);
}

/* 文件来源的落区：与粘贴框同高，一眼看出这是「放文件的地方」 */
.lang-drop {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  width: 100%; min-height: 140px; padding: 16px; box-sizing: border-box;
  border: 1px dashed var(--border); border-radius: var(--radius-md);
  background: transparent; color: var(--muted-foreground);
  font-size: 12px; font-family: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;
}
.lang-drop:hover {
  border-color: var(--muted-foreground); background: var(--muted); color: var(--foreground);
}

/* 选中文件后的摘要：资源包会带出图标、包名、版本与实际取用的词表 */
.lang-file {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px;
  background: var(--muted); border: 1px solid var(--border); border-radius: var(--radius-md);
  transition: background-color 0.4s ease, border-color 0.4s ease;
}
.lang-file-icon {
  width: 36px; height: 36px; flex-shrink: 0;
  border-radius: var(--radius-sm);
  object-fit: cover;
  border: 1px solid var(--border);
  transition: border-color 0.4s ease;
}
.lang-file-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.lang-file-name {
  font-size: 13px; font-weight: 500; color: var(--foreground);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  transition: color 0.4s ease;
}
.lang-file-meta {
  font-size: 11px; color: var(--muted-foreground);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  transition: color 0.4s ease;
}
.lang-file-remove {
  border: none; background: transparent; cursor: pointer;
  font-size: 14px; line-height: 1; padding: 0;
  color: var(--muted-foreground);
  transition: color 0.15s ease;
}
.lang-file-remove:hover { color: var(--foreground); }

.lang-textarea {
  display: block;
  width: 100%; min-height: 140px;
  padding: 8px 12px;
  border: 1px solid var(--border); border-radius: var(--radius-md);
  background: var(--muted); color: var(--foreground);
  font-size: 12px; resize: vertical;
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  outline: none; box-sizing: border-box;
  transition: border-color 0.3s ease, background-color 0.4s ease, color 0.4s ease;
}
.lang-textarea:focus { border-color: var(--muted-foreground); }

.lang-error {
  margin: 0; padding: 8px 12px;
  background: var(--muted); border: 1px solid var(--border);
  border-radius: var(--radius-sm); font-size: 12px; color: var(--destructive);
  /* 存储层报错可能带换行，保留断句 */
  white-space: pre-line; word-break: break-all;
  transition: background-color 0.4s ease, border-color 0.4s ease, color 0.4s ease;
}

.lang-footer-hint { font-size: 12px; color: var(--muted-foreground); transition: color 0.4s ease; }
</style>

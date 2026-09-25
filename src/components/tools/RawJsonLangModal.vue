<script setup>
import { computed } from 'vue'
import { NIcon, useMessage } from 'naive-ui'
import AppModal from '../ui/AppModal.vue'
import { Delete24Regular, Edit24Filled } from '@vicons/fluent'
import {
  showLangModal, langPackList, activePackId, langLoading, langStorageFallback,
  langImportOpen, langImportName, langImportText, langImportFileName, langImportFileText,
  langImportError, langImporting, langDeleteConfirmId, langRenamingId, langRenamingName,
  closeLangModal, activatePack, importLangPack, deletePack, toggleDeleteConfirm,
  startRename, cancelRename, confirmRename, setImportFile, clearImportFile, formatBytes,
} from '../../composables/useRawJsonLang.js'

const message = useMessage()

const activePack = computed(() => langPackList.value.find(p => p.id === activePackId.value) || null)
const sourceLabel = { lang: '.lang', json: 'JSON', paste: '粘贴' }

function formatDate(ts) {
  const d = new Date(ts)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function pickFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.lang,.txt,.json,text/plain,application/json'
  input.onchange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setImportFile(file.name, await file.text())
    } catch (err) {
      langImportError.value = `读取文件失败：${err?.message || err}`
    }
  }
  input.click()
}

async function doImport() {
  const text = langImportFileText.value || langImportText.value
  if (!text.trim()) {
    langImportError.value = '请先选择 .lang 文件，或粘贴语言包内容'
    return
  }
  langImporting.value = true
  langImportError.value = ''
  try {
    const meta = await importLangPack({
      text,
      name: langImportName.value,
      source: langImportFileText.value ? 'lang' : 'paste',
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
  if (!ok) message.error('语言包数据读取失败')
}

function doDelete(id) {
  if (toggleDeleteConfirm(id)) deletePack(id)
}
</script>

<template>
  <AppModal
    v-model:show="showLangModal"
    title="语言包"
    :max-width="640"
    :max-height-offset="110"
    content-scrollable
    animated
  >
    <!-- 当前生效 -->
    <div class="lang-section">
      <div class="lang-section-header">
        <span class="lang-section-title">当前生效</span>
        <span v-if="langLoading" class="lang-section-hint">载入中…</span>
      </div>
      <div v-if="activePack" class="lang-current">
        <div class="lang-current-main">
          <span class="lang-current-name">{{ activePack.name }}</span>
          <span class="lang-current-meta">
            {{ activePack.keyCount.toLocaleString('zh-CN') }} 个键 · {{ formatBytes(activePack.bytes) }}
          </span>
        </div>
        <span class="lang-badge">生效中</span>
      </div>
      <p v-else class="lang-empty">
        尚未加载语言包。预览里的 <code>translate</code> 元素会原样显示键名（与游戏查不到键时的行为一致）。
      </p>
    </div>

    <!-- 已导入列表 -->
    <div class="lang-section">
      <div class="lang-section-header">
        <span class="lang-section-title">已导入（{{ langPackList.length }}）</span>
        <button class="lang-link" @click="langImportOpen = !langImportOpen">
          {{ langImportOpen ? '收起导入' : '导入语言包' }}
        </button>
      </div>

      <p v-if="langPackList.length === 0" class="lang-empty">
        还没有语言包。点右上角「导入语言包」，选择游戏资源包里的 <code>texts/zh_CN.lang</code> 即可。
      </p>

      <div v-else class="lang-list">
        <div
          v-for="p in langPackList" :key="p.id"
          class="lang-item" :class="{ 'lang-item--active': p.id === activePackId }"
        >
          <template v-if="langRenamingId === p.id">
            <input
              v-model="langRenamingName"
              type="text" class="lang-input"
              @keydown.enter="confirmRename"
              @keydown.esc="cancelRename"
            />
            <div class="lang-actions">
              <button class="lang-link" @click="cancelRename">取消</button>
              <button class="lang-link lang-link--strong" @click="confirmRename">保存</button>
            </div>
          </template>

          <template v-else>
            <div class="lang-item-main">
              <span class="lang-item-name">{{ p.name }}</span>
              <span class="lang-item-meta">
                {{ p.keyCount.toLocaleString('zh-CN') }} 个键 · {{ formatBytes(p.bytes) }}
                · {{ sourceLabel[p.source] || p.source }} · {{ formatDate(p.importedAt) }}
              </span>
            </div>
            <div class="lang-actions">
              <span v-if="p.id === activePackId" class="lang-badge">生效中</span>
              <button
                v-else class="lang-link lang-link--strong"
                :disabled="langLoading" @click="doActivate(p.id)"
              >设为当前</button>
              <button class="lang-icon-btn" title="重命名" @click="startRename(p.id)">
                <NIcon :component="Edit24Filled" :size="14" />
              </button>
              <button
                class="lang-icon-btn"
                :class="{ 'lang-icon-btn--danger': langDeleteConfirmId === p.id }"
                :title="langDeleteConfirmId === p.id ? '再次点击确认删除' : '删除'"
                @click="doDelete(p.id)"
              >
                <NIcon :component="Delete24Regular" :size="14" />
              </button>
            </div>
          </template>
        </div>
      </div>

      <p v-if="langStorageFallback" class="lang-note">
        当前浏览器不支持 IndexedDB，语言包已降级存到 localStorage，容量有限。
      </p>
    </div>

    <!-- 导入区 -->
    <div v-if="langImportOpen" class="lang-section">
      <div class="lang-section-header">
        <span class="lang-section-title lang-section-title--strong">导入</span>
      </div>

      <div class="lang-field">
        <label class="lang-label">名称</label>
        <input v-model="langImportName" type="text" class="lang-input" placeholder="不填则自动命名" />
      </div>

      <div class="lang-field">
        <label class="lang-label">来源</label>
        <div class="lang-source-row">
          <button
            class="app-btn app-btn--fill app-btn--sm"
            :disabled="langImporting"
            @click="doImport"
          >
            {{ langImporting ? '导入中…' : '导入并启用' }}
          </button>
          <button class="app-btn app-btn--outline app-btn--sm" @click="pickFile">
            选择文件
          </button>
        </div>
        <div v-if="langImportFileName" class="lang-file-line">
          <span class="lang-file-chip">
            {{ langImportFileName }}
            <button class="lang-file-remove" title="移除" @click="clearImportFile">×</button>
          </span>
        </div>
      </div>

      <div class="lang-field">
        <label class="lang-label">或直接粘贴</label>
        <textarea
          v-model="langImportText"
          class="lang-textarea"
          spellcheck="false"
          :disabled="!!langImportFileName"
          placeholder="key=value 形式的 .lang 内容，或 {&quot;键&quot;:&quot;值&quot;} 的 JSON"
        />
      </div>

      <p v-if="langImportError" class="lang-error">{{ langImportError }}</p>
    </div>

    <template #footer>
      <div class="app-modal-actions">
        <span class="lang-footer-hint">语言数据全部保存在本地浏览器，不会上传</span>
        <button class="app-btn app-btn--fill" @click="closeLangModal">关闭</button>
      </div>
    </template>
  </AppModal>
</template>

<style scoped>
.lang-section { margin-bottom: 18px; }
.lang-section:last-child { margin-bottom: 0; }
.lang-section-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px;
}
.lang-section-title {
  font-size: 11px; font-weight: 600; color: var(--subtle-foreground);
  text-transform: uppercase; letter-spacing: 0.5px;
  transition: color 0.4s ease;
}
.lang-section-title--strong {
  font-size: 13px;
  color: var(--foreground);
}
.lang-section-hint { font-size: 10px; color: var(--subtle-foreground); transition: color 0.4s ease; }
.lang-empty {
  margin: 0; padding: 10px 12px;
  font-size: 12px; line-height: 1.6; color: var(--muted-foreground);
  background: var(--muted); border-radius: var(--radius-md);
  transition: color 0.4s ease, background-color 0.4s ease;
}
.lang-empty code {
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: 11px; padding: 1px 4px; border-radius: var(--radius-xs);
  background: var(--card); color: var(--foreground);
}
.lang-note { margin: 8px 0 0; font-size: 11px; color: var(--subtle-foreground); transition: color 0.4s ease; }

.lang-current {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 10px 12px;
  background: var(--muted); border: 1px solid var(--border); border-radius: var(--radius-md);
  transition: background-color 0.4s ease, border-color 0.4s ease;
}
.lang-current-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.lang-current-name {
  font-size: 13px; font-weight: 600; color: var(--foreground);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  transition: color 0.4s ease;
}
.lang-current-meta { font-size: 10px; color: var(--subtle-foreground); transition: color 0.4s ease; }

.lang-list { display: flex; flex-direction: column; gap: 6px; }
.lang-item {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 8px 10px;
  background: var(--muted); border: 1px solid var(--border); border-radius: var(--radius-md);
  transition: background-color 0.4s ease, border-color 0.4s ease;
}
.lang-item--active { border-color: var(--muted-foreground); }
.lang-item-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.lang-item-name {
  font-size: 13px; color: var(--foreground);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  transition: color 0.4s ease;
}
.lang-item-meta { font-size: 10px; color: var(--subtle-foreground); transition: color 0.4s ease; }
.lang-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }

.lang-badge {
  font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: var(--radius-xs);
  color: var(--muted-foreground); background: var(--card);
  border: 1px solid var(--border);
  transition: color 0.4s ease, background-color 0.4s ease, border-color 0.4s ease;
}

.lang-link {
  border: none; background: transparent; cursor: pointer;
  font-size: 11px; font-family: inherit; padding: 2px 4px; border-radius: var(--radius-xs);
  color: var(--muted-foreground);
  transition: color 0.15s ease, background-color 0.15s ease;
}
.lang-link:hover { background: var(--card); color: var(--foreground); }
.lang-link:disabled { opacity: 0.5; cursor: default; }
.lang-link--strong { color: var(--foreground); font-weight: 600; }

.lang-icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; padding: 0;
  border: none; border-radius: var(--radius-sm); background: transparent;
  color: var(--muted-foreground); cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease;
}
.lang-icon-btn:hover { background: var(--card); color: var(--foreground); }
/* 二次点击确认删除：红色态由全局 .confirm-destructive 提供 */
.lang-icon-btn--danger,
.lang-icon-btn--danger:hover {
  background: var(--destructive);
  color: var(--destructive-foreground);
}

.lang-field { margin-bottom: 10px; }
.lang-label {
  display: block; margin-bottom: 4px;
  font-size: 11px; font-weight: 600; color: var(--subtle-foreground);
  text-transform: uppercase; letter-spacing: 0.5px;
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

.lang-source-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.lang-file-line { margin-top: 8px; }
.lang-file-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 8px; border-radius: var(--radius-sm);
  font-size: 11px; color: var(--muted-foreground);
  background: var(--muted); border: 1px solid var(--border);
  transition: color 0.4s ease, background-color 0.4s ease, border-color 0.4s ease;
}
.lang-file-remove {
  border: none; background: transparent; cursor: pointer;
  font-size: 14px; line-height: 1; padding: 0;
  color: var(--subtle-foreground);
  transition: color 0.15s ease;
}
.lang-file-remove:hover { color: var(--foreground); }

.lang-textarea {
  width: 100%; min-height: 120px;
  padding: 8px 12px;
  border: 1px solid var(--border); border-radius: var(--radius-md);
  background: var(--muted); color: var(--foreground);
  font-size: 12px; resize: vertical;
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  outline: none; box-sizing: border-box;
  transition: border-color 0.3s ease, background-color 0.4s ease, color 0.4s ease;
}
.lang-textarea:focus { border-color: var(--muted-foreground); }
.lang-textarea:disabled { opacity: 0.5; cursor: not-allowed; }

.lang-error {
  margin: 0 0 10px; padding: 8px 12px;
  background: var(--muted); border: 1px solid var(--border);
  border-radius: var(--radius-sm); font-size: 12px; color: var(--muted-foreground);
  /* JSON 报错是「诊断 + 位置」两行，靠换行断句 */
  white-space: pre-line; word-break: break-all;
  transition: background-color 0.4s ease, border-color 0.4s ease, color 0.4s ease;
}

.lang-footer-hint { font-size: 11px; color: var(--subtle-foreground); transition: color 0.4s ease; }

</style>

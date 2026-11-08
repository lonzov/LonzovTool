<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NCascader, NForm, NFormItem, NIcon, NInput, NSwitch, useMessage } from 'naive-ui'
import {
  Add24Regular,
  Apps24Regular,
  ArrowClockwise24Regular,
  ArrowUpload24Regular,
  Delete24Regular,
  Edit24Regular,
  EyeOff24Regular,
  Eye24Regular,
  Grid24Regular,
  List24Regular,
  ReOrderDotsVertical16Regular,
} from '@vicons/fluent'
import { createConsoleSortable } from '../sortable.js'
import AppButton from '../../components/ui/AppButton.vue'
import AppModal from '../../components/ui/AppModal.vue'
import { submitOnEnter } from '../enterSubmit.js'
import ToolCard from '../../components/ToolCard.vue'
import ToolLogo from '../../components/ToolLogo.vue'
import ConsolePanel from '../components/ConsolePanel.vue'
import { getCategoryIcon } from '../../config/categoryIcons.js'
import { confirmDialog } from '../../composables/useConfirm.js'
import { consoleFetch } from '../consoleRequest.js'
import { useSensitiveTrust } from '../useSensitiveTrust.js'
import { prepareIcon } from '../../utils/iconUpload.js'

const { ensureTrust } = useSensitiveTrust()

const CARDS_URL = '/api/v1/console/cards'

const route = useRoute()
const router = useRouter()
const message = useMessage()

const cards = ref([])
const categories = ref([])
const loading = ref(false)
const errorText = ref('')
const keyword = ref('')
const categoryFilter = ref(null)
const pendingSlug = ref('')
/* 列表 / 模拟布局：后者用首页同一个卡片组件渲染，点击进入编辑而非跳转 */
const viewMode = ref('list')

const titleError = ref('')
const linkError = ref('')
const categoryError = ref('')

const editor = ref({ show: false, editing: false, slug: '', error: '' })
const form = ref({
  title: '',
  description: '',
  logo: '',
  link: '',
  category_id: null,
  hidden: false,
  openInNewTab: false,
})
const editorSaving = ref(false)

/* 图标上传：点击 / 拖拽 / 粘贴三条入口共用一套校验与压缩（utils/iconUpload） */
const logoInput = ref(null)
const logoDragging = ref(false)
const logoUploading = ref(false)
/* 图标接口以 slug 寻址：新建时还没有 slug，编辑时也不该选图就落盘。
   两种情况都先把压缩好的文件留在内存，保存时随其他字段一起上传。 */
const pendingLogo = ref(null)
const pendingLogoPreview = ref('')

const logoPreview = computed(() => pendingLogoPreview.value || form.value.logo)

function setPendingLogo(file) {
  if (pendingLogoPreview.value) URL.revokeObjectURL(pendingLogoPreview.value)
  pendingLogo.value = file
  pendingLogoPreview.value = file ? URL.createObjectURL(file) : ''
}

async function uploadLogo(slug, file) {
  const body = new FormData()
  body.append('icon_file', file)
  return consoleFetch(`${CARDS_URL}/${slug}/logo`, { method: 'POST', body })
}

async function handleLogoFile(file) {
  if (!file) return
  editor.value.error = ''
  logoUploading.value = true

  const { file: prepared, error } = await prepareIcon(file)
  if (error || !prepared) {
    logoUploading.value = false
    editor.value.error = error
    return
  }

  setPendingLogo(prepared)
  logoUploading.value = false
  message.success('图标已就绪，保存卡片后自动上传')
}

function pickLogo() {
  logoInput.value?.click()
}

function onLogoPicked(event) {
  const [file] = event.target.files || []
  event.target.value = ''
  handleLogoFile(file)
}

function onLogoDrop(event) {
  logoDragging.value = false
  const [file] = event.dataTransfer?.files || []
  handleLogoFile(file)
}

/* 粘贴：仅在编辑器打开时接管，避免影响页面其他输入框 */
function onPaste(event) {
  if (!editor.value.show) return
  const item = [...(event.clipboardData?.items || [])].find((entry) => entry.type.startsWith('image/'))
  if (!item) return
  event.preventDefault()
  handleLogoFile(item.getAsFile())
}

onMounted(() => {
  load()
  window.addEventListener('paste', onPaste)
})

onBeforeUnmount(() => {
  window.removeEventListener('paste', onPaste)
  destroySortables()
  setPendingLogo(null)
})

const categoryCascaderOptions = computed(() => {
  const groups = new Map()
  const standalone = []
  for (const item of categories.value) {
    const option = { label: item.name, value: item.id }
    if (!item.parent_menu_id) {
      standalone.push(option)
      continue
    }
    if (!groups.has(item.parent_menu_id)) {
      groups.set(item.parent_menu_id, {
        label: item.parent_menu_name || item.parent_menu_id,
        value: `parent-${item.parent_menu_id}`,
        children: [],
      })
    }
    groups.get(item.parent_menu_id).children.push(option)
  }
  return [...groups.values(), ...standalone]
})

const visibleCards = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  return cards.value.filter((card) => {
    if (categoryFilter.value && card.category_id !== categoryFilter.value) return false
    if (!text) return true
    return (
      card.title.toLowerCase().includes(text) ||
      card.link.toLowerCase().includes(text) ||
      card.slug.toLowerCase().includes(text)
    )
  })
})

const hiddenCount = computed(() => cards.value.filter((card) => card.hidden).length)
const summaryText = computed(
  () => `${visibleCards.value.length} 张 / 共 ${cards.value.length} 张，隐藏 ${hiddenCount.value} 张`,
)

/* ===== 分类内拖动排序 =====
   两种视图都用 Sortable：列表是一个容器，模拟布局是每个分类一段网格。
   顺序只认后端：拖动结束先把 DOM 挪回去，再由数据驱动重排。 */
const listEl = ref(null)
const gridEls = new Map()
let sortables = []
const reordering = ref(false)

function setGridRef(categoryId, el) {
  if (el) gridEls.set(categoryId, el)
  else gridEls.delete(categoryId)
}

function destroySortables() {
  sortables.forEach((instance) => instance.destroy())
  sortables = []
}

function setupSortables() {
  destroySortables()
  nextTick(() => {
    if (viewMode.value === 'list') {
      if (!listEl.value) return
      sortables.push(
        createConsoleSortable(listEl.value, {
          handle: '.drag-handle',
          animation: 150,
          ghostClass: 'card-row--ghost',
          chosenClass: 'card-row--chosen',
          onEnd: onListDragEnd,
        }),
      )
      return
    }
    for (const [categoryId, el] of gridEls) {
      if (!el) continue
      sortables.push(
        createConsoleSortable(el, {
          handle: '.drag-handle',
          animation: 150,
          ghostClass: 'card-grid__item--ghost',
          chosenClass: 'card-grid__item--chosen',
          onEnd: (event) => onGridDragEnd(categoryId, event),
        }),
      )
    }
  })
}

function setDragDisabled(disabled) {
  sortables.forEach((instance) => instance.option('disabled', disabled))
}

function slugsIn(container) {
  return [...container.querySelectorAll('[data-card-slug]')].map((el) => el.dataset.cardSlug)
}

/** Sortable 直接改了 DOM，Vue 的虚拟 DOM 并不知道：先原样挪回去，顺序只由数据驱动 */
function revertDomMove(event) {
  const { item, from, oldIndex } = event
  from.removeChild(item)
  from.insertBefore(item, from.children[oldIndex] || null)
}

function categoryOf(slug) {
  return cards.value.find((card) => card.slug === slug)?.category_id
}

function visibleSlugsOf(categoryId) {
  return visibleCards.value
    .filter((card) => card.category_id === categoryId)
    .map((card) => card.slug)
}

function visibleOrderChanged(before, after) {
  return before.join() !== after.join()
}

function groupByCategory(slugs) {
  const grouped = new Map()
  for (const slug of slugs) {
    const categoryId = categoryOf(slug)
    if (categoryId === undefined) continue
    if (!grouped.has(categoryId)) grouped.set(categoryId, [])
    grouped.get(categoryId).push(slug)
  }
  return grouped
}

/** 列表是跨分类的平铺：先确认拖动没有跨出分类，再找哪个分类内部顺序变了 */
function changedCategory(beforeSlugs, afterSlugs) {
  const before = groupByCategory(beforeSlugs)
  const after = groupByCategory(afterSlugs)
  for (const [categoryId, slugs] of before) {
    if (visibleOrderChanged(slugs, after.get(categoryId) || [])) return categoryId
  }
  return null
}

async function onListDragEnd(event) {
  suppressCardClick = true
  setTimeout(() => (suppressCardClick = false), 250)
  const container = listEl.value
  const afterSlugs = slugsIn(container)
  revertDomMove(event)

  const beforeSlugs = visibleCards.value.map((card) => card.slug)
  if (!visibleOrderChanged(beforeSlugs, afterSlugs)) return

  // 卡片只能在自己的分类内调整：跨分类顺序会打乱分类段
  const beforeKinds = beforeSlugs.map((slug) => categoryOf(slug)).filter((id) => id !== undefined)
  const afterKinds = afterSlugs.map((slug) => categoryOf(slug)).filter((id) => id !== undefined)
  if (beforeKinds.join() !== afterKinds.join()) {
    message.warning('卡片只能在所属分类内排序')
    return
  }

  const categoryId = changedCategory(beforeSlugs, afterSlugs)
  if (categoryId === undefined || categoryId === null) return
  const movedSlugs = afterSlugs.filter((slug) => categoryOf(slug) === categoryId)
  await persistOrder(categoryId, movedSlugs)
}

async function onGridDragEnd(categoryId, event) {
  suppressCardClick = true
  setTimeout(() => (suppressCardClick = false), 250)
  const container = gridEls.get(categoryId)
  if (!container) return
  const afterSlugs = slugsIn(container)
  revertDomMove(event)

  if (!visibleOrderChanged(visibleSlugsOf(categoryId), afterSlugs)) return
  await persistOrder(categoryId, afterSlugs)
}

/**
 * 把「可见卡片的新顺序」合并回该分类的完整顺序：隐藏或未命中的卡片保持原位，
 * 这样接口总能拿到当前全集，并发校验也有意义。
 */
function mergedCategoryOrder(categoryId, visibleSlugs) {
  const full = cards.value
    .filter((card) => card.category_id === categoryId)
    .map((card) => card.slug)
  const moved = new Set(visibleSlugs)
  let cursor = 0
  return full.map((slug) => (moved.has(slug) ? visibleSlugs[cursor++] : slug))
}

async function persistOrder(categoryId, visibleSlugs) {
  if (!(await ensureTrust())) return
  const slugs = mergedCategoryOrder(categoryId, visibleSlugs)
  const rank = new Map(slugs.map((slug, index) => [slug, index]))
  cards.value = [...cards.value].sort((a, b) => {
    if (a.category_id !== b.category_id) return 0
    return (rank.get(a.slug) ?? 0) - (rank.get(b.slug) ?? 0)
  })

  reordering.value = true
  setDragDisabled(true)
  try {
    await consoleFetch(`${CARDS_URL}/reorder`, {
      method: 'POST',
      body: JSON.stringify({ category_id: categoryId, slugs }),
    })
    message.success('顺序已保存')
  } catch (e) {
    if (e?.code === 'unauthorized') {
      router.replace({ path: '/console/login', query: { redirect: route.fullPath } })
      return
    }
    message.error(e?.message || '顺序保存失败，已恢复原顺序')
  } finally {
    reordering.value = false
    await load()
  }
}

// 拖动结束后浏览器仍会补一个 click：短时间屏蔽，避免刚放下就弹出编辑器
let suppressCardClick = false

function onCardClick(event, card) {
  if (suppressCardClick) return
  if (event.target.closest?.('.drag-handle')) return
  openEdit(card)
}

/* 模拟布局的分组：完全照首页 ToolGrid——按**分类实体**分组、每个分类一段网格。
   注意不能按分类名分组：同一个名字可能出现在不同父级菜单下（首页也是两段），
   按名字合并会把两组卡片揉成一段。排序沿用接口给定的顺序。 */
const cardGroups = computed(() => {
  const order = new Map(categories.value.map((item, index) => [item.id, index]))
  const byId = new Map()

  for (const card of visibleCards.value) {
    let group = byId.get(card.category_id)
    if (!group) {
      const meta = categories.value.find((item) => item.id === card.category_id)
      group = {
        id: card.category_id,
        name: meta?.name || card.category,
        icon: meta?.icon || '',
        cards: [],
      }
      byId.set(card.category_id, group)
    }
    group.cards.push(card)
  }

  return [...byId.values()].sort(
    (a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  )
})

function categoryIconName(group) {
  return getCategoryIcon(group.icon)
}

async function load() {
  loading.value = true
  errorText.value = ''
  try {
    const payload = await consoleFetch(CARDS_URL)
    cards.value = payload?.items || []
    categories.value = payload?.categories || []
  } catch (e) {
    if (e?.code === 'unauthorized') {
      router.replace({ path: '/console/login', query: { redirect: route.fullPath } })
      return
    }
    errorText.value = e?.message || '读取失败，请稍后重试'
  } finally {
    loading.value = false
    await nextTick()
    setupSortables()
  }
}

watch(viewMode, setupSortables)

function openCreate() {
  setPendingLogo(null)
  editor.value = { show: true, editing: false, slug: '', error: '' }
  form.value = {
    title: '',
    description: '',
    logo: '',
    link: '',
    category_id: categoryFilter.value || null,
    hidden: false,
    openInNewTab: false,
  }
}

function openEdit(card) {
  setPendingLogo(null)
  editor.value = { show: true, editing: true, slug: card.slug, error: '' }
  form.value = {
    title: card.title,
    description: card.description,
    logo: card.logo,
    link: card.link,
    category_id: card.category_id,
    hidden: card.hidden,
    openInNewTab: card.open_in_new_tab,
  }
}

async function save() {
  const payload = {
    title: form.value.title.trim(),
    description: form.value.description.trim(),
    logo: form.value.logo.trim(),
    link: form.value.link.trim(),
    category_id: form.value.category_id,
    hidden: form.value.hidden,
    open_in_new_tab: form.value.openInNewTab,
  }
  titleError.value = payload.title ? '' : '标题不能为空'
  linkError.value = payload.link ? '' : '链接不能为空'
  categoryError.value = payload.category_id ? '' : '请选择分类'
  if (titleError.value || linkError.value || categoryError.value) return
  if (!(await ensureTrust())) return

  editorSaving.value = true
  editor.value.error = ''
  try {
    if (editor.value.editing) {
      await consoleFetch(`${CARDS_URL}/${editor.value.slug}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      if (pendingLogo.value) {
        try {
          await uploadLogo(editor.value.slug, pendingLogo.value)
          setPendingLogo(null)
          message.success('已保存修改并更新图标')
        } catch {
          setPendingLogo(null)
          message.warning('已保存修改，但图标上传失败，请重新打开编辑上传')
        }
      } else {
        message.success('已保存修改')
      }
    } else {
      const created = await consoleFetch(CARDS_URL, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      // 建卡成功后再补传暂存的图标：上传接口以 slug 寻址，新建时还没有 slug
      if (pendingLogo.value && created?.slug) {
        try {
          await uploadLogo(created.slug, pendingLogo.value)
          message.success('卡片已创建并设置图标')
        } catch {
          message.warning('卡片已创建，但图标上传失败，请重新打开编辑上传')
        }
        setPendingLogo(null)
      } else {
        message.success('卡片已创建')
      }
    }
    editor.value.show = false
  } catch (e) {
    if (e?.code === 'unauthorized') {
      router.replace({ path: '/console/login', query: { redirect: route.fullPath } })
      return
    }
    message.error(e?.message || '保存失败，请稍后重试')
  } finally {
    editorSaving.value = false
    await load()
  }
}

async function toggleHidden(card) {
  if (!(await ensureTrust())) return
  pendingSlug.value = card.slug
  try {
    const updated = await consoleFetch(`${CARDS_URL}/${card.slug}`, {
      method: 'PATCH',
      body: JSON.stringify({ hidden: !card.hidden }),
    })
    Object.assign(card, updated)
    message.success(updated.hidden ? '已隐藏，公开接口不再返回' : '已恢复显示')
  } catch (e) {
    if (e?.code === 'unauthorized') {
      router.replace({ path: '/console/login', query: { redirect: route.fullPath } })
      return
    }
    message.error(e?.message || '操作失败，请稍后重试')
  } finally {
    pendingSlug.value = ''
  }
}

async function remove(card) {
  const confirmed = await confirmDialog({
    title: '删除卡片',
    message: `确定删除「${card.title}」吗？\n删除后站外嵌入标签 /embed/${card.slug} 会失效，且无法恢复。`,
    confirmText: '删除',
    danger: true,
  })
  if (!confirmed) return
  if (!(await ensureTrust())) return

  pendingSlug.value = card.slug
  try {
    await consoleFetch(`${CARDS_URL}/${card.slug}`, { method: 'DELETE' })
    message.success('已删除')
  } catch (e) {
    if (e?.code === 'unauthorized') {
      router.replace({ path: '/console/login', query: { redirect: route.fullPath } })
      return
    }
    message.error(e?.message || '删除失败，请稍后重试')
  } finally {
    pendingSlug.value = ''
    await load()
  }
}
</script>

<template>
  <div class="console-cards">
    <div class="cards-toolbar">
      <div class="toolbar-filters">
        <NInput v-model:value="keyword" clearable placeholder="搜索标题 / 链接 / slug" class="search-input" />
        <NCascader
          v-model:value="categoryFilter"
          :options="categoryCascaderOptions"
          placement="bottom-end"
          clearable
          placeholder="全部分类"
          class="category-select"
          :menu-props="{ class: 'card-category-menu' }"
        />
        <span class="summary-text">{{ summaryText }}</span>
      </div>
      <div class="toolbar-actions">
        <div class="view-switch">
          <button
            class="view-switch__btn"
            :class="{ 'view-switch__btn--on': viewMode === 'list' }"
            type="button"
            title="列表布局"
            @click="viewMode = 'list'"
          >
            <NIcon :component="List24Regular" :size="15" />
          </button>
          <button
            class="view-switch__btn"
            :class="{ 'view-switch__btn--on': viewMode === 'grid' }"
            type="button"
            title="模拟布局（与首页卡片一致）"
            @click="viewMode = 'grid'"
          >
            <NIcon :component="Grid24Regular" :size="15" />
          </button>
        </div>
        <AppButton
          variant="outline"
          size="sm"
          :icon="ArrowClockwise24Regular"
          :disabled="loading"
          @click="load"
        >
          刷新
        </AppButton>
        <AppButton variant="solid" size="sm" :icon="Add24Regular" @click="openCreate">
          新建卡片
        </AppButton>
      </div>
    </div>

    <p v-if="errorText" class="inline-hint inline-hint--error">{{ errorText }}</p>

    <ConsolePanel :icon="Apps24Regular" title="卡片列表">
      <p v-if="!visibleCards.length" class="inline-hint">
        {{ loading ? '读取中…' : '没有匹配的卡片' }}
      </p>

      <!-- 模拟布局：完全照首页卡片区——按分类分段，每段一个标题 + 网格；
           点击进编辑而不是跳转，隐藏卡整体降透明度并带角标 -->
      <div v-else-if="viewMode === 'grid'" class="card-groups">
        <section v-for="group in cardGroups" :key="group.id" class="card-group">
          <div class="card-group__head">
            <NIcon :component="categoryIconName(group)" :size="18" />
            <span class="card-group__name">{{ group.name }}</span>
            <span class="card-group__count">{{ group.cards.length }}</span>
          </div>
          <div :ref="(el) => setGridRef(group.id, el)" class="card-grid">
            <div
              v-for="card in group.cards"
              :key="card.slug"
              class="card-grid__item"
              :class="{ 'card-grid__item--hidden': card.hidden }"
              :data-card-slug="card.slug"
              @click.capture.stop.prevent="onCardClick($event, card)"
            >
              <span class="drag-handle card-grid__drag" title="拖动调整分类内顺序" aria-hidden="true">
                <NIcon :component="ReOrderDotsVertical16Regular" :size="14" />
              </span>
              <ToolCard
                :title="card.title"
                :description="card.description"
                :logo="card.logo"
                :link="card.link"
                :tool-id="card.slug"
                :open-in-new-tab="card.open_in_new_tab"
              />
              <span v-if="card.hidden" class="card-grid__badge">
                <NIcon :component="EyeOff24Regular" :size="11" />
                已隐藏
              </span>
            </div>
          </div>
        </section>
      </div>

      <div v-else class="card-table">
        <div class="card-row card-row--head">
          <span>卡片</span>
          <span>分类</span>
          <span>状态</span>
          <span class="col-actions">操作</span>
        </div>
        <div ref="listEl" class="card-table-body">
          <div
            v-for="card in visibleCards"
            :key="card.slug"
            class="card-row"
            :class="{ 'card-row--hidden': card.hidden }"
            :data-card-slug="card.slug"
          >
            <div class="cell-main">
              <span class="drag-handle" title="拖动调整分类内顺序" aria-hidden="true">
                <NIcon :component="ReOrderDotsVertical16Regular" :size="14" />
              </span>
              <ToolLogo :logo="card.logo" :alt="card.title" :size="32" />
              <div class="cell-text">
                <span class="cell-title">{{ card.title }}</span>
                <a class="cell-sub" :href="card.link" target="_blank" rel="noopener noreferrer">{{ card.link }}</a>
                <span class="cell-slug">{{ card.slug }}</span>
              </div>
            </div>
            <span class="cell-meta">{{ card.category }}</span>
            <span>
              <button
                class="state-pill"
                :class="card.hidden ? 'state-pill--hidden' : 'state-pill--visible'"
                type="button"
                :disabled="pendingSlug === card.slug"
                @click="toggleHidden(card)"
              >
                <NIcon :component="card.hidden ? EyeOff24Regular : Eye24Regular" :size="12" />
                {{ card.hidden ? '已隐藏' : '显示中' }}
              </button>
            </span>
            <span class="col-actions">
              <AppButton
                variant="outline"
                size="xs"
                icon-only
                label="编辑"
                :icon="Edit24Regular"
                @click="openEdit(card)"
              />
              <AppButton
                variant="outline"
                tone="danger"
                size="xs"
                icon-only
                label="删除"
                :icon="Delete24Regular"
                :disabled="pendingSlug === card.slug"
                @click="remove(card)"
              />
            </span>
          </div>
        </div>
      </div>
    </ConsolePanel>

    <AppModal
      v-model:show="editor.show"
      :title="editor.editing ? '编辑卡片' : '新建卡片'"
      :max-width="560"
      :auto-focus="false"
      :actions="[
        { text: '取消', variant: 'outline', onClick: () => (editor.show = false) },
        { text: editorSaving ? '保存中…' : '保存', variant: 'fill', disabled: editorSaving, onClick: save },
      ]"
      content-scrollable
    >
      <NForm label-placement="top" @keydown.enter="submitOnEnter($event, save)">
        <div class="editor-grid">
          <NFormItem
            class="field--wide"
            label="标题"
            required
            :validation-status="titleError ? 'error' : undefined"
            :feedback="titleError || undefined"
          >
            <NInput v-model:value="form.title" maxlength="128" show-count />
          </NFormItem>
          <NFormItem class="field--wide" label="简介">
            <NInput v-model:value="form.description" maxlength="256" show-count />
          </NFormItem>
          <NFormItem
            class="field--wide"
            label="链接"
            required
            :validation-status="linkError ? 'error' : undefined"
            :feedback="linkError || undefined"
          >
            <NInput v-model:value="form.link" maxlength="512" placeholder="https://example.com" />
          </NFormItem>
          <NFormItem class="field--wide" label="图标">
            <div class="logo-field">
              <div class="logo-preview">
                <ToolLogo :logo="logoPreview" :alt="form.title" :size="56" />
              </div>
              <div class="logo-controls">
                <div
                  class="logo-drop"
                  :class="{ 'logo-drop--active': logoDragging, 'logo-drop--busy': logoUploading }"
                  role="button"
                  tabindex="0"
                  @click="pickLogo"
                  @keydown.enter.prevent="pickLogo"
                  @keydown.space.prevent="pickLogo"
                  @dragover.prevent="logoDragging = true"
                  @dragleave.prevent="logoDragging = false"
                  @drop.prevent="onLogoDrop"
                >
                  <NIcon :component="ArrowUpload24Regular" :size="16" />
                  <span>{{ logoUploading ? '处理中…' : '点击选择、拖入或粘贴图片（保存后自动上传）' }}</span>
                </div>
                <input
                  ref="logoInput"
                  class="logo-input"
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.ico"
                  @change="onLogoPicked"
                />
                <NInput
                  v-model:value="form.logo"
                  maxlength="512"
                  size="small"
                  placeholder="或直接填图片地址 / 图标名，如 ArrowTrending20Filled"
                />
                <span class="field-hint">
                  上传会自动压成 WebP（高 128、宽等比），保存为 /uploads/logos/&lt;slug&gt;.webp
                </span>
              </div>
            </div>
          </NFormItem>
          <NFormItem
            class="field--wide"
            label="分类"
            required
            :validation-status="categoryError ? 'error' : undefined"
            :feedback="categoryError || undefined"
          >
            <NCascader
              v-model:value="form.category_id"
              :options="categoryCascaderOptions"
              placement="bottom-end"
              placeholder="选择分类"
              :menu-props="{ class: 'card-category-menu' }"
            />
          </NFormItem>
          <div class="field--wide settings-block">
            <div class="setting-row">
              <div class="setting-info">
                <span class="setting-title">在公开列表中隐藏</span>
                <span class="setting-desc">隐藏后首页与接口都不再返回，控制台仍可编辑</span>
              </div>
              <NSwitch v-model:value="form.hidden" />
            </div>
            <div class="setting-row">
              <div class="setting-info">
                <span class="setting-title">始终在新标签页打开</span>
                <span class="setting-desc">站内链接也强制新标签页，适合依赖外部环境的工具</span>
              </div>
              <NSwitch v-model:value="form.openInNewTab" />
            </div>
          </div>
        </div>
        <p v-if="editor.error" class="editor-error">{{ editor.error }}</p>
        <p v-if="editor.editing" class="editor-hint">
          slug 建立后不可修改：站外嵌入 /embed/{{ editor.slug }} 依赖它。
        </p>
      </NForm>
    </AppModal>
  </div>
</template>

<style scoped>
.console-cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
  min-width: 0;
}

.cards-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-filters {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.search-input {
  width: 220px;
}

.category-select {
  width: 160px;
}

.summary-text {
  color: var(--subtle-foreground);
  font-size: 0.76rem;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-left: auto;
}

.view-switch {
  display: inline-flex;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  corner-shape: round;
  gap: 2px;
}

.view-switch__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: var(--radius-full);
  corner-shape: round;
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
  transition: color 0.2s ease, background-color 0.2s ease;
}

.view-switch__btn:hover {
  color: var(--foreground);
}

.view-switch__btn--on {
  color: var(--foreground);
  background: var(--accent);
}

/* 模拟布局：与首页 ToolGrid 的结构与参数一致（分类标题 24px 上间距、网格 200px 起） */
.card-groups {
  display: flex;
  flex-direction: column;
}

.card-group + .card-group {
  margin-top: 8px;
}

.card-group__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 24px 0 12px;
  color: var(--muted-foreground);
  transition: color 0.4s ease;
}

.card-group__name {
  color: var(--muted-foreground);
  font-size: 14px;
  font-weight: 600;
}

.card-group__count {
  padding: 0 6px;
  border-radius: var(--radius-full);
  corner-shape: round;
  background: var(--accent);
  color: var(--subtle-foreground);
  font-size: 0.68rem;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.card-grid__item {
  display: flex;
  position: relative;
  min-width: 0;
  cursor: pointer;
}

/* 与首页一致：同一行的卡片拉齐到该行最高的一张 */
.card-grid__item :deep(.tool-card) {
  width: 100%;
  height: 100%;
}

.card-grid__drag {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 3;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--card) 82%, transparent);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.card-grid__item:hover .card-grid__drag {
  opacity: 1;
}

@media (hover: none) {
  .card-grid__drag {
    opacity: 0.9;
  }
}

.card-grid__item--ghost {
  opacity: 0.4;
}

.card-grid__item--chosen {
  z-index: 2;
  box-shadow: var(--shadow-sm);
}

.card-grid__item--hidden {
  opacity: 0.55;
}

.card-grid__badge {
  position: absolute;
  top: 8px;
  right: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  corner-shape: round;
  background: var(--card);
  color: var(--muted-foreground);
  font-size: 0.68rem;
  box-shadow: var(--shadow-sm);
}

.card-table {
  display: flex;
  flex-direction: column;
}

.card-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 130px 110px 88px;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}

.card-row:last-child {
  border-bottom: none;
}

.card-row--head {
  color: var(--subtle-foreground);
  font-size: 0.74rem;
  padding-bottom: 8px;
}

.card-row--hidden {
  opacity: 0.62;
}

.card-table-body {
  display: flex;
  flex-direction: column;
}

.drag-handle {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  color: var(--subtle-foreground);
  cursor: grab;
}

.drag-handle:active {
  cursor: grabbing;
}

.card-row--ghost {
  opacity: 0.4;
  background: var(--accent);
}

.card-row--chosen {
  background: var(--muted);
}

.cell-main {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.cell-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.cell-title {
  color: var(--foreground);
  font-size: 0.86rem;
  font-weight: 500;
}

.cell-sub {
  overflow: hidden;
  color: var(--muted-foreground);
  font-size: 0.74rem;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-sub:hover {
  color: var(--foreground);
}

.cell-slug {
  color: var(--subtle-foreground);
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  font-size: 0.68rem;
}

.cell-meta {
  color: var(--muted-foreground);
  font-size: 0.78rem;
}

.state-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 10px;
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  corner-shape: round;
  background: transparent;
  font-family: inherit;
  font-size: 0.74rem;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
}

.state-pill--visible {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 12%, transparent);
}

.state-pill--hidden {
  color: var(--muted-foreground);
  background: var(--accent);
}

.state-pill:hover {
  border-color: var(--border-strong);
}

.col-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: flex-end;
}

.inline-hint {
  margin: 0;
  padding: 8px 0;
  color: var(--subtle-foreground);
  font-size: 0.8rem;
}

.inline-hint--error {
  color: var(--destructive);
}

.editor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 14px;
}

.field--wide {
  grid-column: 1 / -1;
}

.editor-switches {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.logo-field {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  width: 100%;
}

.logo-preview {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--muted);
}

.logo-controls {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.logo-drop {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--muted);
  color: var(--muted-foreground);
  font-size: 0.78rem;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
}

.logo-drop:hover {
  color: var(--foreground);
  border-color: var(--ring);
}

.logo-drop--active {
  color: var(--foreground);
  border-color: var(--ring);
  background: var(--accent);
}

.logo-drop--busy {
  opacity: 0.6;
  cursor: progress;
}

.logo-input {
  display: none;
}

.field-hint {
  color: var(--subtle-foreground);
  font-size: 0.72rem;
  line-height: 1.5;
}

/* 开关类配置按设置行处理：左侧标题 + 说明，右侧开关。与表单输入项分属两种信息密度，
   混在同一网格里会让人分不清"哪一列该填什么" */
.settings-block {
  display: flex;
  flex-direction: column;
  margin-bottom: 4px;
  border-top: 1px solid var(--border);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
}

.setting-row + .setting-row {
  border-top: 1px solid var(--border);
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.setting-title {
  color: var(--foreground);
  font-size: 0.84rem;
  transition: color 0.4s ease;
}

.setting-desc {
  color: var(--subtle-foreground);
  font-size: 0.72rem;
  line-height: 1.5;
}

.editor-error {
  margin: 0;
  color: var(--destructive);
  font-size: 0.8rem;
}

.editor-hint {
  margin: 6px 0 0;
  color: var(--subtle-foreground);
  font-size: 0.72rem;
}

@media (width <= 720px) {
  /* 表头在窄屏没有意义：每行自带状态与操作，两列排不下时标签会自己错行 */
  .card-row--head {
    display: none;
  }

  .card-row {
    grid-template-columns: minmax(0, 1fr) auto;
    row-gap: 6px;
  }

  /* 卡片信息独占一行，状态与操作落到下一行，操作贴右 */
  .card-row > .cell-main {
    grid-column: 1 / -1;
  }

  .card-row > .cell-meta {
    display: none;
  }
}

/* 窄屏分两行：第一行搜索 + 分类筛选，第二行按钮组。
   按钮各自带文字即可（独占一行后宽度够），分类下拉收到 96px，
   菜单另设 `min-width: 0` 按内容自适应，选项不会被省略号截断 */
@media (width <= 640px) {
  .cards-toolbar {
    flex-wrap: wrap;
    row-gap: 8px;
  }

  .toolbar-filters {
    flex: 1 1 100%;
    flex-wrap: nowrap;
    gap: 8px;
    min-width: 0;
  }

  .search-input {
    flex: 1 1 auto;
    width: auto;
    min-width: 0;
  }

  .category-select {
    flex: 0 0 96px;
    width: 96px;
  }

  .summary-text {
    display: none;
  }

  .toolbar-actions {
    flex: 1 1 100%;
    justify-content: flex-start;
    gap: 8px;
  }

  .toolbar-actions .view-switch {
    margin-right: auto;
  }

  .toolbar-actions .app-btn {
    padding: 0 12px;
  }
}
</style>

<style>
/* 下拉菜单被 teleport 到 body，只能走非 scoped 样式。
   分类名不长，单列 130px 足够；两列加起来约 260px，避免整块菜单空出大片区域 */
.card-category-menu {
  width: auto !important;
  max-width: calc(100vw - 32px);
  min-width: 0 !important;
}

.card-category-menu .n-cascader-submenu {
  width: 130px !important;
  min-width: 130px !important;
}

.card-category-menu .n-cascader-option {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

<template>
  <div class="selector-tool">
    <PageHeader />
    <Toolbar />
    <CodeView />
    <HasitemModal />
    <HaspermissionModal />
    <CoordinateCalcModal />
    <ImportModal />
  </div>
</template>

<script setup>
defineOptions({ name: 'SelectorEditor' })

import { useSelectorEditor } from './composables/useSelectorEditor.js'
import PageHeader from './components/PageHeader.vue'
import Toolbar from './components/Toolbar.vue'
import CodeView from './components/CodeView.vue'
import HasitemModal from './components/HasitemModal.vue'
import HaspermissionModal from './components/HaspermissionModal.vue'
import CoordinateCalcModal from './components/CoordinateCalcModal.vue'
import ImportModal from './components/ImportModal.vue'

defineProps({
  tabPath: { type: String, default: '' },
})

useSelectorEditor()

</script>

<style scoped>
.selector-tool {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
</style>

<style>
/* 下拉菜单描边 */
.n-select-menu {
  border: 1px solid var(--border-color) !important;
}

/* ========== NDropdown 菜单样式（对齐搜索栏） ========== */

.n-dropdown-option-body,
.n-dropdown-option-body__content,
.n-dropdown-group-header {
  user-select: none !important;
  -webkit-user-select: none !important;
  -moz-user-select: none !important;
  -ms-user-select: none !important;
}

.n-dropdown-menu {
  border: 1px solid var(--border-color) !important;
  border-radius: 6px !important;
}

[data-theme='light'] .n-dropdown-menu,
html:not([data-theme='dark']) .n-dropdown-menu {
  box-shadow:
    0 3px 6px -4px rgba(0, 0, 0, 0.16),
    0 6px 16px 0 rgba(0, 0, 0, 0.12),
    0 9px 28px 8px rgba(0, 0, 0, 0.08) !important;
}

[data-theme='dark'] .n-dropdown-menu {
  box-shadow:
    0 3px 6px -4px rgba(0, 0, 0, 0.48),
    0 6px 12px 0 rgba(0, 0, 0, 0.36),
    0 9px 18px 8px rgba(0, 0, 0, 0.24) !important;
  --n-option-color-hover: #2A2A2A;
}

</style>

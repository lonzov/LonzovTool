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
.n-dropdown-option-body,
.n-dropdown-option-body__content,
.n-dropdown-group-header {
  user-select: none !important;
  -webkit-user-select: none !important;
  -moz-user-select: none !important;
  -ms-user-select: none !important;
}
</style>

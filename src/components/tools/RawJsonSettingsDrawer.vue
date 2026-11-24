<script setup>
import { RouterLink } from 'vue-router'
import { NDrawer, NDrawerContent } from 'naive-ui'
import { BookOpen48Regular, Delete24Regular } from '@vicons/fluent'
import AppButton from '../ui/AppButton.vue'
import RawJsonConfigCard from './RawJsonConfigCard.vue'
import { clearAll, loadExample } from '../../composables/useRawJsonEditor.js'

defineProps({
  show: { type: Boolean, default: false },
})
const emit = defineEmits(['update:show'])
</script>

<template>
  <NDrawer
    class="rj-settings-drawer"
    :show="show"
    placement="right"
    width="380"
    :style="{
      background: 'var(--background)',
      border: '1px solid var(--border)',
      boxShadow: 'var(--shadow-drawer)',
      borderTopLeftRadius: 'var(--radius-2xl)',
      borderBottomLeftRadius: 'var(--radius-2xl)',
      overflow: 'hidden',
    }"
    @update:show="emit('update:show', $event)"
  >
    <NDrawerContent :native-scrollbar="false" closable title="设置">
      <div class="rj-drawer-body">
        <section class="rj-section">
          <h2 class="rj-section-title">指令配置</h2>
          <RawJsonConfigCard flat />
        </section>

        <div class="rj-divider" aria-hidden="true" />

        <section class="rj-section">
          <h2 class="rj-section-title">数据</h2>
          <div class="rj-data-actions">
            <AppButton
              variant="outline"
              shape="rect"
              size="sm"
              block
              :icon="BookOpen48Regular"
              @click="loadExample"
            >
              载入示例
            </AppButton>
            <AppButton
              variant="outline"
              shape="rect"
              size="sm"
              block
              class="rj-danger-hover"
              :icon="Delete24Regular"
              @click="clearAll"
            >
              清空元素
            </AppButton>
          </div>
        </section>

        <p class="rj-about">
          可视化构建 rawtext JSON。编辑器参考矩阵方块 T显编译器，授权与许可声明见
          <RouterLink to="/docs/third-party" class="rj-about-link">第三方组件与许可</RouterLink>。
        </p>
      </div>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.rj-drawer-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  /* 内容包装器的内边距被全站样式清零了，这里自己补 */
  padding: 12px 24px 24px;
}
.rj-section { display: flex; flex-direction: column; gap: 10px; }
.rj-section-title {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--foreground);
  transition: color 0.4s ease;
}
/* 配置与数据是两类东西：用虚线分隔，避免看成同一组设置 */
.rj-divider {
  height: 0;
  border-top: 1px dashed var(--border);
  transition: border-color 0.4s ease;
}
.rj-data-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
/* 危险操作平时与普通按钮同款，悬停时才提示后果 */
.rj-danger-hover:hover:not(:disabled) {
  border-color: var(--destructive);
  color: var(--destructive);
}
.rj-about {
  margin: 0;
  font-size: 12px;
  line-height: 1.75;
  color: var(--muted-foreground);
  transition: color 0.4s ease;
}
.rj-about-link {
  color: var(--muted-foreground);
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: color 0.4s ease;
}
.rj-about-link:hover { color: var(--foreground); }
</style>

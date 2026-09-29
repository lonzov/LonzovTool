<script setup>
import { previewHtml } from '../../composables/useRawJsonEditor.js'
import '../../vendor/mcfc/mcfc.css'

defineProps({
  /** 容器是 flex 列时吃掉剩余高度（紧凑布局的大预览区），否则按内容撑高 */
  fill: { type: Boolean, default: false },
})
</script>

<template>
  <div class="preview-box" :class="{ 'preview-box--fill': fill }">
    <div class="preview-content mcfc" v-html="previewHtml" />
  </div>
</template>

<style scoped>
/* stylelint-disable declaration-property-value-disallowed-list --
   预览舞台固定深色：它模拟的是游戏内聊天框，预览内容由 vendor/mcfc 按 Minecraft
   原色渲染、假定深底。改成 --card 会让浅色主题下预览变白底，MC 颜色失去对比。 */
.preview-box {
  background: #1a1a1a; border-radius: var(--radius-md); border: 1px solid #333;
  padding: 12px 16px; min-height: 60px;
  /* 居中交给 .preview-content 的 auto 外边距。用 align-items/justify-content 居中时，
     内容一旦高过容器就会向两端等量溢出，顶部那截落在滚动区之外，永远滚不回去 */
  display: flex;
  overflow: auto;
}
[data-theme="dark"] .preview-box {
  background: #111;
  border-color: #2b2b2b;
}
/* stylelint-enable declaration-property-value-disallowed-list */
.preview-box--fill {
  flex: 1;
  min-height: 0;
}
.preview-content {
  display: inline-block;
  margin: auto;
  /* 行高必须写死：符号字形本身近 3em 高，靠字体度量自动算会把带符号的行撑到 2.9em。
     游戏内符号是跨行叠着的，1.19 = 游戏内行距 20px ÷ 汉字墨迹 17px × 本字体汉字墨迹 1.01em */
  font-size: 14px; line-height: 1.19; text-align: left;
  white-space: pre-line; max-width: 100%; overflow-x: auto;
  letter-spacing: 0.8px;
}
</style>

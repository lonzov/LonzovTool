<script setup>
import { computed } from 'vue'
import { NIcon } from 'naive-ui'
import {
  Person24Regular, Color24Regular, BookOpen48Regular, LocalLanguage24Regular,
  ArrowUndo24Regular, ArrowRedo24Regular,
} from '@vicons/fluent'
import AppButton from '../ui/AppButton.vue'
import {
  jsonOutput, undoStack, redoStack, undo, redo, openColorTable, loadExample,
} from '../../composables/useRawJsonEditor.js'
import { openSimModal, simCustomized } from '../../composables/useRawJsonSimulator.js'
import { openLangModal, activePackName } from '../../composables/useRawJsonLang.js'
import { renderMode } from '../../composables/useRawJsonRenderMode.js'
import RawJsonCard from './RawJsonCard.vue'
import RawJsonPreviewBox from './RawJsonPreviewBox.vue'
import RawJsonFormatToggle from './RawJsonFormatToggle.vue'

const props = defineProps({
  /**
   * 紧凑布局：预览框吃掉卡片剩余高度，底部换成常驻快捷栏（接管原本散在工具栏里的高频操作），
   * 并去掉脚注那行状态文本。
   */
  compact: { type: Boolean, default: false },

})

/** JSON 模式下大区域改渲染 JSON 文本，游戏渲染退到设置面板里的输出卡 */
const showJson = computed(() => props.compact && renderMode.value === 'json')
/** 紧凑布局的游戏渲染没有标题行，高度全留给内容；桌面端始终标出这是游戏渲染 */
const cardTitle = computed(() => (props.compact ? (showJson.value ? 'JSON' : '') : '游戏渲染'))
</script>

<template>
  <RawJsonCard
    :title="cardTitle"
    stretch

  >
    <template #actions>
      <div v-if="!compact" class="preview-header-actions">
        <AppButton
          variant="text"
          size="xs"
          :icon="LocalLanguage24Regular"
          @click="openLangModal"
        >
          {{ activePackName || '语言包' }}
          <span v-if="activePackName" class="preview-lang-dot" aria-hidden="true" />
        </AppButton>
        <span class="preview-sim-wrap">
          <AppButton
            variant="solid"
            size="xs"
            icon-only
            :icon="Person24Regular"
            label="预览模拟器"
            @click="openSimModal"
          />
          <span v-if="simCustomized" class="sim-dot" aria-hidden="true" />
        </span>
      </div>
      <RawJsonFormatToggle v-else />
    </template>

    <textarea
      v-if="showJson"
      class="json-stage"
      readonly
      :value="jsonOutput"
      spellcheck="false"
    />
    <RawJsonPreviewBox v-else fill />

    <div v-if="compact" class="quick-bar">
      <button
        class="qb-btn qb-btn--primary"
        title="预览模拟器（玩家名 / 记分板）"
        @click="openSimModal"
      >
        <NIcon :component="Person24Regular" :size="14" />
        <span v-if="simCustomized" class="sim-dot sim-dot--tight" aria-hidden="true" />
      </button>
      <button class="qb-btn" @click="openColorTable">
        <NIcon :component="Color24Regular" :size="14" />
        <span>颜色表</span>
      </button>
      <button class="qb-btn" @click="loadExample">
        <NIcon :component="BookOpen48Regular" :size="14" />
        <span>示例</span>
      </button>
      <button class="qb-btn" :disabled="undoStack.length === 0" @click="undo">
        <NIcon :component="ArrowUndo24Regular" :size="14" />
        <span>撤销</span>
      </button>
      <button class="qb-btn" :disabled="redoStack.length === 0" @click="redo">
        <NIcon :component="ArrowRedo24Regular" :size="14" />
        <span>重做</span>
      </button>
    </div>
  </RawJsonCard>
</template>

<style scoped>


.preview-header-actions { display: flex; align-items: center; gap: 4px; }
/* 预览参数偏离默认值时，入口右上角标点（与语言包加载后的绿点同一套语义） */
.preview-sim-wrap { position: relative; display: inline-flex; }
.sim-dot {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  corner-shape: round;
  background: var(--success);
  box-shadow: 0 0 0 1.5px var(--card);
  pointer-events: none;
}
.sim-dot--tight { top: 2px; right: 2px; }
/* 已加载语言包的绿点：语言包是否生效会直接改变预览结果，需要一眼可见 */
.preview-lang-dot {
  width: 5px;
  height: 5px;
  margin-left: 2px;
  border-radius: 50%;
  corner-shape: round;
  background: var(--success);
}

.json-stage {
  flex: 1;
  min-height: 0;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--muted);
  color: var(--foreground);
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: 12px; line-height: 1.6;
  resize: none; outline: none;
  transition: border-color 0.4s ease, background-color 0.4s ease, color 0.4s ease;
}

/* 紧凑布局的预览快捷栏 */
.quick-bar {
  /* 单一高度来源：文字按钮取它，图标按钮的方形边长也取它。
     不能再低：--radius-sm 经平滑曲率放大后是 10.5px，短边掉到 22px 时两角几乎相接，
     方形会鼓成圆形块，看着比同排按钮大一号 */
  --qb-h: 24px;
  /* 描边相邻会糊成一条线，留一点比字间距稍大的缝 */
  display: flex; align-items: center; gap: 4px;
  max-height: 60px; overflow: hidden;
  margin-top: 10px; padding-top: 8px;
  border-top: 1px solid var(--border);
  transition:
    border-color 0.4s ease,
    max-height 0.28s cubic-bezier(0.2, 0, 0, 1),
    opacity 0.18s ease;
}

/* 减少动态效果：快捷栏展开收起直接到位。只摘掉 max-height，
   描边与透明度的过渡保留 —— 整条 transition 换掉会让它在主题切换时跳变 */
html[data-motion='reduced'] .quick-bar {
  transition: border-color 0.4s ease, opacity 0.18s ease;
}
.qb-btn {
  flex: 1 1 0; min-width: 0;
  display: inline-flex; align-items: center; justify-content: center; gap: 3px;
  height: var(--qb-h); padding: 0 2px;
  border: none; background: var(--muted);
  color: var(--muted-foreground);
  font-size: 12px; font-weight: 500;
  font-family: inherit;
  border-radius: var(--radius-sm);
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, opacity 0.4s ease;
}
/* 卡片本身就是 --card，常态取 --muted 与它拉开一档，hover 再叠一层 accent */
.qb-btn:hover { background: var(--accent); color: var(--foreground); }
.qb-btn:active { transform: scale(0.97); }
.qb-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
.qb-btn:disabled:hover { background: var(--muted); color: var(--muted-foreground); }
/* 预览模拟器入口：与「添加元素」同为反色块，取快捷栏高度做等边方形 */
.qb-btn--primary {
  position: relative;
  flex: 0 0 auto;
  width: var(--qb-h);
  padding: 0;
  background: var(--primary);
  color: var(--primary-foreground);
  transition: background-color 0.4s ease, color 0.4s ease, opacity 0.15s ease;
}
.qb-btn--primary:hover { background: var(--primary); color: var(--primary-foreground); opacity: 0.85; }
</style>

<script setup>
import { NIcon } from 'naive-ui'
import { ArrowUp24Regular, ArrowDown24Regular, Edit24Filled, Delete24Regular } from '@vicons/fluent'
import {
  data, validationResult, deleteConfirmIdx,
  getElTypeClass, getElTypeLabel, getElPreviewText,
  addElement, editElement, deleteElement, moveElement,
} from '../../composables/useRawJsonEditor.js'
</script>

<template>
  <div class="list-body">
    <!-- 空状态 -->
    <div v-if="data.length === 0" class="empty-state">
      <span>点击「添加元素」开始构建</span>
    </div>

    <!-- 元素卡片列表 -->
    <template v-for="(el, i) in data" :key="i">
      <!-- 插入间隙 -->
      <div class="insert-gap" @click="addElement(i)">
        <div class="insert-line" />
        <div class="insert-plus">+</div>
      </div>

      <div
        class="node"
        :class="{
          'node-error': validationResult.errors.some(e => e.idx === i),
          'node-warning': validationResult.warnings.some(e => e.idx === i),
        }"
      >
        <div class="node-main">
          <div class="node-info">
            <span class="node-type-badge" :class="getElTypeClass(el)">
              {{ getElTypeLabel(el) }}
            </span>
            <span class="node-text">{{ getElPreviewText(el) }}</span>
          </div>
          <div class="node-actions">
            <button class="act-btn" :disabled="i === 0" title="上移" @click="moveElement(i, 'up')">
              <NIcon :component="ArrowUp24Regular" :size="14" />
            </button>
            <button class="act-btn" :disabled="i === data.length - 1" title="下移" @click="moveElement(i, 'down')">
              <NIcon :component="ArrowDown24Regular" :size="14" />
            </button>
            <button class="act-btn act-btn--primary" title="编辑" @click="editElement(i)">
              <NIcon :component="Edit24Filled" :size="14" />
            </button>
            <button
              class="act-btn act-btn--danger"
              :class="{ 'act-delete-confirmed': deleteConfirmIdx === i }"
              :title="deleteConfirmIdx === i ? '再次点击确认删除' : '删除'"
              @click="deleteElement(i)"
            >
              <NIcon :component="Delete24Regular" :size="14" />
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- 末尾插入间隙 -->
    <div v-if="data.length > 0" class="insert-gap" @click="addElement(data.length)">
      <div class="insert-line" />
      <div class="insert-plus">+</div>
    </div>
  </div>

  <!-- 验证错误/警告 -->
  <div v-if="validationResult.errors.length > 0" class="error-box">
    <div v-for="(e, i) in validationResult.errors" :key="'err' + i" class="error-item">
      <span>{{ e.msg }}</span>
    </div>
  </div>
  <div v-if="validationResult.warnings.length > 0" class="warning-box">
    <div v-for="(w, i) in validationResult.warnings" :key="'warn' + i" class="warning-item">
      <span>{{ w.msg }}</span>
    </div>
  </div>
</template>

<style scoped>
.list-body { min-height: 60px; }
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  color: var(--text-tertiary);
  font-size: 13px;
  border: 2px dashed var(--border-color);
  border-radius: 8px;
  transition: color 0.4s ease, border-color 0.4s ease;
}
.insert-gap {
  height: 20px; margin: 4px 0;
  position: relative; opacity: 0; cursor: pointer;
  transition: opacity 0.2s;
  display: none;
}
@media (hover: hover) { .insert-gap:hover { opacity: 1; } }
@media (min-width: 640px) { .insert-gap { display: block; } }
.insert-line {
  position: absolute; top: 50%; left: 0; right: 0;
  height: 2px; background: var(--text-secondary); border-radius: 1px;
}
.insert-plus {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 24px; height: 24px;
  background: #555; color: white;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
}
[data-theme="dark"] .insert-plus {
  background: #aaa;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}
.node {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px 12px;
  transition: all 0.15s ease, background-color 0.4s ease, border-color 0.4s ease;
}
.node:hover {
  border-color: var(--text-secondary);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.04);
  transform: translateY(-1px);
}
.node:active { transform: scale(0.995); }
.node-error {
  border-color: #555 !important;
  background: color-mix(in srgb, #333 5%, var(--bg-card)) !important;
}
[data-theme="dark"] .node-error {
  background: color-mix(in srgb, #aaa 8%, #191919) !important;
}
.node-warning {
  border-color: #aaa !important;
  background: color-mix(in srgb, #666 3%, var(--bg-card)) !important;
}
[data-theme="dark"] .node-warning {
  background: color-mix(in srgb, #888 6%, #191919) !important;
}
.node-main {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
}
.node-info {
  display: flex; align-items: center; gap: 8px;
  flex: 1; min-width: 0; overflow: hidden;
}
.node-type-badge {
  font-size: 10px; font-weight: 700;
  padding: 2px 6px; border-radius: 4px;
  flex-shrink: 0; letter-spacing: 0.3px;
}
.type-text, .type-sel, .type-scr, .type-trn { background: var(--bg-sub); color: var(--text-secondary); }
.type-err { background: var(--text-primary); color: #fff; }
[data-theme="dark"] .type-text, [data-theme="dark"] .type-sel,
[data-theme="dark"] .type-scr, [data-theme="dark"] .type-trn { background: var(--bg-sub); color: var(--text-secondary); }
[data-theme="dark"] .type-err { background: #555; color: #1a1a1a; }
.node-text {
  font-size: 12px; color: var(--text-primary);
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  transition: color 0.4s ease;
}
.node-actions { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }

/* 自定义图标操作按钮 */
.act-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; padding: 0;
  border: none; background: transparent; border-radius: 6px;
  color: var(--text-secondary); cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, opacity 0.4s ease;
}
.act-btn:hover { background: var(--bg-sub); }
.act-btn:active { transform: scale(0.95); }
.act-btn:disabled { opacity: 0.3; cursor: default; }
.act-btn:disabled:hover { background: transparent; }
.act-btn--primary { color: var(--text-primary); }
.act-btn--primary:hover { background: var(--bg-sub); }
.act-btn--danger { color: var(--text-secondary); }
.act-btn--danger:hover { background: var(--bg-sub); }
.act-delete-confirmed,
.act-delete-confirmed:hover {
  background: #dc2626 !important;
  color: #fff !important;
}
[data-theme="dark"] .act-delete-confirmed,
[data-theme="dark"] .act-delete-confirmed:hover {
  background: #dc2626 !important;
  color: #fff !important;
}

.error-box {
  margin-top: 12px;
  background: #f2f2f2; border: 1px solid #ddd;
  border-radius: 6px; padding: 10px 12px;
  transition: background-color 0.4s ease, border-color 0.4s ease;
}
[data-theme="dark"] .error-box {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
}
.error-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #555; margin: 2px 0; transition: color 0.4s ease; }
.warning-box {
  margin-top: 8px;
  background: #f5f5f5; border: 1px solid #ddd;
  border-radius: 6px; padding: 10px 12px;
  transition: background-color 0.4s ease, border-color 0.4s ease;
}
[data-theme="dark"] .warning-box {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.08);
}
.warning-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #555; margin: 2px 0; transition: color 0.4s ease; }
[data-theme="dark"] .warning-item { color: #999; }

@media (max-width: 480px) {
  .node-main { flex-direction: column; align-items: stretch; gap: 8px; }
  .node-actions { justify-content: flex-end; }
}
</style>

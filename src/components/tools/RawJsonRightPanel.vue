<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { NButton, NIcon } from 'naive-ui'
import { Copy24Regular, Code20Filled, ArrowMinimize16Filled, Person24Regular } from '@vicons/fluent'
import {
  jsonFormatted, modeLabel, previewHtml, jsonOutput, commandOutput, cmdLength,
  formatJson, minifyJson, copyCommand,
} from '../../composables/useRawJsonEditor.js'
import { openSimModal } from '../../composables/useRawJsonSimulator.js'
import { activePackName } from '../../composables/useRawJsonLang.js'
import { startObfuscateTimer, stopObfuscateTimer } from '../../vendor/mcfc/mcfc.js'
import '../../vendor/mcfc/mcfc.css'

onMounted(() => { startObfuscateTimer() })
onBeforeUnmount(() => { stopObfuscateTimer() })
</script>

<template>
  <!-- 预览 -->
  <div class="output-card">
    <div class="output-card-header">
      <span class="output-card-title">预览</span>
      <div class="preview-header-actions">
        <span class="output-card-badge">{{ modeLabel }}</span>
        <button class="preview-icon-btn" title="预览模拟器（玩家名 / 记分板）" @click="openSimModal">
          <NIcon :component="Person24Regular" :size="14" />
        </button>
      </div>
    </div>
    <div class="preview-box">
      <div class="preview-content mcfc" v-html="previewHtml" />
    </div>
    <div class="preview-footer">
      <span class="preview-footer-left">
        <span>支持 § 颜色代码 + \n 换行</span>
        <span class="preview-lang" :class="{ 'preview-lang--off': !activePackName }">
          {{ activePackName ? `语言包：${activePackName}` : '语言包：未加载' }}
        </span>
      </span>
      <span>{{ cmdLength }} 字符</span>
    </div>
  </div>

  <!-- JSON 输出 -->
  <div class="output-card">
    <div class="output-card-header">
      <span class="output-card-title">JSON 输出</span>
      <div class="output-card-actions">
        <button class="qh-btn" :class="{ 'qh-btn--active': jsonFormatted }" @click="formatJson">
          <NIcon :component="Code20Filled" :size="14" />
          <span>格式化</span>
        </button>
        <button class="qh-btn" :class="{ 'qh-btn--active': !jsonFormatted }" @click="minifyJson">
          <NIcon :component="ArrowMinimize16Filled" :size="14" />
          <span>压缩</span>
        </button>
      </div>
    </div>
    <textarea
      class="json-textarea"
      readonly
      :value="jsonOutput"
      spellcheck="false"
    />
  </div>

  <!-- 命令输出 -->
  <div class="output-card">
    <div class="output-card-header">
      <span class="output-card-title">命令</span>
      <NButton size="small" @click="copyCommand">
        <template #icon><NIcon :component="Copy24Regular" :size="14" /></template>
        复制命令
      </NButton>
    </div>
    <div class="cmd-box">
      <input
        class="cmd-input"
        readonly
        :value="commandOutput"
      />
    </div>
  </div>
</template>

<style scoped>
.output-card {
  background: var(--card);
  border-radius: 12px;
  border: 1px solid var(--border);
  padding: 16px;
  transition: background-color 0.4s ease, border-color 0.4s ease;
}
.output-card-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px;
}
.output-card-title {
  font-size: 11px; font-weight: 700; color: var(--foreground);
  text-transform: uppercase; letter-spacing: 0.5px;
  transition: color 0.4s ease;
}
.output-card-badge {
  font-size: 10px; color: var(--subtle-foreground);
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  background: var(--muted);
  padding: 2px 8px; border-radius: 4px;
  transition: color 0.4s ease, background-color 0.4s ease;
}
.output-card-actions { display: flex; gap: 2px; }
.preview-header-actions { display: flex; align-items: center; gap: 6px; }
.preview-icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; padding: 0;
  border: none; border-radius: 6px; background: transparent;
  color: var(--subtle-foreground); cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease;
}
.preview-icon-btn:hover { background: var(--muted); color: var(--foreground); }

.preview-box {
  background: #1a1a1a; border-radius: 8px; border: 1px solid #333;
  padding: 12px 16px; min-height: 60px;
  display: flex; align-items: center; justify-content: center;
  overflow-x: auto;
}
[data-theme="dark"] .preview-box {
  background: #111;
  border-color: #2b2b2b;
}
.preview-content {
  display: inline-block;
  font-size: 14px; text-align: left;
  white-space: pre-line; max-width: 100%; overflow-x: auto;
  letter-spacing: 0.8px;
}
.preview-footer {
  display: flex; justify-content: space-between; gap: 8px;
  margin-top: 6px; font-size: 10px; color: var(--subtle-foreground);
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  transition: color 0.4s ease;
}
.preview-footer-left { display: flex; align-items: center; gap: 8px; min-width: 0; }
.preview-lang {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  transition: color 0.4s ease;
}
.preview-lang::before { content: '· '; }
.preview-lang--off { color: var(--subtle-foreground); opacity: 0.75; }
.json-textarea {
  width: 100%; height: 100px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--muted);
  color: var(--foreground);
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: 12px; line-height: 1.6;
  resize: none; outline: none;
  transition: border-color 0.4s ease, background-color 0.4s ease, color 0.4s ease;
}
.cmd-box {
  padding: 10px 12px;
  background: var(--muted);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow-x: auto;
  transition: background-color 0.4s ease, border-color 0.4s ease;
}
.cmd-input {
  width: 100%; background: transparent; border: none;
  color: var(--foreground);
  font-family: 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: 12px; outline: none; word-break: break-all;
  transition: color 0.4s ease;
}

/* 自定义格式化/压缩按钮 */
.qh-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 8px;
  border: none; background: transparent;
  color: var(--muted-foreground);
  font-size: 11px; font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.qh-btn:hover { background: var(--muted); }
.qh-btn:active { transform: scale(0.97); }
.qh-btn--active { color: var(--foreground); }
.qh-btn--active:hover { background: var(--muted); }
</style>

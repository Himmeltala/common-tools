<!--
 * @Author: zhengrenfu
 * @Date: 2026-08-12
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-12
 * @FilePath: \src\components\ToolLayout.vue
 * @Description: 工具页通用布局组件，提供顶部工具栏、左右分栏结构、统一样式和复制功能
-->
<template>
  <div class="tool-layout">
    <div class="tool-toolbar">
      <slot name="toolbar" />
    </div>
    <div class="tool-panes">
      <div class="tool-pane">
        <div class="pane-header">
          <slot name="left-header" />
        </div>
        <slot name="left" />
      </div>
      <div class="tool-pane">
        <div class="pane-header">
          <slot name="right-header" />
          <el-button v-if="copyText !== undefined" size="small" text :disabled="!copyText" @click="handleCopy">
            复制
          </el-button>
        </div>
        <slot name="right" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useLogStore } from '@/stores/log.store'

const logStore = useLogStore()

const props = defineProps({
  /**
   * 右侧面板的可复制文本内容
   * 传入后自动在右侧标题栏显示"复制"按钮
   */
  copyText: {
    type: String,
    default: undefined,
  },
})

/**
 * 复制右侧结果到剪贴板
 */
async function handleCopy() {
  if (!props.copyText) return
  try {
    await navigator.clipboard.writeText(props.copyText)
    logStore.addLog('success', '已复制到剪贴板')
  } catch {
    logStore.addLog('error', '复制失败，请手动复制')
  }
}
</script>

<style scoped>
/* 布局 */
.tool-layout {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 8px;
}
.tool-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 8px;
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: thin;
}
.tool-panes {
  flex: 1;
  display: flex;
  gap: 12px;
  min-height: 0;
}
.tool-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  overflow: hidden;
}
.pane-header {
  padding: 6px 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  background: var(--el-bg-color-overlay);
  border-bottom: 1px solid var(--el-border-color-lighter);
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* 工具栏通用样式 */
:deep(.toolbar-label) {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
:deep(.file-name) {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-left: 8px;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 编辑器通用样式 */
:deep(.editor-textarea) {
  flex: 1;
  min-height: 0;
}
:deep(.editor-textarea .el-textarea__inner) {
  height: 100%;
  border: none;
  border-radius: 0;
  resize: none;
  padding: 12px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.5;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
}

/* 右侧结果区通用样式 */
:deep(.result-area) {
  flex: 1;
  overflow: auto;
  padding: 12px;
}
:deep(.placeholder-text) {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
:deep(.error-text) {
  color: var(--el-color-danger);
  font-size: 13px;
  white-space: pre-wrap;
}
:deep(.truncate-hint) {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-color-warning);
}
:deep(.code-output) {
  margin: 0;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--el-text-color-primary);
}
</style>

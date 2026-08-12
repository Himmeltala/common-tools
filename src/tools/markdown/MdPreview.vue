<!--
 * @Author: zhengrenfu
 * @Date: 2026-08-11
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-11
 * @FilePath: \src\tools\markdown\MdPreview.vue
 * @Description: Markdown 实时预览工具，左侧编辑右侧预览，支持暗黑主题
-->
<template>
  <div class="md-preview">
    <div class="md-toolbar">
      <el-upload
        :auto-upload="false"
        :show-file-list="false"
        accept=".md,.markdown"
        @change="handleFileOpen"
      >
        <el-button :icon="FolderOpened" size="small">打开文件</el-button>
      </el-upload>
      <el-button :icon="RefreshRight" size="small" @click="handleReset">清空</el-button>
      <span class="md-file-name" v-if="currentFile">{{ currentFile }}</span>
    </div>
    <div class="md-editor-panes">
      <div class="md-editor-pane">
        <div class="pane-header">编辑</div>
        <el-input
          v-model="source"
          type="textarea"
          class="md-editor-textarea"
          placeholder="在此输入 Markdown 文本，或点击上方按钮打开 .md 文件..."
          resize="none"
        />
      </div>
      <div class="md-preview-pane">
        <div class="pane-header">预览</div>
        <div
          class="md-preview-content markdown-body"
          v-html="renderedHtml"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { FolderOpened, RefreshRight } from '@element-plus/icons-vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.min.css'
import type { UploadFile } from 'element-plus'

/** Markdown 解析器实例：启用代码高亮 */
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight(str: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`
      } catch {
        // ignore
      }
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`
  },
})

const source = ref('')
const currentFile = ref('')

/** 渲染后的 HTML 内容 */
const renderedHtml = computed(() => {
  if (!source.value) {
    return '<p style="color:var(--el-text-color-secondary)">预览区域，在左侧输入 Markdown 文本后此处将显示渲染结果</p>'
  }
  return md.render(source.value)
})

/**
 * 处理文件打开
 * @param uploadFile Element Plus 上传文件对象
 */
async function handleFileOpen(uploadFile: UploadFile) {
  const file = uploadFile.raw
  if (!file) return
  try {
    const text = await file.text()
    source.value = text
    currentFile.value = file.name
  } catch {
    window.electronAPI.invoke('tool:log', 'error', '文件读取失败')
  }
}

/** 清空编辑内容 */
function handleReset() {
  source.value = ''
  currentFile.value = ''
}
</script>

<style scoped>
.md-preview {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 8px;
}
.md-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.md-file-name {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-left: 8px;
}
.md-editor-panes {
  flex: 1;
  display: flex;
  gap: 12px;
  min-height: 0;
}
.md-editor-pane,
.md-preview-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  overflow: hidden;
}
.pane-header {
  padding: 4px 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-bg-color-overlay);
  border-bottom: 1px solid var(--el-border-color-lighter);
  flex-shrink: 0;
}
.md-editor-textarea {
  flex: 1;
}
.md-editor-textarea :deep(.el-textarea__inner) {
  height: 100%;
  border: none;
  border-radius: 0;
  resize: none;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 14px;
  line-height: 1.6;
}
.md-preview-content {
  flex: 1;
  overflow: auto;
  padding: 16px 20px;
}

/* Markdown 渲染内容样式 */
.markdown-body {
  font-size: 15px;
  line-height: 1.7;
  color: var(--el-text-color-primary);
}
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin-top: 24px;
  margin-bottom: 12px;
  font-weight: 600;
  line-height: 1.3;
}
.markdown-body :deep(h1) { font-size: 1.8em; border-bottom: 1px solid var(--el-border-color-lighter); padding-bottom: 8px; }
.markdown-body :deep(h2) { font-size: 1.5em; border-bottom: 1px solid var(--el-border-color-lighter); padding-bottom: 6px; }
.markdown-body :deep(h3) { font-size: 1.25em; }
.markdown-body :deep(p) { margin-bottom: 12px; }
.markdown-body :deep(code) {
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 0.9em;
  background: var(--el-fill-color-light);
}
.markdown-body :deep(pre.hljs) {
  padding: 16px;
  border-radius: 6px;
  overflow: auto;
  margin-bottom: 12px;
}
.markdown-body :deep(pre.hljs code) {
  padding: 0;
  background: transparent;
  font-size: 13px;
}
.markdown-body :deep(blockquote) {
  border-left: 4px solid var(--el-color-primary);
  padding: 8px 16px;
  margin: 12px 0;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border-radius: 0 4px 4px 0;
}
.markdown-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 12px;
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid var(--el-border-color);
  padding: 8px 12px;
  text-align: left;
}
.markdown-body :deep(th) {
  background: var(--el-fill-color-light);
  font-weight: 600;
}
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 24px;
  margin-bottom: 12px;
}
.markdown-body :deep(li) {
  margin-bottom: 4px;
}
.markdown-body :deep(a) {
  color: var(--el-color-primary);
}
.markdown-body :deep(img) {
  max-width: 100%;
  border-radius: 4px;
}
.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--el-border-color);
  margin: 20px 0;
}
</style>

<!--
 * @Author: zhengrenfu
 * @Date: 2026-08-11
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-12
 * @FilePath: \src\tools\markdown\MdToPdf.vue
 * @Description: Markdown 转 PDF 工具，编辑 Markdown 后通过主进程生成 PDF 并保存，支持主题选择
-->
<template>
  <div class="md-to-pdf">
    <div class="md-toolbar">
      <el-upload :auto-upload="false" :show-file-list="false" accept=".md,.markdown" @change="handleFileOpen">
        <el-button :icon="FolderOpened" size="small">打开 MD 文件</el-button>
      </el-upload>
      <el-button :icon="RefreshRight" size="small" @click="handleReset">清空</el-button>
      <el-divider direction="vertical" />
      <span class="toolbar-label">主题：</span>
      <el-select v-model="activeTheme" size="small" style="width: 110px" @change="onThemeChange">
        <el-option v-for="t in themes" :key="t.id" :label="t.label" :value="t.id" />
      </el-select>
      <el-divider direction="vertical" />
      <el-button :icon="DocumentCopy" type="primary" size="small" :loading="converting" @click="handleConvert">
        {{ converting ? '转换中...' : '转换为 PDF' }}
      </el-button>
      <span class="md-file-name" v-if="currentFile">{{ currentFile }}</span>
    </div>
    <div class="md-editor-panes">
      <div class="md-editor-pane">
        <div class="pane-header">Markdown 源文本</div>
        <el-input
          v-model="source"
          type="textarea"
          class="md-editor-textarea"
          placeholder="在此输入 Markdown 文本，或点击上方按钮打开 .md 文件..."
          resize="none"
        />
      </div>
      <div class="md-preview-pane">
        <div class="pane-header">PDF 预览（{{ currentThemeLabel }}）</div>
        <div class="md-preview-content markdown-body" :class="`theme-${activeTheme}`" v-html="renderedHtml" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { FolderOpened, RefreshRight, DocumentCopy } from '@element-plus/icons-vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.min.css'
import type { UploadFile } from 'element-plus'
import { maybeShowSysNotification } from '@/utils/sysNotification'

/** PDF 主题定义 */
interface PdfTheme {
  id: string
  label: string
  /** PDF 输出的 CSS 样式 */
  pdfCss: string
}

// 可选主题
const themes: PdfTheme[] = [
  {
    id: 'light',
    label: '亮色',
    pdfCss: `
      body { font-family: 'Microsoft YaHei', Arial, sans-serif; font-size: 15px; line-height: 1.7; padding: 40px; max-width: 900px; margin: 0 auto; color: #222; background: #fff; }
      h1, h2, h3, h4 { margin-top: 24px; margin-bottom: 12px; font-weight: 600; color: #111; }
      h1 { font-size: 1.8em; border-bottom: 1px solid #ddd; padding-bottom: 8px; }
      h2 { font-size: 1.5em; border-bottom: 1px solid #eee; padding-bottom: 6px; }
      h3 { font-size: 1.25em; }
      p { margin-bottom: 12px; }
      code { padding: 2px 6px; border-radius: 4px; font-family: 'Consolas', monospace; font-size: 0.9em; background: #f0f0f0; color: #c7254e; }
      pre { background: #f6f8fa; color: #333; padding: 16px; border-radius: 6px; overflow: visible; white-space: pre-wrap; word-wrap: break-word; }
      pre code { background: transparent; padding: 0; font-size: 13px; color: inherit; white-space: pre-wrap; word-wrap: break-word; }
      blockquote { border-left: 4px solid #409eff; padding: 8px 16px; margin: 12px 0; color: #666; background: #f8f8f8; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 12px; }
      th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
      th { background: #f5f5f5; font-weight: 600; }
      img { max-width: 100%; }
      hr { border: none; border-top: 1px solid #eee; margin: 20px 0; }
      a { color: #1677ff; }
    `,
  },
  {
    id: 'dark',
    label: '暗色',
    pdfCss: `
      body { font-family: 'Microsoft YaHei', Arial, sans-serif; font-size: 15px; line-height: 1.7; padding: 40px; max-width: 900px; margin: 0 auto; color: #c9d1d9; background: #0d1117; }
      h1, h2, h3, h4 { margin-top: 24px; margin-bottom: 12px; font-weight: 600; color: #e6edf3; }
      h1 { font-size: 1.8em; border-bottom: 1px solid #30363d; padding-bottom: 8px; }
      h2 { font-size: 1.5em; border-bottom: 1px solid #21262d; padding-bottom: 6px; }
      h3 { font-size: 1.25em; }
      p { margin-bottom: 12px; }
      code { padding: 2px 6px; border-radius: 4px; font-family: 'Consolas', monospace; font-size: 0.9em; background: #161b22; color: #f0883e; }
      pre { background: #161b22; color: #c9d1d9; padding: 16px; border-radius: 6px; overflow: visible; white-space: pre-wrap; word-wrap: break-word; border: 1px solid #30363d; }
      pre code { background: transparent; padding: 0; font-size: 13px; color: inherit; white-space: pre-wrap; word-wrap: break-word; }
      blockquote { border-left: 4px solid #58a6ff; padding: 8px 16px; margin: 12px 0; color: #8b949e; background: #161b22; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 12px; }
      th, td { border: 1px solid #30363d; padding: 8px 12px; text-align: left; }
      th { background: #161b22; font-weight: 600; }
      img { max-width: 100%; }
      hr { border: none; border-top: 1px solid #30363d; margin: 20px 0; }
      a { color: #58a6ff; }
    `,
  },
  {
    id: 'github',
    label: 'GitHub',
    pdfCss: `
      body { font-family: -apple-system, 'Segoe UI', 'Noto Sans', Arial, sans-serif; font-size: 16px; line-height: 1.6; padding: 32px; max-width: 980px; margin: 0 auto; color: #1f2328; background: #fff; }
      h1, h2, h3, h4 { margin-top: 24px; margin-bottom: 16px; font-weight: 600; color: #1f2328; border: none; padding: 0; }
      h1 { font-size: 2em; padding-bottom: 0.3em; border-bottom: 1px solid #d8dee4; }
      h2 { font-size: 1.5em; padding-bottom: 0.3em; border-bottom: 1px solid #d8dee4; }
      h3 { font-size: 1.25em; }
      p { margin-bottom: 16px; }
      code { padding: 0.2em 0.4em; border-radius: 6px; font-family: 'SFMono', 'Consolas', monospace; font-size: 0.85em; background: #afb8c133; color: #1f2328; }
      pre { background: #f6f8fa; color: #1f2328; padding: 16px; border-radius: 6px; overflow: visible; white-space: pre-wrap; word-wrap: break-word; }
      pre code { background: transparent; padding: 0; font-size: 13px; white-space: pre-wrap; word-wrap: break-word; }
      blockquote { border-left: 4px solid #d0d7de; padding: 0 16px; margin: 16px 0; color: #656d76; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
      th, td { border: 1px solid #d8dee4; padding: 6px 13px; text-align: left; }
      th { background: #f6f8fa; font-weight: 600; }
      tr:nth-child(even) { background: #f6f8fa; }
      img { max-width: 100%; }
      hr { border: none; border-top: 1px solid #d8dee4; margin: 24px 0; }
      a { color: #0969da; }
    `,
  },
  {
    id: 'minimal',
    label: '简约',
    pdfCss: `
      body { font-family: 'Georgia', 'Times New Roman', serif; font-size: 16px; line-height: 1.8; padding: 48px 56px; max-width: 720px; margin: 0 auto; color: #333; background: #fafaf8; }
      h1, h2, h3, h4 { margin-top: 32px; margin-bottom: 16px; font-weight: 400; color: #222; border: none; }
      h1 { font-size: 2em; }
      h2 { font-size: 1.6em; }
      h3 { font-size: 1.3em; font-style: italic; }
      p { margin-bottom: 20px; }
      code { padding: 1px 4px; font-family: 'Courier New', monospace; font-size: 0.9em; background: #eee; color: #000; }
      pre { background: #f0f0f0; color: #333; padding: 20px; overflow: visible; white-space: pre-wrap; word-wrap: break-word; }
      pre code { background: transparent; padding: 0; white-space: pre-wrap; word-wrap: break-word; }
      blockquote { border-left: 2px solid #999; padding: 4px 20px; margin: 20px 0; color: #555; font-style: italic; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
      th, td { border-bottom: 1px solid #ccc; padding: 10px 8px; text-align: left; }
      th { font-weight: 600; }
      img { max-width: 100%; }
      hr { border: none; border-top: 1px solid #ddd; margin: 32px 0; }
      a { color: #333; text-decoration: underline; }
    `,
  },
]

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
const converting = ref(false)
const activeTheme = ref('light')

// 当前主题标签
const currentThemeLabel = computed(() => {
  return themes.find((t) => t.id === activeTheme.value)?.label || '亮色'
})

const renderedHtml = computed(() => {
  if (!source.value) {
    return '<p class="placeholder-text">预览区域，在左侧输入 Markdown 文本后此处将显示渲染结果</p>'
  }
  return md.render(source.value)
})

// 获取当前主题的 PDF CSS
function getPdfCss(): string {
  const theme = themes.find((t) => t.id === activeTheme.value)
  return theme ? theme.pdfCss : themes[0].pdfCss
}

/**
 * 构建用于 PDF 生成的完整 HTML 文档
 * @returns 完整 HTML 字符串
 */

function buildPdfHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <style>${getPdfCss()}</style>
</head>
<body>${renderedHtml.value}</body>
</html>`
}

function onThemeChange() {
  // 主题切换后不需要额外操作，computed 已经依赖 activeTheme
}

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

function handleReset() {
  source.value = ''
  currentFile.value = ''
}

async function handleConvert() {
  if (!source.value.trim()) {
    window.electronAPI.invoke('tool:log', 'warning', '请先输入 Markdown 内容或打开文件')
    return
  }

  converting.value = true
  try {
    const html = buildPdfHtml()
    const baseName = currentFile.value ? currentFile.value.replace(/\.(md|markdown)$/i, '') : 'output'
    const result = await window.electronAPI.invoke('tool:execute', 'md-to-pdf', { html, fileName: baseName })

    if (result.success && result.data?.pdfBase64) {
      const defaultPath = `${baseName}.pdf`
      const savePath = await window.electronAPI.invoke('system:saveFile', defaultPath, [
        { name: 'PDF 文件', extensions: ['pdf'] },
      ])
      if (savePath) {
        const binaryStr = atob(result.data.pdfBase64)
        const bytes = new Uint8Array(binaryStr.length)
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i)
        }
        await window.electronAPI.invoke('tool:saveFile', savePath, Array.from(bytes))
        window.electronAPI.invoke('tool:log', 'success', `PDF 已保存到: ${savePath}`)
        window.electronAPI.invoke('notification:create', 'success', 'MD 转 PDF 完成', `已保存到 ${savePath}`)
        maybeShowSysNotification('MD 转 PDF 完成', `已保存到 ${savePath}`)
      }
    } else {
      window.electronAPI.invoke('tool:log', 'error', result.error || 'PDF 生成失败')
    }
  } catch (e: any) {
    window.electronAPI.invoke('tool:log', 'error', `转换失败: ${e.message}`)
  } finally {
    converting.value = false
  }
}
</script>

<style scoped>
.md-to-pdf {
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
.toolbar-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
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

/* 预览基础样式 */
.markdown-body {
  font-size: 15px;
  line-height: 1.7;
  color: var(--el-text-color-primary);
}
.markdown-body :deep(.placeholder-text) {
  color: var(--el-text-color-secondary);
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
.markdown-body :deep(h1) {
  font-size: 1.8em;
}
.markdown-body :deep(h2) {
  font-size: 1.5em;
}
.markdown-body :deep(h3) {
  font-size: 1.25em;
}
.markdown-body :deep(p) {
  margin-bottom: 12px;
}
.markdown-body :deep(code) {
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 0.9em;
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
  padding: 8px 16px;
  margin: 12px 0;
  border-radius: 0 4px 4px 0;
}
.markdown-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 12px;
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
  padding: 8px 12px;
  text-align: left;
}
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 24px;
  margin-bottom: 12px;
}
.markdown-body :deep(li) {
  margin-bottom: 4px;
}
.markdown-body :deep(img) {
  max-width: 100%;
  border-radius: 4px;
}
.markdown-body :deep(hr) {
  margin: 20px 0;
}

/* 预览主题：亮色 */
.markdown-body.theme-light {
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
}
.markdown-body.theme-light :deep(h1),
.markdown-body.theme-light :deep(h2) {
  border-color: var(--el-border-color-lighter);
}
.markdown-body.theme-light :deep(code) {
  background: #f0f0f0;
  color: #c7254e;
}
.markdown-body.theme-light :deep(pre.hljs) {
  background: #f6f8fa;
  color: #333;
}
.markdown-body.theme-light :deep(blockquote) {
  border-color: #409eff;
  color: #666;
  background: #f8f8f8;
}
.markdown-body.theme-light :deep(th),
.markdown-body.theme-light :deep(td) {
  border-color: #ddd;
}
.markdown-body.theme-light :deep(th) {
  background: #f5f5f5;
}
.markdown-body.theme-light :deep(a) {
  color: #1677ff;
}
.markdown-body.theme-light :deep(hr) {
  border-color: #eee;
}

/* 预览主题：暗色 */
.markdown-body.theme-dark {
  background: #0d1117;
  color: #c9d1d9;
}
.markdown-body.theme-dark :deep(h1),
.markdown-body.theme-dark :deep(h2) {
  color: #e6edf3;
  border-color: #30363d;
}
.markdown-body.theme-dark :deep(code) {
  background: #161b22;
  color: #f0883e;
}
.markdown-body.theme-dark :deep(pre.hljs) {
  background: #161b22;
  color: #c9d1d9;
  border: 1px solid #30363d;
}
.markdown-body.theme-dark :deep(blockquote) {
  border-color: #58a6ff;
  color: #8b949e;
  background: #161b22;
}
.markdown-body.theme-dark :deep(th),
.markdown-body.theme-dark :deep(td) {
  border-color: #30363d;
}
.markdown-body.theme-dark :deep(th) {
  background: #161b22;
}
.markdown-body.theme-dark :deep(a) {
  color: #58a6ff;
}
.markdown-body.theme-dark :deep(hr) {
  border-color: #30363d;
}

/* 预览主题：GitHub */
.markdown-body.theme-github {
  background: #fff;
  color: #1f2328;
  font-family: -apple-system, 'Segoe UI', 'Noto Sans', Arial, sans-serif;
  font-size: 16px;
}
.markdown-body.theme-github :deep(h1) {
  border-bottom: 1px solid #d8dee4;
  padding-bottom: 0.3em;
}
.markdown-body.theme-github :deep(h2) {
  border-bottom: 1px solid #d8dee4;
  padding-bottom: 0.3em;
}
.markdown-body.theme-github :deep(code) {
  background: #afb8c133;
  color: #1f2328;
  border-radius: 6px;
}
.markdown-body.theme-github :deep(pre.hljs) {
  background: #f6f8fa;
  color: #1f2328;
}
.markdown-body.theme-github :deep(blockquote) {
  border-color: #d0d7de;
  color: #656d76;
}
.markdown-body.theme-github :deep(th),
.markdown-body.theme-github :deep(td) {
  border-color: #d8dee4;
}
.markdown-body.theme-github :deep(th) {
  background: #f6f8fa;
}
.markdown-body.theme-github :deep(tr:nth-child(even)) {
  background: #f6f8fa;
}
.markdown-body.theme-github :deep(a) {
  color: #0969da;
}
.markdown-body.theme-github :deep(hr) {
  border-color: #d8dee4;
}

/* 预览主题：简约 */
.markdown-body.theme-minimal {
  background: #fafaf8;
  color: #333;
  font-family: 'Georgia', 'Times New Roman', serif;
  font-size: 16px;
  line-height: 1.8;
}
.markdown-body.theme-minimal :deep(h1),
.markdown-body.theme-minimal :deep(h2),
.markdown-body.theme-minimal :deep(h3),
.markdown-body.theme-minimal :deep(h4) {
  font-weight: 400;
  color: #222;
  border: none;
}
.markdown-body.theme-minimal :deep(h3) {
  font-style: italic;
}
.markdown-body.theme-minimal :deep(code) {
  background: #eee;
  color: #000;
  border-radius: 0;
  font-family: 'Courier New', monospace;
}
.markdown-body.theme-minimal :deep(pre.hljs) {
  background: #f0f0f0;
  color: #333;
}
.markdown-body.theme-minimal :deep(blockquote) {
  border-color: #999;
  border-left-width: 2px;
  color: #555;
  font-style: italic;
}
.markdown-body.theme-minimal :deep(th),
.markdown-body.theme-minimal :deep(td) {
  border: none;
  border-bottom: 1px solid #ccc;
}
.markdown-body.theme-minimal :deep(th) {
  background: transparent;
}
.markdown-body.theme-minimal :deep(a) {
  color: #333;
  text-decoration: underline;
}
.markdown-body.theme-minimal :deep(hr) {
  border-color: #ddd;
}
</style>

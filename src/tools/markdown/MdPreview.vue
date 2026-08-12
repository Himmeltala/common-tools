<!--
 * @Author: zhengrenfu
 * @Date: 2026-08-11
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-12
 * @FilePath: \src\tools\markdown\MdPreview.vue
 * @Description: Markdown 编辑预览工具，支持实时渲染、主题切换和导出 PDF
-->
<template>
  <ToolLayout :copy-text="source">
    <template #toolbar>
      <el-upload :auto-upload="false" :show-file-list="false" accept=".md,.markdown" @change="handleFileOpen">
        <el-button :icon="FolderOpened" size="small">打开 MD 文件</el-button>
      </el-upload>
      <el-button :icon="RefreshRight" size="small" @click="handleReset">清空</el-button>
      <el-divider direction="vertical" />
      <span class="toolbar-label">主题：</span>
      <el-select v-model="activeTheme" size="small" style="width: 110px">
        <el-option v-for="t in themes" :key="t.id" :label="t.label" :value="t.id" />
      </el-select>
      <el-divider direction="vertical" />
      <el-button
        :icon="DocumentCopy"
        type="primary"
        size="small"
        :loading="converting"
        :disabled="!source"
        @click="handleConvert"
      >
        {{ converting ? '转换中...' : '保存为 PDF' }}
      </el-button>
      <span class="file-name" v-if="currentFile">{{ currentFile }}</span>
    </template>

    <template #left-header>Markdown 源文本</template>
    <template #left>
      <el-input
        v-model="source"
        type="textarea"
        class="editor-textarea"
        placeholder="在此输入 Markdown 文本，或点击上方按钮打开 .md 文件..."
        resize="none"
      />
    </template>

    <template #right-header>预览（{{ currentThemeLabel }}）</template>
    <template #right>
      <div class="result-area markdown-body" :class="`theme-${activeTheme}`">
        <div v-if="errorMsg" class="error-text">{{ errorMsg }}</div>
        <div v-else-if="!source" class="placeholder-text">在左侧输入 Markdown 文本后此处将显示渲染结果</div>
        <div v-else v-html="renderedHtml" />
      </div>
    </template>
  </ToolLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { FolderOpened, RefreshRight, DocumentCopy } from '@element-plus/icons-vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.min.css'
import type { UploadFile } from 'element-plus'
import ToolLayout from '@/components/ToolLayout.vue'
import { useLogStore } from '@/stores/log.store'
import { maybeShowSysNotification } from '@/utils/sysNotification'

const logStore = useLogStore()

/** PDF 主题定义 */
interface PdfTheme {
  id: string
  label: string
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
const errorMsg = ref('')
const activeTheme = ref('light')

const currentThemeLabel = computed(() => {
  return themes.find((t) => t.id === activeTheme.value)?.label || '亮色'
})

const renderedHtml = computed(() => {
  if (!source.value) return ''
  return md.render(source.value)
})

/**
 * 构建用于 PDF 生成的完整 HTML 文档
 * @returns 完整 HTML 字符串
 */
function buildPdfHtml(): string {
  const theme = themes.find((t) => t.id === activeTheme.value)
  const css = theme ? theme.pdfCss : themes[0].pdfCss
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <style>${css}</style>
</head>
<body>${renderedHtml.value}</body>
</html>`
}

async function handleFileOpen(uploadFile: UploadFile) {
  const file = uploadFile.raw
  if (!file) return
  try {
    const text = await file.text()
    source.value = text
    currentFile.value = file.name
    errorMsg.value = ''
  } catch {
    logStore.addLog('error', '文件读取失败')
  }
}

function handleReset() {
  source.value = ''
  currentFile.value = ''
  errorMsg.value = ''
}

/**
 * 将当前 Markdown 内容转换为 PDF 并保存
 */
async function handleConvert() {
  if (!source.value.trim()) {
    logStore.addLog('warning', '请先输入 Markdown 内容或打开文件')
    return
  }

  converting.value = true
  errorMsg.value = ''
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
        logStore.addLog('success', 'PDF 文件已保存')
        logStore.addLog('success', `PDF 已保存到: ${savePath}`)
        maybeShowSysNotification('MD 转 PDF 完成', `已保存到 ${savePath}`)
      }
    } else {
      const err = result.error || 'PDF 生成失败'
      errorMsg.value = err
      logStore.addLog('error', err)
    }
  } catch (e: any) {
    const msg = e.message || '转换失败'
    errorMsg.value = msg
    logStore.addLog('error', msg)
  } finally {
    converting.value = false
  }
}
</script>

<style scoped>
/*
 * 预览样式通过 CSS 自定义属性统一管理颜色。
 * 每套主题只需设置 --md-* 变量值，基础规则共用同一份选择器。
 * PDF 导出使用的内联 CSS（见 JS 中 themes 数组）需保持独立，
 * 因为 PDF 生成的 HTML 文档无法访问应用的 CSS 变量。
 */

/* 基础排版规则（颜色通过 --md-* 变量引用） */
.markdown-body {
  font-size: 15px;
  line-height: 1.7;
  color: var(--md-text, var(--el-text-color-primary));
  background: var(--md-bg, transparent);
}
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin-top: 24px;
  margin-bottom: 12px;
  font-weight: var(--md-heading-weight, 600);
  line-height: 1.3;
  color: var(--md-heading-color, inherit);
  border-color: var(--md-heading-border, transparent);
}
.markdown-body :deep(h1) {
  font-size: 1.8em;
  border-bottom-width: var(--md-h1-border-width, 1px);
  border-bottom-style: solid;
  padding-bottom: var(--md-h1-padding, 0);
}
.markdown-body :deep(h2) {
  font-size: 1.5em;
  border-bottom-width: var(--md-h2-border-width, 1px);
  border-bottom-style: solid;
  padding-bottom: var(--md-h2-padding, 0);
}
.markdown-body :deep(h3) {
  font-size: 1.25em;
  font-style: var(--md-h3-style, normal);
}
.markdown-body :deep(p) {
  margin-bottom: 12px;
}
.markdown-body :deep(code) {
  padding: 2px 6px;
  border-radius: var(--md-code-radius, 4px);
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.9em;
  background: var(--md-code-bg, var(--el-fill-color-light));
  color: var(--md-code-color, inherit);
}
.markdown-body :deep(pre.hljs) {
  padding: 16px;
  border-radius: 6px;
  overflow: auto;
  margin-bottom: 12px;
  background: var(--md-pre-bg, var(--el-fill-color));
  color: var(--md-pre-color, inherit);
  border: var(--md-pre-border, none);
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
  border-left: var(--md-blockquote-border-width, 4px) solid var(--md-blockquote-border, var(--el-color-primary));
  color: var(--md-blockquote-color, var(--el-text-color-secondary));
  background: var(--md-blockquote-bg, var(--el-fill-color-light));
  font-style: var(--md-blockquote-style, normal);
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
  border: var(--md-table-border, 1px solid var(--el-border-color));
}
.markdown-body :deep(th) {
  background: var(--md-th-bg, var(--el-fill-color-light));
  font-weight: 600;
}
.markdown-body :deep(tr:nth-child(even)) {
  background: var(--md-tr-even-bg, transparent);
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
  color: var(--md-link-color, var(--el-color-primary));
  text-decoration: var(--md-link-decoration, none);
}
.markdown-body :deep(img) {
  max-width: 100%;
  border-radius: 4px;
}
.markdown-body :deep(hr) {
  margin: 20px 0;
  border: none;
  border-top: 1px solid var(--md-hr-color, var(--el-border-color));
}

/*
 * 主题 ================================
 * 每套主题仅定义 --md-* 变量，无需重复书写选择器
 */

/* 亮色（跟随系统主题） */
.markdown-body.theme-light {
  --md-bg: var(--el-bg-color);
  --md-text: var(--el-text-color-primary);
  --md-heading-border: var(--el-border-color-lighter);
  --md-code-bg: #f0f0f0;
  --md-code-color: #c7254e;
  --md-pre-bg: #f6f8fa;
  --md-pre-color: #333;
  --md-blockquote-border: #409eff;
  --md-blockquote-color: #666;
  --md-blockquote-bg: #f8f8f8;
  --md-table-border: 1px solid #ddd;
  --md-th-bg: #f5f5f5;
  --md-link-color: #1677ff;
  --md-hr-color: #eee;
}

/* 暗色 */
.markdown-body.theme-dark {
  --md-bg: #0d1117;
  --md-text: #c9d1d9;
  --md-heading-color: #e6edf3;
  --md-heading-border: #30363d;
  --md-code-bg: #161b22;
  --md-code-color: #f0883e;
  --md-pre-bg: #161b22;
  --md-pre-color: #c9d1d9;
  --md-pre-border: 1px solid #30363d;
  --md-blockquote-border: #58a6ff;
  --md-blockquote-color: #8b949e;
  --md-blockquote-bg: #161b22;
  --md-table-border: 1px solid #30363d;
  --md-th-bg: #161b22;
  --md-link-color: #58a6ff;
  --md-hr-color: #30363d;
}

/* GitHub */
.markdown-body.theme-github {
  --md-bg: #fff;
  --md-text: #1f2328;
  --md-h1-border-width: 1px;
  --md-h1-padding: 0.3em;
  --md-h2-border-width: 1px;
  --md-h2-padding: 0.3em;
  --md-heading-border: #d8dee4;
  --md-code-bg: #afb8c133;
  --md-code-color: #1f2328;
  --md-code-radius: 6px;
  --md-pre-bg: #f6f8fa;
  --md-pre-color: #1f2328;
  --md-blockquote-border: #d0d7de;
  --md-blockquote-color: #656d76;
  --md-table-border: 1px solid #d8dee4;
  --md-th-bg: #f6f8fa;
  --md-tr-even-bg: #f6f8fa;
  --md-link-color: #0969da;
  --md-hr-color: #d8dee4;
  font-family: -apple-system, 'Segoe UI', 'Noto Sans', Arial, sans-serif;
  font-size: 16px;
}

/* 简约 */
.markdown-body.theme-minimal {
  --md-bg: #fafaf8;
  --md-text: #333;
  --md-heading-color: #222;
  --md-heading-weight: 400;
  --md-heading-border: none;
  --md-h1-border-width: 0;
  --md-h2-border-width: 0;
  --md-h3-style: italic;
  --md-code-bg: #eee;
  --md-code-color: #000;
  --md-code-radius: 0;
  --md-pre-bg: #f0f0f0;
  --md-pre-color: #333;
  --md-blockquote-border: #999;
  --md-blockquote-border-width: 2px;
  --md-blockquote-color: #555;
  --md-blockquote-style: italic;
  --md-table-border: none;
  --md-th-bg: transparent;
  --md-link-color: #333;
  --md-link-decoration: underline;
  --md-hr-color: #ddd;
  font-family: 'Georgia', 'Times New Roman', serif;
  font-size: 16px;
  line-height: 1.8;
}
</style>

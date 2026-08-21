<!--
 * @Author: zhengrenfu
 * @Date: 2026-08-17
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-21 09:49:02
 * @FilePath: /src/tools/mermaid/MermaidPreview.vue
 * @Description: Mermaid 图表实时预览工具，支持主题切换、缩放、拖拽平移、导出图片和 PDF
-->
<template>
  <ToolLayout :copy-text="code">
    <template #toolbar>
      <el-button :icon="ZoomIn" size="small" @click="zoomBy(0.2)">放大</el-button>
      <el-button :icon="ZoomOut" size="small" @click="zoomBy(-0.2)">缩小</el-button>
      <el-button :icon="RefreshRight" size="small" @click="resetTransform">重置</el-button>
      <el-divider direction="vertical" />
      <span class="zoom-hint">{{ Math.round(scale * 100) }}%</span>
      <el-divider direction="vertical" />
      <span class="toolbar-label">主题：</span>
      <el-select v-model="activeTheme" size="small" style="width: 110px">
        <el-option v-for="t in themes" :key="t.id" :label="t.label" :value="t.id" />
      </el-select>
      <el-divider direction="vertical" />
      <span class="toolbar-label">背景：</span>
      <el-select v-model="activeBg" size="small" style="width: 130px">
        <el-option v-for="b in bgOptions" :key="b.id" :label="b.label" :value="b.id" />
      </el-select>
      <el-divider direction="vertical" />
      <el-button :icon="Download" size="small" :disabled="!renderedSvg" @click="exportSvg">导出 SVG</el-button>
      <el-button :icon="PictureFilled" size="small" :disabled="!renderedSvg" @click="exportPng">导出 PNG</el-button>
      <el-button :icon="Document" size="small" :disabled="!renderedSvg" @click="exportPdf">导出 PDF</el-button>
      <el-button :icon="DocumentCopy" size="small" :disabled="!renderedSvg" @click="copyToClipboard">
        复制到剪贴板
      </el-button>
    </template>

    <template #left-header>Mermaid 代码</template>
    <template #left>
      <el-input
        v-model="code"
        type="textarea"
        class="editor-textarea"
        placeholder="在此输入 Mermaid 代码，例如：&#10;graph TD&#10;    A[开始] --> B{判断}&#10;    B -->|是| C[执行]&#10;    B -->|否| D[结束]"
      />
    </template>

    <template #right-header>
      <span>预览（{{ currentThemeLabel }}）</span>
    </template>
    <template #right>
      <div
        ref="previewRef"
        class="mermaid-preview"
        :class="{ 'is-dark-theme': isDarkTheme }"
        :style="previewBgStyle"
        @mousedown="onMouseDown"
        @mousemove="onMouseMove"
        @mouseup="onMouseUp"
        @mouseleave="onMouseUp"
        @wheel.prevent="onWheel"
        @dblclick="resetTransform"
      >
        <div v-if="!code.trim() && !renderError" class="placeholder-text">在左侧输入 Mermaid 代码后实时预览</div>
        <div v-else-if="renderError" class="error-text">{{ renderError }}</div>
        <div v-else class="mermaid-viewport">
          <div class="mermaid-transform" :style="viewportStyle">
            <div class="mermaid-svg-container" v-html="renderedSvg" />
          </div>
        </div>
      </div>
    </template>
  </ToolLayout>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { ZoomIn, ZoomOut, RefreshRight, Download, PictureFilled, Document, DocumentCopy } from '@element-plus/icons-vue'
import mermaid from 'mermaid'
import type { MermaidConfig } from 'mermaid'
import jsPDF from 'jspdf'
import ToolLayout from '@/components/ToolLayout.vue'
import { useLogStore } from '@/stores/log.store'

const logStore = useLogStore()

// 预设主题定义
type MermaidThemeName =
  | 'default'
  | 'basic'
  | 'dark'
  | 'forest'
  | 'neutral'
  | 'neo'
  | 'neo-dark'
  | 'redux'
  | 'redux-dark'

interface MermaidTheme {
  id: MermaidThemeName
  label: string
}

const themes: MermaidTheme[] = [
  { id: 'default', label: '默认' },
  { id: 'basic', label: '基础' },
  { id: 'dark', label: '暗色' },
  { id: 'forest', label: '森林' },
  { id: 'neutral', label: '中性' },
  { id: 'neo', label: 'Neo' },
  { id: 'neo-dark', label: 'Neo 暗色' },
  { id: 'redux', label: 'Redux' },
  { id: 'redux-dark', label: 'Redux 暗色' },
]

// 主题对应 mermaid 配置：内置主题直接映射，自定义主题基于 base 主题定制 themeVariables
interface MermaidThemeConfig {
  theme: NonNullable<MermaidConfig['theme']>
  themeVariables?: Record<string, string>
}

const themeConfigs: Record<MermaidThemeName, MermaidThemeConfig> = {
  default: { theme: 'default' },
  dark: { theme: 'dark' },
  forest: { theme: 'forest' },
  neutral: { theme: 'neutral' },
  neo: { theme: 'neo' },
  'neo-dark': { theme: 'neo-dark' },
  redux: { theme: 'redux' },
  'redux-dark': { theme: 'redux-dark' },
  // 基础主题：白底节点、浅灰边框(#cccccc)、深灰文字(#333333)、灰线条(#696969)、深灰箭头(#666666)
  basic: {
    theme: 'base',
    themeVariables: {
      primaryColor: '#ffffff',
      secondaryColor: '#ffffff',
      tertiaryColor: '#ffffff',
      primaryTextColor: '#333333',
      secondaryTextColor: '#333333',
      tertiaryTextColor: '#333333',
      primaryBorderColor: '#cccccc',
      secondaryBorderColor: '#cccccc',
      tertiaryBorderColor: '#cccccc',
      lineColor: '#696969',
      arrowheadColor: '#666666',
    },
  },
}

// 预览背景选项
interface BgOption {
  id: string
  label: string
}

const bgOptions: BgOption[] = [
  { id: 'transparent', label: '默认（透明）' },
  { id: 'white', label: '白色' },
  { id: 'gray', label: '灰色' },
  { id: 'blue', label: '蓝色' },
  { id: 'green', label: '绿色' },
  { id: 'dots', label: '圆点' },
  { id: 'grid', label: '网格' },
]

const activeBg = ref('transparent')

// 各背景对应的 CSS background 值（transparent 不设置，跟随主题背景）
const bgStyles: Record<string, string> = {
  white: '#ffffff',
  gray: '#e0e0e0',
  blue: '#e6f2ff',
  green: '#e6f7e6',
  dots: 'radial-gradient(circle, #cccccc 1px, transparent 1px) 0 0 / 20px 20px, #ffffff',
  grid: 'linear-gradient(#e5e5e5 1px, transparent 1px) 0 0 / 20px 20px, linear-gradient(90deg, #e5e5e5 1px, transparent 1px) 0 0 / 20px 20px, #ffffff',
}

const previewBgStyle = computed(() => {
  const bg = bgStyles[activeBg.value]
  return bg ? { background: bg } : {}
})

const code = ref('')
const renderedSvg = ref('')
const renderError = ref('')
const previewRef = ref<HTMLElement>()
const renderId = ref(0)
const activeTheme = ref<MermaidThemeName>('default')
const filenameTemplate = ref('{{year}}{{month}}{{day}}-{{hour}}{{minute}}{{second}}')

// 缩放与平移状态
const scale = ref(1)
const translateX = ref(0)
const translateY = ref(0)
let isDragging = false
let dragStartX = 0
let dragStartY = 0
let dragStartTranslateX = 0
let dragStartTranslateY = 0

const currentThemeLabel = computed(() => {
  return themes.find((t) => t.id === activeTheme.value)?.label || '默认'
})

// 判断当前是否为暗色系主题
const isDarkTheme = computed(() => {
  return activeTheme.value === 'dark' || activeTheme.value === 'neo-dark' || activeTheme.value === 'redux-dark'
})

const viewportStyle = computed(() => ({
  transform: `translate(${translateX.value}px, ${translateY.value}px) scale(${scale.value})`,
  transformOrigin: '0 0',
}))

// mermaid 初始化配置
onMounted(async () => {
  // 加载上次选择的主题
  try {
    const savedTheme = await window.electronAPI.invoke('store:get', 'mermaid.preview.theme')
    if (savedTheme && themes.some((t) => t.id === savedTheme)) {
      activeTheme.value = savedTheme
    }
  } catch {
    // 使用默认主题
  }
  // 加载上次选择的背景
  try {
    const savedBg = await window.electronAPI.invoke('store:get', 'mermaid.preview.background')
    if (savedBg && bgOptions.some((b) => b.id === savedBg)) {
      activeBg.value = savedBg
    }
  } catch {
    // 使用默认背景
  }
  const themeConfig = themeConfigs[activeTheme.value]
  mermaid.initialize({
    startOnLoad: false,
    theme: themeConfig.theme,
    themeVariables: themeConfig.themeVariables,
    securityLevel: 'loose',
  })
  // 加载导出文件名模板配置
  try {
    const tpl = await window.electronAPI.invoke('settings:get', 'mermaid.preview.filenameTemplate')
    if (tpl) filenameTemplate.value = tpl
  } catch {
    // 使用默认值
  }
})

/**
 * 将文件名模板中的变量替换为当前日期时间值
 * @param ext 文件扩展名（不含点号）
 * @returns 解析后的文件名
 */
function resolveFilename(ext: string): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const vars: Record<string, string> = {
    year: String(now.getFullYear()),
    month: pad(now.getMonth() + 1),
    day: pad(now.getDate()),
    hour: pad(now.getHours()),
    minute: pad(now.getMinutes()),
    second: pad(now.getSeconds()),
  }
  let name = filenameTemplate.value
  for (const [key, val] of Object.entries(vars)) {
    name = name.replaceAll(`{{${key}}}`, val)
  }
  return `${name}.${ext}`
}

// 防抖渲染
let renderTimer: ReturnType<typeof setTimeout> | null = null

watch(code, () => {
  scheduleRender()
})

// 主题切换时重新渲染并持久化选择
watch(activeTheme, (newTheme) => {
  const themeConfig = themeConfigs[newTheme]
  mermaid.initialize({
    startOnLoad: false,
    theme: themeConfig.theme,
    themeVariables: themeConfig.themeVariables,
    securityLevel: 'loose',
  })
  scheduleRender()
  // 记录上次选择的主题，下次打开时恢复
  window.electronAPI
    .invoke('store:set', 'mermaid.preview.theme', newTheme)
    .catch(() => {})
})

// 背景切换时持久化选择
watch(activeBg, (newBg) => {
  window.electronAPI
    .invoke('store:set', 'mermaid.preview.background', newBg)
    .catch(() => {})
})

function scheduleRender() {
  if (renderTimer) clearTimeout(renderTimer)
  renderTimer = setTimeout(() => renderDiagram(code.value), 300)
}

/**
 * 渲染 Mermaid 代码为 SVG
 * @param mermaidCode Mermaid 源代码
 */
async function renderDiagram(mermaidCode: string) {
  const trimmed = mermaidCode.trim()
  if (!trimmed) {
    renderedSvg.value = ''
    renderError.value = ''
    return
  }
  renderId.value++
  try {
    const { svg } = await mermaid.render(`mermaid-${renderId.value}`, trimmed)
    renderedSvg.value = svg
    renderError.value = ''
  } catch (e: any) {
    renderedSvg.value = ''
    renderError.value = e.message || '渲染失败，请检查 Mermaid 语法'
  }
}

// 缩放操作
function zoomBy(delta: number) {
  const newScale = Math.min(5, Math.max(0.1, scale.value + delta))
  scale.value = newScale
}

function resetTransform() {
  scale.value = 1
  translateX.value = 0
  translateY.value = 0
}

// 鼠标拖拽平移
function onMouseDown(e: MouseEvent) {
  if (e.button !== 0) return
  isDragging = true
  dragStartX = e.clientX
  dragStartY = e.clientY
  dragStartTranslateX = translateX.value
  dragStartTranslateY = translateY.value
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging) return
  translateX.value = dragStartTranslateX + (e.clientX - dragStartX)
  translateY.value = dragStartTranslateY + (e.clientY - dragStartY)
}

function onMouseUp() {
  isDragging = false
}

// 滚轮缩放（以鼠标位置为中心）
function onWheel(e: WheelEvent) {
  const delta = e.deltaY > 0 ? -0.1 : 0.1
  const newScale = Math.min(5, Math.max(0.1, scale.value + delta))
  const rect = previewRef.value?.getBoundingClientRect()
  if (!rect) return
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top
  translateX.value = mouseX - ((mouseX - translateX.value) * newScale) / scale.value
  translateY.value = mouseY - ((mouseY - translateY.value) * newScale) / scale.value
  scale.value = newScale
}

// 获取渲染后的 SVG 元素
function getSvgElement(): SVGElement | null {
  const container = previewRef.value?.querySelector('.mermaid-svg-container')
  return container?.querySelector('svg') || null
}

/**
 * 从 SVG 元素提取实际渲染尺寸
 * @param svgEl SVG 元素
 * @returns 宽度和高度（像素）
 */
function getSvgSize(svgEl: SVGElement): { width: number; height: number } {
  // 优先从 viewBox 计算
  const viewBox = svgEl.getAttribute('viewBox')
  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map(Number)
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3] }
    }
  }
  // 其次从 width/height 属性读取
  const w = parseFloat(svgEl.getAttribute('width') || '0')
  const h = parseFloat(svgEl.getAttribute('height') || '0')
  if (w > 0 && h > 0) return { width: w, height: h }
  // 兜底：使用元素实际渲染尺寸
  const rect = svgEl.getBoundingClientRect()
  return { width: rect.width || 800, height: rect.height || 600 }
}

/**
 * 克隆 SVG 并清理外部资源引用，避免 canvas 被污染
 * 保留 foreignObject 中的文字内容，仅移除外部字体引用
 * @param svgEl 原始 SVG 元素
 * @returns 清理后的 SVG 字符串
 */
function sanitizeSvg(svgEl: SVGElement): string {
  const clone = svgEl.cloneNode(true) as SVGElement
  // 清理 style 标签中的外部资源引用（font-face url 等）
  clone.querySelectorAll('style').forEach((style) => {
    const text = style.textContent || ''
    // 移除 @font-face 声明和 url() 引用
    const cleaned = text.replace(/@font-face\s*\{[^}]*\}/g, '').replace(/url\([^)]*\)/g, '')
    style.textContent = cleaned
  })
  // 清理 foreignObject 中的外部字体引用，保留文字结构
  clone.querySelectorAll('foreignObject').forEach((fo) => {
    fo.querySelectorAll('*').forEach((el) => {
      // 移除 style 属性中的 url() 引用
      const styleAttr = el.getAttribute('style') || ''
      if (styleAttr.includes('url(')) {
        el.setAttribute('style', styleAttr.replace(/url\([^)]*\)/g, ''))
      }
    })
  })
  // 确保 xmlns 属性存在
  if (!clone.getAttribute('xmlns')) {
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  }
  return new XMLSerializer().serializeToString(clone)
}

// 根据当前主题获取导出背景色
function getExportBackground(): string {
  return isDarkTheme.value ? '#1e1e1e' : '#ffffff'
}

/**
 * 将 SVG 字符串转为 data URL（避免 object URL 污染 canvas）
 * @param svgString SVG 字符串
 * @returns data URL
 */
function svgToDataUrl(svgString: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString)
}

// 导出 SVG 文件
async function exportSvg() {
  const svgEl = getSvgElement()
  if (!svgEl) return
  const svgData = new XMLSerializer().serializeToString(svgEl)
  const fullSvg = `<?xml version="1.0" encoding="UTF-8"?>\n${svgData}`
  try {
    const savePath = await window.electronAPI.invoke('system:saveFile', resolveFilename('svg'), [
      { name: 'SVG 文件', extensions: ['svg'] },
    ])
    if (!savePath) return
    const bytes = Array.from(new TextEncoder().encode(fullSvg))
    await window.electronAPI.invoke('tool:saveFile', savePath, bytes)
    logStore.addLog('success', 'SVG 文件已保存')
  } catch (e: any) {
    logStore.addLog('error', '保存失败: ' + (e.message || '未知错误'))
  }
}

/**
 * 将渲染后的 SVG 导出为图片文件
 * @param format 导出格式 'png' | 'pdf'
 */
async function exportAsImage(format: 'png' | 'pdf') {
  const svgEl = getSvgElement()
  if (!svgEl) return
  try {
    const svgSize = getSvgSize(svgEl)
    const cleanSvg = sanitizeSvg(svgEl)
    const dataUrl = svgToDataUrl(cleanSvg)
    const img = new Image()
    img.onload = async () => {
      // 使用 2 倍分辨率导出，确保清晰度
      const scale = 2
      const padding = 20
      const canvas = document.createElement('canvas')
      canvas.width = (svgSize.width + padding * 2) * scale
      canvas.height = (svgSize.height + padding * 2) * scale
      const ctx = canvas.getContext('2d')!
      ctx.scale(scale, scale)
      // PNG 保持透明背景，PDF 填充实色背景
      if (format === 'pdf') {
        ctx.fillStyle = getExportBackground()
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      ctx.drawImage(img, padding, padding, svgSize.width, svgSize.height)
      if (format === 'png') {
        await saveCanvasAsPng(canvas)
      } else {
        await saveCanvasAsPdf(canvas)
      }
    }
    img.src = dataUrl
  } catch (e: any) {
    logStore.addLog('error', `导出 ${format.toUpperCase()} 失败: ` + (e.message || '未知错误'))
  }
}

/**
 * 将 canvas 保存为 PNG 文件
 * @param canvas 画布元素
 */
async function saveCanvasAsPng(canvas: HTMLCanvasElement) {
  return new Promise<void>((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return resolve()
      const buffer = await blob.arrayBuffer()
      const bytes = Array.from(new Uint8Array(buffer))
      const savePath = await window.electronAPI.invoke('system:saveFile', resolveFilename('png'), [
        { name: 'PNG 图片', extensions: ['png'] },
      ])
      if (!savePath) return resolve()
      await window.electronAPI.invoke('tool:saveFile', savePath, bytes)
      logStore.addLog('success', 'PNG 图片已保存')
      resolve()
    }, 'image/png')
  })
}

/**
 * 将 canvas 保存为 PDF 文件
 * @param canvas 画布元素
 */
async function saveCanvasAsPdf(canvas: HTMLCanvasElement) {
  const imgData = canvas.toDataURL('image/png')
  const pxWidth = canvas.width
  const pxHeight = canvas.height
  const pdfWidth = pxWidth * 0.264583
  const pdfHeight = pxHeight * 0.264583
  const pdf = new jsPDF({
    orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [pdfWidth, pdfHeight],
  })
  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
  const pdfBytes = Array.from(new Uint8Array(pdf.output('arraybuffer')))
  const savePath = await window.electronAPI.invoke('system:saveFile', resolveFilename('pdf'), [
    { name: 'PDF 文件', extensions: ['pdf'] },
  ])
  if (!savePath) return
  await window.electronAPI.invoke('tool:saveFile', savePath, pdfBytes)
  logStore.addLog('success', 'PDF 文件已保存')
}

// 导出 PNG 文件
function exportPng() {
  return exportAsImage('png')
}

// 导出 PDF 文件
function exportPdf() {
  return exportAsImage('pdf')
}

// 复制渲染结果到剪贴板（透明背景 PNG）
async function copyToClipboard() {
  const svgEl = getSvgElement()
  if (!svgEl) return
  try {
    const svgSize = getSvgSize(svgEl)
    const cleanSvg = sanitizeSvg(svgEl)
    const dataUrl = svgToDataUrl(cleanSvg)
    const img = new Image()
    img.onload = async () => {
      const scale = 2
      const canvas = document.createElement('canvas')
      canvas.width = svgSize.width * scale
      canvas.height = svgSize.height * scale
      const ctx = canvas.getContext('2d')!
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0, svgSize.width, svgSize.height)
      canvas.toBlob(async (blob) => {
        if (!blob) return
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
          logStore.addLog('success', '已复制到剪贴板')
        } catch {
          logStore.addLog('error', '复制失败，请手动复制')
        }
      }, 'image/png')
    }
    img.src = dataUrl
  } catch (e: any) {
    logStore.addLog('error', '复制失败: ' + (e.message || '未知错误'))
  }
}
</script>

<style scoped>
.mermaid-preview {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
  cursor: grab;
  background: var(--el-bg-color);
}
.mermaid-preview:active {
  cursor: grabbing;
}
.mermaid-preview.is-dark-theme {
  background: #1e1e1e;
}
.mermaid-viewport {
  width: 100%;
  height: 100%;
  overflow: auto;
}
.mermaid-transform {
  width: 100%;
  height: 100%;
}
.mermaid-svg-container {
  display: inline-block;
  min-width: 100%;
  min-height: 100%;
  padding: 12px;
}
.mermaid-svg-container :deep(svg) {
  max-width: none;
}
.zoom-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  min-width: 40px;
  text-align: center;
}
.toolbar-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>

<!--
 * @Author: zhengrenfu
 * @Date: 2026-08-15
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-15
 * @FilePath: \src\tools\image\ImageConvert.vue
 * @Description: 图片格式转换工具，在 JPG、PNG、WebP、GIF、BMP、TIFF、AVIF、ICO 之间互转，支持质量调节
-->
<template>
  <ToolLayout>
    <template #toolbar>
      <el-upload
        :auto-upload="false"
        :show-file-list="false"
        accept=".jpg,.jpeg,.png,.webp,.gif,.bmp,.tif,.tiff,.avif,.ico,.svg"
        @change="handleFileOpen"
      >
        <el-button :icon="FolderOpened" size="small">打开图片</el-button>
      </el-upload>
      <el-button :icon="RefreshRight" size="small" @click="clearInput">清空</el-button>
      <el-divider direction="vertical" />
      <span class="toolbar-label">目标格式：</span>
      <el-select v-model="targetFormat" size="small" style="width: 100px">
        <el-option v-for="f in FORMATS" :key="f.value" :label="f.label" :value="f.value" />
      </el-select>
      <template v-if="isLossyFormat">
        <el-divider direction="vertical" />
        <span class="toolbar-label">质量：</span>
        <el-slider v-model="quality" :min="1" :max="100" size="small" style="width: 140px" />
        <span class="toolbar-label">{{ quality }}</span>
      </template>
      <el-divider direction="vertical" />
      <el-button
        :icon="Download"
        type="primary"
        size="small"
        :disabled="!outputBytes"
        :loading="exporting"
        @click="saveAs"
      >
        保存结果
      </el-button>
      <span class="file-name" v-if="currentFile">{{ currentFile }}</span>
    </template>

    <template #left-header>
      <span
        >原图<span v-if="inputInfo">（{{ inputInfo }}）</span></span
      >
    </template>
    <template #left>
      <div class="image-area" v-loading="converting">
        <div v-if="!inputUrl && !parseError" class="placeholder-text">打开图片后在此预览</div>
        <div v-else-if="parseError" class="error-text">{{ parseError }}</div>
        <img v-else :src="inputUrl" class="preview-image" @load="onInputLoad" />
      </div>
    </template>

    <template #right-header>
      <span
        >转换结果<span v-if="outputInfo">（{{ outputInfo }}）</span></span
      >
    </template>
    <template #right>
      <div class="image-area" v-loading="converting">
        <div v-if="!outputUrl && !parseError" class="placeholder-text">转换后在此预览</div>
        <div v-else-if="parseError" class="error-text">{{ parseError }}</div>
        <img v-else :src="outputUrl" class="preview-image" @load="onOutputLoad" />
      </div>
    </template>
  </ToolLayout>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { FolderOpened, RefreshRight, Download } from '@element-plus/icons-vue'
import type { UploadFile } from 'element-plus'
import ToolLayout from '@/components/ToolLayout.vue'
import { useLogStore } from '@/stores/log.store'

const logStore = useLogStore()

// 支持的目标输出格式
const FORMATS = [
  { label: 'JPG', value: 'jpg' },
  { label: 'PNG', value: 'png' },
  { label: 'WebP', value: 'webp' },
  { label: 'GIF', value: 'gif' },
  { label: 'BMP', value: 'bmp' },
  { label: 'TIFF', value: 'tiff' },
  { label: 'AVIF', value: 'avif' },
  { label: 'ICO', value: 'ico' },
]

// 单文件大小上限，单位 MB
const MAX_FILE_SIZE_MB = 50

const fileBytes = ref<Uint8Array | null>(null)
const fileSize = ref(0)
const inputFormat = ref('')
const currentFile = ref('')
const targetFormat = ref('jpg')
const quality = ref(90)

const inputUrl = ref('')
const outputUrl = ref('')
const outputBytes = ref<number[] | null>(null)
const outputSize = ref(0)

const inputWidth = ref(0)
const inputHeight = ref(0)
const outputWidth = ref(0)
const outputHeight = ref(0)

const parseError = ref('')
const converting = ref(false)
const exporting = ref(false)

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let inputObjectUrl: string | null = null
let outputObjectUrl: string | null = null

// 有损格式才显示质量滑块
const isLossyFormat = computed(() => ['jpg', 'webp', 'avif'].includes(targetFormat.value))

// 原图信息文本
const inputInfo = computed(() => {
  if (!currentFile.value) return ''
  const parts = [inputFormat.value.toUpperCase()]
  if (inputWidth.value > 0) parts.push(`${inputWidth.value}×${inputHeight.value}`)
  parts.push(formatSize(fileSize.value))
  return parts.join(' · ')
})

// 转换结果信息文本
const outputInfo = computed(() => {
  if (!outputSize.value) return ''
  const parts = [targetFormat.value.toUpperCase()]
  if (outputWidth.value > 0) parts.push(`${outputWidth.value}×${outputHeight.value}`)
  parts.push(formatSize(outputSize.value))
  return parts.join(' · ')
})

/**
 * 获取目标格式对应的 MIME 类型
 * @param format 格式扩展名
 * @returns MIME 类型
 */
function mimeType(format: string): string {
  switch (format) {
    case 'jpg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    case 'bmp':
      return 'image/bmp'
    case 'tiff':
      return 'image/tiff'
    case 'avif':
      return 'image/avif'
    case 'ico':
      return 'image/x-icon'
    default:
      return 'application/octet-stream'
  }
}

/**
 * 将字节数格式化为可读文本
 * @param bytes 字节数
 * @returns 可读大小文本
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

// 清空转换结果
function resetOutput() {
  outputBytes.value = null
  outputSize.value = 0
  outputWidth.value = 0
  outputHeight.value = 0
  if (outputObjectUrl) URL.revokeObjectURL(outputObjectUrl)
  outputObjectUrl = null
  outputUrl.value = ''
}

async function doConvert() {
  if (!fileBytes.value) return
  converting.value = true
  try {
    const result = await window.electronAPI.invoke('tool:execute', 'image-convert', {
      bytes: fileBytes.value,
      inputFormat: inputFormat.value,
      targetFormat: targetFormat.value,
      quality: quality.value,
    })
    if (result.success) {
      const bytes = new Uint8Array(result.data.bytes)
      outputBytes.value = Array.from(bytes)
      outputSize.value = result.data.outputSize || bytes.length
      if (outputObjectUrl) URL.revokeObjectURL(outputObjectUrl)
      const blob = new Blob([bytes], { type: mimeType(targetFormat.value) })
      outputObjectUrl = URL.createObjectURL(blob)
      outputUrl.value = outputObjectUrl
      outputWidth.value = 0
      outputHeight.value = 0
      parseError.value = ''
    } else {
      resetOutput()
      parseError.value = result.error || '转换失败'
    }
  } catch (e: any) {
    resetOutput()
    parseError.value = e.message || '转换失败'
  } finally {
    converting.value = false
  }
}

// 切换格式或质量后防抖重新转换
watch([targetFormat, quality], () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(doConvert, 300)
})

async function handleFileOpen(uploadFile: UploadFile) {
  const file = uploadFile.raw
  if (!file) return
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    logStore.addLog('error', `文件过大，请选择 ${MAX_FILE_SIZE_MB}MB 以内的图片`)
    return
  }
  try {
    const buffer = await file.arrayBuffer()
    fileBytes.value = new Uint8Array(buffer)
    fileSize.value = file.size
    currentFile.value = file.name
    inputFormat.value = file.name.split('.').pop()?.toLowerCase() || 'png'
    parseError.value = ''
    inputWidth.value = 0
    inputHeight.value = 0
    if (inputObjectUrl) URL.revokeObjectURL(inputObjectUrl)
    inputObjectUrl = URL.createObjectURL(file)
    inputUrl.value = inputObjectUrl
    resetOutput()
    doConvert()
  } catch {
    logStore.addLog('error', '文件读取失败')
  }
}

function clearInput() {
  fileBytes.value = null
  fileSize.value = 0
  inputFormat.value = ''
  currentFile.value = ''
  inputWidth.value = 0
  inputHeight.value = 0
  parseError.value = ''
  if (inputObjectUrl) URL.revokeObjectURL(inputObjectUrl)
  inputObjectUrl = null
  inputUrl.value = ''
  resetOutput()
}

function onInputLoad(e: Event) {
  const img = e.target as HTMLImageElement
  inputWidth.value = img.naturalWidth
  inputHeight.value = img.naturalHeight
}

function onOutputLoad(e: Event) {
  const img = e.target as HTMLImageElement
  outputWidth.value = img.naturalWidth
  outputHeight.value = img.naturalHeight
}

async function saveAs() {
  if (!outputBytes.value) return
  exporting.value = true
  try {
    const baseName = currentFile.value ? currentFile.value.replace(/\.[^.]+$/, '') : 'output'
    const defaultName = `${baseName}.${targetFormat.value}`
    const savePath = await window.electronAPI.invoke('system:saveFile', defaultName, [
      { name: `${targetFormat.value.toUpperCase()} 图片`, extensions: [targetFormat.value] },
    ])
    if (!savePath) return
    // ref 数组为 reactive Proxy，不可直接过 IPC 序列化，先转为原始数组
    await window.electronAPI.invoke('tool:saveFile', savePath, Array.from(outputBytes.value))
    logStore.addLog('success', '图片已保存')
  } catch (e: any) {
    logStore.addLog('error', '保存失败: ' + (e.message || '未知错误'))
  } finally {
    exporting.value = false
  }
}

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (inputObjectUrl) URL.revokeObjectURL(inputObjectUrl)
  if (outputObjectUrl) URL.revokeObjectURL(outputObjectUrl)
})
</script>

<style scoped>
.image-area {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--app-space-3);
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
</style>

<!--
 * @Author: zhengrenfu
 * @Date: 2026-08-14
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-14
 * @FilePath: \src\tools\excel\DataMasking.vue
 * @Description: Excel 数据脱敏工具，保留单元格首尾字符、中间替换为星号，支持设置前 N 行不脱敏
-->
<template>
  <ToolLayout :copy-text="maskedTsv">
    <template #toolbar>
      <el-upload :auto-upload="false" :show-file-list="false" accept=".xlsx,.xls" @change="handleFileOpen">
        <el-button :icon="FolderOpened" size="small">打开 Excel 文件</el-button>
      </el-upload>
      <el-button :icon="RefreshRight" size="small" @click="clearInput">清空</el-button>
      <span class="toolbar-label">前</span>
      <el-input-number v-model="skipRows" :min="0" size="small" controls-position="right" style="width: 90px" />
      <span class="toolbar-label">行不脱敏</span>
      <el-select
        v-model="excludeColumns"
        multiple
        collapse-tags
        collapse-tags-tooltip
        clearable
        size="small"
        placeholder="不脱敏列"
        style="min-width: 130px"
      >
        <el-option v-for="col in columnOptions" :key="col.index" :label="col.label" :value="col.index" />
      </el-select>
      <el-button
        :icon="Download"
        type="primary"
        size="small"
        :disabled="!fileBytes"
        :loading="exporting"
        @click="saveAsExcel"
      >
        保存脱敏结果
      </el-button>
      <span class="file-name" v-if="currentFile">{{ currentFile }}</span>
    </template>

    <template #left-header>
      <span v-if="sheetName">原始数据（{{ sheetName }}）</span>
      <span v-else>原始数据</span>
    </template>
    <template #left>
      <div class="result-area">
        <div v-if="!previewOriginal.length && !parseError" class="placeholder-text">
          打开 Excel 文件后自动显示原始数据预览
        </div>
        <div v-else-if="parseError" class="error-text">{{ parseError }}</div>
        <el-table v-else v-loading="converting" :data="originalData" size="small" border stripe class="data-table">
          <el-table-column
            v-for="col in tableColumns"
            :key="col.prop"
            :prop="col.prop"
            :label="col.label"
            min-width="110"
            show-overflow-tooltip
          />
        </el-table>
      </div>
    </template>

    <template #right-header>
      <span v-if="totalRows">脱敏结果（{{ totalRows }} 行 {{ totalCols }} 列）</span>
      <span v-else>脱敏结果</span>
    </template>
    <template #right>
      <div class="result-area">
        <div v-if="!previewMasked.length && !parseError" class="placeholder-text">脱敏后自动显示结果预览</div>
        <div v-else-if="parseError" class="error-text">{{ parseError }}</div>
        <el-table v-else v-loading="converting" :data="maskedData" size="small" border stripe class="data-table">
          <el-table-column
            v-for="col in tableColumns"
            :key="col.prop"
            :prop="col.prop"
            :label="col.label"
            min-width="110"
            show-overflow-tooltip
          />
        </el-table>
      </div>
    </template>
  </ToolLayout>
</template>

<script setup lang="ts">
import { computed, ref, toRaw, watch } from 'vue'
import { FolderOpened, RefreshRight, Download } from '@element-plus/icons-vue'
import type { UploadFile } from 'element-plus'
import ToolLayout from '@/components/ToolLayout.vue'
import { useLogStore } from '@/stores/log.store'

const logStore = useLogStore()

// 单文件大小上限，单位 MB
const MAX_FILE_SIZE_MB = 50
// 预览显示的最大行数，与主进程脱敏执行器保持一致
const PREVIEW_LIMIT = 30

const fileBytes = ref<Uint8Array | null>(null)
const currentFile = ref('')
const sheetName = ref('')
const skipRows = ref(1)
// 不参与脱敏的列索引集合
const excludeColumns = ref<number[]>([])
const previewOriginal = ref<string[][]>([])
const previewMasked = ref<string[][]>([])
const totalRows = ref(0)
const totalCols = ref(0)
const outputBase64 = ref('')
const parseError = ref('')
const converting = ref(false)
const exporting = ref(false)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

// 表格列定义，前 N 行不脱敏时首行作为表头
const tableColumns = computed(() => {
  const useHeader = skipRows.value >= 1
  const header = useHeader && previewOriginal.value.length > 0 ? previewOriginal.value[0] : []
  const count = Math.max(totalCols.value, header.length)
  return Array.from({ length: count }, (_, i) => ({
    prop: `col${i}`,
    label: header[i] || `列${i + 1}`,
  }))
})

// 列选择选项，值为列索引，标签为表头或默认列名
const columnOptions = computed(() =>
  tableColumns.value.map((col, index) => ({
    index,
    label: col.label,
  })),
)

// 原始数据表格行
const originalData = computed(() => toTableData(previewOriginal.value))

// 脱敏数据表格行
const maskedData = computed(() => toTableData(previewMasked.value))

// 脱敏结果制表符分隔文本，用于复制
const maskedTsv = computed(() => previewMasked.value.map((row) => row.join('\t')).join('\n'))

/**
 * 将二维行数据转换为表格组件使用的对象数组
 * @param rows 二维行数据
 * @returns 表格对象数组，首行为表头时不参与数据展示
 */
function toTableData(rows: string[][]): Record<string, string>[] {
  const dataRows = skipRows.value >= 1 ? rows.slice(1) : rows
  return dataRows.map((row) => {
    const obj: Record<string, string> = {}
    row.forEach((cell, i) => {
      obj[`col${i}`] = cell
    })
    return obj
  })
}

// 清空转换结果
function resetResult() {
  previewOriginal.value = []
  previewMasked.value = []
  totalRows.value = 0
  totalCols.value = 0
  outputBase64.value = ''
}

async function doConvert() {
  if (!fileBytes.value) return
  converting.value = true
  try {
    const result = await window.electronAPI.invoke('tool:execute', 'excel-mask', {
      bytes: fileBytes.value,
      skipRows: skipRows.value,
      excludeColumns: toRaw(excludeColumns.value),
    })
    if (result.success) {
      previewOriginal.value = result.data.previewOriginal
      previewMasked.value = result.data.previewMasked
      sheetName.value = result.data.sheetName
      totalRows.value = result.data.totalRows
      totalCols.value = result.data.totalCols
      outputBase64.value = result.data.base64
      parseError.value = ''
      if (result.data.truncated) {
        logStore.addLog('info', `数据行数较多，仅预览前 ${PREVIEW_LIMIT} 行，导出不受影响`)
      }
    } else {
      resetResult()
      parseError.value = result.error || '脱敏处理失败'
    }
  } catch (e: any) {
    resetResult()
    parseError.value = e.message || '脱敏处理失败'
  } finally {
    converting.value = false
  }
}

watch([skipRows, excludeColumns], () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(doConvert, 300)
})

async function handleFileOpen(uploadFile: UploadFile) {
  const file = uploadFile.raw
  if (!file) return
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    logStore.addLog('error', `文件过大，请选择 ${MAX_FILE_SIZE_MB}MB 以内的 Excel 文件`)
    return
  }
  try {
    const buffer = await file.arrayBuffer()
    fileBytes.value = new Uint8Array(buffer)
    currentFile.value = file.name
    excludeColumns.value = []
    parseError.value = ''
    doConvert()
  } catch {
    logStore.addLog('error', '文件读取失败')
  }
}

function clearInput() {
  fileBytes.value = null
  currentFile.value = ''
  sheetName.value = ''
  excludeColumns.value = []
  parseError.value = ''
  resetResult()
}

/**
 * 将 base64 字符串解码为字节数组
 * @param base64 base64 编码的文本
 * @returns 字节数组
 */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function saveAsExcel() {
  if (!outputBase64.value) return
  exporting.value = true
  try {
    const defaultName = currentFile.value
      ? currentFile.value.replace(/\.(xlsx|xls)$/i, '') + '_masked.xlsx'
      : 'data_masked.xlsx'
    const savePath = await window.electronAPI.invoke('system:saveFile', defaultName, [
      { name: 'Excel 文件', extensions: ['xlsx'] },
    ])
    if (!savePath) return
    const bytes = base64ToBytes(outputBase64.value)
    await window.electronAPI.invoke('tool:saveFile', savePath, Array.from(bytes))
    logStore.addLog('success', '脱敏文件已保存')
  } catch (e: any) {
    logStore.addLog('error', '保存失败: ' + (e.message || '未知错误'))
  } finally {
    exporting.value = false
  }
}
</script>

<style scoped>
.data-table {
  width: 100%;
}
</style>

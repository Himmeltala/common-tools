<!--
 * @Author: zhengrenfu
 * @Date: 2026-08-14
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-14
 * @FilePath: \src\tools\excel\ExcelToCsv.vue
 * @Description: Excel 转 CSV 工具，读取 Excel 首个/指定工作表并转换为 CSV，支持选择工作表与分隔符
-->
<template>
  <ToolLayout :copy-text="csvText">
    <template #toolbar>
      <el-upload :auto-upload="false" :show-file-list="false" accept=".xlsx,.xls" @change="handleFileOpen">
        <el-button :icon="FolderOpened" size="small">打开 Excel 文件</el-button>
      </el-upload>
      <el-button :icon="RefreshRight" size="small" @click="clearInput">清空</el-button>
      <el-divider direction="vertical" />
      <template v-if="sheetNames.length > 1">
        <span class="toolbar-label">工作表：</span>
        <el-select v-model="selectedSheet" size="small" style="width: 140px" @change="doConvert">
          <el-option v-for="name in sheetNames" :key="name" :label="name" :value="name" />
        </el-select>
        <el-divider direction="vertical" />
      </template>
      <span class="toolbar-label">分隔符：</span>
      <el-select v-model="separator" size="small" style="width: 90px" @change="doConvert">
        <el-option label="逗号 (,)" value="," />
        <el-option label="制表符" value="\t" />
        <el-option label="分号 (;)" value=";" />
      </el-select>
      <el-divider direction="vertical" />
      <el-button :icon="Download" type="primary" size="small" :disabled="!csvText" @click="saveAsCsv">
        保存为 CSV
      </el-button>
      <span class="file-name" v-if="currentFile">{{ currentFile }}</span>
    </template>

    <template #left-header>
      <span v-if="selectedSheet">原始数据（{{ selectedSheet }}）</span>
      <span v-else>原始数据</span>
    </template>
    <template #left>
      <div class="result-area">
        <div v-if="!previewRows.length && !parseError" class="placeholder-text">
          打开 Excel 文件后自动显示数据预览
        </div>
        <div v-else-if="parseError" class="error-text">{{ parseError }}</div>
        <el-table v-else v-loading="converting" :data="tableData" size="small" border stripe class="data-table">
          <el-table-column
            v-for="col in tableColumns"
            :key="col.prop"
            :prop="col.prop"
            :label="col.label"
            min-width="110"
            show-overflow-tooltip
          />
        </el-table>
        <div v-if="truncated" class="truncate-hint">
          数据行数较多，仅预览前 {{ PREVIEW_LIMIT }} 行，导出不受影响
        </div>
      </div>
    </template>

    <template #right-header>
      <span>CSV 结果（{{ totalRows }} 行 {{ totalCols }} 列）</span>
    </template>
    <template #right>
      <div class="result-area">
        <div v-if="!csvText && !parseError" class="placeholder-text">打开 Excel 文件后自动显示 CSV 结果</div>
        <div v-else-if="parseError" class="error-text">{{ parseError }}</div>
        <template v-else>
          <pre class="code-output"><code>{{ displayCsv.text }}</code></pre>
          <div v-if="displayCsv.truncated" class="truncate-hint">
            内容过长，仅显示前 {{ MAX_DISPLAY_LINES }} 行（共 {{ displayCsv.totalLines }} 行），复制与保存不受影响
          </div>
        </template>
      </div>
    </template>
  </ToolLayout>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { FolderOpened, RefreshRight, Download } from '@element-plus/icons-vue'
import type { UploadFile } from 'element-plus'
import ToolLayout from '@/components/ToolLayout.vue'
import { useLogStore } from '@/stores/log.store'
import { MAX_DISPLAY_LINES, truncateLines } from '@/utils/text'

const logStore = useLogStore()

// 单文件大小上限，单位 MB
const MAX_FILE_SIZE_MB = 50
// 预览显示的最大行数，与主进程执行器保持一致
const PREVIEW_LIMIT = 200

const fileBytes = ref<Uint8Array | null>(null)
const currentFile = ref('')
const sheetNames = ref<string[]>([])
const selectedSheet = ref('')
const separator = ref(',')
const previewRows = ref<string[][]>([])
const totalRows = ref(0)
const totalCols = ref(0)
const csvText = ref('')
const parseError = ref('')
const converting = ref(false)
const truncated = ref(false)

// 预览表格列定义
const tableColumns = computed(() =>
  Array.from({ length: totalCols.value }, (_, i) => ({
    prop: `col${i}`,
    label: `列${i + 1}`,
  })),
)

// 预览表格数据行
const tableData = computed(() =>
  previewRows.value.map((row) => {
    const obj: Record<string, string> = {}
    row.forEach((cell, i) => {
      obj[`col${i}`] = cell
    })
    return obj
  }),
)

// 界面仅渲染前 200 行 CSV，完整内容保留用于复制与保存
const displayCsv = computed(() => truncateLines(csvText.value))

/**
 * 分隔符选项值为字符串 '\t'（反斜杠+t），转为真实制表符
 */
function actualSeparator(): string {
  return separator.value === '\\t' ? '\t' : separator.value
}

function resetResult() {
  previewRows.value = []
  totalRows.value = 0
  totalCols.value = 0
  csvText.value = ''
  truncated.value = false
}

async function doConvert() {
  if (!fileBytes.value) return
  converting.value = true
  try {
    const result = await window.electronAPI.invoke('tool:execute', 'excel-to-csv', {
      bytes: fileBytes.value,
      sheetName: selectedSheet.value || undefined,
      sep: actualSeparator(),
    })
    if (result.success) {
      sheetNames.value = result.data.sheetNames || []
      selectedSheet.value = result.data.sheetName || ''
      previewRows.value = result.data.previewRows || []
      totalRows.value = result.data.totalRows || 0
      totalCols.value = result.data.totalCols || 0
      csvText.value = result.data.csv || ''
      truncated.value = !!result.data.truncated
      parseError.value = ''
    } else {
      resetResult()
      parseError.value = result.error || '转换失败'
    }
  } catch (e: any) {
    resetResult()
    parseError.value = e.message || '转换失败'
  } finally {
    converting.value = false
  }
}

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
    selectedSheet.value = ''
    parseError.value = ''
    await doConvert()
  } catch {
    logStore.addLog('error', '文件读取失败')
  }
}

function clearInput() {
  fileBytes.value = null
  currentFile.value = ''
  sheetNames.value = []
  selectedSheet.value = ''
  parseError.value = ''
  resetResult()
}

async function saveAsCsv() {
  if (!csvText.value) return
  try {
    const defaultName = currentFile.value ? currentFile.value.replace(/\.(xlsx|xls)$/i, '') + '.csv' : 'output.csv'
    const savePath = await window.electronAPI.invoke('system:saveFile', defaultName, [
      { name: 'CSV 文件', extensions: ['csv'] },
    ])
    if (!savePath) return
    const encoder = new TextEncoder()
    // 前置 UTF-8 BOM，确保含中文的 CSV 在 Excel 中打开不乱码
    const bytes = Array.from(encoder.encode('\uFEFF' + csvText.value))
    await window.electronAPI.invoke('tool:saveFile', savePath, bytes)
    logStore.addLog('success', 'CSV 文件已保存')
  } catch (e: any) {
    logStore.addLog('error', '保存失败: ' + (e.message || '未知错误'))
  }
}
</script>

<style scoped>
.data-table {
  width: 100%;
}
</style>

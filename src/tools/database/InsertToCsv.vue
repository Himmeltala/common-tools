<!--
 * @Author: zhengrenfu
 * @Date: 2026-08-12
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-12
 * @FilePath: \src\tools\database\InsertToCsv.vue
 * @Description: INSERT 语句转虚谷 CSV 工具，将 MySQL INSERT 转为虚谷可导入的 CSV 格式
-->
<template>
  <ToolLayout :copy-text="outputText">
    <template #toolbar>
      <el-upload :auto-upload="false" :show-file-list="false" accept=".sql,.txt" @change="handleFileOpen">
        <el-button :icon="FolderOpened" size="small">打开 SQL 文件</el-button>
      </el-upload>
      <el-button :icon="RefreshRight" size="small" @click="clearInput">清空</el-button>
      <el-divider direction="vertical" />
      <span class="toolbar-label">分隔符：</span>
      <el-select v-model="separator" size="small" style="width: 90px">
        <el-option label="逗号 (,)" value="," />
        <el-option label="制表符" value="\t" />
        <el-option label="分号 (;)" value=";" />
      </el-select>
      <el-divider direction="vertical" />
      <el-button :icon="Download" type="primary" size="small" :disabled="!outputText" @click="saveAsCsv">
        保存为 CSV
      </el-button>
      <span class="file-name" v-if="currentFile">{{ currentFile }}</span>
    </template>

    <template #left-header>MySQL INSERT 语句</template>
    <template #left>
      <PlainEditor v-model="inputSql" placeholder="粘贴 MySQL INSERT INTO ... VALUES ... 语句..." />
    </template>

    <template #right-header>
      <span>虚谷 CSV（{{ rowCount }} 行 {{ colCount }} 列）</span>
    </template>
    <template #right>
      <div class="result-area">
        <div v-if="!outputText && !parseError" class="placeholder-text">在左侧粘贴 INSERT 语句后自动显示转换结果</div>
        <div v-else-if="parseError" class="error-text">{{ parseError }}</div>
        <template v-else>
          <pre class="code-output"><code>{{ displayText.text }}</code></pre>
          <div v-if="displayText.truncated" class="truncate-hint">
            内容过长，仅显示前 {{ MAX_DISPLAY_LINES }} 行（共 {{ displayText.totalLines }} 行），复制与保存不受影响
          </div>
        </template>
      </div>
    </template>
  </ToolLayout>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { FolderOpened, RefreshRight, Download } from '@element-plus/icons-vue'
import type { UploadFile } from 'element-plus'
import ToolLayout from '@/components/ToolLayout.vue'
import PlainEditor from '@/components/PlainEditor.vue'
import { useLogStore } from '@/stores/log.store'
import { MAX_DISPLAY_LINES, truncateLines } from '@/utils/text'

const logStore = useLogStore()

const inputSql = ref('')
const outputText = ref('')
const parseError = ref('')
const currentFile = ref('')
const separator = ref(',')
const rowCount = ref(0)
const colCount = ref(0)

// 界面仅渲染前 200 行，完整结果保留用于复制与保存
const displayText = computed(() => truncateLines(outputText.value))

let debounceTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 按引号外逗号切分 VALUES 子句中的值列表
 * @param s 值列表字符串
 * @returns 切分后的值数组
 */
function splitValues(s: string): string[] {
  const vals: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === "'") {
      inQuote = !inQuote
      cur += ch
    } else if (ch === ',' && !inQuote) {
      vals.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  vals.push(cur.trim())
  return vals
}

/**
 * 将单个 SQL 值转为 CSV 单元格
 * @param val 原始 SQL 值
 * @param sep 分隔符
 * @returns CSV 格式化后的值
 */
function toCsvCell(val: string, sep: string): string {
  const trimmed = val.trim()
  const upper = trimmed.toUpperCase()

  // NULL 值输出为空
  if (upper === 'NULL') return ''

  // 字符串字面量：去掉引号，输出原始内容
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    let inner = trimmed.slice(1, -1)
    // 还原转义的单引号
    inner = inner.replace(/\\'/g, "'")
    inner = inner.replace(/''/g, "'")
    // 如果内容包含分隔符、引号或换行，用双引号包裹
    if (inner.includes(sep) || inner.includes('"') || inner.includes('\n')) {
      inner = inner.replace(/"/g, '""')
      return `"${inner}"`
    }
    return inner
  }

  // 数字、布尔等直接返回
  return trimmed
}

/**
 * 解析 INSERT 语句中的字段名列表
 * @param text 插入语句文本
 * @returns 去反引号后的大写字段名数组
 */
function parseInsertColumns(text: string): string[] | null {
  const m = text.match(/INSERT\s+INTO\s+`?\w+`?\s*\(([\s\S]*?)\)\s*VALUES/i)
  if (!m) return null
  return m[1]
    .split(',')
    .map((c) => c.trim().replace(/`/g, '').trim().toUpperCase())
    .filter(Boolean)
}

/**
 * 将 INSERT 语句转换为 CSV
 * @param sql 原始 SQL 文本
 * @param sep 分隔符
 * @returns CSV 文本和统计信息
 */
function convertToCsv(sql: string, sep: string): { csv: string; rows: number; cols: number } | null {
  // 提取第一个 INSERT 的列名作为 CSV 表头
  const columns = parseInsertColumns(sql)
  if (!columns) return null

  // 匹配所有 VALUES (...)
  const valRegex = /VALUES\s*\(([\s\S]*?)\)\s*(?:,|;|$)/gi
  const rows: string[][] = []

  for (const vm of sql.matchAll(valRegex)) {
    const vals = splitValues(vm[1])
    if (vals.length !== columns.length) continue
    rows.push(vals.map((v) => toCsvCell(v, sep)))
  }

  if (rows.length === 0) return null

  const actualSep = sep === '\\t' ? '\t' : sep
  const lines: string[] = []

  // 表头
  lines.push(columns.join(actualSep))
  // 数据行
  for (const row of rows) {
    lines.push(row.join(actualSep))
  }

  return { csv: lines.join('\n'), rows: rows.length, cols: columns.length }
}

function doConvert() {
  const val = inputSql.value.trim()
  if (!val) {
    outputText.value = ''
    parseError.value = ''
    rowCount.value = 0
    colCount.value = 0
    return
  }

  try {
    const result = convertToCsv(val, separator.value)
    if (result) {
      outputText.value = result.csv
      rowCount.value = result.rows
      colCount.value = result.cols
      parseError.value = ''
    } else {
      outputText.value = ''
      rowCount.value = 0
      colCount.value = 0
      parseError.value = '未识别到有效的 INSERT 语句'
    }
  } catch (e: any) {
    outputText.value = ''
    parseError.value = e.message || '转换失败'
    rowCount.value = 0
    colCount.value = 0
  }
}

watch(inputSql, () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(doConvert, 300)
})

// 分隔符变化时重新转换
watch(separator, () => {
  doConvert()
})

async function handleFileOpen(uploadFile: UploadFile) {
  const file = uploadFile.raw
  if (!file) return
  try {
    const text = await file.text()
    inputSql.value = text
    currentFile.value = file.name
  } catch {
    logStore.addLog('error', '文件读取失败')
  }
}

function clearInput() {
  inputSql.value = ''
  outputText.value = ''
  parseError.value = ''
  currentFile.value = ''
  rowCount.value = 0
  colCount.value = 0
}

async function saveAsCsv() {
  if (!outputText.value) return
  try {
    const defaultName = currentFile.value ? currentFile.value.replace(/\.(sql|txt)$/i, '') + '.csv' : 'output.csv'
    const savePath = await window.electronAPI.invoke('system:saveFile', defaultName, [
      { name: 'CSV 文件', extensions: ['csv'] },
    ])
    if (!savePath) return
    const encoder = new TextEncoder()
    const bytes = Array.from(encoder.encode(outputText.value))
    await window.electronAPI.invoke('tool:saveFile', savePath, bytes)
    logStore.addLog('success', 'CSV 文件已保存')
  } catch (e: any) {
    logStore.addLog('error', '保存失败: ' + (e.message || '未知错误'))
  }
}
</script>

<style scoped>
.file-name {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-left: 8px;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.toolbar-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>

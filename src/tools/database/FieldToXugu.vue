<!--
 * @Author: zhengrenfu
 * @Date: 2026-08-12
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-12
 * @FilePath: \src\tools\database\FieldToXugu.vue
 * @Description: SQL 字段转虚谷大写格式工具，将 MySQL 风格 SQL 中的标识符转为 Oracle/虚谷大写风格
-->
<template>
  <ToolLayout :copy-text="outputText">
    <template #toolbar>
      <el-upload :auto-upload="false" :show-file-list="false" accept=".sql,.txt" @change="handleFileOpen">
        <el-button :icon="FolderOpened" size="small">打开 SQL 文件</el-button>
      </el-upload>
      <el-button :icon="RefreshRight" size="small" @click="clearInput">清空</el-button>
      <el-divider direction="vertical" />
      <el-button :icon="Download" type="primary" size="small" :disabled="!outputText" @click="saveAsSql">
        保存为 SQL
      </el-button>
      <span class="file-name" v-if="currentFile">{{ currentFile }}</span>
    </template>

    <template #left-header>MySQL 风格 SQL</template>
    <template #left>
      <el-input
        v-model="inputSql"
        type="textarea"
        class="editor-textarea"
        placeholder="粘贴 MySQL INSERT / UPDATE / SELECT / CREATE TABLE 语句..."
      />
    </template>

    <template #right-header>虚谷风格 SQL</template>
    <template #right>
      <div class="result-area">
        <div v-if="!outputText && !parseError" class="placeholder-text">在左侧粘贴 SQL 后自动显示转换结果</div>
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
import { useLogStore } from '@/stores/log.store'
import { MAX_DISPLAY_LINES, truncateLines } from '@/utils/text'

const logStore = useLogStore()

const inputSql = ref('')
const outputText = ref('')
const parseError = ref('')
const currentFile = ref('')

// 界面仅渲染前 200 行，完整结果保留用于复制与保存
const displayText = computed(() => truncateLines(outputText.value))

let debounceTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 将 MySQL 风格 SQL 转为虚谷/Oracle 大写风格
 * - 反引号包裹的标识符去反引号并大写
 * - 未加引号的标识符（表名、列名等）大写
 * - 字符串字面量保持原样
 * - SQL 关键字保持原样（通常已大写）
 * @param sql 原始 SQL 文本
 * @returns 转换后的 SQL
 */
function convertToXuguStyle(sql: string): string {
  let result = ''
  let i = 0

  while (i < sql.length) {
    // 字符串字面量：保持原样
    if (sql[i] === "'") {
      const start = i
      i++
      while (i < sql.length && sql[i] !== "'") {
        if (sql[i] === '\\') i++ // 跳过转义字符
        i++
      }
      if (i < sql.length) i++ // 跳过结束引号
      result += sql.substring(start, i)
      continue
    }

    // 反引号标识符：去反引号并大写
    if (sql[i] === '`') {
      i++ // 跳过开始反引号
      let ident = ''
      while (i < sql.length && sql[i] !== '`') {
        ident += sql[i]
        i++
      }
      i++ // 跳过结束反引号
      result += ident.toUpperCase()
      continue
    }

    // 单行注释：保持到行尾
    if (sql[i] === '-' && sql[i + 1] === '-') {
      const start = i
      while (i < sql.length && sql[i] !== '\n') i++
      result += sql.substring(start, i)
      continue
    }

    // 块注释：保持原样
    if (sql[i] === '/' && sql[i + 1] === '*') {
      const start = i
      i += 2
      while (i < sql.length && !(sql[i - 1] === '*' && sql[i] === '/')) i++
      if (i < sql.length) i++
      result += sql.substring(start, i)
      continue
    }

    result += sql[i]
    i++
  }

  return result
}

function doConvert() {
  const val = inputSql.value.trim()
  if (!val) {
    outputText.value = ''
    parseError.value = ''
    return
  }

  try {
    outputText.value = convertToXuguStyle(val)
    parseError.value = ''
  } catch (e: any) {
    outputText.value = ''
    parseError.value = e.message || '转换失败'
  }
}

watch(inputSql, () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(doConvert, 300)
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
}

async function saveAsSql() {
  if (!outputText.value) return
  try {
    const defaultName = currentFile.value
      ? currentFile.value.replace(/\.(sql|txt)$/i, '') + '_xugu.sql'
      : 'output_xugu.sql'
    const savePath = await window.electronAPI.invoke('system:saveFile', defaultName, [
      { name: 'SQL 文件', extensions: ['sql'] },
    ])
    if (!savePath) return
    const encoder = new TextEncoder()
    const bytes = Array.from(encoder.encode(outputText.value))
    await window.electronAPI.invoke('tool:saveFile', savePath, bytes)
    logStore.addLog('success', 'SQL 文件已保存')
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
</style>

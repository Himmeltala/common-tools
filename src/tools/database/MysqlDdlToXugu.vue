<!--
 * @Author: zhengrenfu
 * @Date: 2026-08-12
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-12
 * @FilePath: \src\tools\database\MysqlDdlToXugu.vue
 * @Description: MySQL DDL 转虚谷数据库工具，左侧粘贴源 DDL，右侧实时显示转换结果
-->
<template>
  <ToolLayout :copy-text="outputDdl">
    <template #toolbar>
      <el-upload :auto-upload="false" :show-file-list="false" accept=".sql,.txt" @change="handleFileOpen">
        <el-button :icon="FolderOpened" size="small">打开 SQL 文件</el-button>
      </el-upload>
      <el-button :icon="RefreshRight" size="small" @click="clearInput">清空</el-button>
      <el-divider direction="vertical" />
      <el-button :icon="Download" type="primary" size="small" :disabled="!outputDdl" @click="saveAsSql">
        保存为 SQL
      </el-button>
      <span class="file-name" v-if="currentFile">{{ currentFile }}</span>
    </template>

    <template #left-header>MySQL DDL</template>
    <template #left>
      <PlainEditor
        v-model="inputSql"
        placeholder="在此粘贴 MySQL CREATE TABLE 建表语句，或点击上方按钮打开 .sql 文件..."
      />
    </template>

    <template #right-header>虚谷 DDL</template>
    <template #right>
      <div class="result-area">
        <div v-if="converting" class="placeholder-text">转换中...</div>
        <div v-else-if="!outputDdl && !parseError" class="placeholder-text">
          在左侧粘贴 MySQL DDL 后自动显示转换结果
        </div>
        <div v-else-if="parseError" class="error-text">{{ parseError }}</div>
        <template v-else>
          <pre class="code-output"><code>{{ displayDdl.text }}</code></pre>
          <div v-if="displayDdl.truncated" class="truncate-hint">
            内容过长，仅显示前 {{ MAX_DISPLAY_LINES }} 行（共 {{ displayDdl.totalLines }} 行），复制与保存不受影响
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
const outputDdl = ref('')
const parseError = ref('')
const currentFile = ref('')
const converting = ref(false)

// 界面仅渲染前 200 行，完整结果保留用于复制与保存
const displayDdl = computed(() => truncateLines(outputDdl.value))

let debounceTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 通过主进程执行 DDL 转换
 */
async function doConvert() {
  const val = inputSql.value.trim()
  if (!val) {
    outputDdl.value = ''
    parseError.value = ''
    return
  }

  converting.value = true
  try {
    const resp = await window.electronAPI.invoke('tool:execute', 'mysql-ddl-to-xugu', { sql: val })
    if (resp.success) {
      outputDdl.value = resp.data?.ddl || ''
      parseError.value = ''
    } else {
      outputDdl.value = ''
      parseError.value = resp.error || '转换失败'
    }
  } catch (e: any) {
    parseError.value = e.message || '转换失败'
    outputDdl.value = ''
  } finally {
    converting.value = false
  }
}

// 监听输入，300ms 防抖自动转换
watch(inputSql, () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(doConvert, 300)
})

/**
 * 通过 el-upload 打开本地 SQL 文件
 * @param uploadFile 上传文件对象
 */
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

/**
 * 清空输入和转换结果
 */
function clearInput() {
  inputSql.value = ''
  outputDdl.value = ''
  parseError.value = ''
  currentFile.value = ''
}

/**
 * 保存转换结果为 SQL 文件
 */
async function saveAsSql() {
  if (!outputDdl.value) return
  try {
    const defaultName = currentFile.value
      ? currentFile.value.replace(/\.(sql|txt)$/i, '') + '_xugu.sql'
      : 'output_xugu.sql'
    const savePath = await window.electronAPI.invoke('system:saveFile', defaultName, [
      { name: 'SQL 文件', extensions: ['sql'] },
    ])
    if (!savePath) return
    const encoder = new TextEncoder()
    const bytes = Array.from(encoder.encode(outputDdl.value))
    await window.electronAPI.invoke('tool:saveFile', savePath, bytes)
    logStore.addLog('success', `SQL 已保存到: ${savePath}`)
    logStore.addLog('success', 'SQL 文件已保存')
  } catch (e: any) {
    logStore.addLog('error', '保存失败: ' + (e.message || '未知错误'))
  }
}
</script>

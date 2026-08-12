<!--
 * @Author: zhengrenfu
 * @Date: 2026-08-12
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-12
 * @FilePath: \src\tools\database\MysqlToXugu.vue
 * @Description: MySQL 转虚谷数据库转换工具，调用 Python 脚本执行转换
-->
<template>
  <div class="mysql-to-xugu">
    <div class="tool-toolbar">
      <el-button :icon="FolderOpened" size="small" @click="selectInputFile">选择 SQL 文件</el-button>
      <span class="toolbar-label">编码：</span>
      <el-select v-model="encoding" size="small" style="width: 130px">
        <el-option label="自动检测" value="" />
        <el-option label="UTF-8" value="utf-8" />
        <el-option label="GBK" value="gbk" />
        <el-option label="GB2312" value="gb2312" />
        <el-option label="GB18030" value="gb18030" />
      </el-select>
      <span class="toolbar-label">输出目录：</span>
      <el-input
        :model-value="outputDir"
        size="small"
        style="width: 260px"
        readonly
        placeholder="默认为源文件所在目录"
      />
      <el-button size="small" @click="selectOutputDir">选择</el-button>
      <el-divider direction="vertical" />
      <el-button :icon="Switch" type="primary" size="small" :loading="converting" @click="handleConvert">
        {{ converting ? '转换中...' : '执行转换' }}
      </el-button>
      <span class="md-file-name" v-if="inputFile">{{ inputFile }}</span>
    </div>

    <div class="converter-panes">
      <div class="converter-pane">
        <div class="pane-header">源文件信息</div>
        <div class="info-area">
          <div v-if="!inputFile" class="placeholder-text">请选择 Navicat 导出的 MySQL SQL 文件</div>
          <div v-else class="file-info">
            <div class="info-row"><span class="info-label">文件路径：</span>{{ inputFile }}</div>
            <div class="info-row"><span class="info-label">使用编码：</span>{{ encoding || '自动检测' }}</div>
            <div class="info-row"><span class="info-label">输出目录：</span>{{ outputDir || '源文件所在目录' }}</div>
          </div>
        </div>
      </div>
      <div class="converter-pane">
        <div class="pane-header">转换结果</div>
        <div class="result-area" ref="resultRef">
          <div v-if="!result && !errorMsg" class="placeholder-text">点击"执行转换"开始</div>
          <div v-else-if="errorMsg" class="error-text">{{ errorMsg }}</div>
          <div v-else class="result-content" v-html="formatResult(result)" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { FolderOpened, Switch } from '@element-plus/icons-vue'

const inputFile = ref('')
const outputDir = ref('')
const encoding = ref('')
const converting = ref(false)
const result = ref('')
const errorMsg = ref('')

// 选择输入 SQL 文件
async function selectInputFile() {
  const path = await window.electronAPI.invoke('system:selectFile', [{ name: 'SQL 文件', extensions: ['sql', 'txt'] }])
  if (path) {
    inputFile.value = path
    result.value = ''
    errorMsg.value = ''
  }
}

// 选择输出目录
async function selectOutputDir() {
  const path = await window.electronAPI.invoke('system:selectDirectory')
  if (path) {
    outputDir.value = path
  }
}

// 执行转换
async function handleConvert() {
  if (!inputFile.value) {
    window.electronAPI.invoke('tool:log', 'warning', '请先选择 SQL 文件')
    return
  }

  converting.value = true
  result.value = ''
  errorMsg.value = ''

  try {
    const args = [inputFile.value]
    if (outputDir.value) args.push(outputDir.value)
    if (encoding.value) args.push('--encoding', encoding.value)

    const resp = await window.electronAPI.invoke('tool:execute', 'run-python', {
      scriptPath: 'assets/scripts/mysql_ddl_to_xugu.py',
      args,
    })

    if (resp.success) {
      result.value = resp.data?.stdout || '转换完成'
      window.electronAPI.invoke('tool:log', 'success', 'MySQL 转虚谷 转换完成')
      window.electronAPI.invoke('notification:create', 'success', '数据库转换完成', 'MySQL 转虚谷')
    } else {
      // 有警告但转换成功
      if (resp.data?.hasWarnings && resp.data?.stdout) {
        result.value = resp.data.stdout
        window.electronAPI.invoke('tool:log', 'warning', '转换完成，但存在警告')
      } else {
        const err = resp.error || resp.data?.stderr || '转换失败'
        errorMsg.value = err
        window.electronAPI.invoke('tool:log', 'error', `转换失败: ${err}`)
      }
    }
  } catch (e: any) {
    errorMsg.value = e.message || '执行出错'
    window.electronAPI.invoke('tool:log', 'error', `执行出错: ${e.message}`)
  } finally {
    converting.value = false
  }
}

// 格式化结果文本
function formatResult(text: string): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
    .replace(/\s{2,}/g, (m) => '&nbsp;'.repeat(m.length))
}
</script>

<style scoped>
.mysql-to-xugu {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 8px;
}
.tool-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.toolbar-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.md-file-name {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-left: 8px;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.converter-panes {
  flex: 1;
  display: flex;
  gap: 12px;
  min-height: 0;
}
.converter-pane {
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
.info-area,
.result-area {
  flex: 1;
  padding: 16px;
  overflow: auto;
  font-size: 13px;
  line-height: 1.6;
}
.placeholder-text {
  color: var(--el-text-color-secondary);
}
.error-text {
  color: var(--el-color-danger);
  white-space: pre-wrap;
}
.result-content {
  white-space: normal;
  word-break: break-all;
}
.file-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.info-row {
  display: flex;
  gap: 4px;
}
.info-label {
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}
</style>

/*
 * @Author: zhengrenfu
 * @Date: 2026-08-12
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-12
 * @FilePath: \electron\services\python-executor.service.ts
 * @Description: Python 脚本执行器，通过 spawn 运行 Python 脚本并捕获输出
 */

import { toolExecutors, type ToolExecuteResult } from '@electron/services/tool-executor.service'
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { resolve } from 'path'

/** Python 可执行文件候选列表，按优先级尝试 */
const PYTHON_CANDIDATES = ['python3', 'python']

/**
 * 查找可用的 Python 可执行文件
 * @returns Python 路径或 null
 */
async function findPython(): Promise<string | null> {
  for (const py of PYTHON_CANDIDATES) {
    try {
      await new Promise<void>((resolve_, reject) => {
        const child = spawn(py, ['--version'], { windowsHide: true })
        child.on('close', (code) => (code === 0 ? resolve_() : reject()))
        child.on('error', reject)
      })
      return py
    } catch {
      continue
    }
  }
  return null
}

toolExecutors.register({
  id: 'run-python',
  async execute(params: Record<string, unknown>): Promise<ToolExecuteResult> {
    const scriptPath = params.scriptPath as string
    const args = (params.args as string[]) || []
    const cwd = (params.cwd as string) || undefined

    if (!scriptPath) {
      return { success: false, error: '未指定脚本路径' }
    }

    const absolutePath = resolve(scriptPath)
    if (!existsSync(absolutePath)) {
      return { success: false, error: `脚本文件不存在: ${absolutePath}` }
    }

    const pythonPath = params.pythonPath as string
    let python: string

    if (pythonPath && existsSync(pythonPath)) {
      python = pythonPath
    } else {
      const found = await findPython()
      if (!found) {
        return { success: false, error: '未找到 Python 环境，请安装 Python 或设置 python.exe 路径' }
      }
      python = found
    }

    return new Promise((resolve_) => {
      const child = spawn(python, [absolutePath, ...args], {
        cwd,
        windowsHide: true,
      })

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString()
      })
      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      child.on('close', (code) => {
        // 警告信息通过 stderr 输出属于正常行为
        const hasWarnings = stdout.includes('警告:')
        resolve_({
          success: code === 0,
          data: {
            stdout,
            stderr,
            exitCode: code || 0,
            hasWarnings,
          },
          error: code !== 0 ? stderr || `退出码: ${code}` : undefined,
        })
      })

      child.on('error', (err) => {
        resolve_({
          success: false,
          error: `启动 Python 失败: ${err.message}`,
        })
      })
    })
  },
})

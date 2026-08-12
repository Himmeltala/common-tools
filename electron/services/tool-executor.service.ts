/*
 * @Author: zhengrenfu
 * @Date: 2026-08-11
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-11
 * @FilePath: \electron\services\tool-executor.service.ts
 * @Description: 工具执行器注册表，管理主进程侧的工具执行器
 */

import { BrowserWindow } from 'electron'
import { writeFileSync, mkdirSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

/** 工具执行器上下文，提供主进程能力 */
export interface ToolExecutorContext {
  app: {
    getPath: (name: string) => string
  }
}

/** 工具执行器执行结果 */
export interface ToolExecuteResult {
  success: boolean
  data?: Record<string, unknown>
  error?: string
}

/** 工具执行器接口 */
export interface ToolExecutor {
  id: string
  execute(params: Record<string, unknown>, ctx: ToolExecutorContext): Promise<ToolExecuteResult>
}

/** 工具执行器注册表 */
class ToolExecutorRegistry {
  private executors: Map<string, ToolExecutor> = new Map()

  /**
   * 注册一个执行器
   * @param executor 执行器实例
   */
  register(executor: ToolExecutor): void {
    this.executors.set(executor.id, executor)
  }

  /**
   * 根据 id 获取执行器
   * @param id 执行器标识
   */
  get(id: string): ToolExecutor | undefined {
    return this.executors.get(id)
  }
}

/** 全局单例 */
export const toolExecutors = new ToolExecutorRegistry()

// 注册内置执行器：MD 转 PDF
toolExecutors.register({
  id: 'md-to-pdf',
  async execute(params: Record<string, unknown>, _ctx: ToolExecutorContext): Promise<ToolExecuteResult> {
    const html = params.html as string
    const fileName = (params.fileName as string) || 'output'

    if (!html) {
      return { success: false, error: '未提供 HTML 内容' }
    }

    // 将 HTML 写入临时文件
    const tmpDir = join(tmpdir(), 'common-tools-pdf')
    mkdirSync(tmpDir, { recursive: true })
    const htmlPath = join(tmpDir, `${fileName}.html`)
    writeFileSync(htmlPath, html, 'utf-8')

    return new Promise((resolve) => {
      const pdfWin = new BrowserWindow({
        width: 800,
        height: 600,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      })

      pdfWin.loadFile(htmlPath)

      pdfWin.webContents.on('did-finish-load', async () => {
        try {
          const pdfData = await pdfWin.webContents.printToPDF({
            printBackground: true,
            preferCSSPageSize: true,
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
          })

          // 将 PDF 数据以 base64 形式返回给渲染进程保存
          const pdfBase64 = pdfData.toString('base64')
          resolve({
            success: true,
            data: { pdfBase64, fileName: `${fileName}.pdf` },
          })
        } catch (e: any) {
          resolve({ success: false, error: e.message || 'PDF 生成失败' })
        } finally {
          pdfWin.destroy()
          // 清理临时文件
          try {
            if (existsSync(htmlPath)) unlinkSync(htmlPath)
          } catch {
            // ignore
          }
        }
      })

      pdfWin.webContents.on('did-fail-load', () => {
        resolve({ success: false, error: '加载 HTML 失败' })
        pdfWin.destroy()
      })
    })
  },
})

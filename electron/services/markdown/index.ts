/*
 * @Author: zhengrenfu
 * @Date: 2026-08-12
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-12
 * @FilePath: \electron\services\markdown\index.ts
 * @Description: Markdown 工具类执行器注册
 */

import { BrowserWindow } from 'electron'
import { writeFileSync, mkdirSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { toolExecutors, type ToolExecuteResult } from '@electron/services/tool-executor.service'
import { rewriteLocalImages } from '@electron/services/markdown/image-resolver'

// 注册本地图片路径改写执行器，渲染进程与 PDF 导出共用同一份结果
toolExecutors.register({
  id: 'md-resolve-images',
  async execute(params: Record<string, unknown>): Promise<ToolExecuteResult> {
    const markdown = params.markdown as string
    const baseDir = (params.baseDir as string) || ''
    const { markdown: rewritten, missing } = rewriteLocalImages(markdown || '', baseDir)
    return { success: true, data: { markdown: rewritten, missing } }
  },
})

// 注册 MD 转 PDF 执行器
toolExecutors.register({
  id: 'md-to-pdf',
  async execute(params: Record<string, unknown>): Promise<ToolExecuteResult> {
    const html = params.html as string
    const fileName = (params.fileName as string) || 'output'

    if (!html) {
      return { success: false, error: '未提供 HTML 内容' }
    }

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

          const pdfBase64 = pdfData.toString('base64')
          resolve({
            success: true,
            data: { pdfBase64, fileName: `${fileName}.pdf` },
          })
        } catch (e: any) {
          resolve({ success: false, error: e.message || 'PDF 生成失败' })
        } finally {
          pdfWin.destroy()
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

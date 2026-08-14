/*
 * @Author: zhengrenfu
 * @Date: 2026-08-14
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-14
 * @FilePath: \electron\services\excel\index.ts
 * @Description: Excel 工具类执行器注册，提供 Excel 数据脱敏能力
 */

import * as XLSX from 'xlsx'
import { toolExecutors, type ToolExecuteResult } from '@electron/services/tool-executor.service'

// 预览返回的最大数据行数
const PREVIEW_MAX_ROWS = 200
// 脱敏替换字符
const MASK_CHAR = '*'

/**
 * 对单元格文本脱敏，保留首尾字符，中间替换为星号
 * @param text 原始单元格文本
 * @returns 脱敏后的文本
 */
function maskText(text: string): string {
  if (text.length <= 2) return text
  return text[0] + MASK_CHAR.repeat(text.length - 2) + text[text.length - 1]
}

/**
 * 从工作簿字节中读取第一个工作表的二维文本数据
 * @param bytes Excel 文件字节
 * @returns 工作表名称与二维数据，解析失败返回 null
 */
function readFirstSheet(bytes: Uint8Array): { sheetName: string; rows: string[][] } | null {
  try {
    const workbook = XLSX.read(bytes, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) return null
    const sheet = workbook.Sheets[sheetName]
    // raw: false 时返回单元格的格式化文本，日期与数字均按显示内容处理
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as string[][]
    return { sheetName, rows }
  } catch {
    return null
  }
}

/**
 * 按行脱敏，跳过前 skipRows 行
 * @param rows 原始二维数据
 * @param skipRows 不脱敏的行数
 * @returns 脱敏后的二维数据
 */
function maskRows(rows: string[][], skipRows: number): string[][] {
  return rows.map((row, index) => (index < skipRows ? row : row.map(maskText)))
}

// 注册 Excel 数据脱敏执行器
toolExecutors.register({
  id: 'excel-mask',
  async execute(params: Record<string, unknown>): Promise<ToolExecuteResult> {
    const bytes = params.bytes as Uint8Array
    const skipRows = Math.max(0, Number(params.skipRows) || 0)

    if (!bytes || bytes.length === 0) {
      return { success: false, error: '未提供 Excel 文件内容' }
    }

    const parsed = readFirstSheet(bytes)
    if (!parsed) {
      return { success: false, error: 'Excel 文件解析失败，请确认文件格式正确' }
    }

    try {
      const masked = maskRows(parsed.rows, skipRows)

      // 生成脱敏后的工作簿并转为 base64
      const outSheet = XLSX.utils.aoa_to_sheet(masked)
      const outBook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(outBook, outSheet, parsed.sheetName)
      const base64 = XLSX.write(outBook, { bookType: 'xlsx', type: 'base64' })

      const totalRows = masked.length
      const totalCols = masked.reduce((max, row) => Math.max(max, row.length), 0)

      return {
        success: true,
        data: {
          sheetName: parsed.sheetName,
          previewOriginal: parsed.rows.slice(0, PREVIEW_MAX_ROWS),
          previewMasked: masked.slice(0, PREVIEW_MAX_ROWS),
          totalRows,
          totalCols,
          truncated: totalRows > PREVIEW_MAX_ROWS,
          base64,
        },
      }
    } catch (e: any) {
      return { success: false, error: e.message || '脱敏处理失败' }
    }
  },
})

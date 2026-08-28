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

// 脱敏预览返回的最大数据行数
const MASK_PREVIEW_MAX_ROWS = 30
// 其他工具预览返回的最大数据行数
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
 * 从工作簿字节中读取指定工作表的二维文本数据
 * @param bytes Excel 文件字节
 * @param sheetName 目标工作表名称，未指定时读取第一个工作表
 * @returns 工作表名称列表、实际读取的工作表名与二维数据，解析失败返回 null
 */
function readSheet(
  bytes: Uint8Array,
  sheetName?: string,
): { sheetNames: string[]; sheetName: string; rows: string[][] } | null {
  try {
    const workbook = XLSX.read(bytes, { type: 'array' })
    if (!workbook.SheetNames.length) return null
    const target = sheetName && workbook.SheetNames.includes(sheetName) ? sheetName : workbook.SheetNames[0]
    const sheet = workbook.Sheets[target]
    // raw: false 时返回单元格的格式化文本，日期与数字均按显示内容处理
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as string[][]
    return { sheetNames: workbook.SheetNames, sheetName: target, rows }
  } catch {
    return null
  }
}

/**
 * 从工作簿字节中读取第一个工作表的二维文本数据
 * @param bytes Excel 文件字节
 * @returns 工作表名称与二维数据，解析失败返回 null
 */
function readFirstSheet(bytes: Uint8Array): { sheetName: string; rows: string[][] } | null {
  const parsed = readSheet(bytes)
  if (!parsed) return null
  return { sheetName: parsed.sheetName, rows: parsed.rows }
}

/**
 * 按行脱敏，跳过前 skipRows 行，排除指定列
 * @param rows 原始二维数据
 * @param skipRows 不脱敏的行数
 * @param excludeCols 不参与脱敏的列索引集合
 * @returns 脱敏后的二维数据
 */
function maskRows(rows: string[][], skipRows: number, excludeCols: ReadonlySet<number>): string[][] {
  return rows.map((row, index) =>
    index < skipRows ? row : row.map((cell, col) => (excludeCols.has(col) ? cell : maskText(cell))),
  )
}

/**
 * 将单个单元格值格式化为 CSV 字段
 * 内容包含分隔符、双引号或换行时用双引号包裹，并转义内部双引号
 * @param value 单元格值
 * @param sep 分隔符
 * @returns CSV 字段文本
 */
function toCsvCell(value: unknown, sep: string): string {
  const s = value == null ? '' : String(value)
  if (s.includes(sep) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

/**
 * 将二维数据转为 CSV 文本
 * @param rows 二维数据
 * @param sep 分隔符
 * @returns CSV 文本
 */
function rowsToCsv(rows: string[][], sep: string): string {
  return rows.map((row) => row.map((c) => toCsvCell(c, sep)).join(sep)).join('\n')
}

// 注册 Excel 数据脱敏执行器
toolExecutors.register({
  id: 'excel-mask',
  async execute(params: Record<string, unknown>): Promise<ToolExecuteResult> {
    const bytes = params.bytes as Uint8Array
    const skipRows = Math.max(0, Number(params.skipRows) || 0)
    const excludeCols = new Set<number>(
      (Array.isArray(params.excludeColumns) ? params.excludeColumns : []).filter(
        (col) => typeof col === 'number',
      ),
    )

    if (!bytes || bytes.length === 0) {
      return { success: false, error: '未提供 Excel 文件内容' }
    }

    const parsed = readFirstSheet(bytes)
    if (!parsed) {
      return { success: false, error: 'Excel 文件解析失败，请确认文件格式正确' }
    }

    try {
      const masked = maskRows(parsed.rows, skipRows, excludeCols)

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
          previewOriginal: parsed.rows.slice(0, MASK_PREVIEW_MAX_ROWS),
          previewMasked: masked.slice(0, MASK_PREVIEW_MAX_ROWS),
          totalRows,
          totalCols,
          truncated: totalRows > MASK_PREVIEW_MAX_ROWS,
          base64,
        },
      }
    } catch (e: any) {
      return { success: false, error: e.message || '脱敏处理失败' }
    }
  },
})

// 注册 Excel 转 CSV 执行器
toolExecutors.register({
  id: 'excel-to-csv',
  async execute(params: Record<string, unknown>): Promise<ToolExecuteResult> {
    const bytes = params.bytes as Uint8Array
    const sheetName = params.sheetName as string | undefined
    const sep = (params.sep as string) || ','

    if (!bytes || bytes.length === 0) {
      return { success: false, error: '未提供 Excel 文件内容' }
    }

    const parsed = readSheet(bytes, sheetName)
    if (!parsed) {
      return { success: false, error: 'Excel 文件解析失败，请确认文件格式正确' }
    }

    try {
      const csv = rowsToCsv(parsed.rows, sep)
      const totalRows = parsed.rows.length
      const totalCols = parsed.rows.reduce((max, row) => Math.max(max, row.length), 0)

      return {
        success: true,
        data: {
          sheetNames: parsed.sheetNames,
          sheetName: parsed.sheetName,
          csv,
          previewRows: parsed.rows.slice(0, PREVIEW_MAX_ROWS),
          totalRows,
          totalCols,
          truncated: totalRows > PREVIEW_MAX_ROWS,
        },
      }
    } catch (e: any) {
      return { success: false, error: e.message || '转换失败' }
    }
  },
})

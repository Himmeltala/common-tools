/*
 * @Author: zhengrenfu
 * @Date: 2026-08-14
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-14
 * @FilePath: \src\tools\excel\index.ts
 * @Description: Excel 工具类别注册
 */

import type { ToolCategory } from '@/types/tool'
import DataMasking from '@/tools/excel/DataMasking.vue'
import ExcelToCsv from '@/tools/excel/ExcelToCsv.vue'

// Excel 工具类别
export const excelCategory: ToolCategory = {
  id: 'excel',
  label: 'Excel 工具',
  icon: 'Grid',
  tools: [
    {
      id: 'data-masking',
      label: '数据脱敏',
      description: '保留单元格首尾字符、中间替换为星号，可设置前 N 行与指定列不脱敏',
      icon: 'Hide',
      component: DataMasking,
      executors: ['excel-mask'],
    },
    {
      id: 'excel-to-csv',
      label: 'Excel 转 CSV',
      description: '将 Excel 工作表转换为 CSV 文本，支持选择工作表与分隔符',
      icon: 'Files',
      component: ExcelToCsv,
      executors: ['excel-to-csv'],
    },
  ],
}

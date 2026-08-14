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

// Excel 工具类别
export const excelCategory: ToolCategory = {
  id: 'excel',
  label: 'Excel 工具',
  icon: 'Grid',
  tools: [
    {
      id: 'data-masking',
      label: '数据脱敏',
      description: '保留单元格首尾字符、中间替换为星号，可设置前 N 行不脱敏',
      icon: 'Hide',
      component: DataMasking,
      executors: ['excel-mask'],
    },
  ],
}

/*
 * @Author: zhengrenfu
 * @Date: 2026-08-11
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-12
 * @FilePath: \src\tools\markdown\index.ts
 * @Description: Markdown 工具类别注册
 */

import type { ToolCategory } from '@/types/tool'
import MdPreview from '@/tools/markdown/MdPreview.vue'

// Markdown 工具类别
export const markdownCategory: ToolCategory = {
  id: 'markdown',
  label: 'Markdown 工具',
  icon: 'EditPen',
  tools: [
    {
      id: 'md-preview',
      label: 'Markdown 编辑器',
      description: '编辑并实时预览 Markdown，支持主题切换和导出 PDF',
      icon: 'View',
      component: MdPreview,
      executors: ['md-to-pdf'],
    },
  ],
}

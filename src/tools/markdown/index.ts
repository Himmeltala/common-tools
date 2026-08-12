/*
 * @Author: zhengrenfu
 * @Date: 2026-08-11
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-11
 * @FilePath: \src\tools\markdown\index.ts
 * @Description: Markdown 工具类别注册
 */

import type { ToolCategory } from '@/types/tool'
import MdPreview from '@/tools/markdown/MdPreview.vue'
import MdToPdf from '@/tools/markdown/MdToPdf.vue'

// Markdown 工具类别
export const markdownCategory: ToolCategory = {
  id: 'markdown',
  label: 'Markdown 工具',
  icon: 'EditPen',
  tools: [
    {
      id: 'md-preview',
      label: '预览 MD',
      description: '编辑并实时预览 Markdown 内容，支持暗黑主题',
      icon: 'View',
      component: MdPreview,
    },
    {
      id: 'md-to-pdf',
      label: 'MD 转 PDF',
      description: '将 Markdown 文件转换为 PDF 格式',
      icon: 'DocumentCopy',
      component: MdToPdf,
      executors: ['md-to-pdf'],
    },
  ],
}

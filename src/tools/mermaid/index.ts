/*
 * @Author: zhengrenfu
 * @Date: 2026-08-17
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-17
 * @FilePath: \src\tools\mermaid\index.ts
 * @Description: Mermaid 工具类别注册
 */

import type { ToolCategory } from '@/types/tool'
import MermaidPreview from '@/tools/mermaid/MermaidPreview.vue'

// Mermaid 工具类别
export const mermaidCategory: ToolCategory = {
  id: 'mermaid',
  label: 'Mermaid 工具',
  icon: 'DataLine',
  tools: [
    {
      id: 'mermaid-preview',
      label: 'Mermaid 预览',
      description: '实时预览 Mermaid 图表，支持导出为图片和 PDF',
      icon: 'View',
      component: MermaidPreview,
    },
  ],
}

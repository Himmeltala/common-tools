/*
 * @Author: zhengrenfu
 * @Date: 2026-08-11
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-11
 * @FilePath: \src\tools\index.ts
 * @Description: 工具注册入口，集中注册所有内置工具类别和工具
 */

import { toolRegistry } from '@/composables/useToolRegistry'
import { markdownCategory } from '@/tools/markdown'
import { databaseCategory } from '@/tools/database'
import { excelCategory } from '@/tools/excel'
import { imageCategory } from '@/tools/image'
import { mermaidCategory } from '@/tools/mermaid'

/**
 * 注册所有内置工具类别
 */
export function registerBuiltinTools(): void {
  toolRegistry.register(markdownCategory)
  toolRegistry.register(databaseCategory)
  toolRegistry.register(excelCategory)
  toolRegistry.register(imageCategory)
  toolRegistry.register(mermaidCategory)
}

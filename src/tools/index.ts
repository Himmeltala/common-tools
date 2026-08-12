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

/**
 * 注册所有内置工具类别
 * 新增类别时在此处添加注册调用即可
 */
export function registerBuiltinTools(): void {
  // Markdown 工具
  toolRegistry.register(markdownCategory)
}

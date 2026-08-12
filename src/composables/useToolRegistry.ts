/*
 * @Author: zhengrenfu
 * @Date: 2026-08-11
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-11
 * @FilePath: \src\composables\useToolRegistry.ts
 * @Description: 工具类别注册表，全局单例管理所有工具类别和工具
 */

import { reactive } from 'vue'
import type { ToolCategory, Tool } from '@/types/tool'

/** 工具类别注册表类，管理所有工具类别的注册与查询 */
class ToolCategoryRegistry {
  private categories: Map<string, ToolCategory> = reactive(new Map())

  /**
   * 注册一个工具类别
   * @param category 工具类别对象
   */
  register(category: ToolCategory): void {
    if (this.categories.has(category.id)) {
      console.warn(`工具类别 "${category.id}" 已存在，将被覆盖`)
    }
    this.categories.set(category.id, category)
  }

  /**
   * 根据类别 id 获取工具类别
   * @param id 类别唯一标识
   * @returns 工具类别或 undefined
   */
  getCategory(id: string): ToolCategory | undefined {
    return this.categories.get(id)
  }

  /**
   * 获取所有已注册的工具类别
   * @returns 工具类别数组
   */
  getAll(): ToolCategory[] {
    return Array.from(this.categories.values())
  }

  /**
   * 根据类别和工具 id 查找工具
   * @param categoryId 类别 id
   * @param toolId 工具 id
   * @returns 工具对象或 undefined
   */
  getTool(categoryId: string, toolId: string): Tool | undefined {
    const category = this.categories.get(categoryId)
    if (!category) return undefined
    return category.tools.find((t) => t.id === toolId)
  }

  /**
   * 检查类别是否已注册
   * @param id 类别唯一标识
   * @returns 是否已注册
   */
  has(id: string): boolean {
    return this.categories.has(id)
  }
}

/** 全局单例 */
export const toolRegistry = new ToolCategoryRegistry()

/**
 * 在 Vue 组件中使用工具注册表
 * @returns 工具注册表实例
 */
export function useToolRegistry() {
  return toolRegistry
}

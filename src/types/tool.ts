/*
 * @Author: zhengrenfu
 * @Date: 2026-08-11
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-11
 * @FilePath: \src\types\tool.ts
 * @Description: 工具集类型定义，包含工具类别、工具和执行器接口
 */

import type { Component } from 'vue'

/** 工具类别，对应用户看到的左侧菜单分组 */
export interface ToolCategory {
  /** 唯一标识，如 'markdown' */
  id: string
  /** 显示名称，如 'Markdown 工具' */
  label: string
  /** Element Plus 图标组件名 */
  icon: string
  /** 类别下的工具列表 */
  tools: Tool[]
}

/** 单个工具定义 */
export interface Tool {
  /** 工具路由标识，如 'md-preview' */
  id: string
  /** 工具显示名称，如 '预览 MD' */
  label: string
  /** 工具功能简述 */
  description: string
  /** Element Plus 图标组件名 */
  icon: string
  /** 工具对应的 Vue 页面组件 */
  component: Component
  /** 依赖的主进程执行器 id 列表（纯前端工具留空） */
  executors?: string[]
}

/** 工具执行器参数（主进程侧） */
export interface ToolExecuteParams {
  /** 执行器 id */
  executorId: string
  /** 传递给执行器的数据 */
  data: Record<string, unknown>
}

/** 工具执行器返回值 */
export interface ToolExecuteResult {
  /** 是否成功 */
  success: boolean
  /** 返回数据或错误信息 */
  data?: Record<string, unknown>
  /** 错误消息 */
  error?: string
}

/** 工具执行器接口（主进程侧实现） */
export interface ToolExecutor {
  /** 执行器唯一标识 */
  id: string
  /** 执行工具逻辑 */
  execute(params: Record<string, unknown>): Promise<ToolExecuteResult>
}

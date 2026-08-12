/*
 * @Author: zhengrenfu
 * @Date: 2026-07-14
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-11
 * @FilePath: \src\types\ipc.ts
 * @Description: IPC 类型定义，声明主进程与渲染进程之间的通用接口
 */

/** 设置分类（对应 settings_schema.json 结构） */
export interface SettingsSchema {
  key: string
  label: string
  groups: SettingsGroup[]
}

/** 设置分组（一组相关设置项） */
export interface SettingsGroup {
  label: string
  settings: SettingsField[]
}

/** 单个设置字段定义 */
export interface SettingsField {
  key: string
  label: string
  type: string
  default: any
  options?: { label: string; value: string }[]
  description?: string
  min?: number
  max?: number
  step?: number
  suffix?: string
  placeholder?: string
  dependsOn?: string
  dependsValue?: string
}

/** 工具执行器参数 */
export interface ToolExecuteParams {
  executorId: string
  data: Record<string, unknown>
}

/** 工具执行器返回结果 */
export interface ToolExecuteResult {
  success: boolean
  data?: Record<string, unknown>
  error?: string
}

/** 渲染进程调用的 IPC 接口 */
export interface IpcApi {
  /** 通用 IPC 调用 */
  invoke: (channel: string, ...args: any[]) => Promise<any>
  /** 事件监听，返回清理函数 */
  on: (channel: string, callback: (...args: any[]) => void) => () => void
}

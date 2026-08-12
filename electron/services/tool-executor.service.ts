/*
 * @Author: zhengrenfu
 * @Date: 2026-08-11
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-12
 * @FilePath: \electron\services\tool-executor.service.ts
 * @Description: 工具执行器注册表，管理主进程侧的工具执行器
 */

/** 工具执行器上下文，提供主进程能力 */
export interface ToolExecutorContext {
  app: {
    getPath: (name: string) => string
  }
}

/** 工具执行器执行结果 */
export interface ToolExecuteResult {
  success: boolean
  data?: Record<string, unknown>
  error?: string
}

/** 工具执行器接口 */
export interface ToolExecutor {
  id: string
  execute(params: Record<string, unknown>, ctx: ToolExecutorContext): Promise<ToolExecuteResult>
}

/** 工具执行器注册表 */
class ToolExecutorRegistry {
  private executors: Map<string, ToolExecutor> = new Map()

  /**
   * 注册一个执行器
   * @param executor 执行器实例
   */
  register(executor: ToolExecutor): void {
    this.executors.set(executor.id, executor)
  }

  /**
   * 根据 id 获取执行器
   * @param id 执行器标识
   */
  get(id: string): ToolExecutor | undefined {
    return this.executors.get(id)
  }
}

/** 全局单例 */
export const toolExecutors = new ToolExecutorRegistry()

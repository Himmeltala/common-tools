/*
 * @Author: zhengrenfu
 * @Date: 2026-07-14
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-12
 * @FilePath: \src\types\ipc.ts
 * @Description: IPC 接口类型定义
 */

/** 渲染进程 electronAPI 接口声明 */
export interface IpcApi {
  /** 通用 IPC 调用，channel 受 preload 白名单限制 */
  invoke: (channel: string, ...args: any[]) => Promise<any>
  /** 事件监听，返回清理函数，channel 受 preload 白名单限制 */
  on: (channel: string, callback: (...args: any[]) => void) => () => void
}

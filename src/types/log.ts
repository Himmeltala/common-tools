/*
 * @Author: zhengrenfu
 * @Date: 2026-08-12
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-12
 * @FilePath: \src\types\log.ts
 * @Description: 日志类型定义
 */

// 日志条目
export interface LogEntry {
  type: 'info' | 'success' | 'warning' | 'error'
  message: string
  time: string
}

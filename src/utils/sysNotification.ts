/*
 * @Author: zhengrenfu
 * @Date: 2026-08-12
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-12
 * @FilePath: \src\utils\sysNotification.ts
 * @Description: 系统通知公共函数，按设置条件弹出 Windows 原生通知
 */

/**
 * 按设置条件弹出系统通知
 * 依次检查总开关、静默模式，满足条件时通过 IPC 请求主进程弹出 Windows 通知
 * @param title 通知标题
 * @param body 通知正文
 */
export async function maybeShowSysNotification(title: string, body: string): Promise<void> {
  try {
    const enabled = await window.electronAPI.invoke('settings:get', 'notification.enabled')
    if (!enabled && enabled !== undefined) return
    const silent = !!(await window.electronAPI.invoke('settings:get', 'notification.silent'))
    const timeoutType =
      (await window.electronAPI.invoke('settings:get', 'notification.timeoutType')) === 'never' ? 'never' : 'default'
    await window.electronAPI.invoke('sys:showNotification', { title, body, silent, timeoutType })
  } catch {
    // 通知失败不影响主流程
  }
}

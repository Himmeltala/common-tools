/*
 * @Author: zhengrenfu
 * @Date: 2026-08-12
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-12
 * @FilePath: \electron\services\sys-notification.service.ts
 * @Description: 系统通知服务，渲染进程请求弹出 Windows 原生通知
 */

import { ipcMain, Notification } from 'electron'
import type { BrowserWindow } from 'electron'

/** 系统通知参数 */
export interface SysNotificationParams {
  title: string
  body: string
  silent?: boolean
  timeoutType?: 'default' | 'never'
}

/**
 * 注册系统通知 IPC handler
 * @param getWindow 获取主窗口的回调函数，点击通知时用于聚焦窗口
 */
export function setupSysNotificationIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('sys:showNotification', (_e, params: SysNotificationParams) => {
    if (!params || !params.title) {
      console.warn('[系统通知] 缺少通知参数')
      return { success: false, reason: '缺少参数' }
    }
    if (!Notification.isSupported()) {
      console.warn('[系统通知] 当前系统不支持通知')
      return { success: false, reason: 'unsupported' }
    }
    const n = new Notification({
      title: params.title,
      body: params.body || '',
      silent: !!params.silent,
      timeoutType: params.timeoutType === 'never' ? 'never' : 'default',
    })
    n.on('click', () => {
      const win = getWindow()
      if (win) {
        if (win.isMinimized()) win.restore()
        win.show()
        win.focus()
      }
    })
    n.show()
    return { success: true }
  })
}

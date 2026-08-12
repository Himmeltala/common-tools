/*
 * @Author: zhengrenfu
 * @Date: 2026-08-12 10:51:43
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-12 10:55:38
 * @FilePath: /electron/preload.ts
 * @Description: Preload
 */
import { contextBridge, ipcRenderer } from 'electron'

const ALLOWED_PREFIXES = ['settings:', 'notification:', 'store:', 'system:', 'tool:', 'sys:', 'event:', 'menu:']

/**
 * 校验 IPC channel 是否在白名单范围内
 * @param channel IPC 通道名
 */
function guardChannel(channel: string): void {
  if (!ALLOWED_PREFIXES.some((p) => channel.startsWith(p))) {
    throw new Error(`不允许的 IPC 通道: ${channel}`)
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, ...args: unknown[]) => {
    guardChannel(channel)
    return ipcRenderer.invoke(channel, ...args)
  },

  on: (channel: string, callback: (...args: unknown[]) => void) => {
    guardChannel(channel)
    const handler = (_e: Electron.IpcRendererEvent, ...data: unknown[]) => callback(...data)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
})

/*
 * @Author: zhengrenfu
 * @Date: 2026-07-20
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-11
 * @FilePath: \electron\services\notification.service.ts
 * @Description: 通知持久化服务，管理工具操作和系统事件的通知记录
 */
import { EventEmitter } from 'events'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { randomUUID } from 'crypto'

/** 通知类型 */
export type NotificationType = 'info' | 'warning' | 'error' | 'success'

/** 通知条目 */
export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  message: string
  source: string
  timestamp: number
  read: boolean
}

export class NotificationService extends EventEmitter {
  private filePath: string
  private notifications: NotificationItem[] = []

  constructor(filePath: string) {
    super()
    this.filePath = filePath
    this.load()
  }

  private load(): void {
    if (!existsSync(this.filePath)) return
    try {
      this.notifications = JSON.parse(readFileSync(this.filePath, 'utf-8'))
    } catch {
      // ignore
    }
  }

  private save(): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    writeFileSync(this.filePath, JSON.stringify(this.notifications, null, 2), 'utf-8')
  }

  /**
   * 创建通知
   * @param type 通知类型
   * @param title 标题
   * @param message 内容
   * @param source 来源标识
   * @returns 通知 id
   */
  createNotification(type: NotificationType, title: string, message: string, source: string = ''): string {
    const notification: NotificationItem = {
      id: randomUUID().slice(0, 12),
      type,
      title,
      message,
      source,
      timestamp: Date.now(),
      read: false,
    }

    this.notifications.unshift(notification)
    if (this.notifications.length > 100) {
      this.notifications = this.notifications.slice(0, 100)
    }

    this.save()
    this.emit('notificationCreated', {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      source: notification.source,
      timestamp: notification.timestamp,
    })

    return notification.id
  }

  getAll(): NotificationItem[] {
    return [...this.notifications]
  }

  getUnreadCount(): number {
    return this.notifications.filter((n) => !n.read).length
  }

  markRead(id: string): boolean {
    const n = this.notifications.find((item) => item.id === id)
    if (n && !n.read) {
      n.read = true
      this.save()
      return true
    }
    return false
  }

  markAllRead(): void {
    let changed = false
    for (const n of this.notifications) {
      if (!n.read) {
        n.read = true
        changed = true
      }
    }
    if (changed) this.save()
  }

  clearAll(): void {
    this.notifications = []
    this.save()
    this.emit('notificationsCleared')
  }
}

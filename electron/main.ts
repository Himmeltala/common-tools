// #region Imports
import { app, BrowserWindow, Menu, ipcMain, dialog } from 'electron'
import { join, resolve, dirname } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname as pathDirname } from 'path'
import { fileURLToPath } from 'url'

import { AppSettings } from '@electron/services/core/settings.service'
import { NotificationService } from '@electron/services/notification.service'
import { ensureDataDir } from '@electron/services/core/data-dir.service'
import { createStore, storeGet, storeSet, storeDelete, storeKeys } from '@electron/services/core/store.service'
import type { Store } from '@electron/services/core/store.service'
import { toolExecutors, type ToolExecutorContext } from '@electron/services/tool-executor.service'
import '@electron/services/python-executor.service'
import '@electron/services/markdown'
import '@electron/services/database'
import { setupSysNotificationIpc } from '@electron/services/sys-notification.service'
// #endregion

/** ESM 下 __dirname 不可用，通过 import.meta.url 派生 */
const __dirname = dirname(fileURLToPath(import.meta.url))

const APP_NAME = 'common-tools'
// #region Services & State
let mainWindow: BrowserWindow | null = null
let settings: AppSettings
let notificationService: NotificationService
let store: Store
let appVersion: string
// #endregion

// #region Window
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 800,
    minWidth: 900,
    minHeight: 500,
    title: APP_NAME,
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    mainWindow?.maximize()
  })

  mainWindow.webContents.on('before-input-event', (_e, input) => {
    if (input.key === 'F12') {
      mainWindow?.webContents.toggleDevTools()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  setupMenu()
  registerIpc()
  // 注册系统通知 IPC
  setupSysNotificationIpc(() => mainWindow)
}
// #endregion

// #region Menu
function setupMenu(): void {
  const send = (action: string) => mainWindow?.webContents.send('menu:event', { action })
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        { label: '设置', click: () => send('settings') },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '刷新' },
        { role: 'toggleDevTools', label: '开发者工具' },
      ],
    },
  ]
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}
// #endregion

// #region IPC Registration
function registerIpc(): void {
  // 工具执行器
  ipcMain.handle('tool:execute', async (_e, executorId: string, params: Record<string, unknown>) => {
    const executor = toolExecutors.get(executorId)
    if (!executor) {
      return { success: false, error: `未找到执行器: ${executorId}` }
    }
    try {
      const ctx: ToolExecutorContext = {
        app: { getPath: (name: string) => app.getPath(name as any) },
      }
      return await executor.execute(params, ctx)
    } catch (e: any) {
      return { success: false, error: e.message || '执行器内部错误' }
    }
  })

  // 工具保存文件（二进制数据）
  ipcMain.handle('tool:saveFile', (_e, filePath: string, bytes: number[]) => {
    try {
      mkdirSync(pathDirname(filePath), { recursive: true })
      writeFileSync(filePath, Buffer.from(bytes))
      return true
    } catch (e: any) {
      return false
    }
  })

  // 设置
  ipcMain.handle('settings:get', (_e, key: string, defaultVal?: any) => settings.get(key, defaultVal))
  ipcMain.handle('settings:set', (_e, key: string, value: any) => {
    settings.set(key, value)
    if (key === 'theme') mainWindow?.webContents.send('event:themeChanged', value)
  })
  ipcMain.handle('settings:getSchema', () => settings.getSchema())

  // 通知
  ipcMain.handle('notification:getAll', () => notificationService.getAll())
  ipcMain.handle('notification:getUnreadCount', () => notificationService.getUnreadCount())
  ipcMain.handle('notification:create', (_e, type, title, message, source) =>
    notificationService.createNotification(type, title, message, source),
  )
  ipcMain.handle('notification:markRead', (_e, id: string) => notificationService.markRead(id))
  ipcMain.handle('notification:markAllRead', () => notificationService.markAllRead())
  ipcMain.handle('notification:clearAll', () => notificationService.clearAll())

  // Store
  ipcMain.handle('store:get', (_e, key: string) => storeGet(store, key))
  ipcMain.handle('store:set', (_e, key: string, value: any) => storeSet(store, key, value))
  ipcMain.handle('store:delete', (_e, key: string) => storeDelete(store, key))
  ipcMain.handle('store:keys', () => storeKeys(store))

  // 系统
  ipcMain.handle('system:getVersion', () => appVersion)
  ipcMain.handle('system:selectDirectory', async (_e, defaultPath?: string) => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'], defaultPath })
    return result.canceled ? null : result.filePaths[0]
  })
  ipcMain.handle('system:selectFile', async (_e, filters?: { name: string; extensions: string[] }[]) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: filters || [{ name: '所有文件', extensions: ['*'] }],
    })
    return result.canceled ? null : result.filePaths[0]
  })
  ipcMain.handle(
    'system:saveFile',
    async (_e, defaultPath?: string, filters?: { name: string; extensions: string[] }[]) => {
      const result = await dialog.showSaveDialog({
        defaultPath,
        filters: filters || [{ name: '所有文件', extensions: ['*'] }],
      })
      return result.canceled ? null : result.filePath
    },
  )
}
// #endregion

// #region Init
function initServices(): void {
  const sourceRoot = app.isPackaged ? process.resourcesPath : resolve(__dirname, '..')
  const dataDir = ensureDataDir(APP_NAME, sourceRoot)
  store = createStore(dataDir)

  appVersion = app.getVersion()

  const assetDir = join(dataDir, 'assets')
  const schemaPath = join(assetDir, 'settings_schema.json')
  const settingsPath = join(assetDir, 'settings.json')
  settings = new AppSettings(settingsPath, schemaPath)

  const notifyPath = join(assetDir, 'notifications.json')
  notificationService = new NotificationService(notifyPath)

  notificationService.on('notificationCreated', (data) => {
    mainWindow?.webContents.send('event:notificationCreated', data)
  })
  notificationService.on('notificationsCleared', () => {
    mainWindow?.webContents.send('event:notificationsCleared')
  })
}

process.on('uncaughtException', (error) => {
  const msg = `未捕获异常: ${error.message}\n${error.stack || ''}`
  console.error(msg)
  if (mainWindow) mainWindow.webContents.send('event:output', { type: 'error', text: msg })
})

process.on('unhandledRejection', (reason: any) => {
  const msg = `未处理的 Promise 拒绝: ${reason?.message || reason}`
  console.error(msg)
  if (mainWindow) mainWindow.webContents.send('event:output', { type: 'error', text: msg })
})
// #endregion

// #region App Lifecycle
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

// Windows 通知要求设置 AppUserModelId
app.setAppUserModelId('com.common-tools.app')

app.whenReady().then(() => {
  initServices()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
// #endregion

import { app, BrowserWindow, ipcMain } from 'electron'
import { resolve } from 'node:path'
import { BrowserRuntime } from './browserRuntime'
import { DownloadManager } from './downloadManager'
import { loadSessionSnapshot, saveSessionSnapshot } from './sessionStore'
import { IPC_CHANNELS, type AppPlatformResponse, type AppVersionResponse } from '../shared/ipc'

let browserRuntime: BrowserRuntime | null = null
let downloadManager: DownloadManager | null = null

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.appGetVersion, (): AppVersionResponse => ({
    version: app.getVersion()
  }))

  ipcMain.handle(IPC_CHANNELS.appGetPlatform, (): AppPlatformResponse => ({
    platform: process.platform
  }))

  ipcMain.handle(IPC_CHANNELS.browserListTabs, () => browserRuntime?.getTabSnapshotList() ?? [])
  ipcMain.handle(IPC_CHANNELS.browserCreateTab, (_event, initialUrl?: string) =>
    browserRuntime?.createTab(initialUrl) ?? []
  )
  ipcMain.handle(IPC_CHANNELS.browserActivateTab, (_event, tabId: string) =>
    browserRuntime?.activateTab(tabId) ?? []
  )
  ipcMain.handle(IPC_CHANNELS.browserCloseTab, (_event, tabId: string) =>
    browserRuntime?.closeTab(tabId) ?? []
  )
  ipcMain.handle(IPC_CHANNELS.browserNavigate, (_event, request) => browserRuntime?.navigate(request) ?? [])
  ipcMain.handle(IPC_CHANNELS.browserBack, (_event, tabId: string) => browserRuntime?.back(tabId) ?? [])
  ipcMain.handle(IPC_CHANNELS.browserForward, (_event, tabId: string) =>
    browserRuntime?.forward(tabId) ?? []
  )
  ipcMain.handle(IPC_CHANNELS.browserReload, (_event, tabId: string) => browserRuntime?.reload(tabId) ?? [])
  ipcMain.handle(IPC_CHANNELS.browserStop, (_event, tabId: string) => browserRuntime?.stop(tabId) ?? [])
  ipcMain.handle(IPC_CHANNELS.browserGetDownloads, () => downloadManager?.listDownloads() ?? [])
}

function createWindow(): void {
  const userDataPath = app.getPath('userData')

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: resolve(__dirname, '../preload/index.js')
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  browserRuntime = new BrowserRuntime(mainWindow, (payload) => {
    mainWindow.webContents.send('browser:state', payload)

    if (browserRuntime) {
      saveSessionSnapshot(userDataPath, browserRuntime.exportSnapshot())
    }
  })

  downloadManager = new DownloadManager(
    (payload) => {
      mainWindow.webContents.send('browser:downloads', payload)
    },
    process.env.PATHFINDER_DOWNLOAD_DIR
  )
  downloadManager.start()

  const snapshot = loadSessionSnapshot(userDataPath)
  if (snapshot) {
    browserRuntime.restoreFromSnapshot(snapshot)
  } else {
    browserRuntime.createTab('about:blank')
  }

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(resolve(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (browserRuntime) {
    saveSessionSnapshot(app.getPath('userData'), browserRuntime.exportSnapshot())
  }
})

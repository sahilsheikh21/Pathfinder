import { app, BrowserWindow, ipcMain } from 'electron'
import { resolve } from 'node:path'
import { IPC_CHANNELS, type AppPlatformResponse, type AppVersionResponse } from '../shared/ipc'

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.appGetVersion, (): AppVersionResponse => ({
    version: app.getVersion()
  }))

  ipcMain.handle(IPC_CHANNELS.appGetPlatform, (): AppPlatformResponse => ({
    platform: process.platform
  }))
}

function createWindow(): void {
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

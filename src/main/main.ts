import { app, BrowserWindow, ipcMain } from 'electron'
import { resolve } from 'node:path'
import { BrowserRuntime } from './browserRuntime'
import { DownloadManager } from './downloadManager'
import { createHomeStore, type HomeStore } from './homeStore'
import {
  createQuickSearchWindowManager,
  type QuickSearchWindowManager
} from './quickSearchWindow'
import { createAutomationCdpBridge, type AutomationCdpBridge } from './cdpBridge'
import { createActionRecorder, type ActionRecorder } from './actionRecorder'
import { loadSessionSnapshot, saveSessionSnapshot } from './sessionStore'
import { IPC_CHANNELS, type AppPlatformResponse, type AppVersionResponse } from '../shared/ipc'
import { DEFAULT_HOME_SEARCH_TEMPLATE } from '../shared/browser'

let browserRuntime: BrowserRuntime | null = null
let downloadManager: DownloadManager | null = null
let homeStore: HomeStore | null = null
let quickSearchWindowManager: QuickSearchWindowManager | null = null
let automationCdpBridge: AutomationCdpBridge | null = null
let actionRecorder: ActionRecorder | null = null

const cdpPort = Number(process.env.PATHFINDER_CDP_PORT ?? '9222')
const cdpEndpoint = `http://127.0.0.1:${cdpPort}`

app.commandLine.appendSwitch('remote-debugging-port', String(cdpPort))

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
  ipcMain.handle(IPC_CHANNELS.quickSearchToggle, async () => {
    await quickSearchWindowManager?.toggle()
  })
  ipcMain.handle(IPC_CHANNELS.quickSearchOpen, async (_event, request) => {
    await quickSearchWindowManager?.open(request)
  })
  ipcMain.handle(IPC_CHANNELS.quickSearchClose, () => {
    quickSearchWindowManager?.close()
  })
  ipcMain.handle(IPC_CHANNELS.quickSearchSubmit, (_event, request) => {
    const target = typeof request?.target === 'string' ? request.target.trim() : ''
    if (!target) {
      return
    }

    browserRuntime?.navigateActiveOrCreate(target)
    quickSearchWindowManager?.close()
  })
  ipcMain.handle(IPC_CHANNELS.automationConnect, async (_event, request) => {
    if (!automationCdpBridge) {
      return {
        ok: false,
        sessionId: null,
        state: 'error',
        reason: 'attach-failed',
        tabId: null
      }
    }

    return automationCdpBridge.connect(request)
  })
  ipcMain.handle(IPC_CHANNELS.automationDisconnect, async (_event, request) => {
    if (!automationCdpBridge) {
      return {
        ok: false,
        state: 'disconnected',
        reason: 'invalid-session'
      }
    }

    return automationCdpBridge.disconnect(request)
  })
  ipcMain.handle(IPC_CHANNELS.automationGetStatus, () => {
    if (!automationCdpBridge) {
      return {
        state: 'idle',
        owner: null,
        sessionId: null,
        tabId: null,
        reason: 'none'
      }
    }

    return automationCdpBridge.getStatus()
  })
  ipcMain.handle(IPC_CHANNELS.automationRecordStart, (_event, request) => {
    if (!actionRecorder) {
      return {
        ok: false,
        sessionId: null,
        state: 'error',
        reason: 'failed',
        tabId: null
      }
    }

    return actionRecorder.start(request)
  })
  ipcMain.handle(IPC_CHANNELS.automationRecordStop, (_event, request) => {
    if (!actionRecorder) {
      return {
        ok: false,
        state: 'error',
        reason: 'not-recording'
      }
    }

    return actionRecorder.stop(request)
  })
  ipcMain.handle(IPC_CHANNELS.automationRecordStatus, () => {
    return actionRecorder?.getStatus() ?? {
      state: 'idle',
      sessionId: null,
      tabId: null,
      reason: 'none',
      startedAt: null
    }
  })
  ipcMain.handle(IPC_CHANNELS.homeGetPreferences, () =>
    homeStore?.getHomePreferences() ?? { searchTemplate: DEFAULT_HOME_SEARCH_TEMPLATE }
  )
  ipcMain.handle(IPC_CHANNELS.homeSavePreferences, (_event, preferences) =>
    homeStore?.saveHomePreferences(preferences) ?? { searchTemplate: DEFAULT_HOME_SEARCH_TEMPLATE }
  )
  ipcMain.handle(IPC_CHANNELS.homeListQuickLinks, () => homeStore?.listQuickLinks() ?? [])
  ipcMain.handle(IPC_CHANNELS.homeUpsertQuickLink, (_event, quickLink) =>
    homeStore?.upsertQuickLink(quickLink) ?? []
  )
  ipcMain.handle(IPC_CHANNELS.homeRemoveQuickLink, (_event, quickLinkId: string) =>
    homeStore?.removeQuickLink(quickLinkId) ?? []
  )
  ipcMain.handle(IPC_CHANNELS.homeListRecentAutomations, () =>
    homeStore?.listRecentAutomations() ?? []
  )
}

function createWindow(): void {
  const userDataPath = app.getPath('userData')
  homeStore = createHomeStore(userDataPath)

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

  quickSearchWindowManager = createQuickSearchWindowManager({
    preloadPath: resolve(__dirname, '../preload/index.js'),
    rendererIndexPath: resolve(__dirname, '../renderer/index.html'),
    ...(process.env.VITE_DEV_SERVER_URL
      ? { devServerUrl: process.env.VITE_DEV_SERVER_URL }
      : {})
  })

  browserRuntime = new BrowserRuntime(mainWindow, (payload) => {
    mainWindow.webContents.send('browser:state', payload)

    if (browserRuntime) {
      saveSessionSnapshot(userDataPath, browserRuntime.exportSnapshot())
    }
  })

  automationCdpBridge = createAutomationCdpBridge({
    cdpEndpoint,
    resolveTarget: (tabId) => browserRuntime?.resolveAutomationTarget(tabId) ?? null
  })

  actionRecorder = createActionRecorder({
    resolveTarget: (tabId) => {
      const target = browserRuntime?.resolveAutomationTarget(tabId)
      if (!target) {
        return null
      }

      return {
        tabId: target.tabId,
        url: target.url
      }
    }
  })

  browserRuntime.onTabClosed((tabId) => {
    actionRecorder?.stopForTargetLoss(tabId)
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
  void automationCdpBridge?.shutdown()
  actionRecorder?.shutdown()
  quickSearchWindowManager?.destroy()

  if (browserRuntime) {
    saveSessionSnapshot(app.getPath('userData'), browserRuntime.exportSnapshot())
  }
})

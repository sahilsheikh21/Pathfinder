import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type AppPlatformResponse, type AppVersionResponse, type PathfinderApi } from '../shared/ipc'

const subscribe = <T>(channel: string, callback: (payload: T) => void): (() => void) => {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => {
    callback(payload)
  }

  ipcRenderer.on(channel, listener)

  return (): void => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const api: PathfinderApi = {
  getVersion: async (): Promise<AppVersionResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.appGetVersion),
  getPlatform: async (): Promise<AppPlatformResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.appGetPlatform),
  listTabs: async () => ipcRenderer.invoke(IPC_CHANNELS.browserListTabs),
  createTab: async (initialUrl?: string) => ipcRenderer.invoke(IPC_CHANNELS.browserCreateTab, initialUrl),
  activateTab: async (tabId: string) => ipcRenderer.invoke(IPC_CHANNELS.browserActivateTab, tabId),
  closeTab: async (tabId: string) => ipcRenderer.invoke(IPC_CHANNELS.browserCloseTab, tabId),
  navigate: async (request) => ipcRenderer.invoke(IPC_CHANNELS.browserNavigate, request),
  back: async (tabId: string) => ipcRenderer.invoke(IPC_CHANNELS.browserBack, tabId),
  forward: async (tabId: string) => ipcRenderer.invoke(IPC_CHANNELS.browserForward, tabId),
  reload: async (tabId: string) => ipcRenderer.invoke(IPC_CHANNELS.browserReload, tabId),
  stop: async (tabId: string) => ipcRenderer.invoke(IPC_CHANNELS.browserStop, tabId),
  listDownloads: async () => ipcRenderer.invoke(IPC_CHANNELS.browserGetDownloads),
  onBrowserState: (callback) => subscribe(IPC_CHANNELS.browserOnState, callback),
  onDownloadState: (callback) => subscribe(IPC_CHANNELS.browserOnDownloads, callback),
  getHomePreferences: async () => ipcRenderer.invoke(IPC_CHANNELS.homeGetPreferences),
  saveHomePreferences: async (preferences) => ipcRenderer.invoke(IPC_CHANNELS.homeSavePreferences, preferences),
  listQuickLinks: async () => ipcRenderer.invoke(IPC_CHANNELS.homeListQuickLinks),
  upsertQuickLink: async (quickLink) => ipcRenderer.invoke(IPC_CHANNELS.homeUpsertQuickLink, quickLink),
  removeQuickLink: async (quickLinkId: string) => ipcRenderer.invoke(IPC_CHANNELS.homeRemoveQuickLink, quickLinkId),
  listRecentAutomations: async () => ipcRenderer.invoke(IPC_CHANNELS.homeListRecentAutomations)
}

contextBridge.exposeInMainWorld('pathfinder', api)

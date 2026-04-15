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
  quickSearchToggle: async () => ipcRenderer.invoke(IPC_CHANNELS.quickSearchToggle),
  quickSearchOpen: async (request) => ipcRenderer.invoke(IPC_CHANNELS.quickSearchOpen, request),
  quickSearchClose: async () => ipcRenderer.invoke(IPC_CHANNELS.quickSearchClose),
  quickSearchSubmit: async (request) => ipcRenderer.invoke(IPC_CHANNELS.quickSearchSubmit, request),
  connectAutomationSession: async (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.automationConnect, request),
  disconnectAutomationSession: async (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.automationDisconnect, request),
  getAutomationBridgeStatus: async () => ipcRenderer.invoke(IPC_CHANNELS.automationGetStatus),
  startAutomationRecording: async (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.automationRecordStart, request),
  stopAutomationRecording: async (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.automationRecordStop, request),
  getAutomationRecordingStatus: async () =>
    ipcRenderer.invoke(IPC_CHANNELS.automationRecordStatus),
  startAutomationPlayback: async (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.automationPlaybackStart, request),
  getAutomationPlaybackStatus: async () =>
    ipcRenderer.invoke(IPC_CHANNELS.automationPlaybackStatus),
  cancelAutomationPlayback: async (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.automationPlaybackCancel, request),
  automationLibraryList: async (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.automationLibraryList, request),
  automationLibraryUpsert: async (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.automationLibraryUpsert, request),
  automationLibraryDelete: async (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.automationLibraryDelete, request),
  automationLibraryRun: async (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.automationLibraryRun, request),
  automationHistoryList: async (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.automationHistoryList, request),
  automationHistoryRemove: async (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.automationHistoryRemove, request),
  automationHistoryClear: async (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.automationHistoryClear, request),
  automationHistoryRerun: async (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.automationHistoryRerun, request),
  getAutomationSidebarPreferences: async () =>
    ipcRenderer.invoke(IPC_CHANNELS.automationSidebarGetPreferences),
  saveAutomationSidebarPreferences: async (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.automationSidebarSavePreferences, request),
  getHomePreferences: async () => ipcRenderer.invoke(IPC_CHANNELS.homeGetPreferences),
  saveHomePreferences: async (preferences) => ipcRenderer.invoke(IPC_CHANNELS.homeSavePreferences, preferences),
  listQuickLinks: async () => ipcRenderer.invoke(IPC_CHANNELS.homeListQuickLinks),
  upsertQuickLink: async (quickLink) => ipcRenderer.invoke(IPC_CHANNELS.homeUpsertQuickLink, quickLink),
  removeQuickLink: async (quickLinkId: string) => ipcRenderer.invoke(IPC_CHANNELS.homeRemoveQuickLink, quickLinkId),
  listRecentAutomations: async () => ipcRenderer.invoke(IPC_CHANNELS.homeListRecentAutomations),
  llmGetConfig: async () => ipcRenderer.invoke(IPC_CHANNELS.llmGetConfig),
  llmSaveConfig: async (patch) => ipcRenderer.invoke(IPC_CHANNELS.llmSaveConfig, patch),
  llmValidateConfig: async (request) => ipcRenderer.invoke(IPC_CHANNELS.llmValidateConfig, request),
  llmGenerate: async (request) => ipcRenderer.invoke(IPC_CHANNELS.llmGenerate, request)
}

contextBridge.exposeInMainWorld('pathfinder', api)

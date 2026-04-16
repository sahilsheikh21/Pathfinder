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
  settingsGetSnapshot: async () => ipcRenderer.invoke(IPC_CHANNELS.settingsGetSnapshot),
  settingsSaveGeneral: async (request) => ipcRenderer.invoke(IPC_CHANNELS.settingsSaveGeneral, request),
  settingsSavePrivacy: async (request) => ipcRenderer.invoke(IPC_CHANNELS.settingsSavePrivacy, request),
  settingsClearData: async (request) => ipcRenderer.invoke(IPC_CHANNELS.settingsClearData, request),
  settingsGetRepairNotice: async () => ipcRenderer.invoke(IPC_CHANNELS.settingsGetRepairNotice),
  llmGetConfig: async () => ipcRenderer.invoke(IPC_CHANNELS.llmGetConfig),
  llmSaveConfig: async (patch) => ipcRenderer.invoke(IPC_CHANNELS.llmSaveConfig, patch),
  llmValidateConfig: async (request) => ipcRenderer.invoke(IPC_CHANNELS.llmValidateConfig, request),
  llmGenerate: async (request) => ipcRenderer.invoke(IPC_CHANNELS.llmGenerate, request),
  aiAutomationGenerate: async (request) => ipcRenderer.invoke(IPC_CHANNELS.aiAutomationGenerate, request),
  aiAutomationCancel: async (request) => ipcRenderer.invoke(IPC_CHANNELS.aiAutomationCancel, request),
  aiAutomationGetStatus: async () => ipcRenderer.invoke(IPC_CHANNELS.aiAutomationGetStatus),
  liveAgentStart: async (request) => ipcRenderer.invoke(IPC_CHANNELS.liveAgentStart, request),
  liveAgentGetStatus: async (request) => ipcRenderer.invoke(IPC_CHANNELS.liveAgentGetStatus, request),
  liveAgentApproveBatch: async (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.liveAgentApproveBatch, request),
  liveAgentPause: async (request) => ipcRenderer.invoke(IPC_CHANNELS.liveAgentPause, request),
  liveAgentResume: async (request) => ipcRenderer.invoke(IPC_CHANNELS.liveAgentResume, request),
  liveAgentCancel: async (request) => ipcRenderer.invoke(IPC_CHANNELS.liveAgentCancel, request),
  liveAgentGetAuditTrail: async (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.liveAgentGetAuditTrail, request),
  pageAnalysisSummarize: async (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.pageAnalysisSummarize, request),
  pageAnalysisAsk: async (request) => ipcRenderer.invoke(IPC_CHANNELS.pageAnalysisAsk, request),
  pageAnalysisCancel: async (request) => ipcRenderer.invoke(IPC_CHANNELS.pageAnalysisCancel, request),
  pageAnalysisRefreshContext: async (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.pageAnalysisRefreshContext, request),
  pageAnalysisClearContext: async (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.pageAnalysisClearContext, request),
  pageAnalysisGetStatus: async (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.pageAnalysisGetStatus, request)
}

contextBridge.exposeInMainWorld('pathfinder', api)

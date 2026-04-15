import type {
  AutomationBridgeStatus,
  AutomationConnectRequest,
  AutomationConnectResult,
  AutomationDisconnectRequest,
  AutomationDisconnectResult,
  RecorderStartRequest,
  RecorderStartResult,
  RecorderStatus,
  RecorderStopRequest,
  RecorderStopResult,
  BrowserNavigationRequest,
  BrowserStatePayload,
  BrowserTabState,
  DownloadState,
  DownloadStatePayload,
  HomePreferences,
  QuickSearchOpenRequest,
  QuickSearchSubmitRequest,
  QuickLink,
  RecentAutomationPreview
} from './browser'

export const IPC_CHANNELS = {
  appGetVersion: 'app:getVersion',
  appGetPlatform: 'app:getPlatform',
  browserListTabs: 'browser:listTabs',
  browserCreateTab: 'browser:createTab',
  browserActivateTab: 'browser:activateTab',
  browserCloseTab: 'browser:closeTab',
  browserNavigate: 'browser:navigate',
  browserBack: 'browser:back',
  browserForward: 'browser:forward',
  browserReload: 'browser:reload',
  browserStop: 'browser:stop',
  browserGetDownloads: 'browser:getDownloads',
  browserOnState: 'browser:state',
  browserOnDownloads: 'browser:downloads',
  quickSearchToggle: 'quickSearch:toggle',
  quickSearchOpen: 'quickSearch:open',
  quickSearchClose: 'quickSearch:close',
  quickSearchSubmit: 'quickSearch:submit',
  automationConnect: 'automation:connect',
  automationDisconnect: 'automation:disconnect',
  automationGetStatus: 'automation:getStatus',
  automationRecordStart: 'automation:record:start',
  automationRecordStop: 'automation:record:stop',
  automationRecordStatus: 'automation:record:status',
  homeGetPreferences: 'home:getPreferences',
  homeSavePreferences: 'home:savePreferences',
  homeListQuickLinks: 'home:listQuickLinks',
  homeUpsertQuickLink: 'home:upsertQuickLink',
  homeRemoveQuickLink: 'home:removeQuickLink',
  homeListRecentAutomations: 'home:listRecentAutomations'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

export interface AppVersionResponse {
  version: string
}

export interface AppPlatformResponse {
  platform: string
}

export interface PathfinderApi {
  getVersion: () => Promise<AppVersionResponse>
  getPlatform: () => Promise<AppPlatformResponse>
  listTabs: () => Promise<BrowserTabState[]>
  createTab: (initialUrl?: string) => Promise<BrowserTabState[]>
  activateTab: (tabId: string) => Promise<BrowserTabState[]>
  closeTab: (tabId: string) => Promise<BrowserTabState[]>
  navigate: (request: BrowserNavigationRequest) => Promise<BrowserTabState[]>
  back: (tabId: string) => Promise<BrowserTabState[]>
  forward: (tabId: string) => Promise<BrowserTabState[]>
  reload: (tabId: string) => Promise<BrowserTabState[]>
  stop: (tabId: string) => Promise<BrowserTabState[]>
  listDownloads: () => Promise<DownloadState[]>
  onBrowserState: (callback: (payload: BrowserStatePayload) => void) => () => void
  onDownloadState: (callback: (payload: DownloadStatePayload) => void) => () => void
  quickSearchToggle: () => Promise<void>
  quickSearchOpen: (request?: QuickSearchOpenRequest) => Promise<void>
  quickSearchClose: () => Promise<void>
  quickSearchSubmit: (request: QuickSearchSubmitRequest) => Promise<void>
  connectAutomationSession: (request: AutomationConnectRequest) => Promise<AutomationConnectResult>
  disconnectAutomationSession: (
    request: AutomationDisconnectRequest
  ) => Promise<AutomationDisconnectResult>
  getAutomationBridgeStatus: () => Promise<AutomationBridgeStatus>
  startAutomationRecording: (request: RecorderStartRequest) => Promise<RecorderStartResult>
  stopAutomationRecording: (request?: RecorderStopRequest) => Promise<RecorderStopResult>
  getAutomationRecordingStatus: () => Promise<RecorderStatus>
  getHomePreferences: () => Promise<HomePreferences>
  saveHomePreferences: (preferences: HomePreferences) => Promise<HomePreferences>
  listQuickLinks: () => Promise<QuickLink[]>
  upsertQuickLink: (quickLink: QuickLink) => Promise<QuickLink[]>
  removeQuickLink: (quickLinkId: string) => Promise<QuickLink[]>
  listRecentAutomations: () => Promise<RecentAutomationPreview[]>
}

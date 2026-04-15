import type {
  BrowserNavigationRequest,
  BrowserStatePayload,
  BrowserTabState,
  DownloadState,
  DownloadStatePayload,
  HomePreferences,
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
  getHomePreferences: () => Promise<HomePreferences>
  saveHomePreferences: (preferences: HomePreferences) => Promise<HomePreferences>
  listQuickLinks: () => Promise<QuickLink[]>
  upsertQuickLink: (quickLink: QuickLink) => Promise<QuickLink[]>
  removeQuickLink: (quickLinkId: string) => Promise<QuickLink[]>
  listRecentAutomations: () => Promise<RecentAutomationPreview[]>
}

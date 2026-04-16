import type {
  AutomationHistoryClearRequest,
  AutomationHistoryListRequest,
  AutomationHistoryListResult,
  AutomationHistoryRemoveRequest,
  AutomationHistoryRerunRequest,
  AutomationLibraryDeleteRequest,
  AutomationLibraryListRequest,
  AutomationLibraryResult,
  AutomationLibraryRunRequest,
  AutomationLibraryUpsertRequest,
  AutomationPlaybackCancelRequest,
  AutomationPlaybackCancelResult,
  AutomationPlaybackStartRequest,
  AutomationPlaybackStartResult,
  AutomationPlaybackStatus,
  AutomationSidebarPreferences,
  AutomationSidebarPreferencesUpdateRequest,
  AutomationBridgeStatus,
  AutomationConnectRequest,
  AutomationConnectResult,
  AutomationDisconnectRequest,
  AutomationDisconnectResult,
  LLMAdapterConfigState,
  LLMGenerateRequest,
  LLMGenerateResult,
  LLMProviderConfigPatch,
  LLMValidateConfigRequest,
  LLMValidateConfigResult,
  PageAnalysisAskRequest,
  PageAnalysisCancelRequest,
  PageAnalysisCancelResult,
  PageAnalysisClearContextRequest,
  PageAnalysisClearContextResult,
  PageAnalysisRefreshContextRequest,
  PageAnalysisRefreshContextResult,
  PageAnalysisResult,
  PageAnalysisStatusRequest,
  PageAnalysisStatusResult,
  PageAnalysisSummarizeRequest,
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
  automationPlaybackStart: 'automation:playback:start',
  automationPlaybackStatus: 'automation:playback:status',
  automationPlaybackCancel: 'automation:playback:cancel',
  automationLibraryList: 'automation:library:list',
  automationLibraryUpsert: 'automation:library:upsert',
  automationLibraryDelete: 'automation:library:delete',
  automationLibraryRun: 'automation:library:run',
  automationHistoryList: 'automation:history:list',
  automationHistoryRemove: 'automation:history:remove',
  automationHistoryClear: 'automation:history:clear',
  automationHistoryRerun: 'automation:history:rerun',
  automationSidebarGetPreferences: 'automation:sidebar:getPreferences',
  automationSidebarSavePreferences: 'automation:sidebar:savePreferences',
  homeGetPreferences: 'home:getPreferences',
  homeSavePreferences: 'home:savePreferences',
  homeListQuickLinks: 'home:listQuickLinks',
  homeUpsertQuickLink: 'home:upsertQuickLink',
  homeRemoveQuickLink: 'home:removeQuickLink',
  homeListRecentAutomations: 'home:listRecentAutomations',
  llmGetConfig: 'llm:getConfig',
  llmSaveConfig: 'llm:saveConfig',
  llmValidateConfig: 'llm:validateConfig',
  llmGenerate: 'llm:generate',
  pageAnalysisSummarize: 'pageAnalysis:summarize',
  pageAnalysisAsk: 'pageAnalysis:ask',
  pageAnalysisCancel: 'pageAnalysis:cancel',
  pageAnalysisRefreshContext: 'pageAnalysis:refreshContext',
  pageAnalysisClearContext: 'pageAnalysis:clearContext',
  pageAnalysisGetStatus: 'pageAnalysis:getStatus'
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
  startAutomationPlayback: (
    request: AutomationPlaybackStartRequest
  ) => Promise<AutomationPlaybackStartResult>
  getAutomationPlaybackStatus: () => Promise<AutomationPlaybackStatus>
  cancelAutomationPlayback: (
    request?: AutomationPlaybackCancelRequest
  ) => Promise<AutomationPlaybackCancelResult>
  automationLibraryList: (request?: AutomationLibraryListRequest) => Promise<AutomationLibraryResult>
  automationLibraryUpsert: (request: AutomationLibraryUpsertRequest) => Promise<AutomationLibraryResult>
  automationLibraryDelete: (request: AutomationLibraryDeleteRequest) => Promise<AutomationLibraryResult>
  automationLibraryRun: (request: AutomationLibraryRunRequest) => Promise<AutomationPlaybackStartResult>
  automationHistoryList: (request?: AutomationHistoryListRequest) => Promise<AutomationHistoryListResult>
  automationHistoryRemove: (
    request: AutomationHistoryRemoveRequest
  ) => Promise<AutomationHistoryListResult>
  automationHistoryClear: (request?: AutomationHistoryClearRequest) => Promise<AutomationHistoryListResult>
  automationHistoryRerun: (
    request: AutomationHistoryRerunRequest
  ) => Promise<AutomationPlaybackStartResult>
  getAutomationSidebarPreferences: () => Promise<AutomationSidebarPreferences>
  saveAutomationSidebarPreferences: (
    request: AutomationSidebarPreferencesUpdateRequest
  ) => Promise<AutomationSidebarPreferences>
  getHomePreferences: () => Promise<HomePreferences>
  saveHomePreferences: (preferences: HomePreferences) => Promise<HomePreferences>
  listQuickLinks: () => Promise<QuickLink[]>
  upsertQuickLink: (quickLink: QuickLink) => Promise<QuickLink[]>
  removeQuickLink: (quickLinkId: string) => Promise<QuickLink[]>
  listRecentAutomations: () => Promise<RecentAutomationPreview[]>
  llmGetConfig: () => Promise<LLMAdapterConfigState>
  llmSaveConfig: (patch: LLMProviderConfigPatch) => Promise<LLMAdapterConfigState>
  llmValidateConfig: (request: LLMValidateConfigRequest) => Promise<LLMValidateConfigResult>
  llmGenerate: (request: LLMGenerateRequest) => Promise<LLMGenerateResult>
  pageAnalysisSummarize: (request?: PageAnalysisSummarizeRequest) => Promise<PageAnalysisResult>
  pageAnalysisAsk: (request: PageAnalysisAskRequest) => Promise<PageAnalysisResult>
  pageAnalysisCancel: (request?: PageAnalysisCancelRequest) => Promise<PageAnalysisCancelResult>
  pageAnalysisRefreshContext: (
    request?: PageAnalysisRefreshContextRequest
  ) => Promise<PageAnalysisRefreshContextResult>
  pageAnalysisClearContext: (
    request?: PageAnalysisClearContextRequest
  ) => Promise<PageAnalysisClearContextResult>
  pageAnalysisGetStatus: (request?: PageAnalysisStatusRequest) => Promise<PageAnalysisStatusResult>
}

export interface BrowserTabState {
  id: string
  title: string
  url: string
  isActive: boolean
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
}

export interface BrowserNavigationRequest {
  tabId: string
  input: string
}

export interface OmniboxResolution {
  kind: 'url' | 'search'
  target: string
}

export interface BrowserSessionSnapshot {
  tabs: BrowserTabState[]
  activeTabId: string | null
  savedAt: string
}

export type DownloadLifecycleState = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'

export interface DownloadState {
  id: string
  fileName: string
  state: DownloadLifecycleState
  receivedBytes: number
  totalBytes: number
  savePath: string | null
}

export interface BrowserStatePayload {
  tabs: BrowserTabState[]
  activeTabId: string | null
}

export interface DownloadStatePayload {
  downloads: DownloadState[]
}

export const HOME_STARTER_URL = 'about:pathfinder-home'

export const DEFAULT_HOME_SEARCH_TEMPLATE = 'https://duckduckgo.com/?q={query}'

export interface HomePreferences {
  searchTemplate: string
}

export interface QuickSearchOpenRequest {
  query?: string
}

export interface QuickSearchSubmitRequest {
  query: string
  target: string
}

export type AutomationOwner = 'command-palette' | 'automation-engine' | 'system'

export type AutomationSessionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'

export type AutomationDisconnectReason =
  | 'none'
  | 'busy'
  | 'missing-target'
  | 'attach-failed'
  | 'disconnected'
  | 'invalid-session'
  | 'shutdown'

export interface AutomationConnectRequest {
  owner: AutomationOwner
  tabId?: string
}

export interface AutomationConnectResult {
  ok: boolean
  sessionId: string | null
  state: AutomationSessionState
  reason: AutomationDisconnectReason
  tabId: string | null
}

export interface AutomationDisconnectRequest {
  sessionId: string
}

export interface AutomationDisconnectResult {
  ok: boolean
  state: AutomationSessionState
  reason: AutomationDisconnectReason
}

export interface AutomationBridgeStatus {
  state: AutomationSessionState
  owner: AutomationOwner | null
  sessionId: string | null
  tabId: string | null
  reason: AutomationDisconnectReason
}

export interface QuickLink {
  id: string
  title: string
  url: string
  pinned: boolean
  order: number
}

export interface RecentAutomationPreview {
  id: string
  name: string
  lastRunAt: string | null
  status: 'never-run' | 'success' | 'failed'
}
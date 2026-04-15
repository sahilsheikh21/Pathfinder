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
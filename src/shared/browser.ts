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
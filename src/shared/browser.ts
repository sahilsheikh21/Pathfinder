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

export type RecorderAction = 'navigate' | 'click' | 'type' | 'wait'

export type RecorderSessionState = 'idle' | 'recording' | 'stopped' | 'error'

export type RecorderStopReason =
  | 'none'
  | 'busy'
  | 'not-recording'
  | 'target-lost'
  | 'bridge-disconnected'
  | 'invalid-session'
  | 'shutdown'
  | 'failed'

export type WorkflowVariableType = 'text' | 'secret'

export interface WorkflowVariableDefinition {
  type: WorkflowVariableType
  prompt: string
}

export interface RecorderSecretPlaceholder {
  kind: 'variable'
  name: string
  secret: true
}

export type RecorderInputValue = string | RecorderSecretPlaceholder

interface RecorderStepBase {
  id: string
  seq: number
}

export interface RecorderNavigateStep extends RecorderStepBase {
  action: 'navigate'
  url: string
}

export interface RecorderClickStep extends RecorderStepBase {
  action: 'click'
  selector: string
}

export interface RecorderTypeStep extends RecorderStepBase {
  action: 'type'
  selector: string
  value: RecorderInputValue
}

export interface RecorderWaitStep extends RecorderStepBase {
  action: 'wait'
  waitFor: 'navigation' | 'selector'
  selector?: string
  timeoutMs?: number
}

export type RecorderWorkflowStep =
  | RecorderNavigateStep
  | RecorderClickStep
  | RecorderTypeStep
  | RecorderWaitStep

export interface RecorderWorkflowDocument {
  version: 1
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  steps: RecorderWorkflowStep[]
  variables?: Record<string, WorkflowVariableDefinition>
  metadata?: Record<string, string | number | boolean | null>
}

export interface RecorderStartRequest {
  owner: AutomationOwner
  tabId?: string
  name?: string
}

export interface RecorderStartResult {
  ok: boolean
  sessionId: string | null
  state: RecorderSessionState
  reason: RecorderStopReason
  tabId: string | null
}

export interface RecorderStopRequest {
  sessionId?: string
}

export interface RecorderStopResult {
  ok: boolean
  state: RecorderSessionState
  reason: RecorderStopReason
}

export interface RecorderStatus {
  state: RecorderSessionState
  sessionId: string | null
  tabId: string | null
  reason: RecorderStopReason
  startedAt: string | null
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
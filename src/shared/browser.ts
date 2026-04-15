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

export type AutomationPlaybackFailurePolicy = 'stop-on-error' | 'continue-on-error'

export type AutomationPlaybackRunState =
  | 'idle'
  | 'starting'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type AutomationPlaybackStartReason =
  | 'none'
  | 'busy'
  | 'invalid-workflow'
  | 'missing-variables'
  | 'invalid-session'
  | 'missing-target'
  | 'already-running'
  | 'failed'

export type AutomationPlaybackCancelReason = 'none' | 'not-running' | 'cancelled' | 'failed'

export type AutomationPlaybackFailureReason =
  | 'invalid-workflow'
  | 'missing-variables'
  | 'busy'
  | 'invalid-session'
  | 'missing-target'
  | 'target-lost'
  | 'timeout'
  | 'step-failed'
  | 'cancelled'
  | 'internal-error'

export interface AutomationPlaybackSource {
  kind: 'file'
  path: string
}

export interface AutomationPlaybackStartRequest {
  source: AutomationPlaybackSource
  tabId?: string
  variables?: Record<string, string>
  policy?: AutomationPlaybackFailurePolicy
  defaultTimeoutMs?: number
}

export interface AutomationPlaybackVariablePrompt {
  name: string
  prompt: string
  secret: boolean
}

export interface AutomationPlaybackStepFailure {
  stepId: string
  seq: number
  action: RecorderAction
  reason: AutomationPlaybackFailureReason
  message: string
}

export interface AutomationPlaybackRunSummary {
  totalSteps: number
  succeededSteps: number
  failedSteps: number
  failures: AutomationPlaybackStepFailure[]
  startedAt: string
  finishedAt: string
}

export interface AutomationPlaybackStartResult {
  ok: boolean
  runId: string | null
  state: AutomationPlaybackRunState
  reason: AutomationPlaybackStartReason
  requiredVariables?: AutomationPlaybackVariablePrompt[]
  summary?: AutomationPlaybackRunSummary
  failure?: AutomationPlaybackStepFailure
  message?: string
}

export interface AutomationPlaybackStatus {
  state: AutomationPlaybackRunState
  runId: string | null
  source: AutomationPlaybackSource | null
  tabId: string | null
  policy: AutomationPlaybackFailurePolicy
  startedAt: string | null
  finishedAt: string | null
  summary: AutomationPlaybackRunSummary | null
  failure: AutomationPlaybackStepFailure | null
}

export interface AutomationPlaybackCancelRequest {
  runId?: string
}

export interface AutomationPlaybackCancelResult {
  ok: boolean
  state: AutomationPlaybackRunState
  reason: AutomationPlaybackCancelReason
  message?: string
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

export type AutomationLibraryOrigin = 'recorded' | 'imported'

export interface AutomationLibraryItem {
  id: string
  name: string
  description?: string
  tags: string[]
  workflowPath?: string
  workflowDocument?: RecorderWorkflowDocument
  origin: AutomationLibraryOrigin
  updatedAt: string
  lastRunAt: string | null
}

export interface AutomationLibraryFilter {
  query?: string
  tags?: string[]
}

export interface AutomationLibraryListRequest {
  filter?: AutomationLibraryFilter
}

export interface AutomationLibraryUpsertRequest {
  item: Omit<AutomationLibraryItem, 'updatedAt' | 'lastRunAt'>
}

export interface AutomationLibraryDeleteRequest {
  id: string
}

export type AutomationRunSourceLabel = 'sidebar' | 'command' | 'home' | 'unknown'

export interface AutomationLibraryRunRequest {
  id: string
  tabId?: string
  sourceLabel?: AutomationRunSourceLabel
  variables?: Record<string, string>
}

export interface AutomationLibraryResult {
  items: AutomationLibraryItem[]
  item?: AutomationLibraryItem
}

export type AutomationHistoryStatus = 'running' | 'success' | 'failed' | 'cancelled'

export interface AutomationHistoryEntry {
  id: string
  workflowId: string
  workflowNameSnapshot: string
  tagsSnapshot: string[]
  status: AutomationHistoryStatus
  sourceLabel: AutomationRunSourceLabel
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
  failureSnippet: string | null
  failureDetail: string | null
  runId: string | null
  targetUrlAtStart: string | null
  workflowOrigin: AutomationLibraryOrigin
  workflowDeleted?: boolean
}

export interface AutomationHistoryListRequest {
  status?: AutomationHistoryStatus | 'all'
  query?: string
  limit?: number
}

export interface AutomationHistoryListResult {
  entries: AutomationHistoryEntry[]
}

export interface AutomationHistoryRemoveRequest {
  id: string
}

export interface AutomationHistoryClearRequest {
  preserveRunning?: boolean
}

export interface AutomationHistoryRerunRequest {
  id: string
  tabId?: string
  variables?: Record<string, string>
}

export type AutomationSidebarSection = 'library' | 'history' | 'ai-chat'

export interface AutomationSidebarSectionPreferences {
  query?: string
  tags?: string[]
  scrollTop?: number
  status?: AutomationHistoryListRequest['status']
}

export interface AutomationSidebarPreferences {
  collapsed: boolean
  width: number
  activeSection: AutomationSidebarSection
  sectionState: Partial<Record<AutomationSidebarSection, AutomationSidebarSectionPreferences>>
}

export interface AutomationSidebarPreferencesUpdateRequest {
  preferences: Partial<AutomationSidebarPreferences>
}
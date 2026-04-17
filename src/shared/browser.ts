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

export type BrowserStartupMode = 'restore-last-session' | 'open-home' | 'open-urls'

export type BrowserHomepageMode = 'home-starter' | 'custom-url'

export type BrowserDownloadsMode = 'ask-every-time' | 'fixed-path'

export type BrowserCookieMode = 'allow-all' | 'block-third-party' | 'block-all'

export type BrowserThemeMode = 'light' | 'dark' | 'system'

export type BrowserFontScalePreset = 'small' | 'medium' | 'large'

export type BrowserSidebarPosition = 'left' | 'right'

export interface BrowserAppearanceSettings {
  themeMode: BrowserThemeMode
  fontScalePreset: BrowserFontScalePreset
  sidebarPosition: BrowserSidebarPosition
}

export type BrowserShortcutCommandId =
  | 'command-palette.open'
  | 'command-palette.open-legacy'
  | 'quick-search.toggle'
  | 'settings.open'
  | 'sidebar.toggle'

export type BrowserShortcutBinding = string

export type BrowserShortcutBindings = Record<BrowserShortcutCommandId, BrowserShortcutBinding>

export interface BrowserShortcutSettings {
  bindings: BrowserShortcutBindings
}

export const DEFAULT_APPEARANCE_SETTINGS: BrowserAppearanceSettings = {
  themeMode: 'system',
  fontScalePreset: 'medium',
  sidebarPosition: 'left'
}

export const DEFAULT_SHORTCUT_BINDINGS: BrowserShortcutBindings = {
  'command-palette.open': 'Ctrl+K',
  'command-palette.open-legacy': 'Ctrl+Shift+P',
  'quick-search.toggle': 'Ctrl+Shift+S',
  'settings.open': 'Ctrl+,',
  'sidebar.toggle': 'Ctrl+B'
}

export type BrowserClearDataBucket =
  | 'history-downloads'
  | 'cookies-site-data'
  | 'cache-storage'
  | 'app-settings-subset'

export interface BrowserGeneralSettings {
  startupMode: BrowserStartupMode
  startupUrls: string[]
  homepageMode: BrowserHomepageMode
  homepageUrl: string
  downloadsMode: BrowserDownloadsMode
  downloadsPath: string
}

export interface BrowserPrivacySettings {
  cookieMode: BrowserCookieMode
}

export interface BrowserSettingsRepairNotice {
  reason: 'corrupted-file' | 'invalid-shape' | 'validation-failed'
  repairedAt: string
}

export interface BrowserSettingsSnapshot {
  general: BrowserGeneralSettings
  privacy: BrowserPrivacySettings
  appearance: BrowserAppearanceSettings
  shortcuts: BrowserShortcutSettings
  updatedAt: string
  repairNotice: BrowserSettingsRepairNotice | null
}

export interface BrowserSettingsValidationError {
  field: string
  code:
    | 'required'
    | 'invalid-value'
    | 'invalid-url'
    | 'invalid-path'
    | 'invalid-selection'
    | 'invalid-binding'
    | 'binding-conflict'
  message: string
}

export interface BrowserSettingsSaveGeneralRequest {
  general: BrowserGeneralSettings
}

export interface BrowserSettingsSavePrivacyRequest {
  privacy: BrowserPrivacySettings
}

export interface BrowserSettingsSaveAppearanceRequest {
  appearance: BrowserAppearanceSettings
}

export interface BrowserSettingsSaveShortcutsRequest {
  shortcuts: BrowserShortcutSettings
}

export interface BrowserSettingsSaveGeneralResult {
  ok: boolean
  snapshot: BrowserSettingsSnapshot
  validationError?: BrowserSettingsValidationError
}

export interface BrowserSettingsSavePrivacyResult {
  ok: boolean
  snapshot: BrowserSettingsSnapshot
  validationError?: BrowserSettingsValidationError
}

export interface BrowserSettingsSaveAppearanceResult {
  ok: boolean
  snapshot: BrowserSettingsSnapshot
  validationError?: BrowserSettingsValidationError
}

export interface BrowserSettingsSaveShortcutsResult {
  ok: boolean
  snapshot: BrowserSettingsSnapshot
  validationError?: BrowserSettingsValidationError
}

export interface BrowserClearDataRequest {
  buckets: BrowserClearDataBucket[]
}

export interface ClearDataBucketResult {
  bucket: BrowserClearDataBucket
  ok: boolean
  message: string
}

export interface BrowserSettingsClearDataResult {
  ok: boolean
  snapshot: BrowserSettingsSnapshot
  bucketResults: ClearDataBucketResult[]
  validationError?: BrowserSettingsValidationError
}

export type LLMProviderId = 'openai' | 'ollama'

export interface LLMProviderCapability {
  streaming: boolean
  jsonMode: boolean
  toolCalls: boolean
  systemRole: boolean
}

export interface LLMProviderConfig {
  provider: LLMProviderId
  model: string
  endpoint?: string
  timeoutMs: number
  capabilities?: Partial<LLMProviderCapability>
}

export interface LLMSecretPatch {
  mode: 'unchanged' | 'set' | 'clear'
  value?: string
}

export interface LLMProviderConfigPatch {
  provider?: LLMProviderId
  model?: string
  endpoint?: string | null
  timeoutMs?: number
  capabilities?: Partial<LLMProviderCapability>
  secret?: LLMSecretPatch
}

export interface LLMAdapterConfigState {
  config: LLMProviderConfig
  secretPresent: boolean
  updatedAt: string
}

export interface LLMValidateConfigRequest {
  provider?: LLMProviderId
}

export interface LLMGenerateError {
  reason:
    | 'invalid-config'
    | 'auth'
    | 'network'
    | 'timeout'
    | 'quota'
    | 'provider-error'
    | 'unsupported-capability'
  message: string
  provider: LLMProviderId
  retryable: boolean
}

export interface LLMValidateConfigResult {
  ok: boolean
  provider: LLMProviderId
  model: string
  checkedAt: string
  latencyMs?: number
  error?: LLMGenerateError
}

export interface LLMGenerateRequest {
  provider: LLMProviderId
  model?: string
  prompt: string
  systemPrompt?: string
  timeoutMs?: number
}

export interface LLMGenerateTokenUsage {
  input: number
  output: number
  total: number
}

export interface LLMGenerateResult {
  ok: boolean
  provider: LLMProviderId
  model: string
  text: string
  finishReason: 'stop' | 'length' | 'content-filter' | 'unknown'
  tokenUsage?: LLMGenerateTokenUsage
  latencyMs?: number
  error?: LLMGenerateError
}

export interface AIAutomationGenerateConstraints {
  targetUrl?: string
  objective?: string
  variables?: string[]
  notes?: string
}

export interface AIAutomationGenerateRequest {
  prompt: string
  constraints?: AIAutomationGenerateConstraints
  tabId?: string
}

export interface AIAutomationGeneratedDraft {
  workflow: RecorderWorkflowDocument
  warnings: string[]
}

export interface AIAutomationGenerateFailure {
  reason:
    | 'invalid-draft'
    | 'unsupported-intent'
    | 'invalid-config'
    | 'auth'
    | 'network'
    | 'timeout'
    | 'quota'
    | 'provider-error'
    | 'cancelled'
    | 'failed'
  message: string
  retryable: boolean
  userAction: 'retry' | 'edit-prompt' | 'check-llm-config' | 'none'
}

export interface AIAutomationGenerateResult {
  ok: boolean
  draft: AIAutomationGeneratedDraft | null
  state: AIAutomationGenerationState
  operationId: string | null
  error?: AIAutomationGenerateFailure
}

export type AIAutomationGenerationState =
  | 'idle'
  | 'generating'
  | 'validating'
  | 'ready'
  | 'failed'
  | 'cancelled'

export interface AIAutomationStatusResult {
  state: AIAutomationGenerationState
  operationId: string | null
  hasDraft: boolean
  updatedAt: string | null
  error?: AIAutomationGenerateFailure
}

export interface AIAutomationCancelRequest {
  operationId?: string
}

export interface AIAutomationCancelResult {
  ok: boolean
  state: AIAutomationGenerationState
  operationId: string | null
}

export type LiveAgentRiskTier = 'low' | 'high'

export type LiveAgentRunState =
  | 'idle'
  | 'planning'
  | 'running'
  | 'waiting-approval'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type LiveAgentApprovalDecision = 'approved' | 'rejected' | 'not-required'

export interface LiveAgentStepSummary {
  id: string
  seq: number
  action: RecorderAction
  target?: string
  expectedSideEffect: string
  rationale: string
  riskTier: LiveAgentRiskTier
}

export interface LiveAgentApprovalBatch {
  batchId: string
  runId: string
  size: number
  stepIds: string[]
  steps: LiveAgentStepSummary[]
  createdAt: string
}

export interface LiveAgentError {
  reason:
    | 'busy'
    | 'invalid-state'
    | 'missing-run'
    | 'approval-required'
    | 'context-mismatch'
    | 'cancelled'
    | 'failed'
  message: string
  retryable: boolean
}

export interface LiveAgentStartRequest {
  prompt: string
  tabId?: string
  batchSize?: number
  proposedSteps?: LiveAgentStepSummary[]
}

export interface LiveAgentStartResult {
  ok: boolean
  runId: string | null
  state: LiveAgentRunState
  approvalBatch: LiveAgentApprovalBatch | null
  message?: string
  error?: LiveAgentError
}

export interface LiveAgentStatusRequest {
  runId?: string
}

export interface LiveAgentStatusResult {
  state: LiveAgentRunState
  runId: string | null
  tabId: string | null
  approvalBatch: LiveAgentApprovalBatch | null
  nextStep: LiveAgentStepSummary | null
  completedSteps: number
  totalSteps: number
  updatedAt: string | null
  error?: LiveAgentError
}

export interface LiveAgentApproveBatchRequest {
  runId?: string
  batchId: string
  decision: 'approve' | 'reject'
}

export interface LiveAgentApproveBatchResult {
  ok: boolean
  runId: string | null
  state: LiveAgentRunState
  approvalBatch: LiveAgentApprovalBatch | null
  message?: string
  error?: LiveAgentError
}

export interface LiveAgentPauseRequest {
  runId?: string
}

export interface LiveAgentPauseResult {
  ok: boolean
  runId: string | null
  state: LiveAgentRunState
  paused: boolean
  error?: LiveAgentError
}

export interface LiveAgentResumeRequest {
  runId?: string
  tabId?: string
}

export interface LiveAgentResumeResult {
  ok: boolean
  runId: string | null
  state: LiveAgentRunState
  resumed: boolean
  error?: LiveAgentError
}

export interface LiveAgentCancelRequest {
  runId?: string
}

export interface LiveAgentCancelResult {
  ok: boolean
  runId: string | null
  state: LiveAgentRunState
  cancelled: boolean
  error?: LiveAgentError
}

export interface LiveAgentStepAuditEvent {
  id: string
  runId: string
  stepId: string
  stepIndex: number
  actionSummary: string
  riskTier: LiveAgentRiskTier
  approvalDecision: LiveAgentApprovalDecision
  observedResult: string
  nextStepRationale: string
  createdAt: string
}

export interface LiveAgentGetAuditTrailRequest {
  runId: string
}

export interface LiveAgentGetAuditTrailResult {
  runId: string
  events: LiveAgentStepAuditEvent[]
}

export type PageAnalysisMode = 'summarize' | 'ask'

export type PageAnalysisVerbosity = 'concise' | 'detailed'

export type PageAnalysisConfidence = 'high' | 'medium' | 'low' | 'uncertain'

export interface PageAnalysisSnapshotMetadata {
  tabId: string
  url: string
  title: string
  extractedAt: string
  ttlMs: number
  stale: boolean
}

export interface PageAnalysisCitationSource {
  title: string
  url: string
}

export interface PageAnalysisCitation {
  id: string
  marker: string
  snippet: string
  snippetIndex: number
  extractedAt: string
  source: PageAnalysisCitationSource
}

export interface PageAnalysisAnswerSection {
  title: string
  bullets: string[]
}

export interface PageAnalysisFailure {
  reason:
    | 'missing-target'
    | 'extraction-failed'
    | 'no-content'
    | 'cancelled'
    | 'invalid-config'
    | 'auth'
    | 'network'
    | 'timeout'
    | 'quota'
    | 'provider-error'
    | 'unsupported-claim'
  message: string
  userAction:
    | 'retry'
    | 'refresh-context'
    | 'clear-context'
    | 'check-llm-config'
    | 'review-page-selection'
    | 'none'
  retryable: boolean
}

export interface PageAnalysisRequestBase {
  tabId?: string
  verbosity?: PageAnalysisVerbosity
  includeNonPageContext?: boolean
  forceRefresh?: boolean
  allowOneTimeUnredacted?: boolean
}

export interface PageAnalysisSummarizeRequest extends PageAnalysisRequestBase {
  mode?: 'summarize'
}

export interface PageAnalysisAskRequest extends PageAnalysisRequestBase {
  mode?: 'ask'
  question: string
}

export interface PageAnalysisResult {
  ok: boolean
  mode: PageAnalysisMode
  answer: string
  sections: PageAnalysisAnswerSection[]
  confidence: PageAnalysisConfidence
  snapshot: PageAnalysisSnapshotMetadata | null
  citations: PageAnalysisCitation[]
  staleWarning?: string
  usedNonPageContext: boolean
  error?: PageAnalysisFailure
}

export interface PageAnalysisCancelRequest {
  operationId?: string
}

export interface PageAnalysisCancelResult {
  ok: boolean
  operationId: string | null
  cancelled: boolean
}

export interface PageAnalysisRefreshContextRequest {
  tabId?: string
}

export interface PageAnalysisRefreshContextResult {
  ok: boolean
  snapshot: PageAnalysisSnapshotMetadata | null
  error?: PageAnalysisFailure
}

export interface PageAnalysisClearContextRequest {
  tabId?: string
}

export interface PageAnalysisClearContextResult {
  ok: boolean
  tabId: string | null
}

export type PageAnalysisRunState = 'idle' | 'running' | 'cancelling'

export interface PageAnalysisStatusRequest {
  tabId?: string
}

export interface PageAnalysisStatusResult {
  state: PageAnalysisRunState
  operationId: string | null
  tabId: string | null
  hasContext: boolean
  snapshot: PageAnalysisSnapshotMetadata | null
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
  status: 'never-run' | 'running' | 'success' | 'failed' | 'cancelled'
  workflowDeleted?: boolean
  canRun?: boolean
  durationMs?: number | null
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
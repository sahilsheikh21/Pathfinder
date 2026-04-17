import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type AIAutomationGenerationState,
  type AutomationHistoryEntry,
  type AutomationHistoryListRequest,
  type AutomationLibraryItem,
  type AutomationLibraryUpsertRequest,
  type AutomationPlaybackStartRequest,
  type AutomationPlaybackStartResult,
  type AutomationPlaybackStatus,
  type AutomationPlaybackVariablePrompt,
  type AutomationSidebarPreferences,
  type AutomationSidebarSection,
  type BrowserAppearanceSettings,
  type BrowserClearDataBucket,
  DEFAULT_APPEARANCE_SETTINGS,
  type BrowserSettingsSnapshot,
  type BrowserSettingsValidationError,
  type ClearDataBucketResult,
  type BrowserGeneralSettings,
  type BrowserPrivacySettings,
  type LLMAdapterConfigState,
  type LiveAgentRunState,
  type LiveAgentStatusResult,
  type LiveAgentStepAuditEvent,
  type PageAnalysisFailure,
  type PageAnalysisMode,
  type PageAnalysisResult,
  type PageAnalysisStatusResult,
  type PageAnalysisVerbosity,
  type LLMProviderId,
  HOME_STARTER_URL,
  type RecorderInputValue,
  type RecorderWorkflowDocument,
  type RecorderWorkflowStep,
  type RecorderStartRequest,
  type RecorderStatus,
  type BrowserTabState,
  type DownloadState,
  type WorkflowVariableDefinition
} from '../shared/browser'
import AutomationSidebar from './components/AutomationSidebar'
import AutomationSidebarHistory from './components/AutomationSidebarHistory'
import AutomationSidebarLibrary from './components/AutomationSidebarLibrary'
import BrowserTabStrip from './components/BrowserTabStrip'
import AutomationPlaybackPrompt from './components/AutomationPlaybackPrompt'
import CommandPalette from './components/CommandPalette'
import DownloadShelf from './components/DownloadShelf'
import HomeStarterPage from './components/HomeStarterPage'
import SettingsPanel from './components/SettingsPanel'
import { createBrowserCommands, type CommandPaletteCommand } from './lib/commandPalette'
import NavigationBar from './components/NavigationBar'
import { applyTheme, subscribeToSystemThemeChanges } from './theme'
import './styles/global.css'

const getPlaybackFailureMessage = (result: AutomationPlaybackStartResult): string => {
  if (result.failure) {
    return `${result.failure.action} step ${result.failure.seq} failed: ${result.failure.message}`
  }

  if (result.message?.trim()) {
    return result.message
  }

  return `Playback start failed: ${result.reason}`
}

const getPageAnalysisUserActionLabel = (action: PageAnalysisFailure['userAction']): string => {
  if (action === 'retry') {
    return 'Retry'
  }

  if (action === 'refresh-context') {
    return 'Refresh Context'
  }

  if (action === 'clear-context') {
    return 'Clear Context'
  }

  if (action === 'check-llm-config') {
    return 'Open AI Settings'
  }

  if (action === 'review-page-selection') {
    return 'Review Selection'
  }

  return 'Continue'
}

const formatLiveAgentState = (state: LiveAgentRunState): string => {
  if (state === 'waiting-approval') {
    return 'Waiting Approval'
  }

  return state
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const LIVE_AGENT_FIELD_TRUNCATION_LIMIT = 140

const truncateLiveAgentField = (value: string): string => {
  if (value.length <= LIVE_AGENT_FIELD_TRUNCATION_LIMIT) {
    return value
  }

  return `${value.slice(0, LIVE_AGENT_FIELD_TRUNCATION_LIMIT)}...`
}

type PendingPlaybackRequest =
  | { kind: 'path'; workflowPath: string; label: string }
  | { kind: 'library'; libraryId: string; label: string }
  | { kind: 'history'; historyId: string; label: string }

const DEFAULT_SIDEBAR_PREFERENCES: AutomationSidebarPreferences = {
  collapsed: false,
  width: 320,
  activeSection: 'library',
  sectionState: {}
}

const DEFAULT_PAGE_ANALYSIS_STATUS: PageAnalysisStatusResult = {
  state: 'idle',
  operationId: null,
  tabId: null,
  hasContext: false,
  snapshot: null
}

const DEFAULT_LIVE_AGENT_STATUS: LiveAgentStatusResult = {
  state: 'idle',
  runId: null,
  tabId: null,
  approvalBatch: null,
  nextStep: null,
  completedSteps: 0,
  totalSteps: 0,
  updatedAt: null
}

const DEFAULT_PAGE_ANALYSIS_VERBOSITY: PageAnalysisVerbosity = 'concise'

const AI_AUTOMATION_ALLOWED_ACTIONS = new Set<RecorderWorkflowStep['action']>([
  'navigate',
  'click',
  'type',
  'wait'
])

interface AIAutomationConstraintDraft {
  targetUrl: string
  objective: string
  variables: string
  notes: string
}

const DEFAULT_AI_AUTOMATION_CONSTRAINTS: AIAutomationConstraintDraft = {
  targetUrl: '',
  objective: '',
  variables: '',
  notes: ''
}

const EMPTY_SETTINGS_VALIDATION_ERRORS: Partial<Record<string, string>> = {}

const DEFAULT_SETTINGS_STATUS_MESSAGE =
  'Open Settings to manage general, appearance, and privacy behavior.'

const toDraftInputValueString = (value: RecorderInputValue): string => {
  if (typeof value === 'string') {
    return value
  }

  return `{{${value.name}}}`
}

const toDraftInputValue = (raw: string): RecorderInputValue => {
  const trimmed = raw.trim()
  const variableMatch = trimmed.match(/^\{\{([a-zA-Z0-9_-]+)\}\}$/)
  if (!variableMatch) {
    return raw
  }

  const variableName = variableMatch[1]
  if (!variableName) {
    return raw
  }

  return {
    kind: 'variable',
    name: variableName,
    secret: true
  }
}

const parseVariableDefinitions = (value: string): Record<string, WorkflowVariableDefinition> | undefined => {
  const lines = value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)

  if (lines.length === 0) {
    return undefined
  }

  const variables: Record<string, WorkflowVariableDefinition> = {}

  for (const line of lines) {
    const [namePart, promptPart] = line.split(':').map((part) => part.trim())
    if (!namePart) {
      continue
    }

    const isSecret = /secret|password|token|key/i.test(namePart)
    variables[namePart] = {
      type: isSecret ? 'secret' : 'text',
      prompt: promptPart || `Provide value for ${namePart}`
    }
  }

  return Object.keys(variables).length > 0 ? variables : undefined
}

const validateGeneratedDraft = (draft: RecorderWorkflowDocument): string[] => {
  const errors: string[] = []

  if (draft.version !== 1) {
    errors.push('Workflow version must be 1.')
  }

  if (!Array.isArray(draft.steps) || draft.steps.length === 0) {
    errors.push('Generated workflow must include at least one step.')
    return errors
  }

  let lastSeq = 0
  for (const step of draft.steps) {
    if (!AI_AUTOMATION_ALLOWED_ACTIONS.has(step.action)) {
      errors.push(`Unsupported action: ${step.action}.`)
      continue
    }

    if (!Number.isFinite(step.seq) || step.seq <= lastSeq) {
      errors.push('Step sequence must be strict ascending.')
    }

    lastSeq = step.seq

    if (step.action === 'navigate' && (!step.url || !step.url.trim())) {
      errors.push('Navigate steps require a URL.')
    }

    if ((step.action === 'click' || step.action === 'type') && (!step.selector || !step.selector.trim())) {
      errors.push(`${step.action} steps require a selector.`)
    }

    if (step.action === 'type') {
      const value = toDraftInputValueString(step.value)
      if (!value.trim()) {
        errors.push('Type steps require a non-empty value.')
      }
    }

    if (step.action === 'wait') {
      if (step.waitFor !== 'navigation' && step.waitFor !== 'selector') {
        errors.push('Wait steps require waitFor to be navigation or selector.')
      }

      if (step.waitFor === 'selector' && (!step.selector || !step.selector.trim())) {
        errors.push('Wait selector steps require a selector.')
      }
    }
  }

  return errors
}

interface PageAnalysisCacheEntry {
  result: PageAnalysisResult
  updatedAt: string
}

const mergeSectionState = (
  current: AutomationSidebarPreferences['sectionState'],
  patch: AutomationSidebarPreferences['sectionState']
): AutomationSidebarPreferences['sectionState'] => {
  const next: AutomationSidebarPreferences['sectionState'] = {
    ...current
  }

  const entries = Object.entries(patch) as Array<
    [AutomationSidebarSection, AutomationSidebarPreferences['sectionState'][AutomationSidebarSection]]
  >

  for (const [section, value] of entries) {
    if (!value) {
      continue
    }

    next[section] = {
      ...(current[section] ?? {}),
      ...value
    }
  }

  return next
}

function App() {
  const [tabs, setTabs] = useState<BrowserTabState[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [downloads, setDownloads] = useState<DownloadState[]>([])
  const [homeDraftByTabId, setHomeDraftByTabId] = useState<Record<string, string>>({})
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [commandPaletteQuery, setCommandPaletteQuery] = useState('')
  const [commandPaletteError, setCommandPaletteError] = useState('')
  const [recorderStatus, setRecorderStatus] = useState<RecorderStatus>({
    state: 'idle',
    sessionId: null,
    tabId: null,
    reason: 'none',
    startedAt: null
  })
  const [playbackStatus, setPlaybackStatus] = useState<AutomationPlaybackStatus>({
    state: 'idle',
    runId: null,
    source: null,
    tabId: null,
    policy: 'stop-on-error',
    startedAt: null,
    finishedAt: null,
    summary: null,
    failure: null
  })
  const [sidebarPreferences, setSidebarPreferences] =
    useState<AutomationSidebarPreferences>(DEFAULT_SIDEBAR_PREFERENCES)
  const [llmConfigState, setLlmConfigState] = useState<LLMAdapterConfigState | null>(null)
  const [aiProvider, setAiProvider] = useState<LLMProviderId>('openai')
  const [aiModel, setAiModel] = useState('')
  const [aiEndpoint, setAiEndpoint] = useState('')
  const [aiSecretDraft, setAiSecretDraft] = useState('')
  const [aiStatusMessage, setAiStatusMessage] = useState('AI provider settings are loading...')
  const [aiStatusTone, setAiStatusTone] = useState<'neutral' | 'success' | 'error'>('neutral')
  const [aiBusyState, setAiBusyState] = useState<'idle' | 'saving' | 'validating'>('idle')
  const [isOverlayMode, setIsOverlayMode] = useState(() => window.innerWidth < 980)
  const [isOverlayOpen, setIsOverlayOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [appearanceSettings, setAppearanceSettings] = useState<BrowserAppearanceSettings>({
    ...DEFAULT_APPEARANCE_SETTINGS
  })
  const [settingsSnapshot, setSettingsSnapshot] = useState<BrowserSettingsSnapshot | null>(null)
  const [settingsBusyState, setSettingsBusyState] = useState<
    'idle' | 'loading' | 'saving-general' | 'saving-appearance' | 'saving-privacy' | 'clearing-data'
  >('idle')
  const [settingsStatusMessage, setSettingsStatusMessage] = useState(DEFAULT_SETTINGS_STATUS_MESSAGE)
  const [settingsStatusTone, setSettingsStatusTone] = useState<'neutral' | 'success' | 'error'>('neutral')
  const [settingsValidationErrors, setSettingsValidationErrors] =
    useState<Partial<Record<string, string>>>(EMPTY_SETTINGS_VALIDATION_ERRORS)
  const [settingsClearDataResults, setSettingsClearDataResults] = useState<ClearDataBucketResult[]>([])
  const [libraryItems, setLibraryItems] = useState<AutomationLibraryItem[]>([])
  const [libraryQuery, setLibraryQuery] = useState('')
  const [libraryTagFilter, setLibraryTagFilter] = useState<string[]>([])
  const [libraryScrollTop, setLibraryScrollTop] = useState(0)
  const [historyEntries, setHistoryEntries] = useState<AutomationHistoryEntry[]>([])
  const [historyQuery, setHistoryQuery] = useState('')
  const [historyStatusFilter, setHistoryStatusFilter] =
    useState<AutomationHistoryListRequest['status']>('all')
  const [historyScrollTop, setHistoryScrollTop] = useState(0)
  const [playbackPromptVariables, setPlaybackPromptVariables] = useState<AutomationPlaybackVariablePrompt[]>([])
  const [pendingPlaybackRequest, setPendingPlaybackRequest] = useState<PendingPlaybackRequest | null>(null)
  const [recentAutomationsVersion, setRecentAutomationsVersion] = useState(0)
  const [lastTerminalPlaybackKey, setLastTerminalPlaybackKey] = useState<string | null>(null)
  const [pageAnalysisQuestion, setPageAnalysisQuestion] = useState('')
  const [pageAnalysisVerbosity, setPageAnalysisVerbosity] =
    useState<PageAnalysisVerbosity>(DEFAULT_PAGE_ANALYSIS_VERBOSITY)
  const [pageAnalysisStatus, setPageAnalysisStatus] = useState<PageAnalysisStatusResult>(
    DEFAULT_PAGE_ANALYSIS_STATUS
  )
  const [pageAnalysisCacheByTabId, setPageAnalysisCacheByTabId] =
    useState<Record<string, PageAnalysisCacheEntry>>({})
  const [pageAnalysisBusyState, setPageAnalysisBusyState] =
    useState<'idle' | 'summarize' | 'ask' | 'refresh' | 'clear' | 'cancel'>('idle')
  const [pageAnalysisStatusMessage, setPageAnalysisStatusMessage] = useState(
    'Use AI summary or ask to analyze the active page.'
  )
  const [pageAnalysisStatusTone, setPageAnalysisStatusTone] =
    useState<'neutral' | 'success' | 'error'>('neutral')
  const [pageAnalysisLastRequest, setPageAnalysisLastRequest] = useState<{
    mode: PageAnalysisMode
    question?: string
  } | null>(null)
  const [aiAutomationPrompt, setAiAutomationPrompt] = useState('')
  const [aiAutomationConstraints, setAiAutomationConstraints] =
    useState<AIAutomationConstraintDraft>(DEFAULT_AI_AUTOMATION_CONSTRAINTS)
  const [aiAutomationState, setAiAutomationState] = useState<AIAutomationGenerationState>('idle')
  const [aiAutomationOperationId, setAiAutomationOperationId] = useState<string | null>(null)
  const [aiAutomationDraft, setAiAutomationDraft] = useState<RecorderWorkflowDocument | null>(null)
  const [aiAutomationWarnings, setAiAutomationWarnings] = useState<string[]>([])
  const [aiAutomationError, setAiAutomationError] = useState('')
  const [aiAutomationStatusMessage, setAiAutomationStatusMessage] = useState(
    'Generate a workflow draft from a natural-language prompt.'
  )
  const [aiAutomationShowJson, setAiAutomationShowJson] = useState(false)
  const [aiAutomationJsonDraft, setAiAutomationJsonDraft] = useState('')
  const [aiAutomationJsonError, setAiAutomationJsonError] = useState('')
  const [aiAutomationValidationErrors, setAiAutomationValidationErrors] = useState<string[]>([])
  const [aiAutomationBusyState, setAiAutomationBusyState] =
    useState<'idle' | 'generating' | 'saving' | 'save-and-run' | 'cancelling'>('idle')
  const [liveAgentPrompt, setLiveAgentPrompt] = useState('')
  const [liveAgentBatchSize, setLiveAgentBatchSize] = useState(3)
  const [liveAgentStatus, setLiveAgentStatus] = useState<LiveAgentStatusResult>(
    DEFAULT_LIVE_AGENT_STATUS
  )
  const [liveAgentAuditTrail, setLiveAgentAuditTrail] = useState<LiveAgentStepAuditEvent[]>([])
  const [liveAgentStatusMessage, setLiveAgentStatusMessage] = useState(
    'Live Agent is idle. Provide a prompt to start guided execution.'
  )
  const [liveAgentStatusTone, setLiveAgentStatusTone] =
    useState<'neutral' | 'success' | 'error'>('neutral')
  const [liveAgentBusyState, setLiveAgentBusyState] =
    useState<'idle' | 'starting' | 'approving' | 'pausing' | 'resuming' | 'cancelling'>('idle')
  const [liveAgentExpandedAuditIds, setLiveAgentExpandedAuditIds] = useState<string[]>([])
  const pageAnalysisQuestionInputRef = useRef<HTMLInputElement | null>(null)
  const aiAutomationPromptInputRef = useRef<HTMLInputElement | null>(null)
  const liveAgentPromptInputRef = useRef<HTMLInputElement | null>(null)
  const settingsReturnFocusRef = useRef<HTMLElement | null>(null)

  const activeTab = useMemo(() => {
    return tabs.find((tab) => tab.id === activeTabId) ?? null
  }, [activeTabId, tabs])

  const isHomeTab = activeTab?.url === HOME_STARTER_URL || activeTab?.url === 'about:blank'
  const shouldRenderHomeStarter = isHomeTab || tabs.length === 0

  const activePageAnalysisEntry = useMemo(() => {
    if (!activeTabId) {
      return null
    }

    return pageAnalysisCacheByTabId[activeTabId] ?? null
  }, [activeTabId, pageAnalysisCacheByTabId])

  const activePageAnalysisResult = activePageAnalysisEntry?.result ?? null

  const activePageAnalysisSnapshot =
    activePageAnalysisResult?.snapshot ??
    (pageAnalysisStatus.tabId === activeTabId ? pageAnalysisStatus.snapshot : null)

  const activePageAnalysisStale = useMemo(() => {
    if (!activePageAnalysisSnapshot) {
      return false
    }

    const staleByAge =
      Date.now() - Date.parse(activePageAnalysisSnapshot.extractedAt) > activePageAnalysisSnapshot.ttlMs

    return activePageAnalysisSnapshot.stale || staleByAge
  }, [activePageAnalysisSnapshot])

  const liveAgentApprovalBatch = liveAgentStatus.approvalBatch

  const liveAgentCanStart =
    liveAgentBusyState === 'idle' &&
    (liveAgentStatus.state === 'idle' ||
      liveAgentStatus.state === 'completed' ||
      liveAgentStatus.state === 'failed' ||
      liveAgentStatus.state === 'cancelled')

  const liveAgentCanApprove =
    liveAgentBusyState === 'idle' &&
    liveAgentStatus.state === 'waiting-approval' &&
    Boolean(liveAgentApprovalBatch)

  const liveAgentCanPause =
    liveAgentBusyState === 'idle' &&
    (liveAgentStatus.state === 'running' || liveAgentStatus.state === 'planning')

  const liveAgentCanResume =
    liveAgentBusyState === 'idle' && liveAgentStatus.state === 'paused'

  const liveAgentCanCancel =
    liveAgentBusyState === 'idle' &&
    ['planning', 'running', 'waiting-approval', 'paused'].includes(liveAgentStatus.state)

  const sidebarBadges = useMemo(() => {
    const runningCount = historyEntries.filter((entry) => entry.status === 'running').length
    const failedCount = historyEntries.filter((entry) => entry.status === 'failed').length
    const liveAgentNeedsAttention =
      liveAgentStatus.state === 'waiting-approval' ||
      liveAgentStatusTone === 'error'

    return {
      library: libraryItems.length,
      history: runningCount + failedCount,
      'ai-chat':
        aiStatusTone === 'error' ||
        pageAnalysisStatusTone === 'error' ||
        liveAgentNeedsAttention
          ? 1
          : 0
    } satisfies Partial<Record<AutomationSidebarSection, number>>
  }, [
    aiStatusTone,
    historyEntries,
    libraryItems.length,
    liveAgentStatus.state,
    liveAgentStatusTone,
    pageAnalysisStatusTone
  ])

  const persistSidebarPreferences = useCallback(
    (patch: Partial<AutomationSidebarPreferences>): void => {
      setSidebarPreferences((current) => {
        const merged: AutomationSidebarPreferences = {
          ...current,
          ...patch,
          sectionState: patch.sectionState
            ? mergeSectionState(current.sectionState, patch.sectionState)
            : current.sectionState
        }

        void window.pathfinder
          .saveAutomationSidebarPreferences({ preferences: patch })
          .then((saved) => setSidebarPreferences(saved))
          .catch(() => {
            setSidebarPreferences(merged)
          })

        return merged
      })
    },
    []
  )

  const syncAiDraftFromState = useCallback((state: LLMAdapterConfigState): void => {
    setLlmConfigState(state)
    setAiProvider(state.config.provider)
    setAiModel(state.config.model)
    setAiEndpoint(state.config.endpoint ?? '')
  }, [])

  const refreshLlmConfig = useCallback(async (): Promise<void> => {
    const state = await window.pathfinder.llmGetConfig()
    syncAiDraftFromState(state)
    setAiStatusTone('neutral')
    setAiStatusMessage(
      state.secretPresent
        ? 'AI provider settings loaded. Secret is configured.'
        : 'AI provider settings loaded. Add a key/token to enable provider calls.'
    )
  }, [syncAiDraftFromState])

  const saveLlmConfig = useCallback(async (): Promise<void> => {
    if (!aiModel.trim()) {
      setAiStatusTone('error')
      setAiStatusMessage('Model is required before saving AI settings.')
      return
    }

    setAiBusyState('saving')
    setAiStatusTone('neutral')
    setAiStatusMessage('Saving AI provider settings...')

    try {
      const nextState = await window.pathfinder.llmSaveConfig({
        provider: aiProvider,
        model: aiModel.trim(),
        endpoint: aiEndpoint.trim() ? aiEndpoint.trim() : null,
        secret: aiSecretDraft.trim()
          ? { mode: 'set', value: aiSecretDraft.trim() }
          : { mode: 'unchanged' }
      })

      syncAiDraftFromState(nextState)
      setAiSecretDraft('')
      setAiStatusTone('success')
      setAiStatusMessage(
        nextState.secretPresent
          ? `Saved ${nextState.config.provider} settings. Secret is configured.`
          : `Saved ${nextState.config.provider} settings. No secret is configured yet.`
      )
    } catch (error) {
      setAiStatusTone('error')
      setAiStatusMessage(error instanceof Error ? error.message : 'Failed to save AI settings.')
    } finally {
      setAiBusyState('idle')
    }
  }, [aiEndpoint, aiModel, aiProvider, aiSecretDraft, syncAiDraftFromState])

  const validateLlmConfig = useCallback(async (): Promise<void> => {
    setAiBusyState('validating')
    setAiStatusTone('neutral')
    setAiStatusMessage(`Validating ${aiProvider} provider connection...`)

    try {
      const result = await window.pathfinder.llmValidateConfig({ provider: aiProvider })
      if (result.ok) {
        setAiStatusTone('success')
        setAiStatusMessage(
          `Validation succeeded for ${result.provider} (${result.model})${typeof result.latencyMs === 'number' ? ` in ${result.latencyMs}ms` : ''}.`
        )
      } else {
        setAiStatusTone('error')
        setAiStatusMessage(
          result.error?.message ?? `Validation failed for ${result.provider}.`
        )
      }
    } catch (error) {
      setAiStatusTone('error')
      setAiStatusMessage(error instanceof Error ? error.message : 'Validation failed.')
    } finally {
      setAiBusyState('idle')
    }
  }, [aiProvider])

  const upsertPageAnalysisCache = useCallback(
    (tabId: string, result: PageAnalysisResult): void => {
      setPageAnalysisCacheByTabId((current) => ({
        ...current,
        [tabId]: {
          result,
          updatedAt: new Date().toISOString()
        }
      }))
    },
    []
  )

  const refreshPageAnalysisStatus = useCallback(async (): Promise<void> => {
    const status = await window.pathfinder.pageAnalysisGetStatus(
      activeTabId ? { tabId: activeTabId } : undefined
    )
    setPageAnalysisStatus(status)

    const statusTabId = status.tabId
    if (statusTabId && !status.hasContext) {
      setPageAnalysisCacheByTabId((current) => {
        if (!(statusTabId in current)) {
          return current
        }

        const next = { ...current }
        delete next[statusTabId]
        return next
      })
    }
  }, [activeTabId])

  const focusAiSection = useCallback((): void => {
    if (isOverlayMode) {
      setIsOverlayOpen(true)
    }

    persistSidebarPreferences({
      collapsed: false,
      activeSection: 'ai-chat'
    })
  }, [isOverlayMode, persistSidebarPreferences])

  const applySettingsValidationError = useCallback(
    (error: BrowserSettingsValidationError | undefined): void => {
      if (!error) {
        setSettingsValidationErrors(EMPTY_SETTINGS_VALIDATION_ERRORS)
        return
      }

      setSettingsValidationErrors({
        [error.field]: error.message
      })
    },
    []
  )

  const syncSettingsSnapshot = useCallback((snapshot: BrowserSettingsSnapshot): void => {
    setSettingsSnapshot(snapshot)
    setAppearanceSettings(snapshot.appearance)
  }, [])

  const loadSettingsSnapshot = useCallback(async (): Promise<BrowserSettingsSnapshot> => {
    const snapshot = await window.pathfinder.settingsGetSnapshot()
    syncSettingsSnapshot(snapshot)
    return snapshot
  }, [syncSettingsSnapshot])

  const openSettingsPanel = useCallback(async (): Promise<void> => {
    settingsReturnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    setIsSettingsOpen(true)
    setSettingsBusyState('loading')
    setSettingsStatusTone('neutral')
    setSettingsStatusMessage('Loading settings snapshot...')
    setSettingsValidationErrors(EMPTY_SETTINGS_VALIDATION_ERRORS)
    setSettingsClearDataResults([])

    try {
      const snapshot = await loadSettingsSnapshot()

      if (snapshot.repairNotice) {
        setSettingsStatusTone('neutral')
        setSettingsStatusMessage(
          `Settings were auto-repaired (${snapshot.repairNotice.reason}). Review and re-save if needed.`
        )
      } else {
        setSettingsStatusTone('success')
        setSettingsStatusMessage('Settings loaded. Update values and save section changes.')
      }
    } catch (error) {
      setSettingsStatusTone('error')
      setSettingsStatusMessage(
        error instanceof Error ? error.message : 'Unable to load settings snapshot.'
      )
    } finally {
      setSettingsBusyState('idle')
    }
  }, [loadSettingsSnapshot])

  const closeSettingsPanel = useCallback((): void => {
    setIsSettingsOpen(false)
    setSettingsBusyState('idle')
    setSettingsValidationErrors(EMPTY_SETTINGS_VALIDATION_ERRORS)

    window.setTimeout(() => {
      settingsReturnFocusRef.current?.focus()
    }, 0)
  }, [])

  const saveGeneralSettings = useCallback(
    async (general: BrowserGeneralSettings): Promise<void> => {
      setSettingsBusyState('saving-general')
      setSettingsStatusTone('neutral')
      setSettingsStatusMessage('Saving general settings...')
      setSettingsClearDataResults([])

      try {
        const result = await window.pathfinder.settingsSaveGeneral({ general })
        syncSettingsSnapshot(result.snapshot)
        applySettingsValidationError(result.validationError)

        if (result.ok) {
          setSettingsStatusTone('success')
          setSettingsStatusMessage('General settings saved successfully.')
          return
        }

        setSettingsStatusTone('error')
        setSettingsStatusMessage(result.validationError?.message ?? 'General settings could not be saved.')
      } catch (error) {
        setSettingsStatusTone('error')
        setSettingsStatusMessage(
          error instanceof Error ? error.message : 'General settings could not be saved.'
        )
      } finally {
        setSettingsBusyState('idle')
      }
    },
    [applySettingsValidationError, syncSettingsSnapshot]
  )

  const saveAppearanceSettings = useCallback(
    async (appearance: BrowserAppearanceSettings): Promise<void> => {
      setSettingsBusyState('saving-appearance')
      setSettingsStatusTone('neutral')
      setSettingsStatusMessage('Saving appearance settings...')
      setSettingsClearDataResults([])

      try {
        const result = await window.pathfinder.settingsSaveAppearance({ appearance })
        syncSettingsSnapshot(result.snapshot)
        applySettingsValidationError(result.validationError)

        if (result.ok) {
          setSettingsStatusTone('success')
          setSettingsStatusMessage('Appearance settings saved successfully.')
          return
        }

        setSettingsStatusTone('error')
        setSettingsStatusMessage(result.validationError?.message ?? 'Appearance settings could not be saved.')
      } catch (error) {
        setSettingsStatusTone('error')
        setSettingsStatusMessage(
          error instanceof Error ? error.message : 'Appearance settings could not be saved.'
        )
      } finally {
        setSettingsBusyState('idle')
      }
    },
    [applySettingsValidationError, syncSettingsSnapshot]
  )

  const savePrivacySettings = useCallback(
    async (privacy: BrowserPrivacySettings): Promise<void> => {
      setSettingsBusyState('saving-privacy')
      setSettingsStatusTone('neutral')
      setSettingsStatusMessage('Saving privacy settings...')
      setSettingsClearDataResults([])

      try {
        const result = await window.pathfinder.settingsSavePrivacy({ privacy })
        syncSettingsSnapshot(result.snapshot)
        applySettingsValidationError(result.validationError)

        if (result.ok) {
          setSettingsStatusTone('success')
          setSettingsStatusMessage(
            privacy.cookieMode === 'block-third-party'
              ? 'Privacy settings saved. Third-party cookie blocking is currently best effort.'
              : 'Privacy settings saved successfully.'
          )
          return
        }

        setSettingsStatusTone('error')
        setSettingsStatusMessage(result.validationError?.message ?? 'Privacy settings could not be saved.')
      } catch (error) {
        setSettingsStatusTone('error')
        setSettingsStatusMessage(
          error instanceof Error ? error.message : 'Privacy settings could not be saved.'
        )
      } finally {
        setSettingsBusyState('idle')
      }
    },
    [applySettingsValidationError, syncSettingsSnapshot]
  )

  const clearSettingsDataBuckets = useCallback(
    async (buckets: BrowserClearDataBucket[]): Promise<void> => {
      setSettingsBusyState('clearing-data')
      setSettingsStatusTone('neutral')
      setSettingsStatusMessage('Clearing selected data buckets...')

      try {
        const result = await window.pathfinder.settingsClearData({ buckets })
        syncSettingsSnapshot(result.snapshot)
        setSettingsClearDataResults(result.bucketResults)
        applySettingsValidationError(result.validationError)

        if (result.ok) {
          setSettingsStatusTone('success')
          setSettingsStatusMessage('Selected data buckets were cleared.')
          return
        }

        const failedBuckets = result.bucketResults.filter((bucketResult) => !bucketResult.ok)
        if (failedBuckets.length > 0) {
          setSettingsStatusTone('error')
          setSettingsStatusMessage(
            `Some buckets failed: ${failedBuckets.map((bucketResult) => bucketResult.bucket).join(', ')}`
          )
          return
        }

        setSettingsStatusTone('error')
        setSettingsStatusMessage(
          result.validationError?.message ?? 'Unable to clear selected data buckets.'
        )
      } catch (error) {
        setSettingsStatusTone('error')
        setSettingsStatusMessage(
          error instanceof Error ? error.message : 'Unable to clear selected data buckets.'
        )
      } finally {
        setSettingsBusyState('idle')
      }
    },
    [applySettingsValidationError, syncSettingsSnapshot]
  )

  const buildAutomationGenerateRequestConstraints = useCallback(() => {
    const variableHints = aiAutomationConstraints.variables
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)

    const constraints = {
      ...(aiAutomationConstraints.targetUrl.trim()
        ? { targetUrl: aiAutomationConstraints.targetUrl.trim() }
        : {}),
      ...(aiAutomationConstraints.objective.trim()
        ? { objective: aiAutomationConstraints.objective.trim() }
        : {}),
      ...(variableHints.length > 0 ? { variables: variableHints } : {}),
      ...(aiAutomationConstraints.notes.trim()
        ? { notes: aiAutomationConstraints.notes.trim() }
        : {})
    }

    return Object.keys(constraints).length > 0 ? constraints : undefined
  }, [aiAutomationConstraints])

  const refreshAutomationGenerationStatus = useCallback(async (): Promise<void> => {
    const status = await window.pathfinder.aiAutomationGetStatus()
    setAiAutomationState(status.state)
    setAiAutomationOperationId(status.operationId)

    if (status.error) {
      setAiAutomationError(status.error.message)
      if (status.state === 'cancelled') {
        setAiAutomationStatusMessage('Generation cancelled. You can retry with the same prompt.')
      } else {
        setAiAutomationStatusMessage(status.error.message)
      }
      return
    }

    if (status.state === 'generating') {
      setAiAutomationStatusMessage('Generating workflow draft...')
    } else if (status.state === 'validating') {
      setAiAutomationStatusMessage('Validating generated workflow draft...')
    } else if (status.state === 'ready' && status.hasDraft) {
      setAiAutomationStatusMessage('Draft ready. Review and approve before saving or running.')
    }
  }, [])

  const refreshLiveAgentAuditTrail = useCallback(async (runId: string | null): Promise<void> => {
    if (!runId) {
      setLiveAgentAuditTrail([])
      return
    }

    const result = await window.pathfinder.liveAgentGetAuditTrail({ runId })
    setLiveAgentAuditTrail(result.events)
    setLiveAgentExpandedAuditIds((current) =>
      current.filter((eventId) => result.events.some((event) => event.id === eventId))
    )
  }, [])

  const refreshLiveAgentStatus = useCallback(async (): Promise<void> => {
    try {
      const status = await window.pathfinder.liveAgentGetStatus(
        liveAgentStatus.runId ? { runId: liveAgentStatus.runId } : undefined
      )
      setLiveAgentStatus(status)

      if (status.error) {
        setLiveAgentStatusTone('error')
        setLiveAgentStatusMessage(status.error.message)
      } else if (status.state === 'waiting-approval' && status.approvalBatch) {
        setLiveAgentStatusTone('neutral')
        setLiveAgentStatusMessage(
          `Approval required for ${status.approvalBatch.size} planned step${status.approvalBatch.size > 1 ? 's' : ''}.`
        )
      } else if (status.state === 'running') {
        setLiveAgentStatusTone('success')
        setLiveAgentStatusMessage('Live Agent is executing approved steps.')
      } else if (status.state === 'paused') {
        setLiveAgentStatusTone('neutral')
        setLiveAgentStatusMessage('Live Agent paused at a safe boundary. Resume when ready.')
      } else if (status.state === 'completed') {
        setLiveAgentStatusTone('success')
        setLiveAgentStatusMessage('Live Agent run completed successfully.')
      } else if (status.state === 'cancelled') {
        setLiveAgentStatusTone('neutral')
        setLiveAgentStatusMessage('Live Agent run was cancelled.')
      }

      await refreshLiveAgentAuditTrail(status.runId)
    } catch (error) {
      setLiveAgentStatusTone('error')
      setLiveAgentStatusMessage(
        error instanceof Error ? error.message : 'Unable to refresh Live Agent status.'
      )
    }
  }, [liveAgentStatus.runId, refreshLiveAgentAuditTrail])

  const refreshHistorySnapshot = useCallback(async (): Promise<void> => {
    const result = await window.pathfinder.automationHistoryList({
      status: historyStatusFilter ?? 'all',
      ...(historyQuery.trim() ? { query: historyQuery.trim() } : {})
    })

    setHistoryEntries(result.entries)
  }, [historyQuery, historyStatusFilter])

  const startLiveAgentRun = useCallback(
    async (promptOverride?: string): Promise<void> => {
      await focusAiSection()

      const prompt = (promptOverride ?? liveAgentPrompt).trim()
      if (!prompt) {
        setLiveAgentStatusTone('error')
        setLiveAgentStatusMessage('Provide a Live Agent prompt before starting a run.')
        liveAgentPromptInputRef.current?.focus()
        throw new Error('Provide a Live Agent prompt before starting.')
      }

      if (promptOverride?.trim()) {
        setLiveAgentPrompt(promptOverride.trim())
      }

      setLiveAgentBusyState('starting')
      setLiveAgentStatusTone('neutral')
      setLiveAgentStatusMessage('Starting Live Agent run...')

      try {
        const result = await window.pathfinder.liveAgentStart({
          prompt,
          batchSize: liveAgentBatchSize,
          ...(activeTabId ? { tabId: activeTabId } : {})
        })

        if (!result.ok) {
          const message = result.error?.message ?? 'Unable to start Live Agent run.'
          setLiveAgentStatusTone('error')
          setLiveAgentStatusMessage(message)
          throw new Error(message)
        }

        setLiveAgentStatusTone('success')
        setLiveAgentStatusMessage('Live Agent run started.')
        await refreshLiveAgentStatus()
        await refreshHistorySnapshot()
      } finally {
        setLiveAgentBusyState('idle')
      }
    },
    [
      activeTabId,
      focusAiSection,
      liveAgentBatchSize,
      liveAgentPrompt,
      refreshHistorySnapshot,
      refreshLiveAgentStatus
    ]
  )

  const approveLiveAgentBatch = useCallback(
    async (decision: 'approve' | 'reject'): Promise<void> => {
      const runId = liveAgentStatus.runId
      const approvalBatch = liveAgentApprovalBatch

      if (!runId || !approvalBatch) {
        throw new Error('No approval batch is available.')
      }

      setLiveAgentBusyState('approving')
      setLiveAgentStatusTone('neutral')
      setLiveAgentStatusMessage(
        decision === 'approve' ? 'Approving batch...' : 'Rejecting batch...'
      )

      try {
        const result = await window.pathfinder.liveAgentApproveBatch({
          runId,
          batchId: approvalBatch.batchId,
          decision
        })

        if (!result.ok) {
          const message = result.error?.message ?? 'Unable to submit approval decision.'
          setLiveAgentStatusTone('error')
          setLiveAgentStatusMessage(message)
          throw new Error(message)
        }

        setLiveAgentStatusTone(decision === 'approve' ? 'success' : 'neutral')
        setLiveAgentStatusMessage(
          decision === 'approve'
            ? 'Batch approved. Live Agent resumed execution.'
            : 'Batch rejected. Live Agent run stopped.'
        )
      } finally {
        setLiveAgentBusyState('idle')
        await refreshLiveAgentStatus()
        await refreshHistorySnapshot()
      }
    },
    [
      liveAgentApprovalBatch,
      liveAgentStatus.runId,
      refreshHistorySnapshot,
      refreshLiveAgentStatus
    ]
  )

  const pauseLiveAgentRun = useCallback(async (): Promise<void> => {
    setLiveAgentBusyState('pausing')
    setLiveAgentStatusTone('neutral')
    setLiveAgentStatusMessage('Pausing Live Agent at a safe boundary...')

    try {
      const result = await window.pathfinder.liveAgentPause(
        liveAgentStatus.runId ? { runId: liveAgentStatus.runId } : undefined
      )

      if (!result.ok) {
        throw new Error(result.error?.message ?? 'Unable to pause Live Agent run.')
      }
    } finally {
      setLiveAgentBusyState('idle')
      await refreshLiveAgentStatus()
    }
  }, [liveAgentStatus.runId, refreshLiveAgentStatus])

  const resumeLiveAgentRun = useCallback(async (): Promise<void> => {
    setLiveAgentBusyState('resuming')
    setLiveAgentStatusTone('neutral')
    setLiveAgentStatusMessage('Resuming Live Agent run...')

    try {
      const result = await window.pathfinder.liveAgentResume({
        ...(liveAgentStatus.runId ? { runId: liveAgentStatus.runId } : {}),
        ...(activeTabId ? { tabId: activeTabId } : {})
      })

      if (!result.ok) {
        throw new Error(result.error?.message ?? 'Unable to resume Live Agent run.')
      }
    } finally {
      setLiveAgentBusyState('idle')
      await refreshLiveAgentStatus()
      await refreshHistorySnapshot()
    }
  }, [activeTabId, liveAgentStatus.runId, refreshHistorySnapshot, refreshLiveAgentStatus])

  const cancelLiveAgentRun = useCallback(async (): Promise<void> => {
    setLiveAgentBusyState('cancelling')
    setLiveAgentStatusTone('neutral')
    setLiveAgentStatusMessage('Cancelling Live Agent run...')

    try {
      const result = await window.pathfinder.liveAgentCancel(
        liveAgentStatus.runId ? { runId: liveAgentStatus.runId } : undefined
      )

      if (!result.ok) {
        throw new Error(result.error?.message ?? 'Unable to cancel Live Agent run.')
      }
    } finally {
      setLiveAgentBusyState('idle')
      await refreshLiveAgentStatus()
      await refreshHistorySnapshot()
    }
  }, [liveAgentStatus.runId, refreshHistorySnapshot, refreshLiveAgentStatus])

  const toggleLiveAgentAuditExpansion = useCallback((eventId: string): void => {
    setLiveAgentExpandedAuditIds((current) =>
      current.includes(eventId)
        ? current.filter((id) => id !== eventId)
        : [...current, eventId]
    )
  }, [])

  const requestAutomationGeneration = useCallback(
    async (promptOverride?: string): Promise<void> => {
      const prompt = (promptOverride ?? aiAutomationPrompt).trim()
      if (!prompt) {
        setAiAutomationError('Provide a prompt to generate an automation draft.')
        setAiAutomationStatusMessage('Prompt required before generation can start.')
        setAiAutomationState('failed')
        aiAutomationPromptInputRef.current?.focus()
        throw new Error('Provide a prompt for AI automation generation.')
      }

      if (promptOverride?.trim()) {
        setAiAutomationPrompt(promptOverride.trim())
      }

      setAiAutomationBusyState('generating')
      setAiAutomationError('')
      setAiAutomationValidationErrors([])
      setAiAutomationStatusMessage('Generating workflow draft...')
      setAiAutomationState('generating')

      try {
        const constraints = buildAutomationGenerateRequestConstraints()
        const result = await window.pathfinder.aiAutomationGenerate({
          prompt,
          ...(constraints ? { constraints } : {}),
          ...(activeTabId ? { tabId: activeTabId } : {})
        })

        setAiAutomationOperationId(result.operationId)
        setAiAutomationState(result.state)

        if (!result.ok || !result.draft) {
          const message = result.error?.message ?? 'Automation draft generation failed.'
          setAiAutomationError(message)
          setAiAutomationStatusMessage(message)
          setAiAutomationDraft(null)
          setAiAutomationWarnings([])
          return
        }

        setAiAutomationDraft(result.draft.workflow)
        setAiAutomationWarnings(result.draft.warnings)
        setAiAutomationJsonDraft(JSON.stringify(result.draft.workflow, null, 2))
        setAiAutomationJsonError('')
        setAiAutomationShowJson(false)
        setAiAutomationError('')
        setAiAutomationStatusMessage('Draft ready. Review and approve before saving or running.')
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Automation draft generation failed.'
        setAiAutomationError(message)
        setAiAutomationState('failed')
        setAiAutomationStatusMessage(message)
      } finally {
        setAiAutomationBusyState('idle')
      }
    },
    [
      activeTabId,
      aiAutomationPrompt,
      buildAutomationGenerateRequestConstraints
    ]
  )

  const cancelAutomationGeneration = useCallback(async (): Promise<void> => {
    setAiAutomationBusyState('cancelling')

    try {
      const result = await window.pathfinder.aiAutomationCancel(
        aiAutomationOperationId ? { operationId: aiAutomationOperationId } : undefined
      )

      setAiAutomationState(result.state)
      setAiAutomationOperationId(result.operationId)

      if (result.ok) {
        setAiAutomationError('')
        setAiAutomationStatusMessage('Generation cancelled. Prompt and constraints were preserved for retry.')
        return
      }

      setAiAutomationStatusMessage('No active generation request was running.')
    } finally {
      setAiAutomationBusyState('idle')
      await refreshAutomationGenerationStatus()
    }
  }, [aiAutomationOperationId, refreshAutomationGenerationStatus])

  const applyDraftJson = useCallback((): void => {
    if (!aiAutomationJsonDraft.trim()) {
      setAiAutomationJsonError('JSON draft cannot be empty.')
      return
    }

    try {
      const parsed = JSON.parse(aiAutomationJsonDraft) as RecorderWorkflowDocument
      const validationErrors = validateGeneratedDraft(parsed)
      if (validationErrors.length > 0) {
        setAiAutomationJsonError(validationErrors[0] ?? 'Invalid workflow JSON.')
        setAiAutomationValidationErrors(validationErrors)
        return
      }

      setAiAutomationDraft(parsed)
      setAiAutomationValidationErrors([])
      setAiAutomationJsonError('')
      setAiAutomationStatusMessage('Draft JSON applied. Re-validate with Save actions when ready.')
    } catch (error) {
      setAiAutomationJsonError(error instanceof Error ? error.message : 'Invalid JSON.')
    }
  }, [aiAutomationJsonDraft])

  const updateDraftStep = useCallback(
    (index: number, updater: (step: RecorderWorkflowStep) => RecorderWorkflowStep): void => {
      setAiAutomationDraft((current) => {
        if (!current) {
          return current
        }

        const nextSteps = [...current.steps]
        const currentStep = nextSteps[index]
        if (!currentStep) {
          return current
        }

        nextSteps[index] = updater(currentStep)

        const nextDraft = {
          ...current,
          steps: nextSteps,
          updatedAt: new Date().toISOString()
        }

        setAiAutomationJsonDraft(JSON.stringify(nextDraft, null, 2))
        return nextDraft
      })
      setAiAutomationValidationErrors([])
      setAiAutomationJsonError('')
    },
    []
  )

  const normalizeDraftForSave = useCallback(
    (draft: RecorderWorkflowDocument): RecorderWorkflowDocument => {
      const mergedVariables = {
        ...(draft.variables ?? {}),
        ...(parseVariableDefinitions(aiAutomationConstraints.variables) ?? {})
      }

      return {
        ...draft,
        name: draft.name.trim() || `AI Draft ${new Date().toLocaleString()}`,
        updatedAt: new Date().toISOString(),
        ...(Object.keys(mergedVariables).length > 0 ? { variables: mergedVariables } : {}),
        metadata: {
          ...(draft.metadata ?? {}),
          generatedBy: 'ai-automation-generation',
          sourcePrompt: aiAutomationPrompt,
          ...(aiAutomationConstraints.targetUrl.trim()
            ? { targetUrl: aiAutomationConstraints.targetUrl.trim() }
            : {}),
          ...(aiAutomationConstraints.objective.trim()
            ? { objective: aiAutomationConstraints.objective.trim() }
            : {})
        }
      }
    },
    [
      aiAutomationConstraints.objective,
      aiAutomationConstraints.targetUrl,
      aiAutomationConstraints.variables,
      aiAutomationPrompt
    ]
  )

  const saveGeneratedDraft = useCallback(
    async (runAfterSave: boolean): Promise<void> => {
      if (!aiAutomationDraft) {
        setAiAutomationStatusMessage('No generated draft is available to save.')
        setAiAutomationState('failed')
        return
      }

      const normalized = normalizeDraftForSave(aiAutomationDraft)
      const validationErrors = validateGeneratedDraft(normalized)
      setAiAutomationValidationErrors(validationErrors)
      if (validationErrors.length > 0) {
        setAiAutomationState('failed')
        setAiAutomationStatusMessage('Draft validation failed. Fix highlighted issues before approval.')
        return
      }

      setAiAutomationBusyState(runAfterSave ? 'save-and-run' : 'saving')
      setAiAutomationStatusMessage(runAfterSave ? 'Saving draft and starting run...' : 'Saving draft...')

      try {
        const upsertResult = await window.pathfinder.automationLibraryUpsert({
          item: {
            id: normalized.id,
            name: normalized.name,
            ...(normalized.description ? { description: normalized.description } : {}),
            tags: ['ai-generated'],
            workflowDocument: normalized,
            origin: 'imported'
          }
        })

        setLibraryItems(upsertResult.items)
        setRecentAutomationsVersion((current) => current + 1)

        if (!runAfterSave) {
          setAiAutomationState('ready')
          setAiAutomationStatusMessage('Draft saved to the automation library.')
          return
        }

        const savedId = upsertResult.item?.id ?? normalized.id
        const runResult = await window.pathfinder.automationLibraryRun({
          id: savedId,
          sourceLabel: 'sidebar',
          ...(activeTabId ? { tabId: activeTabId } : {})
        })

        if (!runResult.ok) {
          if (runResult.reason === 'missing-variables' && runResult.requiredVariables?.length) {
            throw new Error(
              'Saved draft requires variables before run. Use Run from library to provide inputs.'
            )
          }

          throw new Error(getPlaybackFailureMessage(runResult))
        }

        setRecentAutomationsVersion((current) => current + 1)
        setAiAutomationStatusMessage('Draft saved and playback started.')
      } catch (error) {
        setAiAutomationState('failed')
        setAiAutomationStatusMessage(
          error instanceof Error ? error.message : 'Unable to save or run generated draft.'
        )
      } finally {
        setAiAutomationBusyState('idle')
      }
    },
    [
      activeTabId,
      aiAutomationDraft,
      normalizeDraftForSave
    ]
  )

  const discardGeneratedDraft = useCallback((): void => {
    setAiAutomationDraft(null)
    setAiAutomationWarnings([])
    setAiAutomationValidationErrors([])
    setAiAutomationJsonError('')
    setAiAutomationJsonDraft('')
    setAiAutomationShowJson(false)
    setAiAutomationState('idle')
    setAiAutomationOperationId(null)
    setAiAutomationError('')
    setAiAutomationStatusMessage('Draft discarded. Prompt and constraints are still available for retry.')
  }, [])

  const executePageAnalysis = useCallback(
    async (mode: PageAnalysisMode, questionOverride?: string): Promise<void> => {
      if (!activeTabId) {
        throw new Error('No active tab available.')
      }

      focusAiSection()
      const question = (questionOverride ?? pageAnalysisQuestion).trim()
      if (mode === 'ask' && !question) {
        setPageAnalysisStatusTone('error')
        setPageAnalysisStatusMessage('Type a question before running Ask.')
        pageAnalysisQuestionInputRef.current?.focus()
        return
      }

      setPageAnalysisBusyState(mode)
      setPageAnalysisStatusTone('neutral')
      setPageAnalysisStatusMessage(
        mode === 'summarize'
          ? 'Analyzing active page and generating summary...'
          : 'Analyzing active page and answering question...'
      )

      const requestBase = {
        tabId: activeTabId,
        verbosity: pageAnalysisVerbosity
      }

      try {
        const result =
          mode === 'summarize'
            ? await window.pathfinder.pageAnalysisSummarize(requestBase)
            : await window.pathfinder.pageAnalysisAsk({
                ...requestBase,
                question
              })

        if (result.ok) {
          upsertPageAnalysisCache(activeTabId, result)
          setPageAnalysisStatusTone('success')
          setPageAnalysisStatusMessage(
            mode === 'summarize'
              ? 'Page summary updated with grounded citations.'
              : 'Answer generated with grounded citations.'
          )
          setPageAnalysisLastRequest(mode === 'ask' ? { mode, question } : { mode })
        } else {
          upsertPageAnalysisCache(activeTabId, result)
          setPageAnalysisStatusTone('error')
          setPageAnalysisStatusMessage(result.error?.message ?? 'Page analysis failed.')
          setPageAnalysisLastRequest(mode === 'ask' ? { mode, question } : { mode })
        }
      } catch (error) {
        setPageAnalysisStatusTone('error')
        setPageAnalysisStatusMessage(
          error instanceof Error ? error.message : 'Page analysis failed.'
        )
      } finally {
        setPageAnalysisBusyState('idle')
        await refreshPageAnalysisStatus()
      }
    },
    [
      activeTabId,
      focusAiSection,
      pageAnalysisQuestion,
      pageAnalysisVerbosity,
      refreshPageAnalysisStatus,
      upsertPageAnalysisCache
    ]
  )

  const summarizeActivePage = useCallback(async (): Promise<void> => {
    await executePageAnalysis('summarize')
  }, [executePageAnalysis])

  const askActivePage = useCallback(
    async (questionOverride?: string): Promise<void> => {
      await executePageAnalysis('ask', questionOverride)
    },
    [executePageAnalysis]
  )

  const refreshPageAnalysisContext = useCallback(async (): Promise<void> => {
    if (!activeTabId) {
      throw new Error('No active tab available.')
    }

    setPageAnalysisBusyState('refresh')
    setPageAnalysisStatusTone('neutral')
    setPageAnalysisStatusMessage('Refreshing page context...')

    try {
      const result = await window.pathfinder.pageAnalysisRefreshContext({ tabId: activeTabId })
      if (!result.ok) {
        setPageAnalysisStatusTone('error')
        setPageAnalysisStatusMessage(result.error?.message ?? 'Unable to refresh page context.')
      } else {
        setPageAnalysisStatusTone('success')
        setPageAnalysisStatusMessage('Page context refreshed.')
      }
    } finally {
      setPageAnalysisBusyState('idle')
      await refreshPageAnalysisStatus()
    }
  }, [activeTabId, refreshPageAnalysisStatus])

  const clearPageAnalysisContext = useCallback(async (): Promise<void> => {
    if (!activeTabId) {
      throw new Error('No active tab available.')
    }

    setPageAnalysisBusyState('clear')

    try {
      await window.pathfinder.pageAnalysisClearContext({ tabId: activeTabId })
      setPageAnalysisCacheByTabId((current) => {
        if (!(activeTabId in current)) {
          return current
        }

        const next = { ...current }
        delete next[activeTabId]
        return next
      })
      setPageAnalysisStatusTone('neutral')
      setPageAnalysisStatusMessage('Page analysis context cleared for this tab.')
    } finally {
      setPageAnalysisBusyState('idle')
      await refreshPageAnalysisStatus()
    }
  }, [activeTabId, refreshPageAnalysisStatus])

  const cancelPageAnalysis = useCallback(async (): Promise<void> => {
    setPageAnalysisBusyState('cancel')

    try {
      await window.pathfinder.pageAnalysisCancel(
        pageAnalysisStatus.operationId ? { operationId: pageAnalysisStatus.operationId } : undefined
      )
      setPageAnalysisStatusTone('neutral')
      setPageAnalysisStatusMessage('Cancellation requested for active analysis task.')
    } finally {
      setPageAnalysisBusyState('idle')
      await refreshPageAnalysisStatus()
    }
  }, [pageAnalysisStatus.operationId, refreshPageAnalysisStatus])

  const retryPageAnalysis = useCallback(async (): Promise<void> => {
    if (!pageAnalysisLastRequest) {
      setPageAnalysisStatusTone('error')
      setPageAnalysisStatusMessage('No previous analysis request to retry.')
      return
    }

    if (pageAnalysisLastRequest.mode === 'summarize') {
      await summarizeActivePage()
      return
    }

    await askActivePage(pageAnalysisLastRequest.question)
  }, [askActivePage, pageAnalysisLastRequest, summarizeActivePage])

  const handlePageAnalysisUserAction = useCallback(
    async (action: PageAnalysisFailure['userAction']): Promise<void> => {
      if (action === 'retry') {
        await retryPageAnalysis()
        return
      }

      if (action === 'refresh-context') {
        await refreshPageAnalysisContext()
        return
      }

      if (action === 'clear-context') {
        await clearPageAnalysisContext()
        return
      }

      if (action === 'check-llm-config') {
        focusAiSection()
        return
      }

      if (action === 'review-page-selection') {
        pageAnalysisQuestionInputRef.current?.focus()
      }
    },
    [
      clearPageAnalysisContext,
      focusAiSection,
      refreshPageAnalysisContext,
      retryPageAnalysis
    ]
  )

  const refreshLibrary = useCallback(async (): Promise<void> => {
    const result = await window.pathfinder.automationLibraryList({
      filter: {
        ...(libraryQuery.trim() ? { query: libraryQuery.trim() } : {}),
        ...(libraryTagFilter.length > 0 ? { tags: libraryTagFilter } : {})
      }
    })

    setLibraryItems(result.items)
  }, [libraryQuery, libraryTagFilter])

  const refreshHistory = useCallback(async (): Promise<void> => {
    const result = await window.pathfinder.automationHistoryList({
      status: historyStatusFilter ?? 'all',
      ...(historyQuery.trim() ? { query: historyQuery.trim() } : {})
    })
    setHistoryEntries(result.entries)
  }, [historyQuery, historyStatusFilter])

  const refreshRecorderStatus = useCallback(async (): Promise<void> => {
    const status = await window.pathfinder.getAutomationRecordingStatus()
    setRecorderStatus(status)
  }, [])

  const refreshPlaybackStatus = useCallback(async (): Promise<void> => {
    const status = await window.pathfinder.getAutomationPlaybackStatus()
    setPlaybackStatus(status)

    if (
      status.state === 'completed' ||
      status.state === 'failed' ||
      status.state === 'cancelled'
    ) {
      const terminalKey = `${status.runId ?? 'unknown'}:${status.finishedAt ?? status.state}`
      if (lastTerminalPlaybackKey !== terminalKey) {
        setLastTerminalPlaybackKey(terminalKey)
        setRecentAutomationsVersion((current) => current + 1)
      }
    }
  }, [lastTerminalPlaybackKey])

  const handlePlaybackStartResult = useCallback(
    async (
      result: AutomationPlaybackStartResult,
      pendingRequest: PendingPlaybackRequest
    ): Promise<void> => {
      if (result.ok) {
        setPlaybackPromptVariables([])
        setPendingPlaybackRequest(null)
        setRecentAutomationsVersion((current) => current + 1)
        await refreshPlaybackStatus()
        await refreshLibrary()
        await refreshHistory()
        return
      }

      if (result.reason === 'missing-variables' && result.requiredVariables?.length) {
        setPlaybackPromptVariables(result.requiredVariables)
        setPendingPlaybackRequest(pendingRequest)
        setCommandPaletteError('')
        return
      }

      throw new Error(getPlaybackFailureMessage(result))
    },
    [refreshHistory, refreshLibrary, refreshPlaybackStatus]
  )

  const syncTabs = (nextTabs: BrowserTabState[]): void => {
    setTabs(nextTabs)
    const active = nextTabs.find((tab) => tab.isActive)
    setActiveTabId(active?.id ?? nextTabs[0]?.id ?? null)
  }

  useEffect(() => {
    let isMounted = true

    const loadInitialTabs = async (): Promise<void> => {
      const initialTabs = await window.pathfinder.listTabs()
      if (!isMounted) {
        return
      }

      if (initialTabs.length === 0) {
        const seededTabs = await window.pathfinder.createTab(HOME_STARTER_URL)
        if (!isMounted) {
          return
        }

        syncTabs(seededTabs)
        return
      }

      syncTabs(initialTabs)
    }

    const loadInitialDownloads = async (): Promise<void> => {
      const initialDownloads = await window.pathfinder.listDownloads()
      if (!isMounted) {
        return
      }

      setDownloads(initialDownloads)
    }

    const unsubscribe = window.pathfinder.onBrowserState((payload) => {
      if (!isMounted) {
        return
      }

      syncTabs(payload.tabs)
      setActiveTabId(payload.activeTabId ?? payload.tabs.find((tab) => tab.isActive)?.id ?? null)
    })

    const unsubscribeDownloads = window.pathfinder.onDownloadState((payload) => {
      if (!isMounted) {
        return
      }

      setDownloads(payload.downloads)
    })

    loadInitialTabs().catch(() => {
      if (isMounted) {
        window.pathfinder
          .createTab(HOME_STARTER_URL)
          .then((seededTabs) => {
            if (!isMounted) {
              return
            }

            syncTabs(seededTabs)
          })
          .catch(() => {
            if (!isMounted) {
              return
            }

            setTabs([])
            setActiveTabId(null)
          })
      }
    })

    loadInitialDownloads().catch(() => {
      if (isMounted) {
        setDownloads([])
      }
    })

    return () => {
      isMounted = false
      unsubscribe()
      unsubscribeDownloads()
    }
  }, [])

  useEffect(() => {
    setPageAnalysisCacheByTabId((current) => {
      const tabUrlById = new Map(tabs.map((tab) => [tab.id, tab.url]))
      let changed = false
      let invalidatedActiveTab = false
      const next = { ...current }

      for (const [tabId, entry] of Object.entries(current)) {
        const currentUrl = tabUrlById.get(tabId)
        const snapshotUrl = entry.result.snapshot?.url

        if (!currentUrl || (snapshotUrl && snapshotUrl !== currentUrl)) {
          delete next[tabId]
          changed = true
          if (tabId === activeTabId) {
            invalidatedActiveTab = true
          }
        }
      }

      if (invalidatedActiveTab) {
        setPageAnalysisStatusTone('neutral')
        setPageAnalysisStatusMessage('Page changed. Refresh context before follow-up questions.')
      }

      return changed ? next : current
    })
  }, [activeTabId, tabs])

  useEffect(() => {
    if (!activePageAnalysisStale || pageAnalysisBusyState !== 'idle') {
      return
    }

    setPageAnalysisStatusTone((current) => (current === 'error' ? current : 'neutral'))
    setPageAnalysisStatusMessage((current) =>
      current.includes('stale')
        ? current
        : 'Analysis context may be stale. Refresh context for best results.'
    )
  }, [activePageAnalysisStale, pageAnalysisBusyState])

  useEffect(() => {
    void refreshPageAnalysisStatus()
  }, [activeTabId, refreshPageAnalysisStatus])

  useEffect(() => {
    let isMounted = true

    const loadSidebarPreferences = async (): Promise<void> => {
      try {
        const preferences = await window.pathfinder.getAutomationSidebarPreferences()
        if (!isMounted) {
          return
        }

        setSidebarPreferences(preferences)

        const libraryState = preferences.sectionState.library
        const historyState = preferences.sectionState.history

        setLibraryQuery(libraryState?.query ?? '')
        setLibraryTagFilter(Array.isArray(libraryState?.tags) ? libraryState.tags : [])
        setLibraryScrollTop(typeof libraryState?.scrollTop === 'number' ? libraryState.scrollTop : 0)

        setHistoryQuery(historyState?.query ?? '')
        setHistoryStatusFilter(
          historyState?.status === 'running' ||
            historyState?.status === 'success' ||
            historyState?.status === 'failed' ||
            historyState?.status === 'cancelled' ||
            historyState?.status === 'all'
            ? historyState.status
            : 'all'
        )
        setHistoryScrollTop(typeof historyState?.scrollTop === 'number' ? historyState.scrollTop : 0)
      } catch {
        if (isMounted) {
          setSidebarPreferences(DEFAULT_SIDEBAR_PREFERENCES)
        }
      }
    }

    void loadSidebarPreferences()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    void refreshLlmConfig().catch(() => {
        if (!isMounted) {
          return
        }

        setAiStatusTone('error')
        setAiStatusMessage('Unable to load AI provider settings.')
      })

    return () => {
      isMounted = false
    }
  }, [refreshLlmConfig])

  useEffect(() => {
    const syncOverlayMode = (): void => {
      const nextOverlayMode = window.innerWidth < 980
      setIsOverlayMode(nextOverlayMode)
      if (!nextOverlayMode) {
        setIsOverlayOpen(false)
      }
    }

    syncOverlayMode()
    window.addEventListener('resize', syncOverlayMode)
    return () => {
      window.removeEventListener('resize', syncOverlayMode)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    window.pathfinder
      .automationLibraryList({
        filter: {
          ...(libraryQuery.trim() ? { query: libraryQuery.trim() } : {}),
          ...(libraryTagFilter.length > 0 ? { tags: libraryTagFilter } : {})
        }
      })
      .then((result) => {
        if (!isMounted) {
          return
        }

        setLibraryItems(result.items)
      })
      .catch(() => {
        if (isMounted) {
          setLibraryItems([])
        }
      })

    return () => {
      isMounted = false
    }
  }, [libraryQuery, libraryTagFilter])

  useEffect(() => {
    let isMounted = true

    window.pathfinder
      .automationHistoryList({
        status: historyStatusFilter ?? 'all',
        ...(historyQuery.trim() ? { query: historyQuery.trim() } : {})
      })
      .then((result) => {
        if (!isMounted) {
          return
        }

        setHistoryEntries(result.entries)
      })
      .catch(() => {
        if (isMounted) {
          setHistoryEntries([])
        }
      })

    return () => {
      isMounted = false
    }
  }, [historyQuery, historyStatusFilter])

  const handleCreateTab = async (): Promise<void> => {
    const nextTabs = await window.pathfinder.createTab()
    syncTabs(nextTabs)
  }

  const handleActivateTab = async (tabId: string): Promise<void> => {
    const nextTabs = await window.pathfinder.activateTab(tabId)
    syncTabs(nextTabs)
  }

  const handleCloseTab = async (tabId: string): Promise<void> => {
    const nextTabs = await window.pathfinder.closeTab(tabId)
    syncTabs(nextTabs)
  }

  const handleNavigate = async (target: string): Promise<void> => {
    if (!activeTabId) {
      return
    }

    const nextTabs = await window.pathfinder.navigate({ tabId: activeTabId, input: target })
    syncTabs(nextTabs)
  }

  const handleBack = async (): Promise<void> => {
    if (!activeTabId) {
      return
    }

    const nextTabs = await window.pathfinder.back(activeTabId)
    syncTabs(nextTabs)
  }

  const handleForward = async (): Promise<void> => {
    if (!activeTabId) {
      return
    }

    const nextTabs = await window.pathfinder.forward(activeTabId)
    syncTabs(nextTabs)
  }

  const handleReload = async (): Promise<void> => {
    if (!activeTabId) {
      return
    }

    const nextTabs = await window.pathfinder.reload(activeTabId)
    syncTabs(nextTabs)
  }

  const handleStop = async (): Promise<void> => {
    if (!activeTabId) {
      return
    }

    const nextTabs = await window.pathfinder.stop(activeTabId)
    syncTabs(nextTabs)
  }

  const homeDraftQuery = activeTabId ? (homeDraftByTabId[activeTabId] ?? '') : ''

  const handleHomeDraftQueryChange = (value: string): void => {
    if (!activeTabId) {
      return
    }

    setHomeDraftByTabId((current) => ({
      ...current,
      [activeTabId]: value
    }))
  }

  const openCommandPalette = useCallback((): void => {
    setCommandPaletteQuery('')
    setCommandPaletteError('')
    setIsCommandPaletteOpen(true)
  }, [])

  const closeCommandPalette = useCallback((): void => {
    setIsCommandPaletteOpen(false)
  }, [])

  const startRecordingFromPalette = useCallback(async (): Promise<void> => {
    const request: RecorderStartRequest = activeTabId
      ? { owner: 'command-palette', tabId: activeTabId }
      : { owner: 'command-palette' }

    const result = await window.pathfinder.startAutomationRecording(request)

    setRecorderStatus((current) => ({
      ...current,
      state: result.state,
      sessionId: result.sessionId,
      tabId: result.tabId,
      reason: result.reason,
      startedAt: result.ok ? new Date().toISOString() : current.startedAt
    }))

    if (!result.ok) {
      throw new Error(`Recording start failed: ${result.reason}`)
    }
  }, [activeTabId])

  const stopRecordingFromPalette = useCallback(async (): Promise<void> => {
    const result = await window.pathfinder.stopAutomationRecording(
      recorderStatus.sessionId ? { sessionId: recorderStatus.sessionId } : undefined
    )

    setRecorderStatus((current) => ({
      ...current,
      state: result.state,
      reason: result.reason,
      sessionId: result.ok ? null : current.sessionId,
      startedAt: result.ok ? null : current.startedAt
    }))

    if (!result.ok) {
      throw new Error(`Recording stop failed: ${result.reason}`)
    }
  }, [recorderStatus.sessionId])

  const startPlaybackFromPalette = useCallback(
    async (workflowPath: string): Promise<void> => {
      const initialRequest: AutomationPlaybackStartRequest = {
        source: { kind: 'file', path: workflowPath },
        ...(activeTabId ? { tabId: activeTabId } : {})
      }

      const initialResult = await window.pathfinder.startAutomationPlayback(initialRequest)
      await handlePlaybackStartResult(initialResult, {
        kind: 'path',
        workflowPath,
        label: workflowPath
      })
    },
    [activeTabId, handlePlaybackStartResult]
  )

  const runLibraryItem = useCallback(
    async (item: AutomationLibraryItem): Promise<void> => {
      const result = await window.pathfinder.automationLibraryRun({
        id: item.id,
        sourceLabel: 'sidebar',
        ...(activeTabId ? { tabId: activeTabId } : {})
      })

      await handlePlaybackStartResult(result, {
        kind: 'library',
        libraryId: item.id,
        label: item.name
      })
    },
    [activeTabId, handlePlaybackStartResult]
  )

  const rerunHistoryEntry = useCallback(
    async (entry: AutomationHistoryEntry): Promise<void> => {
      const result = await window.pathfinder.automationHistoryRerun({
        id: entry.id,
        ...(activeTabId ? { tabId: activeTabId } : {})
      })

      await handlePlaybackStartResult(result, {
        kind: 'history',
        historyId: entry.id,
        label: entry.workflowNameSnapshot
      })
    },
    [activeTabId, handlePlaybackStartResult]
  )

  const submitPlaybackVariables = useCallback(
    async (values: Record<string, string>): Promise<void> => {
      if (!pendingPlaybackRequest) {
        throw new Error('No pending playback request to resume.')
      }

      let retryResult: AutomationPlaybackStartResult

      if (pendingPlaybackRequest.kind === 'path') {
        retryResult = await window.pathfinder.startAutomationPlayback({
          source: { kind: 'file', path: pendingPlaybackRequest.workflowPath },
          variables: values,
          ...(activeTabId ? { tabId: activeTabId } : {})
        })
      } else if (pendingPlaybackRequest.kind === 'library') {
        retryResult = await window.pathfinder.automationLibraryRun({
          id: pendingPlaybackRequest.libraryId,
          sourceLabel: 'sidebar',
          variables: values,
          ...(activeTabId ? { tabId: activeTabId } : {})
        })
      } else {
        retryResult = await window.pathfinder.automationHistoryRerun({
          id: pendingPlaybackRequest.historyId,
          variables: values,
          ...(activeTabId ? { tabId: activeTabId } : {})
        })
      }

      await handlePlaybackStartResult(retryResult, pendingPlaybackRequest)
    },
    [activeTabId, handlePlaybackStartResult, pendingPlaybackRequest]
  )

  const cancelPlaybackPrompt = useCallback((): void => {
    setPlaybackPromptVariables([])
    setPendingPlaybackRequest(null)
  }, [])

  const cancelPlaybackFromPalette = useCallback(async (): Promise<void> => {
    const result = await window.pathfinder.cancelAutomationPlayback()
    if (!result.ok) {
      throw new Error(`Playback cancel failed: ${result.reason}`)
    }

    setPlaybackPromptVariables([])
    setPendingPlaybackRequest(null)
    setRecentAutomationsVersion((current) => current + 1)
    await refreshPlaybackStatus()
    await refreshHistory()
  }, [refreshHistory, refreshPlaybackStatus])

  const upsertLibraryItem = useCallback(async (request: AutomationLibraryUpsertRequest): Promise<void> => {
    const result = await window.pathfinder.automationLibraryUpsert(request)
    setLibraryItems(result.items)
  }, [])

  const removeLibraryItem = useCallback(async (id: string): Promise<void> => {
    const result = await window.pathfinder.automationLibraryDelete({ id })
    setLibraryItems(result.items)
    await refreshHistory()
  }, [refreshHistory])

  const removeHistoryEntry = useCallback(async (entry: AutomationHistoryEntry): Promise<void> => {
    const result = await window.pathfinder.automationHistoryRemove({ id: entry.id })
    setHistoryEntries(result.entries)
    setRecentAutomationsVersion((current) => current + 1)
  }, [])

  const clearHistoryEntries = useCallback(async (): Promise<void> => {
    const result = await window.pathfinder.automationHistoryClear({ preserveRunning: true })
    setHistoryEntries(result.entries)
    setRecentAutomationsVersion((current) => current + 1)
  }, [])

  const toggleSidebarFromCommand = useCallback(async (): Promise<void> => {
    if (isOverlayMode) {
      setIsOverlayOpen((current) => !current)
      return
    }

    persistSidebarPreferences({ collapsed: !sidebarPreferences.collapsed })
  }, [isOverlayMode, persistSidebarPreferences, sidebarPreferences.collapsed])

  const openSidebarSectionFromCommand = useCallback(
    async (section: AutomationSidebarSection): Promise<void> => {
      if (isOverlayMode) {
        setIsOverlayOpen(true)
      }

      persistSidebarPreferences({
        collapsed: false,
        activeSection: section
      })
    },
    [isOverlayMode, persistSidebarPreferences]
  )

  const openAiConfigFromCommand = useCallback(async (): Promise<void> => {
    await openSidebarSectionFromCommand('ai-chat')
  }, [openSidebarSectionFromCommand])

  const openSettingsFromCommand = useCallback(async (): Promise<void> => {
    await openSettingsPanel()
  }, [openSettingsPanel])

  const summarizeActivePageFromCommand = useCallback(async (): Promise<void> => {
    await openSidebarSectionFromCommand('ai-chat')
    await summarizeActivePage()
  }, [openSidebarSectionFromCommand, summarizeActivePage])

  const askActivePageFromCommand = useCallback(
    async (input: string): Promise<void> => {
      await openSidebarSectionFromCommand('ai-chat')
      const inlineQuestion = input.trim()

      if (!inlineQuestion) {
        await askActivePage()
        return
      }

      setPageAnalysisQuestion(inlineQuestion)
      await askActivePage(inlineQuestion)
    },
    [askActivePage, openSidebarSectionFromCommand]
  )

  const refreshPageContextFromCommand = useCallback(async (): Promise<void> => {
    await openSidebarSectionFromCommand('ai-chat')
    await refreshPageAnalysisContext()
  }, [openSidebarSectionFromCommand, refreshPageAnalysisContext])

  const clearPageContextFromCommand = useCallback(async (): Promise<void> => {
    await openSidebarSectionFromCommand('ai-chat')
    await clearPageAnalysisContext()
  }, [clearPageAnalysisContext, openSidebarSectionFromCommand])

  const validateAiConfigFromCommand = useCallback(async (): Promise<void> => {
    await openSidebarSectionFromCommand('ai-chat')
    await validateLlmConfig()
  }, [openSidebarSectionFromCommand, validateLlmConfig])

  const generateAutomationFromCommand = useCallback(
    async (input: string): Promise<void> => {
      await openSidebarSectionFromCommand('ai-chat')

      const inlinePrompt = input.trim()
      const fallbackPrompt = aiAutomationPrompt.trim()
      const promptToUse = inlinePrompt || fallbackPrompt

      if (!promptToUse) {
        aiAutomationPromptInputRef.current?.focus()
        throw new Error('Provide a prompt inline or in the AI panel before generating.')
      }

      if (inlinePrompt) {
        setAiAutomationPrompt(inlinePrompt)
      }

      await requestAutomationGeneration(promptToUse)
    },
    [
      aiAutomationPrompt,
      openSidebarSectionFromCommand,
      requestAutomationGeneration
    ]
  )

  const cancelAutomationGenerationFromCommand = useCallback(async (): Promise<void> => {
    await openSidebarSectionFromCommand('ai-chat')
    await cancelAutomationGeneration()
  }, [cancelAutomationGeneration, openSidebarSectionFromCommand])

  const startLiveAgentFromCommand = useCallback(
    async (input: string): Promise<void> => {
      await openSidebarSectionFromCommand('ai-chat')
      await startLiveAgentRun(input)
    },
    [openSidebarSectionFromCommand, startLiveAgentRun]
  )

  const pauseLiveAgentFromCommand = useCallback(async (): Promise<void> => {
    await openSidebarSectionFromCommand('ai-chat')
    await pauseLiveAgentRun()
  }, [openSidebarSectionFromCommand, pauseLiveAgentRun])

  const resumeLiveAgentFromCommand = useCallback(async (): Promise<void> => {
    await openSidebarSectionFromCommand('ai-chat')
    await resumeLiveAgentRun()
  }, [openSidebarSectionFromCommand, resumeLiveAgentRun])

  const cancelLiveAgentFromCommand = useCallback(async (): Promise<void> => {
    await openSidebarSectionFromCommand('ai-chat')
    await cancelLiveAgentRun()
  }, [cancelLiveAgentRun, openSidebarSectionFromCommand])

  const runRecentAutomation = useCallback(
    async (preview: { id: string; canRun?: boolean; name: string }): Promise<void> => {
      if (!preview.canRun) {
        return
      }

      const result = await window.pathfinder.automationLibraryRun({
        id: preview.id,
        sourceLabel: 'home',
        ...(activeTabId ? { tabId: activeTabId } : {})
      })

      await handlePlaybackStartResult(result, {
        kind: 'library',
        libraryId: preview.id,
        label: preview.name
      })
    },
    [activeTabId, handlePlaybackStartResult]
  )

  const handleExecuteCommand = async (command: CommandPaletteCommand, query: string): Promise<void> => {
    try {
      await command.run(query)
      setCommandPaletteError('')
      setIsCommandPaletteOpen(false)
    } catch (error) {
      setCommandPaletteError(error instanceof Error ? error.message : 'Command failed. Try again.')
      setIsCommandPaletteOpen(true)
    }
  }

  const commandPaletteCommands = createBrowserCommands({
    createTab: handleCreateTab,
    closeActiveTab: async (tabId: string) => {
      await handleCloseTab(tabId)
    },
    navigateTarget: handleNavigate,
    back: handleBack,
    forward: handleForward,
    reload: handleReload,
    stop: handleStop,
    startRecording: startRecordingFromPalette,
    stopRecording: stopRecordingFromPalette,
    startPlayback: startPlaybackFromPalette,
    cancelPlayback: cancelPlaybackFromPalette,
    toggleSidebar: toggleSidebarFromCommand,
    openSidebarLibrary: async () => openSidebarSectionFromCommand('library'),
    openSidebarHistory: async () => openSidebarSectionFromCommand('history'),
    openSettings: openSettingsFromCommand,
    openAiConfig: openAiConfigFromCommand,
    summarizeActivePage: summarizeActivePageFromCommand,
    askActivePage: askActivePageFromCommand,
    refreshPageAnalysisContext: refreshPageContextFromCommand,
    clearPageAnalysisContext: clearPageContextFromCommand,
    validateAiConfig: validateAiConfigFromCommand,
    generateAutomationFromAi: generateAutomationFromCommand,
    cancelAutomationGeneration: cancelAutomationGenerationFromCommand,
    startLiveAgent: startLiveAgentFromCommand,
    pauseLiveAgent: pauseLiveAgentFromCommand,
    resumeLiveAgent: resumeLiveAgentFromCommand,
    cancelLiveAgent: cancelLiveAgentFromCommand,
    activeTabId
  })

  const shellClassName = useMemo(() => {
    return appearanceSettings.sidebarPosition === 'right'
      ? 'browser-shell browser-shell--tab-strip-right'
      : 'browser-shell'
  }, [appearanceSettings.sidebarPosition])

  useEffect(() => {
    void loadSettingsSnapshot().catch(() => {
      // Keep defaults active when settings snapshot cannot be loaded.
    })
  }, [loadSettingsSnapshot])

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('font-scale-small', 'font-scale-medium', 'font-scale-large')
    root.classList.add(`font-scale-${appearanceSettings.fontScalePreset}`)

    applyTheme(appearanceSettings.themeMode)

    if (appearanceSettings.themeMode !== 'system') {
      return
    }

    return subscribeToSystemThemeChanges(() => {
      applyTheme('system')
    })
  }, [appearanceSettings.fontScalePreset, appearanceSettings.themeMode])

  useEffect(() => {
    const initialRefreshTimer = window.setTimeout(() => {
      void refreshRecorderStatus()
      void refreshPlaybackStatus()
      void refreshHistory()
      void refreshPageAnalysisStatus()
      void refreshAutomationGenerationStatus()
      void refreshLiveAgentStatus()
    }, 0)

    const interval = window.setInterval(() => {
      void refreshRecorderStatus()
      void refreshPlaybackStatus()
      void refreshHistory()
      void refreshPageAnalysisStatus()
      void refreshAutomationGenerationStatus()
      void refreshLiveAgentStatus()
    }, 1000)

    return () => {
      window.clearTimeout(initialRefreshTimer)
      window.clearInterval(interval)
    }
  }, [
    refreshAutomationGenerationStatus,
    refreshHistory,
    refreshLiveAgentStatus,
    refreshPageAnalysisStatus,
    refreshPlaybackStatus,
    refreshRecorderStatus
  ])

  const playbackIndicatorLabel = useMemo(() => {
    if (playbackStatus.state === 'running') {
      return `Playback running (${playbackStatus.source?.path ?? 'workflow'})`
    }

    if (playbackStatus.state === 'failed' && playbackStatus.failure) {
      return `Playback failed at ${playbackStatus.failure.action}#${playbackStatus.failure.seq}`
    }

    if (playbackStatus.state === 'completed') {
      return 'Playback completed'
    }

    if (playbackStatus.state === 'cancelled') {
      return 'Playback cancelled'
    }

    return 'Playback idle'
  }, [playbackStatus])

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) {
        return false
      }

      return (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      )
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!event.ctrlKey || isEditableTarget(event.target)) {
        return
      }

      const key = event.key.toLowerCase()
      const opensWithCtrlShiftS = event.shiftKey && key === 's'
      const opensWithCtrlShiftP = event.shiftKey && key === 'p'
      const opensWithCtrlK = key === 'k'

      if (opensWithCtrlShiftS) {
        event.preventDefault()
        void window.pathfinder.quickSearchToggle()
        return
      }

      if (!opensWithCtrlShiftP && !opensWithCtrlK) {
        return
      }

      event.preventDefault()
      openCommandPalette()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [openCommandPalette])

  return (
    <main className={shellClassName}>
      <section className="browser-chrome">
        <div className="browser-chrome__status-row">
          <span
            className={`playback-indicator playback-indicator--${playbackStatus.state}`}
            aria-live="polite"
          >
            {playbackIndicatorLabel}
          </span>
          <button
            type="button"
            className="settings-launch-button"
            onClick={() => {
              void openSettingsPanel()
            }}
          >
            Settings
          </button>
          <span
            className={`recorder-indicator ${
              recorderStatus.state === 'recording' ? 'recorder-indicator--active' : 'recorder-indicator--idle'
            }`}
            aria-live="polite"
          >
            {recorderStatus.state === 'recording'
              ? `Recording actions (${recorderStatus.tabId ?? 'active tab'})`
              : 'Recorder idle'}
          </span>
        </div>
        <BrowserTabStrip
          tabs={tabs}
          activeTabId={activeTabId}
          onCreateTab={handleCreateTab}
          onActivateTab={handleActivateTab}
          onCloseTab={handleCloseTab}
        />

        <NavigationBar
          activeTab={activeTab}
          onBack={handleBack}
          onForward={handleForward}
          onReload={handleReload}
          onStop={handleStop}
          onNavigate={handleNavigate}
        />
      </section>

      <section className="browser-workspace">
        <AutomationSidebar
          preferences={sidebarPreferences}
          overlayMode={isOverlayMode}
          overlayOpen={isOverlayOpen}
          badges={sidebarBadges}
          onOverlayToggle={() => setIsOverlayOpen((current) => !current)}
          onOverlayClose={() => setIsOverlayOpen(false)}
          onToggleCollapse={() => {
            persistSidebarPreferences({ collapsed: !sidebarPreferences.collapsed })
          }}
          onSetActiveSection={(section) => {
            persistSidebarPreferences({ activeSection: section })
          }}
          onResizeWidth={(nextWidth) => {
            const clampedWidth = Math.min(520, Math.max(280, Math.floor(nextWidth)))
            persistSidebarPreferences({ width: clampedWidth })
          }}
          libraryContent={
            <AutomationSidebarLibrary
              items={libraryItems}
              query={libraryQuery}
              tagFilter={libraryTagFilter}
              scrollTop={libraryScrollTop}
              onQueryChange={(value) => {
                setLibraryQuery(value)
                persistSidebarPreferences({
                  sectionState: {
                    library: {
                      query: value,
                      tags: libraryTagFilter,
                      scrollTop: libraryScrollTop
                    }
                  }
                })
              }}
              onTagFilterChange={(tags) => {
                setLibraryTagFilter(tags)
                persistSidebarPreferences({
                  sectionState: {
                    library: {
                      query: libraryQuery,
                      tags,
                      scrollTop: libraryScrollTop
                    }
                  }
                })
              }}
              onScrollChange={(nextScrollTop) => {
                setLibraryScrollTop(nextScrollTop)
                persistSidebarPreferences({
                  sectionState: {
                    library: {
                      query: libraryQuery,
                      tags: libraryTagFilter,
                      scrollTop: nextScrollTop
                    }
                  }
                })
              }}
              onUpsert={async (request) => {
                await upsertLibraryItem(request)
                await refreshLibrary()
              }}
              onDelete={async (id) => {
                await removeLibraryItem(id)
                await refreshLibrary()
              }}
              onRun={runLibraryItem}
            />
          }
          historyContent={
            <AutomationSidebarHistory
              entries={historyEntries}
              query={historyQuery}
              status={historyStatusFilter}
              scrollTop={historyScrollTop}
              onQueryChange={(value) => {
                setHistoryQuery(value)
                persistSidebarPreferences({
                  sectionState: {
                    history: {
                      query: value,
                      status: historyStatusFilter,
                      scrollTop: historyScrollTop
                    }
                  }
                })
              }}
              onStatusChange={(value) => {
                setHistoryStatusFilter(value)
                persistSidebarPreferences({
                  sectionState: {
                    history: {
                      query: historyQuery,
                      status: value,
                      scrollTop: historyScrollTop
                    }
                  }
                })
              }}
              onScrollChange={(nextScrollTop) => {
                setHistoryScrollTop(nextScrollTop)
                persistSidebarPreferences({
                  sectionState: {
                    history: {
                      query: historyQuery,
                      status: historyStatusFilter,
                      scrollTop: nextScrollTop
                    }
                  }
                })
              }}
              onRerun={rerunHistoryEntry}
              onRemove={removeHistoryEntry}
              onClear={clearHistoryEntries}
            />
          }
          aiContent={
            <section className="automation-sidebar-ai-panel" aria-label="AI assistant">
              <article className="automation-sidebar-ai-analysis">
                <section className="automation-sidebar-live-agent" aria-label="Live Agent mode">
                  <header className="automation-sidebar-live-agent__header">
                    <h3>Live Agent Mode</h3>
                    <p>
                      High-impact actions require explicit approval for each batch before execution.
                    </p>
                  </header>

                  <label className="automation-sidebar-live-agent__field">
                    <span>Run Prompt</span>
                    <input
                      ref={liveAgentPromptInputRef}
                      type="text"
                      value={liveAgentPrompt}
                      onChange={(event) => setLiveAgentPrompt(event.target.value)}
                      placeholder="Review checkout flow and propose safe fixes"
                    />
                  </label>

                  <div className="automation-sidebar-live-agent__controls">
                    <label className="automation-sidebar-live-agent__field automation-sidebar-live-agent__field--batch">
                      <span>Approval Batch Size</span>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={liveAgentBatchSize}
                        onChange={(event) => {
                          const next = Number(event.target.value)
                          if (!Number.isFinite(next)) {
                            return
                          }

                          setLiveAgentBatchSize(Math.min(10, Math.max(1, Math.floor(next))))
                        }}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        void startLiveAgentRun()
                      }}
                      disabled={!liveAgentCanStart}
                    >
                      {liveAgentBusyState === 'starting' ? 'Starting...' : 'Start Live Agent'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void pauseLiveAgentRun()
                      }}
                      disabled={!liveAgentCanPause}
                    >
                      {liveAgentBusyState === 'pausing' ? 'Pausing...' : 'Pause'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void resumeLiveAgentRun()
                      }}
                      disabled={!liveAgentCanResume}
                    >
                      {liveAgentBusyState === 'resuming' ? 'Resuming...' : 'Resume'}
                    </button>
                    <button
                      type="button"
                      className="is-danger"
                      onClick={() => {
                        void cancelLiveAgentRun()
                      }}
                      disabled={!liveAgentCanCancel}
                    >
                      {liveAgentBusyState === 'cancelling' ? 'Cancelling...' : 'Cancel'}
                    </button>
                  </div>

                  <div
                    className={`automation-sidebar-live-agent__status automation-sidebar-live-agent__status--${liveAgentStatus.state}`}
                  >
                    <span className="automation-sidebar-live-agent__status-label">
                      State: {formatLiveAgentState(liveAgentStatus.state)}
                    </span>
                    <p>{liveAgentStatusMessage}</p>
                    <p className="automation-sidebar-live-agent__meta">
                      Run: {liveAgentStatus.runId ?? 'none'}
                      {' · '}
                      Steps: {liveAgentStatus.completedSteps}/{liveAgentStatus.totalSteps}
                    </p>
                  </div>

                  {liveAgentStatus.error ? (
                    <div className="automation-sidebar-live-agent__error">
                      <p>{liveAgentStatus.error.message}</p>
                    </div>
                  ) : null}

                  {liveAgentApprovalBatch ? (
                    <section
                      className="automation-sidebar-live-agent__approval-card"
                      aria-label="Live Agent approval batch"
                    >
                      <header className="automation-sidebar-live-agent__approval-header">
                        <h4>Approval Required</h4>
                        <p>
                          Batch {liveAgentApprovalBatch.batchId.slice(0, 8)} · {liveAgentApprovalBatch.size} step
                          {liveAgentApprovalBatch.size > 1 ? 's' : ''}
                        </p>
                      </header>

                      <ol className="automation-sidebar-live-agent__approval-steps">
                        {liveAgentApprovalBatch.steps.map((step) => (
                          <li key={step.id} className="automation-sidebar-live-agent__approval-step">
                            <div className="automation-sidebar-live-agent__approval-step-header">
                              <strong>Step {step.seq}</strong>
                              <span
                                className={`automation-sidebar-live-agent__risk-chip automation-sidebar-live-agent__risk-chip--${step.riskTier}`}
                              >
                                {step.riskTier}
                              </span>
                            </div>
                            <p>
                              <strong>Action:</strong> {step.action}
                              {step.target ? ` -> ${step.target}` : ''}
                            </p>
                            <p>
                              <strong>Expected:</strong> {step.expectedSideEffect}
                            </p>
                            <p>
                              <strong>Rationale:</strong> {step.rationale}
                            </p>
                          </li>
                        ))}
                      </ol>

                      <div className="automation-sidebar-live-agent__approval-actions">
                        <button
                          type="button"
                          onClick={() => {
                            void approveLiveAgentBatch('approve')
                          }}
                          disabled={!liveAgentCanApprove}
                        >
                          {liveAgentBusyState === 'approving' ? 'Submitting...' : 'Approve Batch'}
                        </button>
                        <button
                          type="button"
                          className="is-danger"
                          onClick={() => {
                            void approveLiveAgentBatch('reject')
                          }}
                          disabled={!liveAgentCanApprove}
                        >
                          Reject Batch
                        </button>
                      </div>
                    </section>
                  ) : null}

                  <section className="automation-sidebar-live-agent__timeline" aria-label="Live Agent timeline">
                    <header className="automation-sidebar-live-agent__timeline-header">
                      <h4>Step Timeline</h4>
                      <p>{liveAgentAuditTrail.length} events</p>
                    </header>

                    {liveAgentAuditTrail.length === 0 ? (
                      <p className="automation-sidebar-live-agent__timeline-empty">
                        No timeline events yet. Start a run to capture step-level decisions.
                      </p>
                    ) : (
                      <ol className="automation-sidebar-live-agent__timeline-list">
                        {liveAgentAuditTrail.map((event) => {
                          const isExpanded = liveAgentExpandedAuditIds.includes(event.id)
                          const shouldShowToggle =
                            event.observedResult.length > LIVE_AGENT_FIELD_TRUNCATION_LIMIT ||
                            event.nextStepRationale.length > LIVE_AGENT_FIELD_TRUNCATION_LIMIT

                          return (
                            <li key={event.id} className="automation-sidebar-live-agent__timeline-item">
                              <div className="automation-sidebar-live-agent__timeline-item-header">
                                <strong>Step {event.stepIndex}</strong>
                                <span
                                  className={`automation-sidebar-live-agent__risk-chip automation-sidebar-live-agent__risk-chip--${event.riskTier}`}
                                >
                                  {event.riskTier}
                                </span>
                                <span
                                  className={`automation-sidebar-live-agent__decision-chip automation-sidebar-live-agent__decision-chip--${event.approvalDecision}`}
                                >
                                  {event.approvalDecision}
                                </span>
                              </div>
                              <p>
                                <strong>Action:</strong> {event.actionSummary}
                              </p>
                              <p>
                                <strong>Observed:</strong>{' '}
                                {isExpanded
                                  ? event.observedResult
                                  : truncateLiveAgentField(event.observedResult)}
                              </p>
                              <p>
                                <strong>Next Rationale:</strong>{' '}
                                {isExpanded
                                  ? event.nextStepRationale
                                  : truncateLiveAgentField(event.nextStepRationale)}
                              </p>
                              <p className="automation-sidebar-live-agent__timeline-meta">
                                {new Date(event.createdAt).toLocaleTimeString()}
                              </p>
                              {shouldShowToggle ? (
                                <button
                                  type="button"
                                  className="automation-sidebar-live-agent__expand-toggle"
                                  onClick={() => toggleLiveAgentAuditExpansion(event.id)}
                                >
                                  {isExpanded ? 'Collapse' : 'Expand'}
                                </button>
                              ) : null}
                            </li>
                          )
                        })}
                      </ol>
                    )}
                  </section>
                </section>

                <section className="automation-sidebar-ai-generation" aria-label="AI automation generation">
                  <header className="automation-sidebar-ai-generation__header">
                    <h3>Automation Generation</h3>
                    <p>Generate one workflow draft, review it, then explicitly approve save or run.</p>
                  </header>

                  <label className="automation-sidebar-ai-generation__field">
                    <span>Prompt</span>
                    <input
                      ref={aiAutomationPromptInputRef}
                      type="text"
                      value={aiAutomationPrompt}
                      onChange={(event) => setAiAutomationPrompt(event.target.value)}
                      placeholder="Create a login workflow for this site"
                    />
                  </label>

                  <div className="automation-sidebar-ai-generation__constraints">
                    <label className="automation-sidebar-ai-generation__field">
                      <span>Target URL (optional)</span>
                      <input
                        type="text"
                        value={aiAutomationConstraints.targetUrl}
                        onChange={(event) =>
                          setAiAutomationConstraints((current) => ({
                            ...current,
                            targetUrl: event.target.value
                          }))
                        }
                        placeholder="https://example.com/login"
                      />
                    </label>
                    <label className="automation-sidebar-ai-generation__field">
                      <span>Objective (optional)</span>
                      <input
                        type="text"
                        value={aiAutomationConstraints.objective}
                        onChange={(event) =>
                          setAiAutomationConstraints((current) => ({
                            ...current,
                            objective: event.target.value
                          }))
                        }
                        placeholder="Log in and open dashboard"
                      />
                    </label>
                    <label className="automation-sidebar-ai-generation__field">
                      <span>Variables (optional)</span>
                      <input
                        type="text"
                        value={aiAutomationConstraints.variables}
                        onChange={(event) =>
                          setAiAutomationConstraints((current) => ({
                            ...current,
                            variables: event.target.value
                          }))
                        }
                        placeholder="username, password:Account password"
                      />
                    </label>
                    <label className="automation-sidebar-ai-generation__field">
                      <span>Notes (optional)</span>
                      <input
                        type="text"
                        value={aiAutomationConstraints.notes}
                        onChange={(event) =>
                          setAiAutomationConstraints((current) => ({
                            ...current,
                            notes: event.target.value
                          }))
                        }
                        placeholder="Use stable selectors when possible"
                      />
                    </label>
                  </div>

                  <div className="automation-sidebar-ai-generation__actions">
                    <button
                      type="button"
                      onClick={() => {
                        void requestAutomationGeneration()
                      }}
                      disabled={aiAutomationBusyState !== 'idle'}
                    >
                      {aiAutomationBusyState === 'generating' ? 'Generating...' : 'Generate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void cancelAutomationGeneration()
                      }}
                      disabled={
                        aiAutomationBusyState !== 'idle' ||
                        (aiAutomationState !== 'generating' && aiAutomationState !== 'validating')
                      }
                    >
                      {aiAutomationBusyState === 'cancelling' ? 'Cancelling...' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAiAutomationState('idle')
                        setAiAutomationError('')
                        setAiAutomationStatusMessage('Ready to generate a new draft.')
                      }}
                      disabled={aiAutomationBusyState !== 'idle'}
                    >
                      Reset
                    </button>
                  </div>

                  <div
                    className={`automation-sidebar-ai-generation__status automation-sidebar-ai-generation__status--${aiAutomationState}`}
                  >
                    <span className="automation-sidebar-ai-generation__status-label">
                      State: {aiAutomationState}
                    </span>
                    <p>{aiAutomationStatusMessage}</p>
                    {aiAutomationOperationId ? (
                      <p className="automation-sidebar-ai-generation__meta">Operation: {aiAutomationOperationId}</p>
                    ) : null}
                  </div>

                  {aiAutomationError ? (
                    <div className="automation-sidebar-ai-generation__error">
                      <p>{aiAutomationError}</p>
                    </div>
                  ) : null}

                  {aiAutomationWarnings.length > 0 ? (
                    <div className="automation-sidebar-ai-generation__warnings">
                      <h4>Validation Warnings</h4>
                      <ul>
                        {aiAutomationWarnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {aiAutomationValidationErrors.length > 0 ? (
                    <div className="automation-sidebar-ai-generation__validation-errors">
                      <h4>Approval Blocked</h4>
                      <ul>
                        {aiAutomationValidationErrors.map((error) => (
                          <li key={error}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {aiAutomationDraft ? (
                    <section className="automation-sidebar-ai-generation__preview" aria-label="Generated draft preview">
                      <div className="automation-sidebar-ai-generation__preview-header">
                        <h4>Draft Preview</h4>
                        <button
                          type="button"
                          onClick={() => {
                            setAiAutomationShowJson((current) => {
                              const next = !current
                              if (next) {
                                setAiAutomationJsonDraft(JSON.stringify(aiAutomationDraft, null, 2))
                              }
                              return next
                            })
                          }}
                        >
                          {aiAutomationShowJson ? 'Show Step Editor' : 'Show JSON'}
                        </button>
                      </div>

                      <label className="automation-sidebar-ai-generation__field">
                        <span>Workflow Name</span>
                        <input
                          type="text"
                          value={aiAutomationDraft.name}
                          onChange={(event) => {
                            const next = {
                              ...aiAutomationDraft,
                              name: event.target.value,
                              updatedAt: new Date().toISOString()
                            }
                            setAiAutomationDraft(next)
                            setAiAutomationJsonDraft(JSON.stringify(next, null, 2))
                          }}
                        />
                      </label>

                      <label className="automation-sidebar-ai-generation__field">
                        <span>Description</span>
                        <input
                          type="text"
                          value={aiAutomationDraft.description ?? ''}
                          onChange={(event) => {
                            const next = {
                              ...aiAutomationDraft,
                              description: event.target.value,
                              updatedAt: new Date().toISOString()
                            }
                            setAiAutomationDraft(next)
                            setAiAutomationJsonDraft(JSON.stringify(next, null, 2))
                          }}
                          placeholder="Optional workflow description"
                        />
                      </label>

                      {aiAutomationShowJson ? (
                        <div className="automation-sidebar-ai-generation__json-editor">
                          <textarea
                            value={aiAutomationJsonDraft}
                            onChange={(event) => setAiAutomationJsonDraft(event.target.value)}
                            rows={12}
                          />
                          {aiAutomationJsonError ? <p>{aiAutomationJsonError}</p> : null}
                          <button
                            type="button"
                            onClick={applyDraftJson}
                            disabled={aiAutomationBusyState !== 'idle'}
                          >
                            Apply JSON
                          </button>
                        </div>
                      ) : (
                        <ol className="automation-sidebar-ai-generation__steps">
                          {aiAutomationDraft.steps.map((step, index) => (
                            <li key={step.id} className="automation-sidebar-ai-generation__step">
                              <div className="automation-sidebar-ai-generation__step-header">
                                <strong>Step {step.seq}</strong>
                                <span>{step.action}</span>
                              </div>

                              {step.action === 'navigate' ? (
                                <label className="automation-sidebar-ai-generation__field">
                                  <span>URL</span>
                                  <input
                                    type="text"
                                    value={step.url}
                                    onChange={(event) => {
                                      updateDraftStep(index, (current) => ({
                                        ...current,
                                        action: 'navigate',
                                        url: event.target.value
                                      }))
                                    }}
                                  />
                                </label>
                              ) : null}

                              {step.action === 'click' ? (
                                <label className="automation-sidebar-ai-generation__field">
                                  <span>Selector</span>
                                  <input
                                    type="text"
                                    value={step.selector}
                                    onChange={(event) => {
                                      updateDraftStep(index, (current) => ({
                                        ...current,
                                        action: 'click',
                                        selector: event.target.value
                                      }))
                                    }}
                                  />
                                </label>
                              ) : null}

                              {step.action === 'type' ? (
                                <>
                                  <label className="automation-sidebar-ai-generation__field">
                                    <span>Selector</span>
                                    <input
                                      type="text"
                                      value={step.selector}
                                      onChange={(event) => {
                                        updateDraftStep(index, (current) => ({
                                          ...current,
                                          action: 'type',
                                          selector: event.target.value,
                                          value: current.action === 'type' ? current.value : ''
                                        }))
                                      }}
                                    />
                                  </label>
                                  <label className="automation-sidebar-ai-generation__field">
                                    <span>Value</span>
                                    <input
                                      type="text"
                                      value={toDraftInputValueString(step.value)}
                                      onChange={(event) => {
                                        updateDraftStep(index, (current) => ({
                                          ...current,
                                          action: 'type',
                                          selector:
                                            current.action === 'type' ? current.selector : '',
                                          value: toDraftInputValue(event.target.value)
                                        }))
                                      }}
                                    />
                                  </label>
                                </>
                              ) : null}

                              {step.action === 'wait' ? (
                                <>
                                  <label className="automation-sidebar-ai-generation__field">
                                    <span>Wait For</span>
                                    <select
                                      value={step.waitFor}
                                      onChange={(event) => {
                                        const waitFor = event.target.value as 'navigation' | 'selector'
                                        updateDraftStep(index, (current) => {
                                          const baseWaitStep = {
                                            id: current.id,
                                            seq: current.seq,
                                            action: 'wait' as const,
                                            waitFor,
                                            ...(current.action === 'wait' && typeof current.timeoutMs === 'number'
                                              ? { timeoutMs: current.timeoutMs }
                                              : {})
                                          }

                                          if (waitFor === 'selector') {
                                            return {
                                              ...baseWaitStep,
                                              selector: current.action === 'wait' ? current.selector ?? '' : ''
                                            }
                                          }

                                          return baseWaitStep
                                        })
                                      }}
                                    >
                                      <option value="navigation">navigation</option>
                                      <option value="selector">selector</option>
                                    </select>
                                  </label>
                                  {step.waitFor === 'selector' ? (
                                    <label className="automation-sidebar-ai-generation__field">
                                      <span>Selector</span>
                                      <input
                                        type="text"
                                        value={step.selector ?? ''}
                                        onChange={(event) => {
                                          updateDraftStep(index, (current) => ({
                                            ...current,
                                            action: 'wait',
                                            waitFor: 'selector',
                                            selector: event.target.value
                                          }))
                                        }}
                                      />
                                    </label>
                                  ) : null}
                                  <label className="automation-sidebar-ai-generation__field">
                                    <span>Timeout (ms)</span>
                                    <input
                                      type="number"
                                      min={1}
                                      value={step.timeoutMs ?? ''}
                                      onChange={(event) => {
                                        updateDraftStep(index, (current) => {
                                          const waitFor =
                                            current.action === 'wait' ? current.waitFor : 'navigation'
                                          const base = {
                                            id: current.id,
                                            seq: current.seq,
                                            action: 'wait' as const,
                                            waitFor,
                                            ...(event.target.value
                                              ? { timeoutMs: Number(event.target.value) }
                                              : {})
                                          }

                                          if (waitFor === 'selector') {
                                            return {
                                              ...base,
                                              selector: current.action === 'wait' ? current.selector ?? '' : ''
                                            }
                                          }

                                          return base
                                        })
                                      }}
                                    />
                                  </label>
                                </>
                              ) : null}
                            </li>
                          ))}
                        </ol>
                      )}

                      <div className="automation-sidebar-ai-generation__approval-actions">
                        <button
                          type="button"
                          className="automation-sidebar-ai-generation__approval-button--draft"
                          onClick={() => {
                            void saveGeneratedDraft(false)
                          }}
                          disabled={aiAutomationBusyState !== 'idle'}
                        >
                          {aiAutomationBusyState === 'saving' ? 'Saving...' : 'Save Draft'}
                        </button>
                        <button
                          type="button"
                          className="automation-sidebar-ai-generation__approval-button--run"
                          onClick={() => {
                            void saveGeneratedDraft(true)
                          }}
                          disabled={aiAutomationBusyState !== 'idle'}
                        >
                          {aiAutomationBusyState === 'save-and-run' ? 'Saving and Running...' : 'Save and Run'}
                        </button>
                        <button
                          type="button"
                          className="is-danger"
                          onClick={discardGeneratedDraft}
                          disabled={aiAutomationBusyState !== 'idle'}
                        >
                          Discard
                        </button>
                      </div>
                    </section>
                  ) : null}
                </section>

                <header className="automation-sidebar-ai-analysis__header">
                  <h3>Page Analysis</h3>
                  <p>Summarize or ask about the active tab with grounded citations.</p>
                </header>

                <div className="automation-sidebar-ai-analysis__quick-actions">
                  <button
                    type="button"
                    onClick={() => {
                      void summarizeActivePage()
                    }}
                    disabled={pageAnalysisBusyState !== 'idle'}
                  >
                    {pageAnalysisBusyState === 'summarize' ? 'Summarizing...' : 'Summarize'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void askActivePage()
                    }}
                    disabled={pageAnalysisBusyState !== 'idle'}
                  >
                    {pageAnalysisBusyState === 'ask' ? 'Asking...' : 'Ask'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void cancelPageAnalysis()
                    }}
                    disabled={pageAnalysisStatus.state !== 'running' && pageAnalysisStatus.state !== 'cancelling'}
                  >
                    {pageAnalysisStatus.state === 'cancelling' ? 'Cancelling...' : 'Cancel'}
                  </button>
                </div>

                <label className="automation-sidebar-ai-analysis__question">
                  <span>Ask About This Page</span>
                  <input
                    ref={pageAnalysisQuestionInputRef}
                    type="text"
                    value={pageAnalysisQuestion}
                    onChange={(event) => setPageAnalysisQuestion(event.target.value)}
                    placeholder="What are the key risks on this page?"
                  />
                </label>

                <div className="automation-sidebar-ai-analysis__verbosity">
                  <span>Verbosity</span>
                  <div className="automation-sidebar-ai-analysis__verbosity-buttons">
                    <button
                      type="button"
                      className={pageAnalysisVerbosity === 'concise' ? 'is-active' : ''}
                      onClick={() => setPageAnalysisVerbosity('concise')}
                    >
                      Concise
                    </button>
                    <button
                      type="button"
                      className={pageAnalysisVerbosity === 'detailed' ? 'is-active' : ''}
                      onClick={() => setPageAnalysisVerbosity('detailed')}
                    >
                      Detailed
                    </button>
                  </div>
                </div>

                <div className="automation-sidebar-ai-analysis__actions">
                  <button
                    type="button"
                    onClick={() => {
                      void refreshPageAnalysisContext()
                    }}
                    disabled={pageAnalysisBusyState !== 'idle'}
                  >
                    {pageAnalysisBusyState === 'refresh' ? 'Refreshing...' : 'Refresh Context'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void clearPageAnalysisContext()
                    }}
                    disabled={pageAnalysisBusyState !== 'idle'}
                  >
                    {pageAnalysisBusyState === 'clear' ? 'Clearing...' : 'Clear Context'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void retryPageAnalysis()
                    }}
                    disabled={pageAnalysisBusyState !== 'idle' || !pageAnalysisLastRequest}
                  >
                    Retry
                  </button>
                </div>

                <p
                  className={`automation-sidebar-ai-status automation-sidebar-ai-status--${pageAnalysisStatusTone}`}
                >
                  {pageAnalysisStatusMessage}
                </p>

                {activePageAnalysisSnapshot ? (
                  <p className="automation-sidebar-ai-meta">
                    Snapshot: {activePageAnalysisSnapshot.title || 'Untitled page'}
                    {' · '}
                    {new Date(activePageAnalysisSnapshot.extractedAt).toLocaleTimeString()}
                    {' · '}
                    TTL {Math.floor(activePageAnalysisSnapshot.ttlMs / 1000)}s
                  </p>
                ) : null}

                {activePageAnalysisStale ? (
                  <div className="automation-sidebar-ai-stale-warning">
                    <p>Current snapshot may be stale. Refresh context before follow-up questions.</p>
                    <button
                      type="button"
                      onClick={() => {
                        void refreshPageAnalysisContext()
                      }}
                      disabled={pageAnalysisBusyState !== 'idle'}
                    >
                      Re-extract Context
                    </button>
                  </div>
                ) : null}

                {activePageAnalysisResult ? (
                  <article className="automation-sidebar-ai-result" aria-live="polite">
                    <header className="automation-sidebar-ai-result__header">
                      <h4>
                        {activePageAnalysisResult.mode === 'summarize' ? 'Summary' : 'Answer'}
                      </h4>
                      <span
                        className={`automation-sidebar-ai-confidence automation-sidebar-ai-confidence--${activePageAnalysisResult.confidence}`}
                      >
                        Confidence: {activePageAnalysisResult.confidence}
                      </span>
                    </header>

                    <p className="automation-sidebar-ai-answer">{activePageAnalysisResult.answer}</p>

                    {activePageAnalysisResult.sections.length > 0 ? (
                      <div className="automation-sidebar-ai-sections">
                        {activePageAnalysisResult.sections.map((section) => (
                          <section key={section.title} className="automation-sidebar-ai-section">
                            <h5>{section.title}</h5>
                            <ul>
                              {section.bullets.map((bullet, index) => (
                                <li key={`${section.title}-${index}`}>{bullet}</li>
                              ))}
                            </ul>
                          </section>
                        ))}
                      </div>
                    ) : null}

                    {activePageAnalysisResult.error ? (
                      <div className="automation-sidebar-ai-error-panel">
                        <p>{activePageAnalysisResult.error.message}</p>
                        {activePageAnalysisResult.error.userAction !== 'none' ? (
                          <button
                            type="button"
                            onClick={() => {
                              void handlePageAnalysisUserAction(activePageAnalysisResult.error?.userAction ?? 'none')
                            }}
                          >
                            {getPageAnalysisUserActionLabel(activePageAnalysisResult.error.userAction)}
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    {activePageAnalysisResult.citations.length > 0 ? (
                      <ul className="automation-sidebar-ai-citations">
                        {activePageAnalysisResult.citations.map((citation) => (
                          <li key={citation.id} className="automation-sidebar-ai-citation-card">
                            <p className="automation-sidebar-ai-citation-card__snippet">
                              <span className="automation-sidebar-ai-citation-marker">[{citation.marker}]</span>
                              {citation.snippet}
                            </p>
                            <p className="automation-sidebar-ai-citation-card__meta">
                              <strong>{citation.source.title || 'Source'}</strong>
                              {' · index '}
                              {citation.snippetIndex + 1}
                              {' · '}
                              {new Date(citation.extractedAt).toLocaleTimeString()}
                            </p>
                            <p className="automation-sidebar-ai-citation-card__meta automation-sidebar-ai-citation-card__url">
                              {citation.source.url}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                ) : null}
              </article>

              <section className="automation-sidebar-ai-config" aria-label="AI provider configuration">
                <header className="automation-sidebar-library__header">
                  <div className="automation-sidebar-library__actions">
                    <button
                      type="button"
                      onClick={() => {
                        void saveLlmConfig()
                      }}
                      disabled={aiBusyState !== 'idle'}
                    >
                      {aiBusyState === 'saving' ? 'Saving...' : 'Save Settings'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void validateLlmConfig()
                      }}
                      disabled={aiBusyState !== 'idle'}
                    >
                      {aiBusyState === 'validating' ? 'Validating...' : 'Validate Connection'}
                    </button>
                  </div>
                </header>

                <div className="automation-sidebar-library__filters">
                  <label>
                    <span>Provider</span>
                    <select
                      value={aiProvider}
                      onChange={(event) => {
                        const provider = event.target.value as LLMProviderId
                        setAiProvider(provider)
                        void window.pathfinder
                          .llmSaveConfig({
                            provider,
                            secret: { mode: 'unchanged' }
                          })
                          .then((state) => {
                            syncAiDraftFromState(state)
                            setAiStatusTone('neutral')
                            setAiStatusMessage(
                              state.secretPresent
                                ? `Loaded ${state.config.provider} settings.`
                                : `Loaded ${state.config.provider} settings. No secret configured.`
                            )
                          })
                          .catch(() => {
                            setAiStatusTone('error')
                            setAiStatusMessage('Unable to switch provider settings.')
                          })
                      }}
                    >
                      <option value="openai">OpenAI (cloud)</option>
                      <option value="ollama">Ollama (local)</option>
                    </select>
                  </label>
                  <label>
                    <span>Model</span>
                    <input
                      type="text"
                      value={aiModel}
                      onChange={(event) => setAiModel(event.target.value)}
                      placeholder="gpt-4o-mini or llama3.2"
                    />
                  </label>
                  <label>
                    <span>Endpoint/Base URL (optional)</span>
                    <input
                      type="text"
                      value={aiEndpoint}
                      onChange={(event) => setAiEndpoint(event.target.value)}
                      placeholder="http://127.0.0.1:11434"
                    />
                  </label>
                  <label>
                    <span>{aiProvider === 'openai' ? 'API Key' : 'Access Token (optional)'}</span>
                    <input
                      type="password"
                      value={aiSecretDraft}
                      onChange={(event) => setAiSecretDraft(event.target.value)}
                      placeholder={
                        aiProvider === 'openai'
                          ? 'sk-...'
                          : 'Optional bearer token for protected endpoint'
                      }
                      autoComplete="new-password"
                    />
                  </label>
                </div>

                <article className="automation-sidebar-empty-card automation-sidebar-ai-placeholder">
                  <h3>AI Adapter Status</h3>
                  <p>{aiStatusMessage}</p>
                  <p>
                    Selected provider: <strong>{llmConfigState?.config.provider ?? aiProvider}</strong>
                    {' · '}
                    Secret configured: <strong>{llmConfigState?.secretPresent ? 'Yes' : 'No'}</strong>
                  </p>
                </article>
              </section>
            </section>
          }
        />

        <section className="browser-viewport" aria-label="Active tab viewport">
          {shouldRenderHomeStarter ? (
            <HomeStarterPage
              activeTabId={activeTabId}
              draftQueryValue={homeDraftQuery}
              onDraftQueryChange={handleHomeDraftQueryChange}
              onNavigate={handleNavigate}
              recentRefreshToken={recentAutomationsVersion}
              onRunRecentAutomation={runRecentAutomation}
            />
          ) : null}
        </section>

        <SettingsPanel
          key={settingsSnapshot?.updatedAt ?? 'settings-panel-empty'}
          isOpen={isSettingsOpen}
          snapshot={settingsSnapshot}
          loading={settingsBusyState === 'loading'}
          busyState={settingsBusyState === 'loading' ? 'idle' : settingsBusyState}
          statusMessage={settingsStatusMessage}
          statusTone={settingsStatusTone}
          validationErrors={settingsValidationErrors}
          clearDataResults={settingsClearDataResults}
          onRequestClose={closeSettingsPanel}
          onSaveGeneral={saveGeneralSettings}
          onSaveAppearance={saveAppearanceSettings}
          onSavePrivacy={savePrivacySettings}
          onClearData={clearSettingsDataBuckets}
        />
      </section>
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        commands={commandPaletteCommands}
        query={commandPaletteQuery}
        onQueryChange={setCommandPaletteQuery}
        onRequestClose={closeCommandPalette}
        onExecute={handleExecuteCommand}
        errorMessage={commandPaletteError}
      />
      <AutomationPlaybackPrompt
        isOpen={playbackPromptVariables.length > 0 && Boolean(pendingPlaybackRequest)}
        sourcePath={pendingPlaybackRequest?.label ?? null}
        variables={playbackPromptVariables}
        onSubmit={async (values) => {
          await submitPlaybackVariables(values)
        }}
        onCancel={cancelPlaybackPrompt}
      />
      <DownloadShelf downloads={downloads} />
    </main>
  )
}

export default App

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
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
  type LLMAdapterConfigState,
  type PageAnalysisFailure,
  type PageAnalysisMode,
  type PageAnalysisResult,
  type PageAnalysisStatusResult,
  type PageAnalysisVerbosity,
  type LLMProviderId,
  HOME_STARTER_URL,
  type RecorderStartRequest,
  type RecorderStatus,
  type BrowserTabState,
  type DownloadState
} from '../shared/browser'
import AutomationSidebar from './components/AutomationSidebar'
import AutomationSidebarHistory from './components/AutomationSidebarHistory'
import AutomationSidebarLibrary from './components/AutomationSidebarLibrary'
import BrowserTabStrip from './components/BrowserTabStrip'
import AutomationPlaybackPrompt from './components/AutomationPlaybackPrompt'
import CommandPalette from './components/CommandPalette'
import DownloadShelf from './components/DownloadShelf'
import HomeStarterPage from './components/HomeStarterPage'
import { createBrowserCommands, type CommandPaletteCommand } from './lib/commandPalette'
import NavigationBar from './components/NavigationBar'
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

const DEFAULT_PAGE_ANALYSIS_VERBOSITY: PageAnalysisVerbosity = 'concise'

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
  const pageAnalysisQuestionInputRef = useRef<HTMLInputElement | null>(null)

  const activeTab = useMemo(() => {
    return tabs.find((tab) => tab.id === activeTabId) ?? null
  }, [activeTabId, tabs])

  const isHomeTab = activeTab?.url === HOME_STARTER_URL

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

  const sidebarBadges = useMemo(() => {
    const runningCount = historyEntries.filter((entry) => entry.status === 'running').length
    const failedCount = historyEntries.filter((entry) => entry.status === 'failed').length

    return {
      library: libraryItems.length,
      history: runningCount + failedCount,
      'ai-chat': aiStatusTone === 'error' || pageAnalysisStatusTone === 'error' ? 1 : 0
    } satisfies Partial<Record<AutomationSidebarSection, number>>
  }, [aiStatusTone, historyEntries, libraryItems.length, pageAnalysisStatusTone])

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
        setTabs([])
        setActiveTabId(null)
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
      const next = { ...current }

      for (const [tabId, entry] of Object.entries(current)) {
        const currentUrl = tabUrlById.get(tabId)
        const snapshotUrl = entry.result.snapshot?.url

        if (!currentUrl || (snapshotUrl && snapshotUrl !== currentUrl)) {
          delete next[tabId]
          changed = true
        }
      }

      return changed ? next : current
    })
  }, [tabs])

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
    openAiConfig: openAiConfigFromCommand,
    summarizeActivePage: summarizeActivePageFromCommand,
    askActivePage: askActivePageFromCommand,
    refreshPageAnalysisContext: refreshPageContextFromCommand,
    clearPageAnalysisContext: clearPageContextFromCommand,
    validateAiConfig: validateAiConfigFromCommand,
    activeTabId
  })

  useEffect(() => {
    const initialRefreshTimer = window.setTimeout(() => {
      void refreshRecorderStatus()
      void refreshPlaybackStatus()
      void refreshHistory()
      void refreshPageAnalysisStatus()
    }, 0)

    const interval = window.setInterval(() => {
      void refreshRecorderStatus()
      void refreshPlaybackStatus()
      void refreshHistory()
      void refreshPageAnalysisStatus()
    }, 1000)

    return () => {
      window.clearTimeout(initialRefreshTimer)
      window.clearInterval(interval)
    }
  }, [refreshHistory, refreshPageAnalysisStatus, refreshPlaybackStatus, refreshRecorderStatus])

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
    <main className="browser-shell">
      <section className="browser-chrome">
        <div className="browser-chrome__status-row">
          <span
            className={`playback-indicator playback-indicator--${playbackStatus.state}`}
            aria-live="polite"
          >
            {playbackIndicatorLabel}
          </span>
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
          {isHomeTab ? (
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

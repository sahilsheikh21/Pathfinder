import { useCallback, useEffect, useMemo, useState } from 'react'
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

  const activeTab = useMemo(() => {
    return tabs.find((tab) => tab.id === activeTabId) ?? null
  }, [activeTabId, tabs])

  const isHomeTab = activeTab?.url === HOME_STARTER_URL

  const sidebarBadges = useMemo(() => {
    const runningCount = historyEntries.filter((entry) => entry.status === 'running').length
    const failedCount = historyEntries.filter((entry) => entry.status === 'failed').length

    return {
      library: libraryItems.length,
      history: runningCount + failedCount,
      'ai-chat': 0
    } satisfies Partial<Record<AutomationSidebarSection, number>>
  }, [historyEntries, libraryItems.length])

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
  }, [])

  const handlePlaybackStartResult = useCallback(
    async (
      result: AutomationPlaybackStartResult,
      pendingRequest: PendingPlaybackRequest
    ): Promise<void> => {
      if (result.ok) {
        setPlaybackPromptVariables([])
        setPendingPlaybackRequest(null)
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
  }, [])

  const clearHistoryEntries = useCallback(async (): Promise<void> => {
    const result = await window.pathfinder.automationHistoryClear({ preserveRunning: true })
    setHistoryEntries(result.entries)
  }, [])

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
    activeTabId
  })

  useEffect(() => {
    const initialRefreshTimer = window.setTimeout(() => {
      void refreshRecorderStatus()
      void refreshPlaybackStatus()
      void refreshHistory()
    }, 0)

    const interval = window.setInterval(() => {
      void refreshRecorderStatus()
      void refreshPlaybackStatus()
      void refreshHistory()
    }, 1000)

    return () => {
      window.clearTimeout(initialRefreshTimer)
      window.clearInterval(interval)
    }
  }, [refreshHistory, refreshPlaybackStatus, refreshRecorderStatus])

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
        />

        <section className="browser-viewport" aria-label="Active tab viewport">
          {isHomeTab ? (
            <HomeStarterPage
              activeTabId={activeTabId}
              draftQueryValue={homeDraftQuery}
              onDraftQueryChange={handleHomeDraftQueryChange}
              onNavigate={handleNavigate}
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

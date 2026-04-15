import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  HOME_STARTER_URL,
  type RecorderStartRequest,
  type RecorderStatus,
  type BrowserTabState,
  type DownloadState
} from '../shared/browser'
import BrowserTabStrip from './components/BrowserTabStrip'
import CommandPalette from './components/CommandPalette'
import DownloadShelf from './components/DownloadShelf'
import HomeStarterPage from './components/HomeStarterPage'
import { createBrowserCommands, type CommandPaletteCommand } from './lib/commandPalette'
import NavigationBar from './components/NavigationBar'
import './styles/global.css'

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

  const activeTab = useMemo(() => {
    return tabs.find((tab) => tab.id === activeTabId) ?? null
  }, [activeTabId, tabs])

  const isHomeTab = activeTab?.url === HOME_STARTER_URL

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

  const refreshRecorderStatus = useCallback(async (): Promise<void> => {
    const status = await window.pathfinder.getAutomationRecordingStatus()
    setRecorderStatus(status)
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

  const handleExecuteCommand = async (command: CommandPaletteCommand, query: string): Promise<void> => {
    try {
      await command.run(query)
      setCommandPaletteError('')
      setIsCommandPaletteOpen(false)
    } catch {
      setCommandPaletteError('Command failed. Try again.')
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
    activeTabId
  })

  useEffect(() => {
    const initialRefreshTimer = window.setTimeout(() => {
      void refreshRecorderStatus()
    }, 0)

    const interval = window.setInterval(() => {
      void refreshRecorderStatus()
    }, 1000)

    return () => {
      window.clearTimeout(initialRefreshTimer)
      window.clearInterval(interval)
    }
  }, [refreshRecorderStatus])

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
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        commands={commandPaletteCommands}
        query={commandPaletteQuery}
        onQueryChange={setCommandPaletteQuery}
        onRequestClose={closeCommandPalette}
        onExecute={handleExecuteCommand}
        errorMessage={commandPaletteError}
      />
      <DownloadShelf downloads={downloads} />
    </main>
  )
}

export default App

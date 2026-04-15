import { useEffect, useMemo, useState } from 'react'
import {
  HOME_STARTER_URL,
  type BrowserTabState,
  type DownloadState
} from '../shared/browser'
import BrowserTabStrip from './components/BrowserTabStrip'
import DownloadShelf from './components/DownloadShelf'
import HomeStarterPage from './components/HomeStarterPage'
import NavigationBar from './components/NavigationBar'
import './styles/global.css'

function App() {
  const [tabs, setTabs] = useState<BrowserTabState[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [downloads, setDownloads] = useState<DownloadState[]>([])
  const [homeDraftByTabId, setHomeDraftByTabId] = useState<Record<string, string>>({})

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

  return (
    <main className="browser-shell">
      <section className="browser-chrome">
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
      <DownloadShelf downloads={downloads} />
    </main>
  )
}

export default App

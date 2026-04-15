import { BrowserWindow, WebContentsView } from 'electron'
import { randomUUID } from 'node:crypto'
import { HOME_STARTER_URL } from '../shared/browser'
import type {
  BrowserNavigationRequest,
  BrowserSessionSnapshot,
  BrowserStatePayload,
  BrowserTabState
} from '../shared/browser'

interface TabRecord {
  id: string
  title: string
  url: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  view: WebContentsView
}

const TAB_CHROME_HEIGHT = 88

export class BrowserRuntime {
  private readonly tabs = new Map<string, TabRecord>()

  private readonly tabOrder: string[] = []

  private activeTabId: string | null = null

  constructor(
    private readonly mainWindow: BrowserWindow,
    private readonly onStateChange: (payload: BrowserStatePayload) => void
  ) {
    this.mainWindow.on('resize', () => {
      this.layoutActiveTabView()
    })
  }

  getTabSnapshotList(): BrowserTabState[] {
    return this.tabOrder
      .map((tabId) => this.tabs.get(tabId))
      .filter((tab): tab is TabRecord => Boolean(tab))
      .map((tab) => ({
        id: tab.id,
        title: tab.title,
        url: tab.url,
        isActive: tab.id === this.activeTabId,
        isLoading: tab.isLoading,
        canGoBack: tab.canGoBack,
        canGoForward: tab.canGoForward
      }))
  }

  exportSnapshot(): BrowserSessionSnapshot {
    return {
      tabs: this.getTabSnapshotList(),
      activeTabId: this.activeTabId,
      savedAt: new Date().toISOString()
    }
  }

  restoreFromSnapshot(snapshot: BrowserSessionSnapshot): BrowserTabState[] {
    this.destroyAllTabs()

    if (snapshot.tabs.length === 0) {
      return this.createTab('about:blank')
    }

    for (const savedTab of snapshot.tabs) {
      const tabId = savedTab.id || randomUUID()
      const tab = this.createTabRecord(tabId, savedTab.url)
      tab.title = savedTab.title || tab.title
      tab.isLoading = savedTab.isLoading
      tab.canGoBack = savedTab.canGoBack
      tab.canGoForward = savedTab.canGoForward
    }

    const preferredTabId =
      snapshot.activeTabId && this.tabs.has(snapshot.activeTabId)
        ? snapshot.activeTabId
        : this.tabOrder[0] ?? null

    if (preferredTabId) {
      this.activateTab(preferredTabId)
    }

    this.emitState()
    return this.getTabSnapshotList()
  }

  createTab(initialUrl?: string): BrowserTabState[] {
    const tabId = randomUUID()
    this.createTabRecord(tabId, initialUrl ?? HOME_STARTER_URL)
    this.activateTab(tabId)

    this.emitState()
    return this.getTabSnapshotList()
  }

  activateTab(tabId: string): BrowserTabState[] {
    const tab = this.tabs.get(tabId)
    if (!tab) {
      return this.getTabSnapshotList()
    }

    if (this.activeTabId && this.activeTabId !== tabId) {
      const activeTab = this.tabs.get(this.activeTabId)
      if (activeTab) {
        this.mainWindow.contentView.removeChildView(activeTab.view)
      }
    }

    this.activeTabId = tabId
    this.mainWindow.contentView.addChildView(tab.view)
    this.layoutActiveTabView()
    this.emitState()

    return this.getTabSnapshotList()
  }

  closeTab(tabId: string): BrowserTabState[] {
    const tab = this.tabs.get(tabId)
    if (!tab) {
      return this.getTabSnapshotList()
    }

    const removedIndex = this.tabOrder.findIndex((id) => id === tabId)
    this.tabOrder.splice(removedIndex, 1)
    this.tabs.delete(tabId)

    if (this.activeTabId === tabId) {
      this.mainWindow.contentView.removeChildView(tab.view)

      const nextTabId = this.tabOrder[Math.max(0, removedIndex - 1)] ?? this.tabOrder[0] ?? null
      this.activeTabId = null

      if (nextTabId) {
        this.activateTab(nextTabId)
      }
    }

    if (!tab.view.webContents.isDestroyed()) {
      tab.view.webContents.close()
    }

    this.emitState()
    return this.getTabSnapshotList()
  }

  navigate(request: BrowserNavigationRequest): BrowserTabState[] {
    const tab = this.tabs.get(request.tabId)
    if (!tab) {
      return this.getTabSnapshotList()
    }

    const target = this.normalizeNavigationTarget(request.input)
    if (!target) {
      return this.getTabSnapshotList()
    }

    void tab.view.webContents.loadURL(target)
    this.emitState()
    return this.getTabSnapshotList()
  }

  navigateActiveOrCreate(target: string): BrowserTabState[] {
    const normalizedTarget = this.normalizeNavigationTarget(target)
    if (!normalizedTarget) {
      return this.getTabSnapshotList()
    }

    if (this.activeTabId && this.tabs.has(this.activeTabId)) {
      return this.navigate({
        tabId: this.activeTabId,
        input: normalizedTarget
      })
    }

    return this.createTab(normalizedTarget)
  }

  back(tabId: string): BrowserTabState[] {
    const tab = this.tabs.get(tabId)
    if (tab?.view.webContents.canGoBack()) {
      tab.view.webContents.goBack()
    }
    this.emitState()
    return this.getTabSnapshotList()
  }

  forward(tabId: string): BrowserTabState[] {
    const tab = this.tabs.get(tabId)
    if (tab?.view.webContents.canGoForward()) {
      tab.view.webContents.goForward()
    }
    this.emitState()
    return this.getTabSnapshotList()
  }

  reload(tabId: string): BrowserTabState[] {
    const tab = this.tabs.get(tabId)
    if (tab) {
      tab.view.webContents.reload()
    }
    this.emitState()
    return this.getTabSnapshotList()
  }

  stop(tabId: string): BrowserTabState[] {
    const tab = this.tabs.get(tabId)
    if (tab) {
      tab.view.webContents.stop()
    }
    this.emitState()
    return this.getTabSnapshotList()
  }

  private bindTabEvents(tab: TabRecord): void {
    tab.view.webContents.on('page-title-updated', (_event, title) => {
      tab.title = title || 'New Tab'
      this.emitState()
    })

    tab.view.webContents.on('did-start-loading', () => {
      tab.isLoading = true
      this.syncTabHistory(tab)
      this.emitState()
    })

    tab.view.webContents.on('did-stop-loading', () => {
      tab.isLoading = false
      this.syncTabHistory(tab)
      this.emitState()
    })

    tab.view.webContents.on('did-navigate', (_event, url) => {
      tab.url = url
      this.syncTabHistory(tab)
      this.emitState()
    })

    tab.view.webContents.on('did-navigate-in-page', (_event, url) => {
      tab.url = url
      this.syncTabHistory(tab)
      this.emitState()
    })
  }

  private emitState(): void {
    this.onStateChange({
      tabs: this.getTabSnapshotList(),
      activeTabId: this.activeTabId
    })
  }

  private layoutActiveTabView(): void {
    if (!this.activeTabId) {
      return
    }

    const tab = this.tabs.get(this.activeTabId)
    if (!tab) {
      return
    }

    const bounds = this.mainWindow.getContentBounds()
    tab.view.setBounds({
      x: 0,
      y: TAB_CHROME_HEIGHT,
      width: bounds.width,
      height: Math.max(bounds.height - TAB_CHROME_HEIGHT, 0)
    })
  }

  private normalizeNavigationTarget(input?: string): string | null {
    if (!input) {
      return null
    }

    const target = input.trim()
    if (target.length === 0) {
      return null
    }

    try {
      const parsed = new URL(target)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'about:') {
        return target
      }
      return null
    } catch {
      return null
    }
  }

  private syncTabHistory(tab: TabRecord): void {
    tab.canGoBack = tab.view.webContents.canGoBack()
    tab.canGoForward = tab.view.webContents.canGoForward()

    const currentUrl = tab.view.webContents.getURL()
    if (currentUrl) {
      tab.url = currentUrl
    }
  }

  private createTabRecord(tabId: string, initialUrl?: string): TabRecord {
    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })

    const tab: TabRecord = {
      id: tabId,
      title: 'New Tab',
      url: 'about:blank',
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      view
    }

    this.tabs.set(tabId, tab)
    this.tabOrder.push(tabId)
    this.bindTabEvents(tab)

    const target = this.normalizeNavigationTarget(initialUrl)
    if (target) {
      void tab.view.webContents.loadURL(target)
    }

    return tab
  }

  private destroyAllTabs(): void {
    for (const tabId of this.tabOrder) {
      const tab = this.tabs.get(tabId)
      if (!tab) {
        continue
      }

      try {
        this.mainWindow.contentView.removeChildView(tab.view)
      } catch {
        // No-op when the view is not currently attached.
      }

      if (!tab.view.webContents.isDestroyed()) {
        tab.view.webContents.close()
      }
    }

    this.tabs.clear()
    this.tabOrder.splice(0, this.tabOrder.length)
    this.activeTabId = null
  }
}
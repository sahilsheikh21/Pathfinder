import { app, BrowserWindow, ipcMain } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { BrowserRuntime } from './browserRuntime'
import { DownloadManager } from './downloadManager'
import { createHomeStore, type HomeStore } from './homeStore'
import {
  createQuickSearchWindowManager,
  type QuickSearchWindowManager
} from './quickSearchWindow'
import { createAutomationCdpBridge, type AutomationCdpBridge } from './cdpBridge'
import { createActionRecorder, type ActionRecorder } from './actionRecorder'
import { createAutomationPlaybackManager, type AutomationPlaybackManager } from './automationPlayback'
import {
  createAutomationLibraryStore,
  type AutomationLibraryStore
} from './automationLibraryStore'
import {
  createAutomationHistoryStore,
  type AutomationHistoryStore
} from './automationHistoryStore'
import { loadSessionSnapshot, saveSessionSnapshot } from './sessionStore'
import { IPC_CHANNELS, type AppPlatformResponse, type AppVersionResponse } from '../shared/ipc'
import {
  DEFAULT_HOME_SEARCH_TEMPLATE,
  type AutomationHistoryStatus,
  type AutomationPlaybackStartRequest,
  type AutomationSidebarPreferences,
  type AutomationSidebarPreferencesUpdateRequest
} from '../shared/browser'

let browserRuntime: BrowserRuntime | null = null
let downloadManager: DownloadManager | null = null
let homeStore: HomeStore | null = null
let quickSearchWindowManager: QuickSearchWindowManager | null = null
let automationCdpBridge: AutomationCdpBridge | null = null
let actionRecorder: ActionRecorder | null = null
let automationPlayback: AutomationPlaybackManager | null = null
let automationLibraryStore: AutomationLibraryStore | null = null
let automationHistoryStore: AutomationHistoryStore | null = null
let automationUserDataPath: string | null = null

const cdpPort = Number(process.env.PATHFINDER_CDP_PORT ?? '9222')
const cdpEndpoint = `http://127.0.0.1:${cdpPort}`
const AUTOMATION_SIDEBAR_PREFERENCES_FILE_NAME = 'automation-sidebar-preferences.json'
const DEFAULT_AUTOMATION_SIDEBAR_PREFERENCES: AutomationSidebarPreferences = {
  collapsed: false,
  width: 320,
  activeSection: 'library',
  sectionState: {}
}

interface RunTrackingMetadata {
  workflowId: string
  workflowNameSnapshot: string
  tagsSnapshot: string[]
  workflowOrigin: 'recorded' | 'imported'
  sourceLabel: 'sidebar' | 'command' | 'home' | 'unknown'
  targetUrlAtStart: string | null
}

const activeRunMetadata = new Map<string, RunTrackingMetadata>()

const getSidebarPreferencesPath = (): string | null => {
  if (!automationUserDataPath) {
    return null
  }

  return join(automationUserDataPath, AUTOMATION_SIDEBAR_PREFERENCES_FILE_NAME)
}

const clampSidebarWidth = (value: number): number => {
  if (!Number.isFinite(value)) {
    return DEFAULT_AUTOMATION_SIDEBAR_PREFERENCES.width
  }

  return Math.min(520, Math.max(280, Math.floor(value)))
}

const isSidebarSection = (value: unknown): value is AutomationSidebarPreferences['activeSection'] => {
  return value === 'library' || value === 'history' || value === 'ai-chat'
}

const readAutomationSidebarPreferences = (): AutomationSidebarPreferences => {
  const preferencesPath = getSidebarPreferencesPath()
  if (!preferencesPath || !existsSync(preferencesPath)) {
    return DEFAULT_AUTOMATION_SIDEBAR_PREFERENCES
  }

  try {
    const parsed = JSON.parse(readFileSync(preferencesPath, 'utf8')) as Partial<AutomationSidebarPreferences>
    return {
      collapsed: Boolean(parsed.collapsed),
      width: clampSidebarWidth(typeof parsed.width === 'number' ? parsed.width : 320),
      activeSection: isSidebarSection(parsed.activeSection) ? parsed.activeSection : 'library',
      sectionState:
        parsed.sectionState && typeof parsed.sectionState === 'object' ? parsed.sectionState : {}
    }
  } catch {
    return DEFAULT_AUTOMATION_SIDEBAR_PREFERENCES
  }
}

const writeAutomationSidebarPreferences = (
  request?: AutomationSidebarPreferencesUpdateRequest
): AutomationSidebarPreferences => {
  const preferencesPath = getSidebarPreferencesPath()
  const current = readAutomationSidebarPreferences()
  const updates = request?.preferences ?? {}

  const next: AutomationSidebarPreferences = {
    collapsed:
      typeof updates.collapsed === 'boolean'
        ? updates.collapsed
        : current.collapsed,
    width:
      typeof updates.width === 'number'
        ? clampSidebarWidth(updates.width)
        : current.width,
    activeSection: isSidebarSection(updates.activeSection)
      ? updates.activeSection
      : current.activeSection,
    sectionState: {
      ...current.sectionState,
      ...(updates.sectionState ?? {})
    }
  }

  if (preferencesPath) {
    writeFileSync(preferencesPath, JSON.stringify(next, null, 2), 'utf8')
  }

  return next
}

const mapPlaybackStateToHistoryStatus = (
  state: 'completed' | 'failed' | 'cancelled'
): Exclude<AutomationHistoryStatus, 'running'> => {
  if (state === 'completed') {
    return 'success'
  }

  if (state === 'cancelled') {
    return 'cancelled'
  }

  return 'failed'
}

const deriveWorkflowNameFromSource = (request: AutomationPlaybackStartRequest): string => {
  if (request.source.kind !== 'file') {
    return 'Automation workflow'
  }

  const name = basename(request.source.path).replace(/\.json$/i, '').trim()
  return name || 'Automation workflow'
}

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  if (typeof error === 'string' && error.trim()) {
    return error
  }

  return 'Playback execution failed.'
}

const toStepFailure = (
  error: unknown
):
  | {
      stepId: string
      seq: number
      action: 'navigate' | 'click' | 'type' | 'wait'
      reason: 'internal-error'
      message: string
    }
  | undefined => {
  if (typeof error !== 'object' || error === null) {
    return undefined
  }

  const candidate = error as {
    stepId?: unknown
    seq?: unknown
    action?: unknown
    message?: unknown
  }

  if (
    typeof candidate.stepId !== 'string' ||
    typeof candidate.seq !== 'number' ||
    !['navigate', 'click', 'type', 'wait'].includes(String(candidate.action))
  ) {
    return undefined
  }

  return {
    stepId: candidate.stepId,
    seq: candidate.seq,
    action: candidate.action as 'navigate' | 'click' | 'type' | 'wait',
    reason: 'internal-error',
    message:
      typeof candidate.message === 'string' && candidate.message.trim()
        ? candidate.message
        : 'Playback execution failed.'
  }
}

app.commandLine.appendSwitch('remote-debugging-port', String(cdpPort))

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.appGetVersion, (): AppVersionResponse => ({
    version: app.getVersion()
  }))

  ipcMain.handle(IPC_CHANNELS.appGetPlatform, (): AppPlatformResponse => ({
    platform: process.platform
  }))

  ipcMain.handle(IPC_CHANNELS.browserListTabs, () => browserRuntime?.getTabSnapshotList() ?? [])
  ipcMain.handle(IPC_CHANNELS.browserCreateTab, (_event, initialUrl?: string) =>
    browserRuntime?.createTab(initialUrl) ?? []
  )
  ipcMain.handle(IPC_CHANNELS.browserActivateTab, (_event, tabId: string) =>
    browserRuntime?.activateTab(tabId) ?? []
  )
  ipcMain.handle(IPC_CHANNELS.browserCloseTab, (_event, tabId: string) =>
    browserRuntime?.closeTab(tabId) ?? []
  )
  ipcMain.handle(IPC_CHANNELS.browserNavigate, (_event, request) => browserRuntime?.navigate(request) ?? [])
  ipcMain.handle(IPC_CHANNELS.browserBack, (_event, tabId: string) => browserRuntime?.back(tabId) ?? [])
  ipcMain.handle(IPC_CHANNELS.browserForward, (_event, tabId: string) =>
    browserRuntime?.forward(tabId) ?? []
  )
  ipcMain.handle(IPC_CHANNELS.browserReload, (_event, tabId: string) => browserRuntime?.reload(tabId) ?? [])
  ipcMain.handle(IPC_CHANNELS.browserStop, (_event, tabId: string) => browserRuntime?.stop(tabId) ?? [])
  ipcMain.handle(IPC_CHANNELS.browserGetDownloads, () => downloadManager?.listDownloads() ?? [])
  ipcMain.handle(IPC_CHANNELS.quickSearchToggle, async () => {
    await quickSearchWindowManager?.toggle()
  })
  ipcMain.handle(IPC_CHANNELS.quickSearchOpen, async (_event, request) => {
    await quickSearchWindowManager?.open(request)
  })
  ipcMain.handle(IPC_CHANNELS.quickSearchClose, () => {
    quickSearchWindowManager?.close()
  })
  ipcMain.handle(IPC_CHANNELS.quickSearchSubmit, (_event, request) => {
    const target = typeof request?.target === 'string' ? request.target.trim() : ''
    if (!target) {
      return
    }

    browserRuntime?.navigateActiveOrCreate(target)
    quickSearchWindowManager?.close()
  })
  ipcMain.handle(IPC_CHANNELS.automationConnect, async (_event, request) => {
    if (!automationCdpBridge) {
      return {
        ok: false,
        sessionId: null,
        state: 'error',
        reason: 'attach-failed',
        tabId: null
      }
    }

    return automationCdpBridge.connect(request)
  })
  ipcMain.handle(IPC_CHANNELS.automationDisconnect, async (_event, request) => {
    if (!automationCdpBridge) {
      return {
        ok: false,
        state: 'disconnected',
        reason: 'invalid-session'
      }
    }

    return automationCdpBridge.disconnect(request)
  })
  ipcMain.handle(IPC_CHANNELS.automationGetStatus, () => {
    if (!automationCdpBridge) {
      return {
        state: 'idle',
        owner: null,
        sessionId: null,
        tabId: null,
        reason: 'none'
      }
    }

    return automationCdpBridge.getStatus()
  })
  ipcMain.handle(IPC_CHANNELS.automationRecordStart, (_event, request) => {
    if (!actionRecorder) {
      return {
        ok: false,
        sessionId: null,
        state: 'error',
        reason: 'failed',
        tabId: null
      }
    }

    return actionRecorder.start(request)
  })
  ipcMain.handle(IPC_CHANNELS.automationRecordStop, (_event, request) => {
    if (!actionRecorder) {
      return {
        ok: false,
        state: 'error',
        reason: 'not-recording'
      }
    }

    return actionRecorder.stop(request)
  })
  ipcMain.handle(IPC_CHANNELS.automationRecordStatus, () => {
    return actionRecorder?.getStatus() ?? {
      state: 'idle',
      sessionId: null,
      tabId: null,
      reason: 'none',
      startedAt: null
    }
  })
  ipcMain.handle(IPC_CHANNELS.automationPlaybackStart, async (_event, request) => {
    if (!automationPlayback) {
      return {
        ok: false,
        runId: null,
        state: 'idle',
        reason: 'failed',
        message: 'Playback manager is not available.'
      }
    }

    try {
      const result = await automationPlayback.start(request)
      if (result.ok && result.runId && automationHistoryStore) {
        const metadata: RunTrackingMetadata = {
          workflowId:
            request.source.kind === 'file' ? `path:${request.source.path}` : `run:${result.runId}`,
          workflowNameSnapshot: deriveWorkflowNameFromSource(request),
          tagsSnapshot: [],
          workflowOrigin: 'imported',
          sourceLabel: 'command',
          targetUrlAtStart:
            browserRuntime?.resolveAutomationTarget(request.tabId)?.url ?? null
        }
        activeRunMetadata.set(result.runId, metadata)
        automationHistoryStore.recordRunStarted({
          ...metadata,
          runId: result.runId
        })
      }

      return result
    } catch (error) {
      return {
        ok: false,
        runId: null,
        state: 'failed',
        reason: 'failed',
        message: toErrorMessage(error),
        ...(toStepFailure(error) ? { failure: toStepFailure(error) } : {})
      }
    }
  })
  ipcMain.handle(IPC_CHANNELS.automationPlaybackStatus, () => {
    return (
      automationPlayback?.getStatus() ?? {
        state: 'idle',
        runId: null,
        source: null,
        tabId: null,
        policy: 'stop-on-error',
        startedAt: null,
        finishedAt: null,
        summary: null,
        failure: null
      }
    )
  })
  ipcMain.handle(IPC_CHANNELS.automationPlaybackCancel, async (_event, request) => {
    if (!automationPlayback) {
      return {
        ok: false,
        state: 'idle',
        reason: 'not-running',
        message: 'Playback manager is not available.'
      }
    }

    try {
      return await automationPlayback.cancel(request)
    } catch (error) {
      return {
        ok: false,
        state: 'failed',
        reason: 'failed',
        message: toErrorMessage(error)
      }
    }
  })
  ipcMain.handle(IPC_CHANNELS.automationLibraryList, (_event, request) => {
    return automationLibraryStore?.list(request) ?? { items: [] }
  })
  ipcMain.handle(IPC_CHANNELS.automationLibraryUpsert, (_event, request) => {
    if (!automationLibraryStore) {
      return { items: [] }
    }

    return automationLibraryStore.upsert(request)
  })
  ipcMain.handle(IPC_CHANNELS.automationLibraryDelete, (_event, request) => {
    if (!automationLibraryStore) {
      return { items: [] }
    }

    const removed = automationLibraryStore.remove(request)
    void automationHistoryStore?.markWorkflowDeleted(request.id)
    return removed
  })
  ipcMain.handle(IPC_CHANNELS.automationLibraryRun, async (_event, request) => {
    if (!automationPlayback || !automationLibraryStore || !automationHistoryStore) {
      return {
        ok: false,
        runId: null,
        state: 'idle',
        reason: 'failed',
        message: 'Automation runtime is not available.'
      }
    }

    try {
      const run = automationLibraryStore.resolveRun(request)
      const result = await automationPlayback.start({
        source: { kind: 'file', path: run.sourcePath },
        ...(request.tabId ? { tabId: request.tabId } : {}),
        ...(request.variables ? { variables: request.variables } : {})
      })

      if (result.ok && result.runId) {
        const metadata: RunTrackingMetadata = {
          workflowId: run.item.id,
          workflowNameSnapshot: run.item.name,
          tagsSnapshot: run.item.tags,
          workflowOrigin: run.item.origin,
          sourceLabel: run.sourceLabel,
          targetUrlAtStart:
            browserRuntime?.resolveAutomationTarget(request.tabId)?.url ?? null
        }
        activeRunMetadata.set(result.runId, metadata)
        automationHistoryStore.recordRunStarted({
          ...metadata,
          runId: result.runId
        })
        automationLibraryStore.markLastRunAt(run.item.id)
      }

      return result
    } catch (error) {
      return {
        ok: false,
        runId: null,
        state: 'failed',
        reason: 'failed',
        message: toErrorMessage(error)
      }
    }
  })
  ipcMain.handle(IPC_CHANNELS.automationHistoryList, (_event, request) => {
    return automationHistoryStore?.list(request) ?? { entries: [] }
  })
  ipcMain.handle(IPC_CHANNELS.automationHistoryRemove, (_event, request) => {
    return automationHistoryStore?.remove(request) ?? { entries: [] }
  })
  ipcMain.handle(IPC_CHANNELS.automationHistoryClear, (_event, request) => {
    return automationHistoryStore?.clear(request) ?? { entries: [] }
  })
  ipcMain.handle(IPC_CHANNELS.automationHistoryRerun, async (_event, request) => {
    if (!automationPlayback || !automationHistoryStore) {
      return {
        ok: false,
        runId: null,
        state: 'idle',
        reason: 'failed',
        message: 'Automation runtime is not available.'
      }
    }

    const entry = automationHistoryStore.list().entries.find((item) => item.id === request.id)
    if (!entry) {
      return {
        ok: false,
        runId: null,
        state: 'idle',
        reason: 'invalid-workflow',
        message: 'History entry was not found.'
      }
    }

    const libraryItem = automationLibraryStore?.getById(entry.workflowId)
    const resolvedPath =
      libraryItem?.workflowPath ??
      (entry.workflowId.startsWith('path:') ? entry.workflowId.slice(5) : null)

    if (!resolvedPath) {
      return {
        ok: false,
        runId: null,
        state: 'idle',
        reason: 'invalid-workflow',
        message: 'Workflow is no longer available for rerun.'
      }
    }

    const result = await automationPlayback.start({
      source: { kind: 'file', path: resolvedPath },
      ...(request.tabId ? { tabId: request.tabId } : {})
    })

    if (result.ok && result.runId) {
      const metadata: RunTrackingMetadata = {
        workflowId: entry.workflowId,
        workflowNameSnapshot: entry.workflowNameSnapshot,
        tagsSnapshot: entry.tagsSnapshot,
        workflowOrigin: entry.workflowOrigin,
        sourceLabel: 'sidebar',
        targetUrlAtStart:
          browserRuntime?.resolveAutomationTarget(request.tabId)?.url ?? null
      }
      activeRunMetadata.set(result.runId, metadata)
      automationHistoryStore.recordRunStarted({
        ...metadata,
        runId: result.runId
      })
      if (libraryItem) {
        automationLibraryStore?.markLastRunAt(libraryItem.id)
      }
    }

    return result
  })
  ipcMain.handle(IPC_CHANNELS.automationSidebarGetPreferences, () => {
    return readAutomationSidebarPreferences()
  })
  ipcMain.handle(IPC_CHANNELS.automationSidebarSavePreferences, (_event, request) => {
    return writeAutomationSidebarPreferences(request)
  })
  ipcMain.handle(IPC_CHANNELS.homeGetPreferences, () =>
    homeStore?.getHomePreferences() ?? { searchTemplate: DEFAULT_HOME_SEARCH_TEMPLATE }
  )
  ipcMain.handle(IPC_CHANNELS.homeSavePreferences, (_event, preferences) =>
    homeStore?.saveHomePreferences(preferences) ?? { searchTemplate: DEFAULT_HOME_SEARCH_TEMPLATE }
  )
  ipcMain.handle(IPC_CHANNELS.homeListQuickLinks, () => homeStore?.listQuickLinks() ?? [])
  ipcMain.handle(IPC_CHANNELS.homeUpsertQuickLink, (_event, quickLink) =>
    homeStore?.upsertQuickLink(quickLink) ?? []
  )
  ipcMain.handle(IPC_CHANNELS.homeRemoveQuickLink, (_event, quickLinkId: string) =>
    homeStore?.removeQuickLink(quickLinkId) ?? []
  )
  ipcMain.handle(IPC_CHANNELS.homeListRecentAutomations, () =>
    homeStore?.listRecentAutomations() ?? []
  )
}

function createWindow(): void {
  const userDataPath = app.getPath('userData')
  automationUserDataPath = userDataPath
  homeStore = createHomeStore(userDataPath)
  automationLibraryStore = createAutomationLibraryStore(userDataPath)
  automationHistoryStore = createAutomationHistoryStore(userDataPath)

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: resolve(__dirname, '../preload/index.js')
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  quickSearchWindowManager = createQuickSearchWindowManager({
    preloadPath: resolve(__dirname, '../preload/index.js'),
    rendererIndexPath: resolve(__dirname, '../renderer/index.html'),
    ...(process.env.VITE_DEV_SERVER_URL
      ? { devServerUrl: process.env.VITE_DEV_SERVER_URL }
      : {})
  })

  browserRuntime = new BrowserRuntime(mainWindow, (payload) => {
    mainWindow.webContents.send('browser:state', payload)

    if (browserRuntime) {
      saveSessionSnapshot(userDataPath, browserRuntime.exportSnapshot())
    }
  })

  automationCdpBridge = createAutomationCdpBridge({
    cdpEndpoint,
    resolveTarget: (tabId) => browserRuntime?.resolveAutomationTarget(tabId) ?? null
  })

  actionRecorder = createActionRecorder({
    resolveTarget: (tabId) => {
      const target = browserRuntime?.resolveAutomationTarget(tabId)
      if (!target) {
        return null
      }

      return {
        tabId: target.tabId,
        url: target.url
      }
    }
  })

  automationPlayback = createAutomationPlaybackManager({
    connect: async (request) => {
      if (!automationCdpBridge) {
        return {
          ok: false,
          sessionId: null,
          state: 'error',
          reason: 'attach-failed',
          tabId: null
        }
      }

      return automationCdpBridge.connect(request)
    },
    disconnect: async (request) => {
      if (!automationCdpBridge) {
        return {
          ok: false,
          state: 'disconnected',
          reason: 'invalid-session'
        }
      }

      return automationCdpBridge.disconnect(request)
    },
    withConnectedPage: async (sessionId, callback) => {
      if (!automationCdpBridge) {
        return {
          ok: false,
          reason: 'missing-target',
          message: 'Automation bridge is not available.'
        }
      }

      return automationCdpBridge.withConnectedPage(sessionId, callback)
    },
    onRunFinished: (event) => {
      if (!automationHistoryStore) {
        return
      }

      if (event.state !== 'completed' && event.state !== 'failed' && event.state !== 'cancelled') {
        return
      }

      const tracked = activeRunMetadata.get(event.runId)
      const durationMs = event.summary
        ? Math.max(
            0,
            Date.parse(event.summary.finishedAt) - Date.parse(event.summary.startedAt)
          )
        : Math.max(0, Date.parse(event.finishedAt) - Date.parse(event.startedAt))

      const firstFailure = event.summary?.failures[0] ?? event.failure
      automationHistoryStore.recordRunFinished({
        runId: event.runId,
        status: mapPlaybackStateToHistoryStatus(event.state),
        finishedAt: event.finishedAt,
        durationMs,
        failureSnippet: firstFailure
          ? `#${firstFailure.seq} ${firstFailure.action}: ${firstFailure.message}`
          : null,
        failureDetail: firstFailure?.message ?? event.message ?? null
      })

      if (tracked?.workflowId) {
        activeRunMetadata.delete(event.runId)
      }
    }
  })

  browserRuntime.onTabClosed((tabId) => {
    actionRecorder?.stopForTargetLoss(tabId)
    automationPlayback?.stopForTargetLoss(tabId)
  })

  downloadManager = new DownloadManager(
    (payload) => {
      mainWindow.webContents.send('browser:downloads', payload)
    },
    process.env.PATHFINDER_DOWNLOAD_DIR
  )
  downloadManager.start()

  const snapshot = loadSessionSnapshot(userDataPath)
  if (snapshot) {
    browserRuntime.restoreFromSnapshot(snapshot)
  } else {
    browserRuntime.createTab('about:blank')
  }

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(resolve(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  void automationPlayback?.shutdown()
  void automationCdpBridge?.shutdown()
  actionRecorder?.shutdown()
  quickSearchWindowManager?.destroy()

  if (browserRuntime) {
    saveSessionSnapshot(app.getPath('userData'), browserRuntime.exportSnapshot())
  }
})

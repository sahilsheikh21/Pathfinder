import { app, BrowserWindow, ipcMain, session } from 'electron'
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
import {
  createProviderConfigStore,
  type ProviderConfigStore
} from './llm/providerConfigStore'
import { createSecretStore, type SecretStore } from './llm/secretStore'
import { createSettingsStore, type SettingsStore } from './settingsStore'
import { createPrivacyDataService, type PrivacyDataService } from './privacyDataService'
import { createLLMAdapterService, type LLMAdapterService } from './llm/llmAdapterService'
import { createPageAnalysisService, type PageAnalysisService } from './llm/pageAnalysisService'
import {
  createAutomationGenerationService,
  type AutomationGenerationService
} from './llm/automationGenerationService'
import {
  createLiveAgentOrchestrator,
  type LiveAgentOrchestrator
} from './liveAgentOrchestrator'
import { createLiveAgentAuditStore, type LiveAgentAuditStore } from './liveAgentAuditStore'
import { loadSessionSnapshot, saveSessionSnapshot } from './sessionStore'
import { IPC_CHANNELS, type AppPlatformResponse, type AppVersionResponse } from '../shared/ipc'
import {
  DEFAULT_APPEARANCE_SETTINGS,
  DEFAULT_SHORTCUT_BINDINGS,
  type AIAutomationGenerateResult,
  type BrowserClearDataBucket,
  type BrowserCookieMode,
  type BrowserSettingsClearDataResult,
  type BrowserSettingsSaveAppearanceResult,
  type BrowserSettingsSaveGeneralResult,
  type BrowserSettingsSavePrivacyResult,
  type BrowserSettingsSaveShortcutsResult,
  type BrowserSettingsSnapshot,
  type BrowserSettingsValidationError,
  DEFAULT_HOME_SEARCH_TEMPLATE,
  HOME_STARTER_URL,
  type AutomationHistoryStatus,
  type AutomationPlaybackStartRequest,
  type AutomationSidebarPreferences,
  type AutomationSidebarPreferencesUpdateRequest,
  type LiveAgentGetAuditTrailResult,
  type LiveAgentStartResult,
  type LiveAgentStatusResult,
  type LLMProviderId,
  type PageAnalysisFailure,
  type PageAnalysisResult,
  type RecentAutomationPreview
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
let llmProviderConfigStore: ProviderConfigStore | null = null
let llmSecretStore: SecretStore | null = null
let settingsStore: SettingsStore | null = null
let privacyDataService: PrivacyDataService | null = null
let llmAdapterService: LLMAdapterService | null = null
let pageAnalysisService: PageAnalysisService | null = null
let automationGenerationService: AutomationGenerationService | null = null
let liveAgentOrchestrator: LiveAgentOrchestrator | null = null
let liveAgentAuditStore: LiveAgentAuditStore | null = null

const cdpPort = Number(process.env.PATHFINDER_CDP_PORT ?? '9222')
const cdpEndpoint = `http://127.0.0.1:${cdpPort}`
const AUTOMATION_SIDEBAR_PREFERENCES_FILE_NAME = 'automation-sidebar-preferences.json'
const resolvePreloadScriptPath = (): string => {
  const candidates = [
    resolve(__dirname, '../preload/index.js'),
    resolve(__dirname, '../preload/preload.mjs')
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return candidates[0] ?? resolve(__dirname, '../preload/index.js')
}

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
const SETTINGS_CLEAR_DATA_BUCKETS = new Set<BrowserClearDataBucket>([
  'history-downloads',
  'cookies-site-data',
  'cache-storage',
  'app-settings-subset'
])

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

const toRedactedMainErrorMessage = (error: unknown, fallback: string): string => {
  const message = toErrorMessage(error)
    .replace(/bearer\s+[^\s'"`]+/gi, 'bearer [redacted]')
    .replace(/\bsk-[^\s'"`]+/gi, 'sk-[redacted]')
    .trim()

  return message || fallback
}

const toUnavailableLlmError = (provider: LLMProviderId, message: string) => ({
  provider,
  reason: 'provider-error' as const,
  retryable: false,
  message
})

const toUnavailablePageAnalysisFailure = (
  message: string,
  userAction: PageAnalysisFailure['userAction'] = 'retry'
): PageAnalysisFailure => ({
  reason: 'provider-error',
  message,
  retryable: false,
  userAction
})

const toUnavailablePageAnalysisResult = (
  mode: PageAnalysisResult['mode'],
  message: string
): PageAnalysisResult => ({
  ok: false,
  mode,
  answer: '',
  sections: [],
  confidence: 'uncertain',
  snapshot: null,
  citations: [],
  usedNonPageContext: false,
  error: toUnavailablePageAnalysisFailure(message)
})

const toUnavailableAIAutomationFailure = (message: string) => ({
  reason: 'provider-error' as const,
  message,
  retryable: false,
  userAction: 'check-llm-config' as const
})

const toUnavailableAIAutomationGenerateResult = (message: string): AIAutomationGenerateResult => ({
  ok: false,
  draft: null,
  state: 'failed',
  operationId: null,
  error: toUnavailableAIAutomationFailure(message)
})

const toUnavailableLiveAgentError = (message: string) => ({
  reason: 'failed' as const,
  message,
  retryable: false
})

const toUnavailableLiveAgentStartResult = (message: string): LiveAgentStartResult => ({
  ok: false,
  runId: null,
  state: 'failed',
  approvalBatch: null,
  error: toUnavailableLiveAgentError(message)
})

const toUnavailableLiveAgentStatusResult = (message: string): LiveAgentStatusResult => ({
  state: 'idle',
  runId: null,
  tabId: null,
  approvalBatch: null,
  nextStep: null,
  completedSteps: 0,
  totalSteps: 0,
  updatedAt: null,
  error: toUnavailableLiveAgentError(message)
})

const toUnavailableLiveAgentAuditResult = (runId: string): LiveAgentGetAuditTrailResult => ({
  runId,
  events: []
})

const defaultSettingsSnapshot = (): BrowserSettingsSnapshot => ({
  general: {
    startupMode: 'restore-last-session',
    startupUrls: [],
    homepageMode: 'home-starter',
    homepageUrl: HOME_STARTER_URL,
    downloadsMode: 'ask-every-time',
    downloadsPath: ''
  },
  privacy: {
    cookieMode: 'allow-all'
  },
  appearance: {
    ...DEFAULT_APPEARANCE_SETTINGS
  },
  shortcuts: {
    bindings: {
      ...DEFAULT_SHORTCUT_BINDINGS
    }
  },
  updatedAt: new Date().toISOString(),
  repairNotice: null
})

const toSettingsValidationError = (
  error: unknown,
  fieldFallback: string,
  messageFallback: string
): BrowserSettingsValidationError => {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as Partial<BrowserSettingsValidationError>
    if (
      typeof candidate.field === 'string' &&
      typeof candidate.code === 'string' &&
      typeof candidate.message === 'string'
    ) {
      return {
        field: candidate.field,
        code: candidate.code,
        message: toRedactedMainErrorMessage(candidate.message, messageFallback)
      }
    }
  }

  return {
    field: fieldFallback,
    code: 'invalid-value',
    message: toRedactedMainErrorMessage(error, messageFallback)
  }
}

const toUnavailableSettingsSaveGeneralResult = (message: string): BrowserSettingsSaveGeneralResult => ({
  ok: false,
  snapshot: defaultSettingsSnapshot(),
  validationError: {
    field: 'settings',
    code: 'invalid-value',
    message
  }
})

const toUnavailableSettingsSavePrivacyResult = (message: string): BrowserSettingsSavePrivacyResult => ({
  ok: false,
  snapshot: defaultSettingsSnapshot(),
  validationError: {
    field: 'settings',
    code: 'invalid-value',
    message
  }
})

const toUnavailableSettingsSaveAppearanceResult = (message: string): BrowserSettingsSaveAppearanceResult => ({
  ok: false,
  snapshot: defaultSettingsSnapshot(),
  validationError: {
    field: 'settings',
    code: 'invalid-value',
    message
  }
})

const toUnavailableSettingsSaveShortcutsResult = (message: string): BrowserSettingsSaveShortcutsResult => ({
  ok: false,
  snapshot: defaultSettingsSnapshot(),
  validationError: {
    field: 'settings',
    code: 'invalid-value',
    message
  }
})

const isClearDataBucket = (value: unknown): value is BrowserClearDataBucket => {
  return typeof value === 'string' && SETTINGS_CLEAR_DATA_BUCKETS.has(value as BrowserClearDataBucket)
}

const toUnavailableSettingsClearDataResult = (message: string): BrowserSettingsClearDataResult => ({
  ok: false,
  snapshot: defaultSettingsSnapshot(),
  bucketResults: [],
  validationError: {
    field: 'privacy.clearData',
    code: 'invalid-value',
    message
  }
})

const applyCookieModePolicy = async (cookieMode: BrowserCookieMode): Promise<void> => {
  switch (cookieMode) {
    case 'allow-all': {
      return
    }
    case 'block-third-party': {
      // Electron does not provide first-class global third-party cookie blocking.
      // Persisting this mode enables explicit user intent while enforcement can evolve later.
      return
    }
    case 'block-all': {
      await session.defaultSession.clearStorageData({ storages: ['cookies'] })
      return
    }
  }
}

const recordLiveAgentRunStarted = (runId: string, prompt: string, tabId?: string): void => {
  if (!automationHistoryStore) {
    return
  }

  const targetUrlAtStart = tabId
    ? browserRuntime?.resolveAutomationTarget(tabId)?.url ?? null
    : null

  const workflowNameSnapshot = prompt.trim() || 'Live Agent Run'
  automationHistoryStore.recordRunStarted({
    workflowId: 'live-agent',
    workflowNameSnapshot,
    tagsSnapshot: ['live-agent', 'ai'],
    sourceLabel: 'unknown',
    runId,
    startedAt: new Date().toISOString(),
    targetUrlAtStart,
    workflowOrigin: 'imported'
  })
}

const recordLiveAgentRunFinished = (event: {
  runId: string
  state: 'completed' | 'failed' | 'cancelled'
  startedAt: string
  finishedAt: string
  message?: string
}): void => {
  if (!automationHistoryStore) {
    return
  }

  const durationMs = Math.max(0, Date.parse(event.finishedAt) - Date.parse(event.startedAt))

  automationHistoryStore.recordRunFinished({
    runId: event.runId,
    status: mapPlaybackStateToHistoryStatus(event.state),
    finishedAt: event.finishedAt,
    durationMs,
    failureSnippet: event.state === 'failed' ? event.message ?? 'Live-agent run failed.' : null,
    failureDetail: event.state === 'failed' ? event.message ?? null : null
  })
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
      ...(request.tabId ? { tabId: request.tabId } : {}),
      ...(request.variables ? { variables: request.variables } : {})
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
  ipcMain.handle(IPC_CHANNELS.homeListRecentAutomations, () => {
    if (!automationHistoryStore) {
      return homeStore?.listRecentAutomations() ?? []
    }

    const entries = automationHistoryStore.list({ status: 'all', limit: 200 }).entries
    const previews: RecentAutomationPreview[] = []
    const seenWorkflowIds = new Set<string>()

    for (const entry of entries) {
      if (seenWorkflowIds.has(entry.workflowId)) {
        continue
      }

      seenWorkflowIds.add(entry.workflowId)
      const libraryItem = automationLibraryStore?.getById(entry.workflowId)
      const workflowDeleted = entry.workflowDeleted === true
      const canRun = Boolean(libraryItem?.workflowPath) && !workflowDeleted

      previews.push({
        id: entry.workflowId,
        name: workflowDeleted
          ? `${entry.workflowNameSnapshot} (workflow deleted)`
          : entry.workflowNameSnapshot,
        lastRunAt: entry.finishedAt ?? entry.startedAt,
        status: entry.status,
        workflowDeleted,
        canRun,
        durationMs: entry.durationMs
      })

      if (previews.length >= 6) {
        break
      }
    }

    return previews
  })

  ipcMain.handle(IPC_CHANNELS.settingsGetSnapshot, () => {
    return settingsStore?.getSnapshot() ?? defaultSettingsSnapshot()
  })

  ipcMain.handle(IPC_CHANNELS.settingsSaveGeneral, (_event, request) => {
    if (!settingsStore) {
      return toUnavailableSettingsSaveGeneralResult('Settings service is not available.')
    }

    try {
      return settingsStore.saveGeneral(request)
    } catch (error) {
      return {
        ok: false,
        snapshot: settingsStore.getSnapshot(),
        validationError: toSettingsValidationError(
          error,
          'general',
          'Unable to save general settings.'
        )
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.settingsSavePrivacy, async (_event, request) => {
    if (!settingsStore) {
      return toUnavailableSettingsSavePrivacyResult('Settings service is not available.')
    }

    try {
      const result = settingsStore.savePrivacy(request)
      if (result.ok) {
        await applyCookieModePolicy(result.snapshot.privacy.cookieMode)
      }

      return result
    } catch (error) {
      return {
        ok: false,
        snapshot: settingsStore.getSnapshot(),
        validationError: toSettingsValidationError(
          error,
          'privacy',
          'Unable to save privacy settings.'
        )
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.settingsSaveAppearance, (_event, request) => {
    if (!settingsStore) {
      return toUnavailableSettingsSaveAppearanceResult('Settings service is not available.')
    }

    try {
      return settingsStore.saveAppearance(request)
    } catch (error) {
      return {
        ok: false,
        snapshot: settingsStore.getSnapshot(),
        validationError: toSettingsValidationError(
          error,
          'appearance',
          'Unable to save appearance settings.'
        )
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.settingsSaveShortcuts, (_event, request) => {
    if (!settingsStore) {
      return toUnavailableSettingsSaveShortcutsResult('Settings service is not available.')
    }

    try {
      return settingsStore.saveShortcuts(request)
    } catch (error) {
      return {
        ok: false,
        snapshot: settingsStore.getSnapshot(),
        validationError: toSettingsValidationError(
          error,
          'shortcuts',
          'Unable to save shortcut settings.'
        )
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.settingsClearData, async (_event, request) => {
    if (!settingsStore || !privacyDataService) {
      return toUnavailableSettingsClearDataResult('Privacy settings service is not available.')
    }

    const selectedBuckets = Array.isArray(request?.buckets)
      ? request.buckets.filter((bucket: unknown) => isClearDataBucket(bucket))
      : []

    if (selectedBuckets.length === 0) {
      return {
        ok: false,
        snapshot: settingsStore.getSnapshot(),
        bucketResults: [],
        validationError: {
          field: 'privacy.clearData.buckets',
          code: 'required',
          message: 'Select at least one data bucket to clear.'
        }
      }
    }

    try {
      const bucketResults = await privacyDataService.clearSelectedBuckets({
        buckets: selectedBuckets
      })

      return {
        ok: bucketResults.every((result) => result.ok),
        snapshot: settingsStore.getSnapshot(),
        bucketResults
      }
    } catch (error) {
      return {
        ok: false,
        snapshot: settingsStore.getSnapshot(),
        bucketResults: [],
        validationError: toSettingsValidationError(
          error,
          'privacy.clearData',
          'Unable to clear selected data buckets.'
        )
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.settingsGetRepairNotice, () => {
    return settingsStore?.getRepairNotice() ?? null
  })

  ipcMain.handle(IPC_CHANNELS.llmGetConfig, () => {
    if (!llmAdapterService) {
      return {
        config: {
          provider: 'openai' as const,
          model: 'gpt-4o-mini',
          timeoutMs: 30000
        },
        secretPresent: false,
        updatedAt: new Date().toISOString()
      }
    }

    return llmAdapterService.getConfig()
  })

  ipcMain.handle(IPC_CHANNELS.llmSaveConfig, (_event, patch) => {
    if (!llmAdapterService) {
      return {
        config: {
          provider: 'openai' as const,
          model: 'gpt-4o-mini',
          timeoutMs: 30000
        },
        secretPresent: false,
        updatedAt: new Date().toISOString()
      }
    }

    try {
      return llmAdapterService.saveConfig(patch)
    } catch (error) {
      throw new Error(toRedactedMainErrorMessage(error, 'Unable to save AI provider settings.'))
    }
  })

  ipcMain.handle(IPC_CHANNELS.llmValidateConfig, async (_event, request) => {
    const provider = request?.provider ?? llmAdapterService?.getConfig().config.provider ?? 'openai'

    if (!llmAdapterService) {
      return {
        ok: false,
        provider,
        model: '',
        checkedAt: new Date().toISOString(),
        error: toUnavailableLlmError(provider, 'AI adapter service is not available.')
      }
    }

    try {
      return await llmAdapterService.validateConfig(request)
    } catch (error) {
      return {
        ok: false,
        provider,
        model: llmAdapterService.getConfig().config.model,
        checkedAt: new Date().toISOString(),
        error: toUnavailableLlmError(
          provider,
          toRedactedMainErrorMessage(error, 'AI adapter validation failed.')
        )
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.llmGenerate, async (_event, request) => {
    const provider = request?.provider ?? llmAdapterService?.getConfig().config.provider ?? 'openai'

    if (!llmAdapterService) {
      return {
        ok: false,
        provider,
        model: request?.model ?? '',
        text: '',
        finishReason: 'unknown' as const,
        error: toUnavailableLlmError(provider, 'AI adapter service is not available.')
      }
    }

    try {
      return await llmAdapterService.generate(request)
    } catch (error) {
      return {
        ok: false,
        provider,
        model: request?.model ?? llmAdapterService.getConfig().config.model,
        text: '',
        finishReason: 'unknown' as const,
        error: toUnavailableLlmError(
          provider,
          toRedactedMainErrorMessage(error, 'AI generation failed.')
        )
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.aiAutomationGenerate, async (_event, request) => {
    if (!automationGenerationService) {
      return toUnavailableAIAutomationGenerateResult('AI automation generation service is not available.')
    }

    try {
      return await automationGenerationService.generate(request)
    } catch (error) {
      return toUnavailableAIAutomationGenerateResult(
        toRedactedMainErrorMessage(error, 'AI automation generation failed.')
      )
    }
  })

  ipcMain.handle(IPC_CHANNELS.aiAutomationCancel, (_event, request) => {
    if (!automationGenerationService) {
      return {
        ok: false,
        state: 'idle' as const,
        operationId: request?.operationId ?? null
      }
    }

    return automationGenerationService.cancel(request)
  })

  ipcMain.handle(IPC_CHANNELS.aiAutomationGetStatus, () => {
    if (!automationGenerationService) {
      return {
        state: 'idle' as const,
        operationId: null,
        hasDraft: false,
        updatedAt: null,
        error: toUnavailableAIAutomationFailure('AI automation generation service is not available.')
      }
    }

    return automationGenerationService.getStatus()
  })

  ipcMain.handle(IPC_CHANNELS.liveAgentStart, (_event, request) => {
    if (!liveAgentOrchestrator) {
      return toUnavailableLiveAgentStartResult('Live agent orchestrator is not available.')
    }

    try {
      const result = liveAgentOrchestrator.start(request)
      if (result.ok && result.runId) {
        recordLiveAgentRunStarted(result.runId, request.prompt, request.tabId)
      }

      return result
    } catch (error) {
      return toUnavailableLiveAgentStartResult(
        toRedactedMainErrorMessage(error, 'Unable to start live-agent run.')
      )
    }
  })

  ipcMain.handle(IPC_CHANNELS.liveAgentGetStatus, (_event, request) => {
    if (!liveAgentOrchestrator) {
      return toUnavailableLiveAgentStatusResult('Live agent orchestrator is not available.')
    }

    try {
      return liveAgentOrchestrator.getStatus(request)
    } catch (error) {
      return toUnavailableLiveAgentStatusResult(
        toRedactedMainErrorMessage(error, 'Unable to read live-agent status.')
      )
    }
  })

  ipcMain.handle(IPC_CHANNELS.liveAgentApproveBatch, (_event, request) => {
    if (!liveAgentOrchestrator) {
      return {
        ok: false,
        runId: null,
        state: 'idle' as const,
        approvalBatch: null,
        error: toUnavailableLiveAgentError('Live agent orchestrator is not available.')
      }
    }

    try {
      return liveAgentOrchestrator.approveBatch(request)
    } catch (error) {
      return {
        ok: false,
        runId: request?.runId ?? null,
        state: 'failed' as const,
        approvalBatch: null,
        error: toUnavailableLiveAgentError(
          toRedactedMainErrorMessage(error, 'Unable to approve live-agent batch.')
        )
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.liveAgentPause, (_event, request) => {
    if (!liveAgentOrchestrator) {
      return {
        ok: false,
        runId: null,
        state: 'idle' as const,
        paused: false,
        error: toUnavailableLiveAgentError('Live agent orchestrator is not available.')
      }
    }

    return liveAgentOrchestrator.pause(request)
  })

  ipcMain.handle(IPC_CHANNELS.liveAgentResume, (_event, request) => {
    if (!liveAgentOrchestrator) {
      return {
        ok: false,
        runId: null,
        state: 'idle' as const,
        resumed: false,
        error: toUnavailableLiveAgentError('Live agent orchestrator is not available.')
      }
    }

    return liveAgentOrchestrator.resume(request)
  })

  ipcMain.handle(IPC_CHANNELS.liveAgentCancel, (_event, request) => {
    if (!liveAgentOrchestrator) {
      return {
        ok: false,
        runId: null,
        state: 'idle' as const,
        cancelled: false,
        error: toUnavailableLiveAgentError('Live agent orchestrator is not available.')
      }
    }

    return liveAgentOrchestrator.cancel(request)
  })

  ipcMain.handle(IPC_CHANNELS.liveAgentGetAuditTrail, (_event, request) => {
    const runId = typeof request?.runId === 'string' ? request.runId : ''

    if (!liveAgentOrchestrator || !liveAgentAuditStore) {
      return toUnavailableLiveAgentAuditResult(runId)
    }

    try {
      return {
        runId,
        events: liveAgentAuditStore.listEvents(runId)
      }
    } catch {
      return toUnavailableLiveAgentAuditResult(runId)
    }
  })

  ipcMain.handle(IPC_CHANNELS.pageAnalysisSummarize, async (_event, request) => {
    if (!pageAnalysisService) {
      return toUnavailablePageAnalysisResult('summarize', 'Page analysis service is not available.')
    }

    try {
      return await pageAnalysisService.summarize(request)
    } catch (error) {
      return {
        ...toUnavailablePageAnalysisResult(
          'summarize',
          toRedactedMainErrorMessage(error, 'Page summary failed.')
        ),
        error: toUnavailablePageAnalysisFailure(
          toRedactedMainErrorMessage(error, 'Page summary failed.'),
          'retry'
        )
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.pageAnalysisAsk, async (_event, request) => {
    if (!pageAnalysisService) {
      return toUnavailablePageAnalysisResult('ask', 'Page analysis service is not available.')
    }

    try {
      return await pageAnalysisService.ask(request)
    } catch (error) {
      return {
        ...toUnavailablePageAnalysisResult(
          'ask',
          toRedactedMainErrorMessage(error, 'Page question answering failed.')
        ),
        error: toUnavailablePageAnalysisFailure(
          toRedactedMainErrorMessage(error, 'Page question answering failed.'),
          'retry'
        )
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.pageAnalysisCancel, (_event, request) => {
    if (!pageAnalysisService) {
      return {
        ok: false,
        operationId: request?.operationId ?? null,
        cancelled: false
      }
    }

    return pageAnalysisService.cancel(request)
  })

  ipcMain.handle(IPC_CHANNELS.pageAnalysisRefreshContext, async (_event, request) => {
    if (!pageAnalysisService) {
      return {
        ok: false,
        snapshot: null,
        error: toUnavailablePageAnalysisFailure('Page analysis service is not available.', 'retry')
      }
    }

    try {
      return await pageAnalysisService.refreshContext(request)
    } catch (error) {
      return {
        ok: false,
        snapshot: null,
        error: toUnavailablePageAnalysisFailure(
          toRedactedMainErrorMessage(error, 'Page context refresh failed.'),
          'retry'
        )
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.pageAnalysisClearContext, (_event, request) => {
    if (!pageAnalysisService) {
      return {
        ok: true,
        tabId: request?.tabId ?? null
      }
    }

    return pageAnalysisService.clearContext(request)
  })

  ipcMain.handle(IPC_CHANNELS.pageAnalysisGetStatus, (_event, request) => {
    if (!pageAnalysisService) {
      return {
        state: 'idle' as const,
        operationId: null,
        tabId: request?.tabId ?? null,
        hasContext: false,
        snapshot: null
      }
    }

    return pageAnalysisService.getStatus(request)
  })
}

function createWindow(): void {
  const userDataPath = app.getPath('userData')
  automationUserDataPath = userDataPath
  homeStore = createHomeStore(userDataPath)
  automationLibraryStore = createAutomationLibraryStore(userDataPath)
  automationHistoryStore = createAutomationHistoryStore(userDataPath)
  llmProviderConfigStore = createProviderConfigStore(userDataPath)
  llmSecretStore = createSecretStore(userDataPath)
  settingsStore = createSettingsStore(userDataPath)
  privacyDataService = createPrivacyDataService({
    session: session.defaultSession,
    clearHistoryDownloads: () => {
      void automationHistoryStore?.clear({ preserveRunning: false })
      activeRunMetadata.clear()
    },
    clearAppSettingsSubset: () => {
      settingsStore?.clearAppSettingsSubset()
      homeStore?.saveHomePreferences({ searchTemplate: DEFAULT_HOME_SEARCH_TEMPLATE })
    }
  })
  liveAgentAuditStore = createLiveAgentAuditStore(userDataPath)
  llmAdapterService = createLLMAdapterService({
    configStore: llmProviderConfigStore,
    secretStore: llmSecretStore
  })
  liveAgentOrchestrator = createLiveAgentOrchestrator({
    defaultBatchSize: 3,
    auditStore: liveAgentAuditStore,
    onRunFinished: (event) => {
      recordLiveAgentRunFinished(event)
    }
  })

  const preloadPath = resolvePreloadScriptPath()

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: preloadPath
    }
  })

  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame) {
        return
      }

      console.error('[main-window] did-fail-load', {
        errorCode,
        errorDescription,
        validatedURL
      })
    }
  )

  mainWindow.webContents.on('preload-error', (_event, preloadSource, error) => {
    console.error('[main-window] preload-error', {
      preloadSource,
      message: error.message
    })
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  const devServerUrl =
    process.env.ELECTRON_RENDERER_URL ?? process.env.VITE_DEV_SERVER_URL

  quickSearchWindowManager = createQuickSearchWindowManager({
    preloadPath,
    rendererIndexPath: resolve(__dirname, '../renderer/index.html'),
    ...(devServerUrl
      ? { devServerUrl }
      : {})
  })

  browserRuntime = new BrowserRuntime(mainWindow, (payload) => {
    mainWindow.webContents.send('browser:state', payload)

    if (browserRuntime) {
      saveSessionSnapshot(userDataPath, browserRuntime.exportSnapshot())
    }
  })

  if (llmAdapterService) {
    pageAnalysisService = createPageAnalysisService({
      resolveTarget: (tabId) => browserRuntime?.resolveAutomationTarget(tabId) ?? null,
      llmAdapterService
    })

    automationGenerationService = createAutomationGenerationService({
      llmAdapterService
    })
  }

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
    pageAnalysisService?.invalidateTabContext(tabId)
  })

  browserRuntime.onTabNavigation((event) => {
    if (!pageAnalysisService) {
      return
    }

    if (event.kind === 'reload') {
      pageAnalysisService.invalidateTabContext(event.tabId)
      return
    }

    pageAnalysisService.invalidateForNavigation(event.tabId, event.nextUrl)
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
    browserRuntime.createTab(HOME_STARTER_URL)
  }

  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl)
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

import { randomUUID } from 'node:crypto'
import { chromium, type Browser, type Page } from 'playwright-core'
import type {
  AutomationBridgeStatus,
  AutomationConnectRequest,
  AutomationConnectResult,
  AutomationDisconnectReason,
  AutomationDisconnectRequest,
  AutomationDisconnectResult,
  AutomationOwner,
  AutomationSessionState
} from '../shared/browser'

interface AutomationTarget {
  tabId: string
  url: string
  webContentsId: number
}

interface AutomationCdpBridgeOptions {
  cdpEndpoint: string
  resolveTarget: (tabId?: string) => AutomationTarget | null
}

export interface AutomationCdpBridge {
  connect: (request: AutomationConnectRequest) => Promise<AutomationConnectResult>
  disconnect: (request: AutomationDisconnectRequest) => Promise<AutomationDisconnectResult>
  getStatus: () => AutomationBridgeStatus
  withConnectedPage: <T>(
    sessionId: string,
    callback: (page: Page) => Promise<T>
  ) => Promise<AutomationBridgePageExecutionResult<T>>
  shutdown: () => Promise<void>
}

export type AutomationBridgePageExecutionResult<T> =
  | { ok: true; value: T }
  | {
      ok: false
      reason: 'invalid-session' | 'missing-target'
      message: string
    }

export const createAutomationCdpBridge = (
  options: AutomationCdpBridgeOptions
): AutomationCdpBridge => {
  let browser: Browser | null = null
  let owner: AutomationOwner | null = null
  let sessionId: string | null = null
  let tabId: string | null = null
  let state: AutomationSessionState = 'idle'
  let reason: AutomationDisconnectReason = 'none'

  const isLocked = (): boolean => state === 'connecting' || state === 'connected'

  const setLock = (next: {
    owner: AutomationOwner | null
    sessionId: string | null
    tabId: string | null
    state: AutomationSessionState
    reason: AutomationDisconnectReason
  }): void => {
    owner = next.owner
    sessionId = next.sessionId
    tabId = next.tabId
    state = next.state
    reason = next.reason
  }

  const closeBrowser = async (): Promise<void> => {
    if (!browser) {
      return
    }

    try {
      await browser.close()
    } catch {
      // Ignore close failures so shutdown/disconnect can still clear state.
    }

    browser = null
  }

  const getStatus = (): AutomationBridgeStatus => ({
    state,
    owner,
    sessionId,
    tabId,
    reason
  })

  const connect = async (request: AutomationConnectRequest): Promise<AutomationConnectResult> => {
    if (isLocked()) {
      return {
        ok: false,
        sessionId,
        state,
        reason: 'busy',
        tabId
      }
    }

    const target = options.resolveTarget(request.tabId)
    if (!target || target.webContentsId <= 0) {
      setLock({
        owner: null,
        sessionId: null,
        tabId: null,
        state: 'disconnected',
        reason: 'missing-target'
      })

      return {
        ok: false,
        sessionId: null,
        state,
        reason,
        tabId: null
      }
    }

    setLock({
      owner: request.owner,
      sessionId: null,
      tabId: target.tabId,
      state: 'connecting',
      reason: 'none'
    })

    try {
      browser = await chromium.connectOverCDP(options.cdpEndpoint)
      const nextSessionId = randomUUID()

      setLock({
        owner: request.owner,
        sessionId: nextSessionId,
        tabId: target.tabId,
        state: 'connected',
        reason: 'none'
      })

      return {
        ok: true,
        sessionId,
        state,
        reason,
        tabId
      }
    } catch {
      await closeBrowser()
      setLock({
        owner: null,
        sessionId: null,
        tabId: null,
        state: 'error',
        reason: 'attach-failed'
      })

      return {
        ok: false,
        sessionId: null,
        state,
        reason,
        tabId: null
      }
    }
  }

  const disconnect = async (
    request: AutomationDisconnectRequest
  ): Promise<AutomationDisconnectResult> => {
    if (!sessionId || request.sessionId !== sessionId) {
      return {
        ok: false,
        state,
        reason: 'invalid-session'
      }
    }

    await closeBrowser()
    setLock({
      owner: null,
      sessionId: null,
      tabId: null,
      state: 'disconnected',
      reason: 'disconnected'
    })

    return {
      ok: true,
      state,
      reason
    }
  }

  const withConnectedPage = async <T>(
    currentSessionId: string,
    callback: (page: Page) => Promise<T>
  ): Promise<AutomationBridgePageExecutionResult<T>> => {
    if (!sessionId || currentSessionId !== sessionId || state !== 'connected') {
      return {
        ok: false,
        reason: 'invalid-session',
        message: 'Automation bridge session is not connected for this request.'
      }
    }

    if (!tabId) {
      return {
        ok: false,
        reason: 'missing-target',
        message: 'No bound tab exists for the current automation session.'
      }
    }

    const target = options.resolveTarget(tabId)
    if (!target || target.tabId !== tabId || target.webContentsId <= 0) {
      return {
        ok: false,
        reason: 'missing-target',
        message: 'Bound automation target is not available.'
      }
    }

    if (!browser) {
      return {
        ok: false,
        reason: 'missing-target',
        message: 'Automation browser connection is not available.'
      }
    }

    const pages = browser.contexts().flatMap((context) => context.pages())
    if (pages.length === 0) {
      return {
        ok: false,
        reason: 'missing-target',
        message: 'No browser pages are attached to the current session.'
      }
    }

    const page =
      pages.find((candidate) => candidate.url() === target.url) ??
      pages.find((candidate) => candidate.url() === target.url || !candidate.isClosed()) ??
      pages[0] ??
      null

    if (!page) {
      return {
        ok: false,
        reason: 'missing-target',
        message: 'No active page is available for the bound target.'
      }
    }

    return {
      ok: true,
      value: await callback(page)
    }
  }

  const shutdown = async (): Promise<void> => {
    await closeBrowser()
    setLock({
      owner: null,
      sessionId: null,
      tabId: null,
      state: 'disconnected',
      reason: 'shutdown'
    })
  }

  return {
    connect,
    disconnect,
    getStatus,
    withConnectedPage,
    shutdown
  }
}

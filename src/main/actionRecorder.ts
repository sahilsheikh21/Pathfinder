import { randomUUID } from 'node:crypto'
import type {
  RecorderAction,
  RecorderInputValue,
  RecorderSessionState,
  RecorderStartRequest,
  RecorderStartResult,
  RecorderStatus,
  RecorderStopReason,
  RecorderStopRequest,
  RecorderStopResult,
  RecorderWorkflowDocument,
  RecorderWorkflowStep,
  WorkflowVariableDefinition
} from '../shared/browser'

interface RecorderTarget {
  tabId: string
  url: string
}

interface RecorderOptions {
  resolveTarget: (tabId?: string) => RecorderTarget | null
  onStopped?: (status: RecorderStatus) => void
}

interface RecorderSession {
  id: string
  owner: RecorderStartRequest['owner']
  tabId: string
  startedAt: string
  draft: RecorderWorkflowDocument
  nextSeq: number
  pendingTypeBySelector: Map<string, number>
}

type StepInput =
  | { action: 'navigate'; url: string }
  | { action: 'click'; selector: string }
  | { action: 'type'; selector: string; value: RecorderInputValue }
  | { action: 'wait'; waitFor: 'navigation' | 'selector'; selector?: string; timeoutMs?: number }

export interface ActionRecorder {
  start: (request: RecorderStartRequest) => RecorderStartResult
  stop: (request?: RecorderStopRequest) => RecorderStopResult
  getStatus: () => RecorderStatus
  getDraftWorkflow: (sessionId: string) => RecorderWorkflowDocument | null
  recordStep: (sessionId: string, step: StepInput) => boolean
  stopForTargetLoss: (tabId: string) => void
  stopForBridgeDisconnect: () => void
  shutdown: () => void
}

const createStoppedStatus = (reason: RecorderStopReason): RecorderStatus => ({
  state: 'stopped',
  sessionId: null,
  tabId: null,
  reason,
  startedAt: null
})

const createDraft = (name: string, now: string): RecorderWorkflowDocument => ({
  version: 1,
  id: randomUUID(),
  name,
  createdAt: now,
  updatedAt: now,
  steps: [],
  variables: {}
})

const getDefaultName = (): string => {
  const now = new Date()
  return `Recorded workflow ${now.toISOString()}`
}

const cloneWorkflow = (workflow: RecorderWorkflowDocument): RecorderWorkflowDocument => ({
  ...workflow,
  steps: workflow.steps.map((step) => ({ ...step })),
  ...(workflow.variables ? { variables: { ...workflow.variables } } : {}),
  ...(workflow.metadata ? { metadata: { ...workflow.metadata } } : {})
})

const ensureSecretVariable = (
  workflow: RecorderWorkflowDocument,
  selector: string
): RecorderInputValue => {
  const key = `secret_${selector.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`
  const variables = workflow.variables ?? {}
  if (!variables[key]) {
    variables[key] = {
      type: 'secret',
      prompt: `Provide value for ${selector}`
    } satisfies WorkflowVariableDefinition
    workflow.variables = variables
  }

  return {
    kind: 'variable',
    name: key,
    secret: true
  }
}

export const createActionRecorder = (options: RecorderOptions): ActionRecorder => {
  let state: RecorderSessionState = 'idle'
  let reason: RecorderStopReason = 'none'
  let session: RecorderSession | null = null

  const getStatus = (): RecorderStatus => ({
    state,
    sessionId: session?.id ?? null,
    tabId: session?.tabId ?? null,
    reason,
    startedAt: session?.startedAt ?? null
  })

  const clearSession = (nextReason: RecorderStopReason): RecorderStopResult => {
    session = null
    state = 'stopped'
    reason = nextReason

    const status = getStatus()
    options.onStopped?.(status)

    return {
      ok: true,
      state,
      reason
    }
  }

  const start = (request: RecorderStartRequest): RecorderStartResult => {
    if (session) {
      state = 'error'
      reason = 'busy'
      return {
        ok: false,
        sessionId: session.id,
        state,
        reason,
        tabId: session.tabId
      }
    }

    const target = options.resolveTarget(request.tabId)
    if (!target) {
      state = 'error'
      reason = 'target-lost'
      return {
        ok: false,
        sessionId: null,
        state,
        reason,
        tabId: null
      }
    }

    const now = new Date().toISOString()
    session = {
      id: randomUUID(),
      owner: request.owner,
      tabId: target.tabId,
      startedAt: now,
      draft: createDraft(request.name?.trim() || getDefaultName(), now),
      nextSeq: 1,
      pendingTypeBySelector: new Map<string, number>()
    }
    state = 'recording'
    reason = 'none'

    return {
      ok: true,
      sessionId: session.id,
      state,
      reason,
      tabId: session.tabId
    }
  }

  const stop = (request?: RecorderStopRequest): RecorderStopResult => {
    if (!session) {
      state = 'error'
      reason = 'not-recording'
      return {
        ok: false,
        state,
        reason
      }
    }

    if (request?.sessionId && request.sessionId !== session.id) {
      state = 'error'
      reason = 'invalid-session'
      return {
        ok: false,
        state,
        reason
      }
    }

    return clearSession('none')
  }

  const appendStep = (step: RecorderWorkflowStep): void => {
    if (!session) {
      return
    }

    session.draft.steps.push(step)
    session.draft.updatedAt = new Date().toISOString()
  }

  const appendWaitStep = (
    seq: number,
    waitFor: 'navigation' | 'selector',
    selector?: string,
    timeoutMs?: number
  ): void => {
    const step: RecorderWorkflowStep = {
      id: randomUUID(),
      seq,
      action: 'wait',
      waitFor,
      ...(selector ? { selector } : {}),
      ...(timeoutMs !== undefined ? { timeoutMs } : {})
    }
    appendStep(step)
  }

  const recordStep = (sessionId: string, input: StepInput): boolean => {
    if (!session || session.id !== sessionId || state !== 'recording') {
      return false
    }

    const action = input.action
    if (!(['navigate', 'click', 'type', 'wait'] as RecorderAction[]).includes(action)) {
      return false
    }

    const seq = session.nextSeq++
    if (input.action === 'navigate') {
      const step: RecorderWorkflowStep = {
        id: randomUUID(),
        seq,
        action: 'navigate',
        url: input.url
      }
      appendStep(step)
      return true
    }

    if (input.action === 'click') {
      const step: RecorderWorkflowStep = {
        id: randomUUID(),
        seq,
        action: 'click',
        selector: input.selector
      }
      appendStep(step)
      return true
    }

    if (input.action === 'wait') {
      appendWaitStep(seq, input.waitFor, input.selector, input.timeoutMs)
      return true
    }

    const draft = session.draft
    const value = input.value
    const normalizedValue =
      typeof value === 'string' && input.selector.toLowerCase().includes('password')
        ? ensureSecretVariable(draft, input.selector)
        : value

    const existingIndex = session.pendingTypeBySelector.get(input.selector)
    if (existingIndex !== undefined) {
      const existing = draft.steps[existingIndex]
      if (existing && existing.action === 'type') {
        draft.steps[existingIndex] = {
          ...existing,
          value: normalizedValue
        }
        draft.updatedAt = new Date().toISOString()
        return true
      }
    }

    const step: RecorderWorkflowStep = {
      id: randomUUID(),
      seq,
      action: 'type',
      selector: input.selector,
      value: normalizedValue
    }
    appendStep(step)
    session.pendingTypeBySelector.set(input.selector, draft.steps.length - 1)
    return true
  }

  const getDraftWorkflow = (sessionId: string): RecorderWorkflowDocument | null => {
    if (!session || session.id !== sessionId) {
      return null
    }

    return cloneWorkflow(session.draft)
  }

  const stopForTargetLoss = (tabId: string): void => {
    if (!session || session.tabId !== tabId) {
      return
    }

    clearSession('target-lost')
  }

  const stopForBridgeDisconnect = (): void => {
    if (!session) {
      return
    }

    clearSession('bridge-disconnected')
  }

  const shutdown = (): void => {
    if (!session) {
      state = 'stopped'
      reason = 'shutdown'
      return
    }

    clearSession('shutdown')
  }

  return {
    start,
    stop,
    getStatus,
    getDraftWorkflow,
    recordStep,
    stopForTargetLoss,
    stopForBridgeDisconnect,
    shutdown
  }
}

export { createStoppedStatus }
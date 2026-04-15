import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type { Page } from 'playwright-core'
import type {
  AutomationConnectResult,
  AutomationDisconnectResult,
  AutomationPlaybackCancelRequest,
  AutomationPlaybackCancelResult,
  AutomationPlaybackFailurePolicy,
  AutomationPlaybackRunSummary,
  AutomationPlaybackSource,
  AutomationPlaybackStartReason,
  AutomationPlaybackStartRequest,
  AutomationPlaybackStartResult,
  AutomationPlaybackStatus,
  AutomationPlaybackStepFailure,
  AutomationPlaybackVariablePrompt,
  RecorderInputValue,
  RecorderWorkflowDocument,
  RecorderWorkflowStep
} from '../shared/browser'

interface PlaybackConnectRequest {
  owner: 'automation-engine'
  tabId?: string
}

interface PlaybackDisconnectRequest {
  sessionId: string
}

interface PlaybackWithPageResult<T> {
  ok: boolean
  value?: T
  reason?: 'invalid-session' | 'missing-target'
  message?: string
}

interface PlaybackRunResult {
  state: AutomationPlaybackStatus['state']
  summary: AutomationPlaybackRunSummary | null
  failure: AutomationPlaybackStepFailure | null
  message?: string
}

export interface AutomationPlaybackRunStartedEvent {
  runId: string
  source: AutomationPlaybackSource
  tabId: string
  policy: AutomationPlaybackFailurePolicy
  startedAt: string
}

export interface AutomationPlaybackRunFinishedEvent {
  runId: string
  source: AutomationPlaybackSource
  tabId: string
  policy: AutomationPlaybackFailurePolicy
  startedAt: string
  finishedAt: string
  state: AutomationPlaybackStatus['state']
  summary: AutomationPlaybackRunSummary | null
  failure: AutomationPlaybackStepFailure | null
  message?: string
}

interface ActivePlayback {
  runId: string
  sessionId: string
  tabId: string
  source: AutomationPlaybackSource
  policy: AutomationPlaybackFailurePolicy
  cancelRequested: boolean
  targetLost: boolean
  defaultTimeoutMs: number
  startedAt: string
}

interface AutomationPlaybackOptions {
  connect: (request: PlaybackConnectRequest) => Promise<AutomationConnectResult>
  disconnect: (request: PlaybackDisconnectRequest) => Promise<AutomationDisconnectResult>
  withConnectedPage: <T>(
    sessionId: string,
    callback: (page: Page) => Promise<T>
  ) => Promise<PlaybackWithPageResult<T>>
  onRunStarted?: (event: AutomationPlaybackRunStartedEvent) => void
  onRunFinished?: (event: AutomationPlaybackRunFinishedEvent) => void
}

export interface AutomationPlaybackManager {
  start: (request: AutomationPlaybackStartRequest) => Promise<AutomationPlaybackStartResult>
  getStatus: () => AutomationPlaybackStatus
  cancel: (request?: AutomationPlaybackCancelRequest) => Promise<AutomationPlaybackCancelResult>
  stopForTargetLoss: (tabId: string) => void
  shutdown: () => Promise<void>
}

const MIN_TIMEOUT_MS = 250
const MAX_TIMEOUT_MS = 120000
const DEFAULT_TIMEOUT_MS = 15000

const clampTimeout = (value: number): number =>
  Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, value))

const createIdleStatus = (): AutomationPlaybackStatus => ({
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

const toMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  if (typeof error === 'string' && error.trim()) {
    return error
  }

  return 'Playback step failed.'
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isRecorderWorkflowStep = (value: unknown): value is RecorderWorkflowStep => {
  if (!isObject(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.seq === 'number' &&
    Number.isFinite(value.seq) &&
    (value.action === 'navigate' ||
      value.action === 'click' ||
      value.action === 'type' ||
      value.action === 'wait')
  )
}

const validateWorkflowDocument = (value: unknown): { ok: true; workflow: RecorderWorkflowDocument } | { ok: false; message: string } => {
  if (!isObject(value)) {
    return { ok: false, message: 'Workflow JSON must be an object.' }
  }

  if (value.version !== 1) {
    return { ok: false, message: 'Workflow version must be 1.' }
  }

  if (!Array.isArray(value.steps)) {
    return { ok: false, message: 'Workflow must include a steps array.' }
  }

  const steps = value.steps
  let lastSeq = -Infinity
  for (const step of steps) {
    if (!isRecorderWorkflowStep(step)) {
      return { ok: false, message: 'Workflow steps must include id, seq, and supported action.' }
    }

    if (step.seq <= lastSeq) {
      return { ok: false, message: 'Workflow steps must use strict ascending seq ordering.' }
    }

    lastSeq = step.seq
  }

  return {
    ok: true,
    workflow: value as unknown as RecorderWorkflowDocument
  }
}

const createStepFailure = (
  step: RecorderWorkflowStep,
  reason: AutomationPlaybackStepFailure['reason'],
  message: string
): AutomationPlaybackStepFailure => ({
  stepId: step.id,
  seq: step.seq,
  action: step.action,
  reason,
  message
})

const collectMissingVariables = (
  workflow: RecorderWorkflowDocument,
  variables: Record<string, string>
): AutomationPlaybackVariablePrompt[] => {
  const declared = workflow.variables ?? {}
  return Object.entries(declared)
    .filter(([name]) => !variables[name])
    .map(([name, definition]) => ({
      name,
      prompt: definition.prompt,
      secret: definition.type === 'secret'
    }))
}

const resolveTypeValue = (
  value: RecorderInputValue,
  variables: Record<string, string>
): { ok: true; value: string } | { ok: false; missing: string } => {
  if (typeof value === 'string') {
    return {
      ok: true,
      value
    }
  }

  const resolved = variables[value.name]
  if (!resolved) {
    return {
      ok: false,
      missing: value.name
    }
  }

  return {
    ok: true,
    value: resolved
  }
}

const validateStepForExecution = (step: RecorderWorkflowStep): string | null => {
  switch (step.action) {
    case 'navigate':
      return typeof step.url === 'string' && step.url.trim() ? null : 'navigate step requires url'
    case 'click':
      return typeof step.selector === 'string' && step.selector.trim()
        ? null
        : 'click step requires selector'
    case 'type':
      return typeof step.selector === 'string' && step.selector.trim()
        ? null
        : 'type step requires selector'
    case 'wait':
      if (step.waitFor === 'navigation') {
        return null
      }

      if (step.waitFor === 'selector') {
        return typeof step.selector === 'string' && step.selector.trim()
          ? null
          : 'wait selector step requires selector'
      }

      return 'wait step requires waitFor value'
    default:
      return 'Unsupported step action.'
  }
}

const mapConnectReason = (
  reason: AutomationConnectResult['reason']
): AutomationPlaybackStartReason => {
  switch (reason) {
    case 'busy':
      return 'busy'
    case 'missing-target':
      return 'missing-target'
    case 'invalid-session':
      return 'invalid-session'
    default:
      return 'failed'
  }
}

export const createAutomationPlaybackManager = (
  options: AutomationPlaybackOptions
): AutomationPlaybackManager => {
  let status = createIdleStatus()
  let active: ActivePlayback | null = null

  const setStatus = (next: AutomationPlaybackStatus): void => {
    status = next
  }

  const getStatus = (): AutomationPlaybackStatus => status

  const loadWorkflow = async (
    source: AutomationPlaybackSource
  ): Promise<{ ok: true; workflow: RecorderWorkflowDocument } | { ok: false; message: string }> => {
    if (source.kind !== 'file' || !source.path.trim()) {
      return {
        ok: false,
        message: 'Playback source must be a non-empty file path.'
      }
    }

    try {
      const rawContent = await readFile(source.path, 'utf8')
      const parsed = JSON.parse(rawContent) as unknown
      return validateWorkflowDocument(parsed)
    } catch (error) {
      return {
        ok: false,
        message: `Unable to load workflow file: ${toMessage(error)}`
      }
    }
  }

  const finishActiveRun = async (
    run: ActivePlayback,
    result: PlaybackRunResult
  ): Promise<void> => {
    const finishedAt = new Date().toISOString()

    setStatus({
      state: result.state,
      runId: run.runId,
      source: run.source,
      tabId: run.tabId,
      policy: run.policy,
      startedAt: run.startedAt,
      finishedAt,
      summary: result.summary,
      failure: result.failure
    })

    options.onRunFinished?.({
      runId: run.runId,
      source: run.source,
      tabId: run.tabId,
      policy: run.policy,
      startedAt: run.startedAt,
      finishedAt,
      state: result.state,
      summary: result.summary,
      failure: result.failure,
      ...(result.message ? { message: result.message } : {})
    })

    await options.disconnect({ sessionId: run.sessionId })
    active = null
  }

  const runPlayback = async (
    run: ActivePlayback,
    workflow: RecorderWorkflowDocument,
    variables: Record<string, string>
  ): Promise<void> => {
    const runResult = await options.withConnectedPage(run.sessionId, async (page) => {
      const failures: AutomationPlaybackStepFailure[] = []
      let succeededSteps = 0
      const sortedSteps = [...workflow.steps].sort((left, right) => left.seq - right.seq)

      for (const step of sortedSteps) {
        if (run.targetLost) {
          return {
            state: 'failed' as const,
            summary: null,
            failure: createStepFailure(step, 'target-lost', 'Playback target tab was closed.'),
            message: 'Playback target tab was closed.'
          }
        }

        if (run.cancelRequested) {
          break
        }

        const validationError = validateStepForExecution(step)
        if (validationError) {
          const failure = createStepFailure(step, 'invalid-workflow', validationError)
          failures.push(failure)
          if (run.policy === 'stop-on-error') {
            break
          }
          continue
        }

        const timeout = clampTimeout(
          step.action === 'wait' && typeof step.timeoutMs === 'number'
            ? step.timeoutMs
            : run.defaultTimeoutMs
        )

        try {
          if (step.action === 'navigate') {
            await page.goto(step.url, { waitUntil: 'domcontentloaded', timeout })
          } else if (step.action === 'click') {
            await page.click(step.selector, { timeout })
          } else if (step.action === 'type') {
            const resolvedValue = resolveTypeValue(step.value, variables)
            if (!resolvedValue.ok) {
              const missingFailure = createStepFailure(
                step,
                'missing-variables',
                `Missing variable value for ${resolvedValue.missing}.`
              )
              failures.push(missingFailure)
              if (run.policy === 'stop-on-error') {
                break
              }
              continue
            }

            await page.fill(step.selector, resolvedValue.value, { timeout })
          } else if (step.waitFor === 'navigation') {
            await page.waitForLoadState('domcontentloaded', { timeout })
          } else {
            await page.waitForSelector(step.selector ?? '', { timeout })
          }

          succeededSteps += 1
        } catch (error) {
          const message = toMessage(error)
          const reason: AutomationPlaybackStepFailure['reason'] =
            /timeout/i.test(message) ? 'timeout' : 'step-failed'

          failures.push(createStepFailure(step, reason, message))
          if (run.policy === 'stop-on-error') {
            break
          }
        }
      }

      const finishedAt = new Date().toISOString()
      const summary: AutomationPlaybackRunSummary = {
        totalSteps: sortedSteps.length,
        succeededSteps,
        failedSteps: failures.length,
        failures,
        startedAt: run.startedAt,
        finishedAt
      }

      if (run.cancelRequested) {
        return {
          state: 'cancelled' as const,
          summary,
          failure: failures[0] ?? null
        }
      }

      if (failures.length > 0) {
        return {
          state: 'failed' as const,
          summary,
          failure: failures[0] ?? null
        }
      }

      return {
        state: 'completed' as const,
        summary,
        failure: null
      }
    })

    if (!runResult.ok) {
      await finishActiveRun(run, {
        state: 'failed',
        summary: null,
        failure: null,
        message: runResult.message ?? 'Playback session is no longer valid.'
      })
      return
    }

    await finishActiveRun(run, runResult.value as PlaybackRunResult)
  }

  const start = async (request: AutomationPlaybackStartRequest): Promise<AutomationPlaybackStartResult> => {
    if (active) {
      return {
        ok: false,
        runId: active.runId,
        state: status.state,
        reason: 'already-running',
        message: 'Playback is already in progress.'
      }
    }

    const loadedWorkflow = await loadWorkflow(request.source)
    if (!loadedWorkflow.ok) {
      return {
        ok: false,
        runId: null,
        state: status.state,
        reason: 'invalid-workflow',
        message: loadedWorkflow.message
      }
    }

    const runtimeVariables = Object.fromEntries(
      Object.entries(request.variables ?? {}).map(([key, value]) => [key, String(value)])
    )

    const missingVariables = collectMissingVariables(loadedWorkflow.workflow, runtimeVariables)
    if (missingVariables.length > 0) {
      return {
        ok: false,
        runId: null,
        state: status.state,
        reason: 'missing-variables',
        requiredVariables: missingVariables,
        message: 'Playback requires additional variable values before execution.'
      }
    }

    const connectRequest: PlaybackConnectRequest = {
      owner: 'automation-engine',
      ...(request.tabId ? { tabId: request.tabId } : {})
    }

    const connected = await options.connect(connectRequest)

    if (!connected.ok || !connected.sessionId || !connected.tabId) {
      return {
        ok: false,
        runId: null,
        state: status.state,
        reason: mapConnectReason(connected.reason),
        message: 'Unable to acquire automation session lock.'
      }
    }

    const run: ActivePlayback = {
      runId: randomUUID(),
      sessionId: connected.sessionId,
      tabId: connected.tabId,
      source: request.source,
      policy: request.policy ?? 'stop-on-error',
      cancelRequested: false,
      targetLost: false,
      defaultTimeoutMs: clampTimeout(request.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS),
      startedAt: new Date().toISOString()
    }

    active = run
    setStatus({
      state: 'running',
      runId: run.runId,
      source: run.source,
      tabId: run.tabId,
      policy: run.policy,
      startedAt: run.startedAt,
      finishedAt: null,
      summary: null,
      failure: null
    })

    options.onRunStarted?.({
      runId: run.runId,
      source: run.source,
      tabId: run.tabId,
      policy: run.policy,
      startedAt: run.startedAt
    })

    void runPlayback(run, loadedWorkflow.workflow, runtimeVariables)

    return {
      ok: true,
      runId: run.runId,
      state: 'running',
      reason: 'none'
    }
  }

  const cancel = async (
    request?: AutomationPlaybackCancelRequest
  ): Promise<AutomationPlaybackCancelResult> => {
    if (!active) {
      return {
        ok: false,
        state: status.state,
        reason: 'not-running',
        message: 'No playback run is active.'
      }
    }

    if (request?.runId && request.runId !== active.runId) {
      return {
        ok: false,
        state: status.state,
        reason: 'not-running',
        message: 'The requested playback run is not active.'
      }
    }

    active.cancelRequested = true

    return {
      ok: true,
      state: status.state,
      reason: 'none',
      message: 'Playback cancellation requested.'
    }
  }

  const stopForTargetLoss = (tabId: string): void => {
    if (!active || active.tabId !== tabId) {
      return
    }

    active.targetLost = true
  }

  const shutdown = async (): Promise<void> => {
    if (!active) {
      setStatus({
        ...createIdleStatus(),
        state: 'cancelled'
      })
      return
    }

    active.cancelRequested = true
    await options.disconnect({ sessionId: active.sessionId })
    const finishedAt = new Date().toISOString()
    setStatus({
      state: 'cancelled',
      runId: active.runId,
      source: active.source,
      tabId: active.tabId,
      policy: active.policy,
      startedAt: active.startedAt,
      finishedAt,
      summary: status.summary,
      failure: status.failure
    })
    options.onRunFinished?.({
      runId: active.runId,
      source: active.source,
      tabId: active.tabId,
      policy: active.policy,
      startedAt: active.startedAt,
      finishedAt,
      state: 'cancelled',
      summary: status.summary,
      failure: status.failure ?? null,
      message: 'Playback cancelled during shutdown.'
    })
    active = null
  }

  return {
    start,
    getStatus,
    cancel,
    stopForTargetLoss,
    shutdown
  }
}

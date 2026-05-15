import { randomUUID } from 'node:crypto'
import type {
  LiveAgentApprovalBatch,
  LiveAgentApprovalDecision,
  LiveAgentApproveBatchRequest,
  LiveAgentApproveBatchResult,
  LiveAgentCancelRequest,
  LiveAgentCancelResult,
  LiveAgentError,
  LiveAgentGetAuditTrailRequest,
  LiveAgentGetAuditTrailResult,
  LiveAgentPauseRequest,
  LiveAgentPauseResult,
  LiveAgentResumeRequest,
  LiveAgentResumeResult,
  LiveAgentRunState,
  LiveAgentStartRequest,
  LiveAgentStartResult,
  LiveAgentStatusRequest,
  LiveAgentStatusResult,
  LiveAgentStepAuditEvent,
  LiveAgentStepSummary
} from '../shared/browser'
import { createLiveAgentRiskPolicy, type LiveAgentRiskPolicy } from './liveAgentRiskPolicy'
import type { LiveAgentAuditStore } from './liveAgentAuditStore'

interface LiveAgentOrchestratorOptions {
  defaultBatchSize?: number
  riskPolicy?: LiveAgentRiskPolicy
  now?: () => string
  auditStore?: LiveAgentAuditStore
  onRunFinished?: (event: {
    runId: string
    state: 'completed' | 'failed' | 'cancelled'
    startedAt: string
    finishedAt: string
    message?: string
  }) => void
}

interface ActiveLiveAgentRun {
  runId: string
  prompt: string
  tabId: string | null
  batchSize: number
  startedAt: string
  steps: LiveAgentStepSummary[]
  cursor: number
  state: LiveAgentRunState
  approvalBatch: LiveAgentApprovalBatch | null
  updatedAt: string
  error?: LiveAgentError
  pauseRequested: boolean
  auditEvents: LiveAgentStepAuditEvent[]
}

export interface LiveAgentOrchestrator {
  start: (request: LiveAgentStartRequest) => LiveAgentStartResult
  getStatus: (request?: LiveAgentStatusRequest) => LiveAgentStatusResult
  approveBatch: (request: LiveAgentApproveBatchRequest) => LiveAgentApproveBatchResult
  pause: (request?: LiveAgentPauseRequest) => LiveAgentPauseResult
  resume: (request?: LiveAgentResumeRequest) => LiveAgentResumeResult
  cancel: (request?: LiveAgentCancelRequest) => LiveAgentCancelResult
  getAuditTrail: (request: LiveAgentGetAuditTrailRequest) => LiveAgentGetAuditTrailResult
}

const clampBatchSize = (value: number | undefined, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  return Math.min(10, Math.max(1, Math.floor(value)))
}

const toError = (
  reason: LiveAgentError['reason'],
  message: string,
  retryable: boolean
): LiveAgentError => ({
  reason,
  message,
  retryable
})

const normalizeProposedSteps = (
  steps: LiveAgentStepSummary[] | undefined,
  prompt: string,
  riskPolicy: LiveAgentRiskPolicy
): LiveAgentStepSummary[] => {
  if (!Array.isArray(steps) || steps.length === 0) {
    const fallback: LiveAgentStepSummary[] = [
      {
        id: randomUUID(),
        seq: 1,
        action: 'navigate',
        target: 'active-tab',
        expectedSideEffect: 'Ensure the active tab context is loaded and stable.',
        rationale: `Establish execution context for: ${prompt}`,
        riskTier: 'low'
      },
      {
        id: randomUUID(),
        seq: 2,
        action: 'click',
        target: 'primary-action',
        expectedSideEffect: 'Trigger the primary action required by the prompt.',
        rationale: `Perform the requested objective action for: ${prompt}`,
        riskTier: 'high'
      },
      {
        id: randomUUID(),
        seq: 3,
        action: 'wait',
        target: 'result-state',
        expectedSideEffect: 'Observe resulting state before planning additional steps.',
        rationale: `Capture post-action observations for: ${prompt}`,
        riskTier: 'low'
      }
    ]

    return fallback.map((step) => ({
      ...step,
      riskTier: riskPolicy.classifyStep(step)
    }))
  }

  const normalized = [...steps]
    .sort((left, right) => left.seq - right.seq)
    .map((step, index) => {
      const base: LiveAgentStepSummary = {
        ...step,
        seq: index + 1,
        id: step.id || randomUUID(),
        expectedSideEffect: step.expectedSideEffect?.trim() || 'Apply planned browser action.',
        rationale: step.rationale?.trim() || `Planned action for: ${prompt}`
      }

      return {
        ...base,
        riskTier: riskPolicy.classifyStep(base)
      }
    })

  return normalized
}

const getRunError = (run: ActiveLiveAgentRun): LiveAgentError | undefined => run.error

const getStatusSnapshot = (run: ActiveLiveAgentRun | null): LiveAgentStatusResult => {
  if (!run) {
    return {
      state: 'idle',
      runId: null,
      tabId: null,
      approvalBatch: null,
      nextStep: null,
      completedSteps: 0,
      totalSteps: 0,
      updatedAt: null
    }
  }

  const nextStep = run.steps[run.cursor] ?? null
  const runError = getRunError(run)

  return {
    state: run.state,
    runId: run.runId,
    tabId: run.tabId,
    approvalBatch: run.approvalBatch,
    nextStep,
    completedSteps: run.cursor,
    totalSteps: run.steps.length,
    updatedAt: run.updatedAt,
    ...(runError ? { error: runError } : {})
  }
}

const addAuditEvent = (
  run: ActiveLiveAgentRun,
  step: LiveAgentStepSummary,
  decision: LiveAgentApprovalDecision,
  observedResult: string,
  now: () => string,
  auditStore?: LiveAgentAuditStore
): void => {
  const event: LiveAgentStepAuditEvent = {
    id: randomUUID(),
    runId: run.runId,
    stepId: step.id,
    stepIndex: step.seq,
    actionSummary: `${step.action}${step.target ? ` -> ${step.target}` : ''}`,
    riskTier: step.riskTier,
    approvalDecision: decision,
    observedResult,
    nextStepRationale: step.rationale,
    createdAt: now()
  }

  run.auditEvents.push(event)
  auditStore?.appendEvent(event)
}

const buildApprovalBatch = (
  run: ActiveLiveAgentRun,
  now: () => string
): LiveAgentApprovalBatch => {
  const steps = run.steps.slice(run.cursor, run.cursor + run.batchSize)

  return {
    batchId: randomUUID(),
    runId: run.runId,
    size: steps.length,
    stepIds: steps.map((step) => step.id),
    steps,
    createdAt: now()
  }
}

const executeBatch = (
  run: ActiveLiveAgentRun,
  decision: LiveAgentApprovalDecision,
  now: () => string,
  auditStore?: LiveAgentAuditStore
): void => {
  const batch = run.approvalBatch
  if (!batch) {
    return
  }

  for (const step of batch.steps) {
    addAuditEvent(
      run,
      step,
      decision,
      'Step executed in orchestrator control loop.',
      now,
      auditStore
    )
    run.cursor += 1
  }

  run.approvalBatch = null
}

const advanceRun = (
  run: ActiveLiveAgentRun,
  now: () => string,
  auditStore?: LiveAgentAuditStore,
  onRunFinished?: LiveAgentOrchestratorOptions['onRunFinished']
): void => {
  if (run.state === 'cancelled' || run.state === 'failed' || run.state === 'completed') {
    return
  }

  if (run.pauseRequested) {
    run.state = 'paused'
    run.pauseRequested = false
    run.updatedAt = now()
    return
  }

  if (run.cursor >= run.steps.length) {
    run.state = 'completed'
    run.updatedAt = now()
    onRunFinished?.({
      runId: run.runId,
      state: 'completed',
      startedAt: run.startedAt,
      finishedAt: run.updatedAt
    })
    return
  }

  const batch = buildApprovalBatch(run, now)
  const hasHighImpact = batch.steps.some((step) => step.riskTier === 'high')
  run.approvalBatch = batch

  if (hasHighImpact) {
    run.state = 'waiting-approval'
    run.updatedAt = now()
    return
  }

  run.state = 'running'
  executeBatch(run, 'not-required', now, auditStore)
  run.updatedAt = now()

  if (run.cursor >= run.steps.length) {
    run.state = 'completed'
    run.updatedAt = now()
    onRunFinished?.({
      runId: run.runId,
      state: 'completed',
      startedAt: run.startedAt,
      finishedAt: run.updatedAt
    })
    return
  }

  advanceRun(run, now, auditStore, onRunFinished)
}

export const createLiveAgentOrchestrator = (
  options: LiveAgentOrchestratorOptions = {}
): LiveAgentOrchestrator => {
  const riskPolicy = options.riskPolicy ?? createLiveAgentRiskPolicy()
  const now = options.now ?? (() => new Date().toISOString())
  const defaultBatchSize = clampBatchSize(options.defaultBatchSize, 3)
  const auditStore = options.auditStore
  const onRunFinished = options.onRunFinished

  let activeRun: ActiveLiveAgentRun | null = null

  const start = (request: LiveAgentStartRequest): LiveAgentStartResult => {
    if (activeRun && !['completed', 'failed', 'cancelled'].includes(activeRun.state)) {
      activeRun.error = toError('busy', 'A live-agent run is already active.', true)
      activeRun.updatedAt = now()
      return {
        ok: false,
        runId: activeRun.runId,
        state: activeRun.state,
        approvalBatch: activeRun.approvalBatch,
        error: activeRun.error
      }
    }

    const runId = randomUUID()
    const normalizedSteps = normalizeProposedSteps(request.proposedSteps, request.prompt, riskPolicy)

    activeRun = {
      runId,
      prompt: request.prompt,
      tabId: request.tabId ?? null,
      batchSize: clampBatchSize(request.batchSize, defaultBatchSize),
      startedAt: now(),
      steps: normalizedSteps,
      cursor: 0,
      state: 'planning',
      approvalBatch: null,
      updatedAt: now(),
      pauseRequested: false,
      auditEvents: []
    }

    advanceRun(activeRun, now, auditStore, onRunFinished)

    return {
      ok: true,
      runId,
      state: activeRun.state,
      approvalBatch: activeRun.approvalBatch
    }
  }

  const getStatus = (request?: LiveAgentStatusRequest): LiveAgentStatusResult => {
    void request
    return getStatusSnapshot(activeRun)
  }

  const approveBatch = (request: LiveAgentApproveBatchRequest): LiveAgentApproveBatchResult => {
    if (!activeRun) {
      return {
        ok: false,
        runId: null,
        state: 'idle',
        approvalBatch: null,
        error: toError('missing-run', 'No active live-agent run found.', true)
      }
    }

    if (!activeRun.approvalBatch || activeRun.state !== 'waiting-approval') {
      activeRun.error = toError('invalid-state', 'No approval batch is awaiting decision.', true)
      activeRun.updatedAt = now()
      return {
        ok: false,
        runId: activeRun.runId,
        state: activeRun.state,
        approvalBatch: activeRun.approvalBatch,
        error: activeRun.error
      }
    }

    if (activeRun.approvalBatch.batchId !== request.batchId) {
      activeRun.error = toError('invalid-state', 'Approval batch is stale or mismatched.', true)
      activeRun.updatedAt = now()
      return {
        ok: false,
        runId: activeRun.runId,
        state: activeRun.state,
        approvalBatch: activeRun.approvalBatch,
        error: activeRun.error
      }
    }

    if (request.runId && request.runId !== activeRun.runId) {
      activeRun.error = toError('invalid-state', 'Run identifier mismatch for approval request.', false)
      activeRun.updatedAt = now()
      return {
        ok: false,
        runId: activeRun.runId,
        state: activeRun.state,
        approvalBatch: activeRun.approvalBatch,
        error: activeRun.error
      }
    }

    if (request.decision === 'reject') {
      const approvalBatch = activeRun.approvalBatch
      if (approvalBatch) {
        for (const step of approvalBatch.steps) {
          addAuditEvent(
            activeRun,
            step,
            'rejected',
            'Step blocked because user rejected approval batch.',
            now,
            auditStore
          )
        }
      }

      activeRun.error = toError('approval-required', 'Batch was rejected by the user.', true)
      activeRun.state = 'failed'
      activeRun.approvalBatch = null
      activeRun.updatedAt = now()
      onRunFinished?.({
        runId: activeRun.runId,
        state: 'failed',
        startedAt: activeRun.startedAt,
        finishedAt: activeRun.updatedAt,
        message: activeRun.error.message
      })

      return {
        ok: true,
        runId: activeRun.runId,
        state: activeRun.state,
        approvalBatch: null,
        message: 'Live-agent run stopped because the batch was rejected.'
      }
    }

    activeRun.state = 'running'
  executeBatch(activeRun, 'approved', now, auditStore)
    activeRun.updatedAt = now()
  advanceRun(activeRun, now, auditStore, onRunFinished)

    return {
      ok: true,
      runId: activeRun.runId,
      state: activeRun.state,
      approvalBatch: activeRun.approvalBatch
    }
  }

  const pause = (request?: LiveAgentPauseRequest): LiveAgentPauseResult => {
    if (!activeRun) {
      return {
        ok: false,
        runId: null,
        state: 'idle',
        paused: false,
        error: toError('missing-run', 'No active live-agent run found.', true)
      }
    }

    if (request?.runId && request.runId !== activeRun.runId) {
      return {
        ok: false,
        runId: activeRun.runId,
        state: activeRun.state,
        paused: false,
        error: toError('invalid-state', 'Run identifier mismatch for pause request.', false)
      }
    }

    if (activeRun.state === 'waiting-approval' || activeRun.state === 'running' || activeRun.state === 'planning') {
      activeRun.pauseRequested = true
      activeRun.state = 'paused'
      activeRun.updatedAt = now()
      return {
        ok: true,
        runId: activeRun.runId,
        state: activeRun.state,
        paused: true
      }
    }

    return {
      ok: false,
      runId: activeRun.runId,
      state: activeRun.state,
      paused: false,
      error: toError('invalid-state', 'Live-agent run is not in a pausable state.', true)
    }
  }

  const resume = (request?: LiveAgentResumeRequest): LiveAgentResumeResult => {
    if (!activeRun) {
      return {
        ok: false,
        runId: null,
        state: 'idle',
        resumed: false,
        error: toError('missing-run', 'No active live-agent run found.', true)
      }
    }

    if (request?.runId && request.runId !== activeRun.runId) {
      return {
        ok: false,
        runId: activeRun.runId,
        state: activeRun.state,
        resumed: false,
        error: toError('invalid-state', 'Run identifier mismatch for resume request.', false)
      }
    }

    if (request?.tabId && activeRun.tabId && request.tabId !== activeRun.tabId) {
      activeRun.error = toError('context-mismatch', 'Cannot resume: active tab context changed.', false)
      activeRun.updatedAt = now()
      return {
        ok: false,
        runId: activeRun.runId,
        state: activeRun.state,
        resumed: false,
        error: activeRun.error
      }
    }

    if (activeRun.state !== 'paused') {
      return {
        ok: false,
        runId: activeRun.runId,
        state: activeRun.state,
        resumed: false,
        error: toError('invalid-state', 'Live-agent run is not paused.', true)
      }
    }

    activeRun.pauseRequested = false
    activeRun.state = 'running'
    activeRun.updatedAt = now()
    advanceRun(activeRun, now, auditStore, onRunFinished)

    return {
      ok: true,
      runId: activeRun.runId,
      state: activeRun.state,
      resumed: true
    }
  }

  const cancel = (request?: LiveAgentCancelRequest): LiveAgentCancelResult => {
    if (!activeRun) {
      return {
        ok: false,
        runId: null,
        state: 'idle',
        cancelled: false,
        error: toError('missing-run', 'No active live-agent run found.', true)
      }
    }

    if (request?.runId && request.runId !== activeRun.runId) {
      return {
        ok: false,
        runId: activeRun.runId,
        state: activeRun.state,
        cancelled: false,
        error: toError('invalid-state', 'Run identifier mismatch for cancel request.', false)
      }
    }

    if (
      activeRun.state === 'completed' ||
      activeRun.state === 'failed' ||
      activeRun.state === 'cancelled'
    ) {
      return {
        ok: false,
        runId: activeRun.runId,
        state: activeRun.state,
        cancelled: false,
        error: toError('invalid-state', 'Live-agent run is already in a terminal state.', true)
      }
    }

    activeRun.state = 'cancelled'
    activeRun.error = toError('cancelled', 'Live-agent run was cancelled.', true)
    activeRun.approvalBatch = null
    activeRun.updatedAt = now()
    onRunFinished?.({
      runId: activeRun.runId,
      state: 'cancelled',
      startedAt: activeRun.startedAt,
      finishedAt: activeRun.updatedAt,
      message: activeRun.error.message
    })

    return {
      ok: true,
      runId: activeRun.runId,
      state: activeRun.state,
      cancelled: true
    }
  }

  const getAuditTrail = (request: LiveAgentGetAuditTrailRequest): LiveAgentGetAuditTrailResult => {
    if (!activeRun || activeRun.runId !== request.runId) {
      return {
        runId: request.runId,
        events: []
      }
    }

    return {
      runId: activeRun.runId,
      events: [...activeRun.auditEvents]
    }
  }

  return {
    start,
    getStatus,
    approveBatch,
    pause,
    resume,
    cancel,
    getAuditTrail
  }
}

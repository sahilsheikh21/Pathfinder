import { randomUUID } from 'node:crypto'
import type {
  AIAutomationCancelRequest,
  AIAutomationCancelResult,
  AIAutomationGenerateFailure,
  AIAutomationGenerateRequest,
  AIAutomationGenerateResult,
  AIAutomationGenerationState,
  AIAutomationStatusResult,
  RecorderInputValue,
  RecorderWorkflowDocument,
  RecorderWorkflowStep,
  WorkflowVariableDefinition
} from '../../shared/browser'
import type { LLMAdapterService } from './llmAdapterService'

interface AutomationGenerationServiceOptions {
  llmAdapterService: LLMAdapterService
}

export interface AutomationGenerationService {
  generate: (request: AIAutomationGenerateRequest) => Promise<AIAutomationGenerateResult>
  cancel: (request?: AIAutomationCancelRequest) => AIAutomationCancelResult
  getStatus: () => AIAutomationStatusResult
}

interface ActiveGenerationOperation {
  operationId: string
  cancelled: boolean
}

type NormalizedStepInput = Record<string, unknown>

const ALLOWED_ACTIONS = new Set<RecorderWorkflowStep['action']>(['navigate', 'click', 'type', 'wait'])

const toFailure = (
  reason: AIAutomationGenerateFailure['reason'],
  message: string,
  retryable: boolean,
  userAction: AIAutomationGenerateFailure['userAction']
): AIAutomationGenerateFailure => ({
  reason,
  message: message.trim() || 'Unable to generate automation draft.',
  retryable,
  userAction
})

const mapLlmFailure = (error: { reason?: string; message?: string; retryable?: boolean }): AIAutomationGenerateFailure => {
  const message = typeof error.message === 'string' && error.message.trim()
    ? error.message
    : 'AI generation failed.'

  switch (error.reason) {
    case 'invalid-config':
    case 'unsupported-capability':
      return toFailure('invalid-config', message, false, 'check-llm-config')
    case 'auth':
      return toFailure('auth', message, false, 'check-llm-config')
    case 'network':
      return toFailure('network', message, true, 'retry')
    case 'timeout':
      return toFailure('timeout', message, true, 'retry')
    case 'quota':
      return toFailure('quota', message, true, 'retry')
    case 'provider-error':
      return toFailure('provider-error', message, Boolean(error.retryable), 'retry')
    default:
      return toFailure('failed', message, Boolean(error.retryable), 'retry')
  }
}

const normalizeInputValue = (value: unknown): RecorderInputValue | null => {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as { kind?: unknown; name?: unknown; secret?: unknown }
  if (candidate.kind !== 'variable' || typeof candidate.name !== 'string' || candidate.secret !== true) {
    return null
  }

  return {
    kind: 'variable',
    name: candidate.name,
    secret: true
  }
}

const normalizeVariables = (value: unknown): Record<string, WorkflowVariableDefinition> | undefined => {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }

  const entries = Object.entries(value as Record<string, unknown>)
  const output: Record<string, WorkflowVariableDefinition> = {}

  for (const [name, definition] of entries) {
    if (typeof definition !== 'object' || definition === null) {
      continue
    }

    const typed = definition as { type?: unknown; prompt?: unknown }
    if ((typed.type !== 'text' && typed.type !== 'secret') || typeof typed.prompt !== 'string') {
      continue
    }

    output[name] = {
      type: typed.type,
      prompt: typed.prompt
    }
  }

  return Object.keys(output).length > 0 ? output : undefined
}

const parseCandidatePayload = (raw: string): unknown => {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error('Model response was empty.')
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fencedMatch?.[1]?.trim() || trimmed
  const objectMatch = candidate.match(/\{[\s\S]*\}/)
  const jsonText = objectMatch?.[0] || candidate

  return JSON.parse(jsonText)
}

const normalizeStep = (step: NormalizedStepInput, seq: number): RecorderWorkflowStep => {
  const action = step.action
  if (typeof action !== 'string' || !ALLOWED_ACTIONS.has(action as RecorderWorkflowStep['action'])) {
    throw new Error('Generated workflow contains an unsupported action.')
  }

  const base = {
    id: randomUUID(),
    seq
  }

  if (action === 'navigate') {
    if (typeof step.url !== 'string' || !step.url.trim()) {
      throw new Error('navigate step requires a non-empty url.')
    }

    return {
      ...base,
      action: 'navigate',
      url: step.url
    }
  }

  if (action === 'click') {
    if (typeof step.selector !== 'string' || !step.selector.trim()) {
      throw new Error('click step requires a non-empty selector.')
    }

    return {
      ...base,
      action: 'click',
      selector: step.selector
    }
  }

  if (action === 'type') {
    if (typeof step.selector !== 'string' || !step.selector.trim()) {
      throw new Error('type step requires a non-empty selector.')
    }

    const value = normalizeInputValue(step.value)
    if (value === null) {
      throw new Error('type step requires a supported value format.')
    }

    return {
      ...base,
      action: 'type',
      selector: step.selector,
      value
    }
  }

  const waitFor = step.waitFor
  if (waitFor !== 'navigation' && waitFor !== 'selector') {
    throw new Error('wait step requires waitFor set to navigation or selector.')
  }

  if (waitFor === 'selector' && (typeof step.selector !== 'string' || !step.selector.trim())) {
    throw new Error('wait selector step requires a non-empty selector.')
  }

  const timeoutMs = typeof step.timeoutMs === 'number' && Number.isFinite(step.timeoutMs)
    ? Math.max(1, Math.floor(step.timeoutMs))
    : undefined

  return {
    ...base,
    action: 'wait',
    waitFor,
    ...(waitFor === 'selector' ? { selector: String(step.selector) } : {}),
    ...(timeoutMs ? { timeoutMs } : {})
  }
}

const normalizeWorkflow = (
  payload: unknown,
  request: AIAutomationGenerateRequest,
  operationId: string
): RecorderWorkflowDocument => {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Generated workflow payload must be a JSON object.')
  }

  const candidate = payload as {
    workflow?: Record<string, unknown>
    steps?: unknown
    name?: unknown
    description?: unknown
    variables?: unknown
    unsupportedIntent?: unknown
    warnings?: unknown
  }

  if (candidate.unsupportedIntent === true) {
    throw new Error('unsupported-intent')
  }

  const workflowSeed =
    candidate.workflow && typeof candidate.workflow === 'object' ? candidate.workflow : candidate
  const stepsSource = Array.isArray(workflowSeed.steps)
    ? workflowSeed.steps
    : Array.isArray(candidate.steps)
      ? candidate.steps
      : null

  if (!stepsSource || stepsSource.length === 0) {
    throw new Error('unsupported-intent')
  }

  const normalizedSteps = stepsSource.map((step, index) => {
    if (typeof step !== 'object' || step === null) {
      throw new Error('Generated workflow contains invalid step entries.')
    }

    return normalizeStep(step as NormalizedStepInput, index + 1)
  })

  const now = new Date().toISOString()
  const nameCandidate =
    typeof workflowSeed.name === 'string'
      ? workflowSeed.name
      : typeof candidate.name === 'string'
        ? candidate.name
        : 'AI Generated Workflow'

  const descriptionCandidate =
    typeof workflowSeed.description === 'string'
      ? workflowSeed.description
      : typeof candidate.description === 'string'
        ? candidate.description
        : undefined

  const variables = normalizeVariables(workflowSeed.variables ?? candidate.variables)

  return {
    version: 1,
    id: randomUUID(),
    name: nameCandidate.trim() || 'AI Generated Workflow',
    ...(descriptionCandidate && descriptionCandidate.trim()
      ? { description: descriptionCandidate.trim() }
      : {}),
    createdAt: now,
    updatedAt: now,
    steps: normalizedSteps,
    ...(variables ? { variables } : {}),
    metadata: {
      generatedBy: 'ai-automation-generation',
      sourcePrompt: request.prompt,
      operationId,
      ...(request.constraints?.targetUrl ? { targetUrl: request.constraints.targetUrl } : {})
    }
  }
}

const buildPrompt = (request: AIAutomationGenerateRequest): string => {
  const lines = [
    'Create one JSON workflow draft using only these actions: navigate, click, type, wait.',
    'Return JSON only. Do not include prose outside JSON.',
    'Output shape: {"name":"...","description":"...","steps":[...],"variables":{...},"warnings":[...]}.',
    `User prompt: ${request.prompt}`
  ]

  if (request.constraints?.targetUrl) {
    lines.push(`Target URL: ${request.constraints.targetUrl}`)
  }

  if (request.constraints?.objective) {
    lines.push(`Objective: ${request.constraints.objective}`)
  }

  if (Array.isArray(request.constraints?.variables) && request.constraints.variables.length > 0) {
    lines.push(`Required variables: ${request.constraints.variables.join(', ')}`)
  }

  if (request.constraints?.notes) {
    lines.push(`Notes: ${request.constraints.notes}`)
  }

  return lines.join('\n')
}

export const createAutomationGenerationService = (
  options: AutomationGenerationServiceOptions
): AutomationGenerationService => {
  let state: AIAutomationGenerationState = 'idle'
  let active: ActiveGenerationOperation | null = null
  let latestDraft: RecorderWorkflowDocument | null = null
  let latestError: AIAutomationGenerateFailure | undefined
  let updatedAt: string | null = null

  const setState = (next: AIAutomationGenerationState): void => {
    state = next
    updatedAt = new Date().toISOString()
  }

  const getStatus = (): AIAutomationStatusResult => ({
    state,
    operationId: active?.operationId ?? null,
    hasDraft: latestDraft !== null,
    updatedAt,
    ...(latestError ? { error: latestError } : {})
  })

  const cancel = (request?: AIAutomationCancelRequest): AIAutomationCancelResult => {
    if (!active) {
      return {
        ok: false,
        state,
        operationId: null
      }
    }

    if (request?.operationId && request.operationId !== active.operationId) {
      return {
        ok: false,
        state,
        operationId: active.operationId
      }
    }

    active.cancelled = true
    latestError = toFailure('cancelled', 'Generation was cancelled by the user.', true, 'retry')
    setState('cancelled')

    return {
      ok: true,
      state,
      operationId: active.operationId
    }
  }

  const generate = async (request: AIAutomationGenerateRequest): Promise<AIAutomationGenerateResult> => {
    if (active) {
      const busyError = toFailure(
        'failed',
        'A generation operation is already in progress. Cancel it before starting a new one.',
        true,
        'retry'
      )
      latestError = busyError
      setState('failed')
      return {
        ok: false,
        draft: null,
        state,
        operationId: active.operationId,
        error: busyError
      }
    }

    const operation: ActiveGenerationOperation = {
      operationId: randomUUID(),
      cancelled: false
    }

    active = operation
    latestDraft = null
    latestError = undefined

    try {
      setState('generating')
      const config = options.llmAdapterService.getConfig().config
      const generationResult = await options.llmAdapterService.generate({
        provider: config.provider,
        model: config.model,
        prompt: buildPrompt(request)
      })

      if (operation.cancelled) {
        const cancelledResult: AIAutomationGenerateResult = {
          ok: false,
          draft: null,
          state,
          operationId: operation.operationId
        }

        if (latestError) {
          cancelledResult.error = latestError
        }

        return cancelledResult
      }

      if (!generationResult.ok) {
        const failure = mapLlmFailure(generationResult.error ?? {})
        latestError = failure
        setState('failed')
        return {
          ok: false,
          draft: null,
          state,
          operationId: operation.operationId,
          error: failure
        }
      }

      setState('validating')
      let payload: unknown
      try {
        payload = parseCandidatePayload(generationResult.text)
      } catch (error) {
        const failure = toFailure(
          'invalid-draft',
          error instanceof Error ? error.message : 'Generated draft could not be parsed as JSON.',
          true,
          'edit-prompt'
        )
        latestError = failure
        setState('failed')
        return {
          ok: false,
          draft: null,
          state,
          operationId: operation.operationId,
          error: failure
        }
      }

      try {
        const workflow = normalizeWorkflow(payload, request, operation.operationId)
        const candidate = payload as { warnings?: unknown; workflow?: { warnings?: unknown } }
        const warnings = Array.isArray(candidate.warnings)
          ? candidate.warnings.filter((item): item is string => typeof item === 'string')
          : Array.isArray(candidate.workflow?.warnings)
            ? candidate.workflow.warnings.filter((item): item is string => typeof item === 'string')
            : []

        if (operation.cancelled) {
          const cancelledResult: AIAutomationGenerateResult = {
            ok: false,
            draft: null,
            state,
            operationId: operation.operationId
          }

          if (latestError) {
            cancelledResult.error = latestError
          }

          return cancelledResult
        }

        latestDraft = workflow
        latestError = undefined
        setState('ready')

        return {
          ok: true,
          draft: {
            workflow,
            warnings
          },
          state,
          operationId: operation.operationId
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Generated draft failed validation.'
        const failure = message === 'unsupported-intent'
          ? toFailure(
              'unsupported-intent',
              'The request cannot be mapped to supported automation steps yet. Try a more explicit prompt.',
              true,
              'edit-prompt'
            )
          : toFailure('invalid-draft', message, true, 'edit-prompt')

        latestError = failure
        setState('failed')

        return {
          ok: false,
          draft: null,
          state,
          operationId: operation.operationId,
          error: failure
        }
      }
    } finally {
      if (active?.operationId === operation.operationId) {
        active = null
      }
    }
  }

  return {
    generate,
    cancel,
    getStatus
  }
}

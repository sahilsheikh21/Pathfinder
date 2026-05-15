import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { LiveAgentStepAuditEvent } from '../shared/browser'

interface LiveAgentAuditStoreData {
  byRunId: Record<string, LiveAgentStepAuditEvent[]>
}

const LIVE_AGENT_AUDIT_FILE_NAME = 'live-agent-audit.json'

const getStorePath = (userDataPath: string): string => join(userDataPath, LIVE_AGENT_AUDIT_FILE_NAME)

const defaultData = (): LiveAgentAuditStoreData => ({
  byRunId: {}
})

const isAuditEvent = (value: unknown): value is LiveAgentStepAuditEvent => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const event = value as Partial<LiveAgentStepAuditEvent>

  return (
    typeof event.id === 'string' &&
    typeof event.runId === 'string' &&
    typeof event.stepId === 'string' &&
    typeof event.stepIndex === 'number' &&
    typeof event.actionSummary === 'string' &&
    (event.riskTier === 'low' || event.riskTier === 'high') &&
    (event.approvalDecision === 'approved' ||
      event.approvalDecision === 'rejected' ||
      event.approvalDecision === 'not-required') &&
    typeof event.observedResult === 'string' &&
    typeof event.nextStepRationale === 'string' &&
    typeof event.createdAt === 'string'
  )
}

const isStoreData = (value: unknown): value is LiveAgentAuditStoreData => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<LiveAgentAuditStoreData>
  if (!candidate.byRunId || typeof candidate.byRunId !== 'object') {
    return false
  }

  return Object.values(candidate.byRunId).every(
    (events) => Array.isArray(events) && events.every((event) => isAuditEvent(event))
  )
}

const readStoreData = (userDataPath: string): LiveAgentAuditStoreData => {
  const storePath = getStorePath(userDataPath)

  if (!existsSync(storePath)) {
    const defaults = defaultData()
    writeFileSync(storePath, JSON.stringify(defaults, null, 2), 'utf8')
    return defaults
  }

  try {
    const parsed = JSON.parse(readFileSync(storePath, 'utf8')) as unknown
    if (!isStoreData(parsed)) {
      const defaults = defaultData()
      writeFileSync(storePath, JSON.stringify(defaults, null, 2), 'utf8')
      return defaults
    }

    return parsed
  } catch {
    const defaults = defaultData()
    writeFileSync(storePath, JSON.stringify(defaults, null, 2), 'utf8')
    return defaults
  }
}

const writeStoreData = (userDataPath: string, data: LiveAgentAuditStoreData): void => {
  writeFileSync(getStorePath(userDataPath), JSON.stringify(data, null, 2), 'utf8')
}

const redactSensitive = (value: string): string => {
  return value
    .replace(/bearer\s+[a-z0-9._-]+/gi, 'bearer [redacted]')
    .replace(/sk-[a-z0-9]+/gi, 'sk-[redacted]')
    .replace(/(password|token|secret|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .replace(/\{\{[^}]+\}\}/g, '{{redacted-variable}}')
}

const normalizeEvent = (event: LiveAgentStepAuditEvent): LiveAgentStepAuditEvent => {
  return {
    ...event,
    actionSummary: redactSensitive(event.actionSummary),
    observedResult: redactSensitive(event.observedResult),
    nextStepRationale: redactSensitive(event.nextStepRationale)
  }
}

const sortEvents = (events: LiveAgentStepAuditEvent[]): LiveAgentStepAuditEvent[] => {
  return [...events].sort((left, right) => {
    if (left.stepIndex !== right.stepIndex) {
      return left.stepIndex - right.stepIndex
    }

    return Date.parse(left.createdAt) - Date.parse(right.createdAt)
  })
}

export interface LiveAgentAuditStore {
  appendEvent: (event: LiveAgentStepAuditEvent) => void
  listEvents: (runId: string) => LiveAgentStepAuditEvent[]
  clearRun: (runId: string) => void
}

export const createLiveAgentAuditStore = (userDataPath: string): LiveAgentAuditStore => {
  const appendEvent = (event: LiveAgentStepAuditEvent): void => {
    const data = readStoreData(userDataPath)
    const next = normalizeEvent(event)
    const existing = data.byRunId[next.runId] ?? []

    const merged = sortEvents([...existing, next])
    const nextData: LiveAgentAuditStoreData = {
      byRunId: {
        ...data.byRunId,
        [next.runId]: merged
      }
    }

    writeStoreData(userDataPath, nextData)
  }

  const listEvents = (runId: string): LiveAgentStepAuditEvent[] => {
    const data = readStoreData(userDataPath)
    return sortEvents(data.byRunId[runId] ?? [])
  }

  const clearRun = (runId: string): void => {
    const data = readStoreData(userDataPath)
    if (!(runId in data.byRunId)) {
      return
    }

    const nextByRunId = { ...data.byRunId }
    delete nextByRunId[runId]

    writeStoreData(userDataPath, {
      byRunId: nextByRunId
    })
  }

  return {
    appendEvent,
    listEvents,
    clearRun
  }
}

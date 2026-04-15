import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  AutomationHistoryClearRequest,
  AutomationHistoryEntry,
  AutomationHistoryListRequest,
  AutomationHistoryListResult,
  AutomationHistoryRemoveRequest,
  AutomationHistoryStatus,
  AutomationLibraryOrigin,
  AutomationRunSourceLabel
} from '../shared/browser'

interface AutomationHistoryStoreData {
  entries: AutomationHistoryEntry[]
}

interface RecordRunStartedInput {
  workflowId: string
  workflowNameSnapshot: string
  tagsSnapshot: string[]
  sourceLabel: AutomationRunSourceLabel
  runId: string
  startedAt?: string
  targetUrlAtStart?: string | null
  workflowOrigin: AutomationLibraryOrigin
}

interface RecordRunFinishedInput {
  runId: string
  status: Exclude<AutomationHistoryStatus, 'running'>
  finishedAt?: string
  durationMs?: number | null
  failureSnippet?: string | null
  failureDetail?: string | null
}

const AUTOMATION_HISTORY_FILE_NAME = 'automation-history.json'
const AUTOMATION_HISTORY_RETENTION_MAX = 500

const getStorePath = (userDataPath: string): string => {
  return join(userDataPath, AUTOMATION_HISTORY_FILE_NAME)
}

const defaultData = (): AutomationHistoryStoreData => {
  return {
    entries: []
  }
}

const normalizeTags = (tags: string[]): string[] => {
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))]
}

const isHistoryStatus = (value: unknown): value is AutomationHistoryStatus => {
  return value === 'running' || value === 'success' || value === 'failed' || value === 'cancelled'
}

const isEntry = (value: unknown): value is AutomationHistoryEntry => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const entry = value as Partial<AutomationHistoryEntry>
  return (
    typeof entry.id === 'string' &&
    typeof entry.workflowId === 'string' &&
    typeof entry.workflowNameSnapshot === 'string' &&
    Array.isArray(entry.tagsSnapshot) &&
    isHistoryStatus(entry.status) &&
    typeof entry.sourceLabel === 'string' &&
    typeof entry.startedAt === 'string' &&
    (typeof entry.finishedAt === 'string' || entry.finishedAt === null) &&
    (typeof entry.durationMs === 'number' || entry.durationMs === null) &&
    (typeof entry.failureSnippet === 'string' || entry.failureSnippet === null) &&
    (typeof entry.failureDetail === 'string' || entry.failureDetail === null) &&
    (typeof entry.runId === 'string' || entry.runId === null) &&
    (typeof entry.targetUrlAtStart === 'string' || entry.targetUrlAtStart === null) &&
    (entry.workflowOrigin === 'recorded' || entry.workflowOrigin === 'imported')
  )
}

const isStoreData = (value: unknown): value is AutomationHistoryStoreData => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const data = value as Partial<AutomationHistoryStoreData>
  return Array.isArray(data.entries) && data.entries.every((entry) => isEntry(entry))
}

const sortEntries = (entries: AutomationHistoryEntry[]): AutomationHistoryEntry[] => {
  return [...entries].sort((left, right) => {
    if (left.status === 'running' && right.status !== 'running') {
      return -1
    }
    if (left.status !== 'running' && right.status === 'running') {
      return 1
    }

    return Date.parse(right.startedAt) - Date.parse(left.startedAt)
  })
}

const pruneToRetention = (entries: AutomationHistoryEntry[]): AutomationHistoryEntry[] => {
  const running = entries.filter((entry) => entry.status === 'running')
  const terminal = entries
    .filter((entry) => entry.status !== 'running')
    .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))

  return [...running, ...terminal.slice(0, AUTOMATION_HISTORY_RETENTION_MAX)]
}

const readStoreData = (userDataPath: string): AutomationHistoryStoreData => {
  const storePath = getStorePath(userDataPath)

  if (!existsSync(storePath)) {
    const defaults = defaultData()
    writeFileSync(storePath, JSON.stringify(defaults, null, 2), 'utf8')
    return defaults
  }

  try {
    const raw = readFileSync(storePath, 'utf8')
    const parsed = JSON.parse(raw) as unknown

    if (!isStoreData(parsed)) {
      const defaults = defaultData()
      writeFileSync(storePath, JSON.stringify(defaults, null, 2), 'utf8')
      return defaults
    }

    return {
      entries: sortEntries(parsed.entries)
    }
  } catch {
    const defaults = defaultData()
    writeFileSync(storePath, JSON.stringify(defaults, null, 2), 'utf8')
    return defaults
  }
}

const writeStoreData = (userDataPath: string, data: AutomationHistoryStoreData): void => {
  writeFileSync(getStorePath(userDataPath), JSON.stringify(data, null, 2), 'utf8')
}

const toFailureSnippet = (value: string | null | undefined): string | null => {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  return trimmed.length > 180 ? `${trimmed.slice(0, 177)}...` : trimmed
}

const applyFilters = (
  entries: AutomationHistoryEntry[],
  request?: AutomationHistoryListRequest
): AutomationHistoryEntry[] => {
  const requestedStatus = request?.status ?? 'all'
  const query = request?.query?.trim().toLowerCase() ?? ''

  const filtered = entries.filter((entry) => {
    const statusMatch = requestedStatus === 'all' || entry.status === requestedStatus
    if (!statusMatch) {
      return false
    }

    if (!query) {
      return true
    }

    return (
      entry.workflowNameSnapshot.toLowerCase().includes(query) ||
      entry.tagsSnapshot.some((tag) => tag.includes(query)) ||
      (entry.failureSnippet ?? '').toLowerCase().includes(query) ||
      (entry.failureDetail ?? '').toLowerCase().includes(query)
    )
  })

  const limit =
    typeof request?.limit === 'number' && request.limit > 0
      ? Math.floor(request.limit)
      : undefined

  return limit ? filtered.slice(0, limit) : filtered
}

export interface AutomationHistoryStore {
  recordRunStarted: (input: RecordRunStartedInput) => AutomationHistoryEntry
  recordRunFinished: (input: RecordRunFinishedInput) => AutomationHistoryEntry | null
  list: (request?: AutomationHistoryListRequest) => AutomationHistoryListResult
  remove: (request: AutomationHistoryRemoveRequest) => AutomationHistoryListResult
  clear: (request?: AutomationHistoryClearRequest) => AutomationHistoryListResult
  markWorkflowDeleted: (workflowId: string) => AutomationHistoryListResult
}

export const createAutomationHistoryStore = (userDataPath: string): AutomationHistoryStore => {
  const recordRunStarted = (input: RecordRunStartedInput): AutomationHistoryEntry => {
    const data = readStoreData(userDataPath)
    const startedAt = input.startedAt ?? new Date().toISOString()

    const entry: AutomationHistoryEntry = {
      id: randomUUID(),
      workflowId: input.workflowId,
      workflowNameSnapshot: input.workflowNameSnapshot,
      tagsSnapshot: normalizeTags(input.tagsSnapshot),
      status: 'running',
      sourceLabel: input.sourceLabel,
      startedAt,
      finishedAt: null,
      durationMs: null,
      failureSnippet: null,
      failureDetail: null,
      runId: input.runId,
      targetUrlAtStart: input.targetUrlAtStart ?? null,
      workflowOrigin: input.workflowOrigin
    }

    const nextData: AutomationHistoryStoreData = {
      entries: sortEntries(pruneToRetention([entry, ...data.entries]))
    }
    writeStoreData(userDataPath, nextData)
    return entry
  }

  const recordRunFinished = (input: RecordRunFinishedInput): AutomationHistoryEntry | null => {
    const data = readStoreData(userDataPath)
    const finishedAt = input.finishedAt ?? new Date().toISOString()
    const nextEntries = data.entries.map((entry) => {
      if (entry.runId !== input.runId || entry.status !== 'running') {
        return entry
      }

      const duration =
        typeof input.durationMs === 'number'
          ? Math.max(0, input.durationMs)
          : Math.max(0, Date.parse(finishedAt) - Date.parse(entry.startedAt))

      return {
        ...entry,
        status: input.status,
        finishedAt,
        durationMs: Number.isFinite(duration) ? duration : null,
        failureSnippet: toFailureSnippet(input.failureSnippet),
        failureDetail: input.failureDetail?.trim() || null
      }
    })

    const nextData: AutomationHistoryStoreData = {
      entries: sortEntries(pruneToRetention(nextEntries))
    }

    writeStoreData(userDataPath, nextData)
    return nextData.entries.find((entry) => entry.runId === input.runId) ?? null
  }

  const list = (request?: AutomationHistoryListRequest): AutomationHistoryListResult => {
    const data = readStoreData(userDataPath)
    return {
      entries: applyFilters(data.entries, request)
    }
  }

  const remove = (request: AutomationHistoryRemoveRequest): AutomationHistoryListResult => {
    const data = readStoreData(userDataPath)
    const nextData: AutomationHistoryStoreData = {
      entries: data.entries.filter((entry) => entry.id !== request.id)
    }
    writeStoreData(userDataPath, nextData)

    return {
      entries: sortEntries(nextData.entries)
    }
  }

  const clear = (request?: AutomationHistoryClearRequest): AutomationHistoryListResult => {
    const data = readStoreData(userDataPath)
    const preserveRunning = request?.preserveRunning ?? true

    const nextEntries = preserveRunning
      ? data.entries.filter((entry) => entry.status === 'running')
      : []
    const nextData: AutomationHistoryStoreData = {
      entries: sortEntries(nextEntries)
    }
    writeStoreData(userDataPath, nextData)

    return {
      entries: nextData.entries
    }
  }

  const markWorkflowDeleted = (workflowId: string): AutomationHistoryListResult => {
    const data = readStoreData(userDataPath)
    const nextData: AutomationHistoryStoreData = {
      entries: data.entries.map((entry) => {
        if (entry.workflowId !== workflowId) {
          return entry
        }

        return {
          ...entry,
          workflowDeleted: true
        }
      })
    }

    writeStoreData(userDataPath, nextData)
    return {
      entries: sortEntries(nextData.entries)
    }
  }

  return {
    recordRunStarted,
    recordRunFinished,
    list,
    remove,
    clear,
    markWorkflowDeleted
  }
}
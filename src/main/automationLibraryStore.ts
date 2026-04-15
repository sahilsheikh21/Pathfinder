import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  AutomationLibraryDeleteRequest,
  AutomationLibraryItem,
  AutomationLibraryListRequest,
  AutomationLibraryResult,
  AutomationLibraryRunRequest,
  AutomationLibraryUpsertRequest
} from '../shared/browser'

interface AutomationLibraryStoreData {
  items: AutomationLibraryItem[]
}

interface AutomationLibraryRunResolution {
  item: AutomationLibraryItem
  sourcePath: string
  sourceLabel: AutomationLibraryRunRequest['sourceLabel']
}

const AUTOMATION_LIBRARY_FILE_NAME = 'automation-library.json'

const getStorePath = (userDataPath: string): string => {
  return join(userDataPath, AUTOMATION_LIBRARY_FILE_NAME)
}

const defaultData = (): AutomationLibraryStoreData => {
  return {
    items: []
  }
}

const normalizeTags = (tags: string[]): string[] => {
  const unique = new Set<string>()
  for (const tag of tags) {
    const normalized = tag.trim().toLowerCase()
    if (normalized) {
      unique.add(normalized)
    }
  }

  return [...unique]
}

const normalizeName = (name: string): string => name.trim().replace(/\s+/g, ' ')

const isLibraryItem = (value: unknown): value is AutomationLibraryItem => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const item = value as Partial<AutomationLibraryItem>
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.tags !== 'undefined' &&
    Array.isArray(item.tags) &&
    typeof item.origin === 'string' &&
    (item.origin === 'recorded' || item.origin === 'imported') &&
    typeof item.updatedAt === 'string' &&
    (typeof item.lastRunAt === 'string' || item.lastRunAt === null) &&
    (typeof item.workflowPath === 'string' || typeof item.workflowDocument === 'object')
  )
}

const isStoreData = (value: unknown): value is AutomationLibraryStoreData => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const data = value as Partial<AutomationLibraryStoreData>
  return Array.isArray(data.items) && data.items.every((item) => isLibraryItem(item))
}

const sortItems = (items: AutomationLibraryItem[]): AutomationLibraryItem[] => {
  return [...items].sort((left, right) => {
    const leftRun = left.lastRunAt ? Date.parse(left.lastRunAt) : Number.NEGATIVE_INFINITY
    const rightRun = right.lastRunAt ? Date.parse(right.lastRunAt) : Number.NEGATIVE_INFINITY
    if (leftRun !== rightRun) {
      return rightRun - leftRun
    }

    return Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
  })
}

const readStoreData = (userDataPath: string): AutomationLibraryStoreData => {
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
      items: sortItems(parsed.items)
    }
  } catch {
    const defaults = defaultData()
    writeFileSync(storePath, JSON.stringify(defaults, null, 2), 'utf8')
    return defaults
  }
}

const writeStoreData = (userDataPath: string, data: AutomationLibraryStoreData): void => {
  writeFileSync(getStorePath(userDataPath), JSON.stringify(data, null, 2), 'utf8')
}

const applyDuplicateSuffix = (
  normalizedName: string,
  existingItems: AutomationLibraryItem[],
  currentId?: string
): string => {
  const currentLower = normalizedName.toLowerCase()
  const conflicting = existingItems.filter(
    (item) => item.id !== currentId && item.name.trim().toLowerCase() === currentLower
  )

  if (conflicting.length === 0) {
    return normalizedName
  }

  let suffix = 2
  let candidate = `${normalizedName} (${suffix})`
  while (
    existingItems.some(
      (item) => item.id !== currentId && item.name.trim().toLowerCase() === candidate.toLowerCase()
    )
  ) {
    suffix += 1
    candidate = `${normalizedName} (${suffix})`
  }

  return candidate
}

const normalizeItemInput = (
  item: AutomationLibraryUpsertRequest['item'],
  existingItems: AutomationLibraryItem[]
): AutomationLibraryItem => {
  const trimmedName = normalizeName(item.name)
  if (!trimmedName) {
    throw new Error('Automation name must not be empty.')
  }

  const id = item.id.trim() || randomUUID()
  const now = new Date().toISOString()
  const tags = normalizeTags(item.tags)

  const nextName = applyDuplicateSuffix(trimmedName, existingItems, id)
  const previous = existingItems.find((entry) => entry.id === id)

  const normalized: AutomationLibraryItem = {
    id,
    name: nextName,
    tags,
    origin: item.origin,
    updatedAt: now,
    lastRunAt: previous?.lastRunAt ?? null,
    ...(item.description?.trim() ? { description: item.description.trim() } : {}),
    ...(item.workflowPath ? { workflowPath: item.workflowPath.trim() } : {}),
    ...(item.workflowDocument ? { workflowDocument: item.workflowDocument } : {})
  }

  if (!normalized.workflowPath && !normalized.workflowDocument) {
    throw new Error('Automation entry requires workflowPath or workflowDocument.')
  }

  return normalized
}

export interface AutomationLibraryStore {
  list: (request?: AutomationLibraryListRequest) => AutomationLibraryResult
  upsert: (request: AutomationLibraryUpsertRequest) => AutomationLibraryResult
  remove: (request: AutomationLibraryDeleteRequest) => AutomationLibraryResult
  resolveRun: (request: AutomationLibraryRunRequest) => AutomationLibraryRunResolution
  markLastRunAt: (id: string, timestamp?: string) => AutomationLibraryResult
  getById: (id: string) => AutomationLibraryItem | null
}

export const createAutomationLibraryStore = (userDataPath: string): AutomationLibraryStore => {
  const list = (request?: AutomationLibraryListRequest): AutomationLibraryResult => {
    const data = readStoreData(userDataPath)
    const query = request?.filter?.query?.trim().toLowerCase() ?? ''
    const requestedTags = normalizeTags(request?.filter?.tags ?? [])

    const filtered = data.items.filter((item) => {
      const matchesQuery =
        !query ||
        item.name.toLowerCase().includes(query) ||
        (item.description ?? '').toLowerCase().includes(query) ||
        item.tags.some((tag) => tag.includes(query))

      const matchesTags =
        requestedTags.length === 0 || item.tags.some((tag) => requestedTags.includes(tag))

      return matchesQuery && matchesTags
    })

    return {
      items: sortItems(filtered)
    }
  }

  const upsert = (request: AutomationLibraryUpsertRequest): AutomationLibraryResult => {
    const data = readStoreData(userDataPath)
    const normalized = normalizeItemInput(request.item, data.items)
    const existingIndex = data.items.findIndex((item) => item.id === normalized.id)

    const nextItems = [...data.items]
    if (existingIndex >= 0) {
      nextItems[existingIndex] = normalized
    } else {
      nextItems.push(normalized)
    }

    const nextData: AutomationLibraryStoreData = {
      items: sortItems(nextItems)
    }

    writeStoreData(userDataPath, nextData)
    return {
      items: nextData.items,
      item: normalized
    }
  }

  const remove = (request: AutomationLibraryDeleteRequest): AutomationLibraryResult => {
    const data = readStoreData(userDataPath)
    const nextData: AutomationLibraryStoreData = {
      items: data.items.filter((item) => item.id !== request.id)
    }

    writeStoreData(userDataPath, nextData)
    return {
      items: sortItems(nextData.items)
    }
  }

  const resolveRun = (request: AutomationLibraryRunRequest): AutomationLibraryRunResolution => {
    const data = readStoreData(userDataPath)
    const item = data.items.find((entry) => entry.id === request.id)

    if (!item) {
      throw new Error('Automation entry not found.')
    }

    if (!item.workflowPath || !item.workflowPath.trim()) {
      throw new Error('Automation entry does not have a runnable workflow path.')
    }

    return {
      item,
      sourcePath: item.workflowPath,
      sourceLabel: request.sourceLabel ?? 'sidebar'
    }
  }

  const markLastRunAt = (id: string, timestamp?: string): AutomationLibraryResult => {
    const data = readStoreData(userDataPath)
    const nextItems = data.items.map((item) => {
      if (item.id !== id) {
        return item
      }

      return {
        ...item,
        lastRunAt: timestamp ?? new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    })

    const nextData: AutomationLibraryStoreData = {
      items: sortItems(nextItems)
    }
    writeStoreData(userDataPath, nextData)

    return {
      items: nextData.items,
      ...(nextData.items.find((item) => item.id === id)
        ? { item: nextData.items.find((item) => item.id === id) as AutomationLibraryItem }
        : {})
    }
  }

  const getById = (id: string): AutomationLibraryItem | null => {
    const data = readStoreData(userDataPath)
    return data.items.find((item) => item.id === id) ?? null
  }

  return {
    list,
    upsert,
    remove,
    resolveRun,
    markLastRunAt,
    getById
  }
}
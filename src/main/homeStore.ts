import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  DEFAULT_HOME_SEARCH_TEMPLATE,
  type HomePreferences,
  type QuickLink,
  type RecentAutomationPreview
} from '../shared/browser'

interface HomeStoreData {
  preferences: HomePreferences
  quickLinks: QuickLink[]
}

const HOME_STORE_FILE_NAME = 'home-starter.json'

const DEFAULT_QUICK_LINKS: QuickLink[] = [
  { id: 'gh', title: 'GitHub', url: 'https://github.com', pinned: true, order: 0 },
  { id: 'ddg', title: 'DuckDuckGo', url: 'https://duckduckgo.com', pinned: true, order: 1 },
  { id: 'yt', title: 'YouTube', url: 'https://www.youtube.com', pinned: false, order: 2 },
  { id: 'hn', title: 'Hacker News', url: 'https://news.ycombinator.com', pinned: false, order: 3 },
  { id: 'rd', title: 'Reddit', url: 'https://www.reddit.com', pinned: false, order: 4 },
  { id: 'gm', title: 'Gmail', url: 'https://mail.google.com', pinned: false, order: 5 }
]

const getStorePath = (userDataPath: string): string => {
  return join(userDataPath, HOME_STORE_FILE_NAME)
}

const defaultData = (): HomeStoreData => {
  return {
    preferences: {
      searchTemplate: DEFAULT_HOME_SEARCH_TEMPLATE
    },
    quickLinks: DEFAULT_QUICK_LINKS
  }
}

const isHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const isValidPreferences = (value: unknown): value is HomePreferences => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const preferences = value as Partial<HomePreferences>
  return typeof preferences.searchTemplate === 'string' && preferences.searchTemplate.includes('{query}')
}

const isValidQuickLink = (value: unknown): value is QuickLink => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const quickLink = value as Partial<QuickLink>
  return (
    typeof quickLink.id === 'string' &&
    typeof quickLink.title === 'string' &&
    typeof quickLink.url === 'string' &&
    typeof quickLink.pinned === 'boolean' &&
    typeof quickLink.order === 'number' &&
    isHttpUrl(quickLink.url)
  )
}

const isValidStoreData = (value: unknown): value is HomeStoreData => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const store = value as Partial<HomeStoreData>
  if (!isValidPreferences(store.preferences)) {
    return false
  }

  if (!Array.isArray(store.quickLinks) || !store.quickLinks.every((quickLink) => isValidQuickLink(quickLink))) {
    return false
  }

  return true
}

const sortQuickLinks = (quickLinks: QuickLink[]): QuickLink[] => {
  return [...quickLinks].sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return left.pinned ? -1 : 1
    }

    if (left.order !== right.order) {
      return left.order - right.order
    }

    return left.title.localeCompare(right.title)
  })
}

const readStoreData = (userDataPath: string): HomeStoreData => {
  const storePath = getStorePath(userDataPath)

  if (!existsSync(storePath)) {
    const defaults = defaultData()
    writeFileSync(storePath, JSON.stringify(defaults, null, 2), 'utf8')
    return defaults
  }

  try {
    const fileContent = readFileSync(storePath, 'utf8')
    const parsed = JSON.parse(fileContent) as unknown

    if (!isValidStoreData(parsed)) {
      const defaults = defaultData()
      writeFileSync(storePath, JSON.stringify(defaults, null, 2), 'utf8')
      return defaults
    }

    return {
      preferences: parsed.preferences,
      quickLinks: sortQuickLinks(parsed.quickLinks)
    }
  } catch {
    const defaults = defaultData()
    writeFileSync(storePath, JSON.stringify(defaults, null, 2), 'utf8')
    return defaults
  }
}

const writeStoreData = (userDataPath: string, data: HomeStoreData): void => {
  const storePath = getStorePath(userDataPath)
  writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf8')
}

const normalizeQuickLink = (quickLink: QuickLink): QuickLink => {
  const title = quickLink.title.trim()
  const url = quickLink.url.trim()

  if (!isHttpUrl(url)) {
    throw new Error('Quick link URL must use http:// or https://')
  }

  return {
    id: quickLink.id.trim(),
    title,
    url,
    pinned: quickLink.pinned,
    order: quickLink.order
  }
}

export interface HomeStore {
  getHomePreferences: () => HomePreferences
  saveHomePreferences: (input: HomePreferences) => HomePreferences
  listQuickLinks: () => QuickLink[]
  upsertQuickLink: (input: QuickLink) => QuickLink[]
  removeQuickLink: (id: string) => QuickLink[]
  listRecentAutomations: () => RecentAutomationPreview[]
}

export const createHomeStore = (userDataPath: string): HomeStore => {
  return {
    getHomePreferences: () => {
      const data = readStoreData(userDataPath)
      return data.preferences
    },
    saveHomePreferences: (input: HomePreferences) => {
      const data = readStoreData(userDataPath)
      const nextPreferences: HomePreferences = isValidPreferences(input)
        ? input
        : { searchTemplate: DEFAULT_HOME_SEARCH_TEMPLATE }

      const nextData: HomeStoreData = {
        preferences: nextPreferences,
        quickLinks: data.quickLinks
      }

      writeStoreData(userDataPath, nextData)
      return nextPreferences
    },
    listQuickLinks: () => {
      const data = readStoreData(userDataPath)
      return sortQuickLinks(data.quickLinks)
    },
    upsertQuickLink: (input: QuickLink) => {
      const data = readStoreData(userDataPath)
      const normalized = normalizeQuickLink(input)
      const existingIndex = data.quickLinks.findIndex((quickLink) => quickLink.id === normalized.id)

      const nextQuickLinks = [...data.quickLinks]
      if (existingIndex >= 0) {
        nextQuickLinks[existingIndex] = normalized
      } else {
        nextQuickLinks.push(normalized)
      }

      const nextData: HomeStoreData = {
        preferences: data.preferences,
        quickLinks: sortQuickLinks(nextQuickLinks)
      }

      writeStoreData(userDataPath, nextData)
      return nextData.quickLinks
    },
    removeQuickLink: (id: string) => {
      const data = readStoreData(userDataPath)
      const nextData: HomeStoreData = {
        preferences: data.preferences,
        quickLinks: data.quickLinks.filter((quickLink) => quickLink.id !== id)
      }

      writeStoreData(userDataPath, nextData)
      return sortQuickLinks(nextData.quickLinks)
    },
    listRecentAutomations: () => {
      // HOME-03 contract: this will map most-recently executed automation runs in a later phase.
      const recentAutomations: RecentAutomationPreview[] = []
      return recentAutomations
    }
  }
}

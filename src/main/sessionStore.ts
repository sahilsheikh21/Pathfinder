import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { BrowserSessionSnapshot, BrowserTabState } from '../shared/browser'

const SESSION_FILE_NAME = 'browser-session.json'

const getSessionFilePath = (userDataPath: string): string => {
  return join(userDataPath, SESSION_FILE_NAME)
}

const isValidTabState = (value: unknown): value is BrowserTabState => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const tab = value as Partial<BrowserTabState>
  return (
    typeof tab.id === 'string' &&
    typeof tab.title === 'string' &&
    typeof tab.url === 'string' &&
    typeof tab.isActive === 'boolean' &&
    typeof tab.isLoading === 'boolean' &&
    typeof tab.canGoBack === 'boolean' &&
    typeof tab.canGoForward === 'boolean'
  )
}

const isValidSnapshot = (value: unknown): value is BrowserSessionSnapshot => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const snapshot = value as Partial<BrowserSessionSnapshot>
  if (!Array.isArray(snapshot.tabs) || !snapshot.tabs.every((tab) => isValidTabState(tab))) {
    return false
  }

  if (typeof snapshot.savedAt !== 'string') {
    return false
  }

  if (snapshot.activeTabId !== null && typeof snapshot.activeTabId !== 'string') {
    return false
  }

  return true
}

export const loadSessionSnapshot = (userDataPath: string): BrowserSessionSnapshot | null => {
  const sessionFilePath = getSessionFilePath(userDataPath)

  if (!existsSync(sessionFilePath)) {
    return null
  }

  try {
    const fileContent = readFileSync(sessionFilePath, 'utf8')
    const parsed = JSON.parse(fileContent) as unknown

    if (!isValidSnapshot(parsed)) {
      clearInvalidSnapshot(userDataPath)
      return null
    }

    return parsed
  } catch {
    clearInvalidSnapshot(userDataPath)
    return null
  }
}

export const saveSessionSnapshot = (userDataPath: string, snapshot: BrowserSessionSnapshot): void => {
  const sessionFilePath = getSessionFilePath(userDataPath)
  writeFileSync(sessionFilePath, JSON.stringify(snapshot, null, 2), 'utf8')
}

export const clearInvalidSnapshot = (userDataPath: string): void => {
  const sessionFilePath = getSessionFilePath(userDataPath)
  if (existsSync(sessionFilePath)) {
    unlinkSync(sessionFilePath)
  }
}
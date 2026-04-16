import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  HOME_STARTER_URL,
  type BrowserCookieMode,
  type BrowserGeneralSettings,
  type BrowserPrivacySettings,
  type BrowserSettingsRepairNotice,
  type BrowserSettingsSaveGeneralRequest,
  type BrowserSettingsSaveGeneralResult,
  type BrowserSettingsSavePrivacyRequest,
  type BrowserSettingsSavePrivacyResult,
  type BrowserSettingsSnapshot,
  type BrowserSettingsValidationError
} from '../shared/browser'

interface SettingsStoreData {
  general: BrowserGeneralSettings
  privacy: BrowserPrivacySettings
  updatedAt: string
  repairNotice: BrowserSettingsRepairNotice | null
}

const SETTINGS_STORE_FILE_NAME = 'browser-settings.json'

const SETTINGS_STARTUP_MODES = new Set(['restore-last-session', 'open-home', 'open-urls'])
const SETTINGS_HOMEPAGE_MODES = new Set(['home-starter', 'custom-url'])
const SETTINGS_DOWNLOADS_MODES = new Set(['ask-every-time', 'fixed-path'])
const SETTINGS_COOKIE_MODES = new Set(['allow-all', 'block-third-party', 'block-all'])

const getStorePath = (userDataPath: string): string => {
  return join(userDataPath, SETTINGS_STORE_FILE_NAME)
}

const isHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const defaultSnapshot = (): BrowserSettingsSnapshot => ({
  general: {
    startupMode: 'restore-last-session',
    startupUrls: [],
    homepageMode: 'home-starter',
    homepageUrl: HOME_STARTER_URL,
    downloadsMode: 'ask-every-time',
    downloadsPath: ''
  },
  privacy: {
    cookieMode: 'allow-all'
  },
  updatedAt: new Date().toISOString(),
  repairNotice: null
})

const toData = (snapshot: BrowserSettingsSnapshot): SettingsStoreData => ({
  general: snapshot.general,
  privacy: snapshot.privacy,
  updatedAt: snapshot.updatedAt,
  repairNotice: snapshot.repairNotice
})

const validationError = (
  field: string,
  code: BrowserSettingsValidationError['code'],
  message: string
): BrowserSettingsValidationError => ({
  field,
  code,
  message
})

const normalizeGeneralSettings = (
  input: BrowserGeneralSettings
): { ok: true; value: BrowserGeneralSettings } | { ok: false; error: BrowserSettingsValidationError } => {
  if (!SETTINGS_STARTUP_MODES.has(input.startupMode)) {
    return {
      ok: false,
      error: validationError('general.startupMode', 'invalid-selection', 'Startup mode is not supported.')
    }
  }

  const startupUrls = Array.isArray(input.startupUrls)
    ? input.startupUrls.map((value) => value.trim()).filter(Boolean)
    : []

  if (input.startupMode === 'open-urls') {
    if (startupUrls.length === 0) {
      return {
        ok: false,
        error: validationError(
          'general.startupUrls',
          'required',
          'At least one startup URL is required when startup mode is open-urls.'
        )
      }
    }

    const invalidStartupUrl = startupUrls.find((value) => !isHttpUrl(value))
    if (invalidStartupUrl) {
      return {
        ok: false,
        error: validationError(
          'general.startupUrls',
          'invalid-url',
          `Startup URL is invalid: ${invalidStartupUrl}`
        )
      }
    }
  }

  if (!SETTINGS_HOMEPAGE_MODES.has(input.homepageMode)) {
    return {
      ok: false,
      error: validationError('general.homepageMode', 'invalid-selection', 'Homepage mode is not supported.')
    }
  }

  const homepageUrl = input.homepageUrl.trim()
  if (input.homepageMode === 'custom-url' && !isHttpUrl(homepageUrl)) {
    return {
      ok: false,
      error: validationError('general.homepageUrl', 'invalid-url', 'Homepage URL must use http:// or https://.')
    }
  }

  if (!SETTINGS_DOWNLOADS_MODES.has(input.downloadsMode)) {
    return {
      ok: false,
      error: validationError('general.downloadsMode', 'invalid-selection', 'Downloads mode is not supported.')
    }
  }

  const downloadsPath = input.downloadsPath.trim()
  if (input.downloadsMode === 'fixed-path' && downloadsPath.length === 0) {
    return {
      ok: false,
      error: validationError(
        'general.downloadsPath',
        'invalid-path',
        'Downloads path cannot be empty when fixed-path mode is selected.'
      )
    }
  }

  return {
    ok: true,
    value: {
      startupMode: input.startupMode,
      startupUrls,
      homepageMode: input.homepageMode,
      homepageUrl: input.homepageMode === 'custom-url' ? homepageUrl : HOME_STARTER_URL,
      downloadsMode: input.downloadsMode,
      downloadsPath: input.downloadsMode === 'fixed-path' ? downloadsPath : ''
    }
  }
}

const normalizePrivacySettings = (
  input: BrowserPrivacySettings
): { ok: true; value: BrowserPrivacySettings } | { ok: false; error: BrowserSettingsValidationError } => {
  if (!SETTINGS_COOKIE_MODES.has(input.cookieMode)) {
    return {
      ok: false,
      error: validationError('privacy.cookieMode', 'invalid-selection', 'Cookie mode is not supported.')
    }
  }

  return {
    ok: true,
    value: {
      cookieMode: input.cookieMode as BrowserCookieMode
    }
  }
}

const isBrowserSettingsSnapshot = (value: unknown): value is BrowserSettingsSnapshot => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<BrowserSettingsSnapshot>

  const hasValidUpdatedAt = typeof candidate.updatedAt === 'string'
  const repairNoticeValid =
    candidate.repairNotice === null ||
    (typeof candidate.repairNotice === 'object' &&
      candidate.repairNotice !== null &&
      typeof candidate.repairNotice.reason === 'string' &&
      typeof candidate.repairNotice.repairedAt === 'string')

  if (!hasValidUpdatedAt || !repairNoticeValid) {
    return false
  }

  if (!candidate.general || typeof candidate.general !== 'object') {
    return false
  }

  if (!candidate.privacy || typeof candidate.privacy !== 'object') {
    return false
  }

  const generalResult = normalizeGeneralSettings(candidate.general as BrowserGeneralSettings)
  const privacyResult = normalizePrivacySettings(candidate.privacy as BrowserPrivacySettings)

  return generalResult.ok && privacyResult.ok
}

const withRepairNotice = (
  snapshot: BrowserSettingsSnapshot,
  reason: BrowserSettingsRepairNotice['reason']
): BrowserSettingsSnapshot => ({
  ...snapshot,
  updatedAt: new Date().toISOString(),
  repairNotice: {
    reason,
    repairedAt: new Date().toISOString()
  }
})

export interface SettingsStore {
  getSnapshot: () => BrowserSettingsSnapshot
  saveGeneral: (request: BrowserSettingsSaveGeneralRequest) => BrowserSettingsSaveGeneralResult
  savePrivacy: (request: BrowserSettingsSavePrivacyRequest) => BrowserSettingsSavePrivacyResult
  getRepairNotice: () => BrowserSettingsRepairNotice | null
  clearAppSettingsSubset: () => BrowserSettingsSnapshot
}

export const createSettingsStore = (userDataPath: string): SettingsStore => {
  const storePath = getStorePath(userDataPath)

  const writeSnapshot = (snapshot: BrowserSettingsSnapshot): BrowserSettingsSnapshot => {
    const nextSnapshot: BrowserSettingsSnapshot = {
      ...snapshot,
      updatedAt: new Date().toISOString()
    }

    writeFileSync(storePath, JSON.stringify(toData(nextSnapshot), null, 2), 'utf8')
    return nextSnapshot
  }

  const recoverSnapshot = (reason: BrowserSettingsRepairNotice['reason']): BrowserSettingsSnapshot => {
    const repairedSnapshot = withRepairNotice(defaultSnapshot(), reason)
    writeSnapshot(repairedSnapshot)
    return repairedSnapshot
  }

  const readSnapshot = (): BrowserSettingsSnapshot => {
    if (!existsSync(storePath)) {
      return writeSnapshot(defaultSnapshot())
    }

    try {
      const raw = readFileSync(storePath, 'utf8')
      const parsed = JSON.parse(raw) as unknown

      const normalized = isBrowserSettingsSnapshot(parsed)
        ? parsed
        : isBrowserSettingsSnapshot((parsed as Partial<SettingsStoreData>)
            ? {
                general: (parsed as Partial<SettingsStoreData>).general,
                privacy: (parsed as Partial<SettingsStoreData>).privacy,
                updatedAt: (parsed as Partial<SettingsStoreData>).updatedAt,
                repairNotice: (parsed as Partial<SettingsStoreData>).repairNotice
              }
            : null)
          ? (parsed as unknown as BrowserSettingsSnapshot)
          : null

      if (!normalized) {
        return recoverSnapshot('invalid-shape')
      }

      return {
        general: normalized.general,
        privacy: normalized.privacy,
        updatedAt: normalized.updatedAt,
        repairNotice: normalized.repairNotice
      }
    } catch {
      return recoverSnapshot('corrupted-file')
    }
  }

  return {
    getSnapshot: () => {
      return readSnapshot()
    },
    saveGeneral: (request) => {
      const snapshot = readSnapshot()
      const normalized = normalizeGeneralSettings(request.general)

      if (!normalized.ok) {
        return {
          ok: false,
          snapshot,
          validationError: normalized.error
        }
      }

      const nextSnapshot = writeSnapshot({
        ...snapshot,
        general: normalized.value
      })

      return {
        ok: true,
        snapshot: nextSnapshot
      }
    },
    savePrivacy: (request) => {
      const snapshot = readSnapshot()
      const normalized = normalizePrivacySettings(request.privacy)

      if (!normalized.ok) {
        return {
          ok: false,
          snapshot,
          validationError: normalized.error
        }
      }

      const nextSnapshot = writeSnapshot({
        ...snapshot,
        privacy: normalized.value
      })

      return {
        ok: true,
        snapshot: nextSnapshot
      }
    },
    getRepairNotice: () => {
      const snapshot = readSnapshot()
      return snapshot.repairNotice
    },
    clearAppSettingsSubset: () => {
      return writeSnapshot(withRepairNotice(defaultSnapshot(), 'validation-failed'))
    }
  }
}
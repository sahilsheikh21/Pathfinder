import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  DEFAULT_APPEARANCE_SETTINGS,
  DEFAULT_SHORTCUT_BINDINGS,
  HOME_STARTER_URL,
  type BrowserAppearanceSettings,
  type BrowserCookieMode,
  type BrowserFontScalePreset,
  type BrowserGeneralSettings,
  type BrowserPrivacySettings,
  type BrowserSettingsRepairNotice,
  type BrowserSettingsSaveAppearanceRequest,
  type BrowserSettingsSaveAppearanceResult,
  type BrowserSettingsSaveGeneralRequest,
  type BrowserSettingsSaveGeneralResult,
  type BrowserSettingsSavePrivacyRequest,
  type BrowserSettingsSavePrivacyResult,
  type BrowserSettingsSaveShortcutsRequest,
  type BrowserSettingsSaveShortcutsResult,
  type BrowserSettingsSnapshot,
  type BrowserSettingsValidationError,
  type BrowserShortcutBinding,
  type BrowserShortcutCommandId,
  type BrowserShortcutSettings,
  type BrowserSidebarPosition,
  type BrowserThemeMode
} from '../shared/browser'

interface SettingsStoreData {
  general: BrowserGeneralSettings
  privacy: BrowserPrivacySettings
  appearance?: BrowserAppearanceSettings
  shortcuts?: BrowserShortcutSettings
  updatedAt: string
  repairNotice: BrowserSettingsRepairNotice | null
}

const SETTINGS_STORE_FILE_NAME = 'browser-settings.json'

const SETTINGS_STARTUP_MODES = new Set(['restore-last-session', 'open-home', 'open-urls'])
const SETTINGS_HOMEPAGE_MODES = new Set(['home-starter', 'custom-url'])
const SETTINGS_DOWNLOADS_MODES = new Set(['ask-every-time', 'fixed-path'])
const SETTINGS_COOKIE_MODES = new Set(['allow-all', 'block-third-party', 'block-all'])
const SETTINGS_THEME_MODES = new Set(['light', 'dark', 'system'])
const SETTINGS_FONT_SCALE_PRESETS = new Set(['small', 'medium', 'large'])
const SETTINGS_SIDEBAR_POSITIONS = new Set(['left', 'right'])
const SETTINGS_SHORTCUT_COMMAND_IDS: BrowserShortcutCommandId[] = [
  'command-palette.open',
  'command-palette.open-legacy',
  'quick-search.toggle',
  'settings.open',
  'sidebar.toggle'
]

const SHORTCUT_MODIFIER_ORDER = ['Ctrl', 'Shift', 'Alt', 'Meta'] as const

const SHORTCUT_MODIFIER_ALIASES: Record<string, (typeof SHORTCUT_MODIFIER_ORDER)[number]> = {
  ctrl: 'Ctrl',
  control: 'Ctrl',
  shift: 'Shift',
  alt: 'Alt',
  option: 'Alt',
  meta: 'Meta',
  cmd: 'Meta',
  command: 'Meta',
  super: 'Meta',
  win: 'Meta',
  windows: 'Meta'
}

const SHORTCUT_KEY_ALIASES: Record<string, string> = {
  comma: ',',
  period: '.',
  slash: '/',
  semicolon: ';',
  quote: "'",
  apostrophe: "'",
  bracketleft: '[',
  bracketright: ']',
  minus: '-',
  equal: '=',
  backquote: '`',
  backtick: '`',
  space: 'Space',
  esc: 'Escape',
  escape: 'Escape',
  enter: 'Enter',
  tab: 'Tab'
}

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
  appearance: {
    ...DEFAULT_APPEARANCE_SETTINGS
  },
  shortcuts: {
    bindings: {
      ...DEFAULT_SHORTCUT_BINDINGS
    }
  },
  updatedAt: new Date().toISOString(),
  repairNotice: null
})

const toData = (snapshot: BrowserSettingsSnapshot): SettingsStoreData => ({
  general: snapshot.general,
  privacy: snapshot.privacy,
  appearance: snapshot.appearance,
  shortcuts: snapshot.shortcuts,
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

const normalizeAppearanceSettings = (
  input: BrowserAppearanceSettings
): { ok: true; value: BrowserAppearanceSettings } | { ok: false; error: BrowserSettingsValidationError } => {
  if (!SETTINGS_THEME_MODES.has(input.themeMode)) {
    return {
      ok: false,
      error: validationError('appearance.themeMode', 'invalid-selection', 'Theme mode is not supported.')
    }
  }

  if (!SETTINGS_FONT_SCALE_PRESETS.has(input.fontScalePreset)) {
    return {
      ok: false,
      error: validationError('appearance.fontScalePreset', 'invalid-selection', 'Font size preset is not supported.')
    }
  }

  if (!SETTINGS_SIDEBAR_POSITIONS.has(input.sidebarPosition)) {
    return {
      ok: false,
      error: validationError('appearance.sidebarPosition', 'invalid-selection', 'Sidebar position is not supported.')
    }
  }

  return {
    ok: true,
    value: {
      themeMode: input.themeMode as BrowserThemeMode,
      fontScalePreset: input.fontScalePreset as BrowserFontScalePreset,
      sidebarPosition: input.sidebarPosition as BrowserSidebarPosition
    }
  }
}

const normalizeShortcutBinding = (
  rawValue: unknown,
  field: string
): { ok: true; value: BrowserShortcutBinding } | { ok: false; error: BrowserSettingsValidationError } => {
  if (typeof rawValue !== 'string') {
    return {
      ok: false,
      error: validationError(field, 'invalid-binding', 'Shortcut binding must be a string.')
    }
  }

  const trimmed = rawValue.trim()
  if (!trimmed) {
    return {
      ok: false,
      error: validationError(field, 'invalid-binding', 'Shortcut binding cannot be empty.')
    }
  }

  const parts = trimmed
    .split('+')
    .map((token) => token.trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return {
      ok: false,
      error: validationError(field, 'invalid-binding', 'Shortcut binding format is invalid.')
    }
  }

  const modifiers = new Set<(typeof SHORTCUT_MODIFIER_ORDER)[number]>()
  let keyToken: string | null = null

  for (const token of parts) {
    const normalizedToken = token.replace(/\s+/g, '')
    const lower = normalizedToken.toLowerCase()
    const modifier = SHORTCUT_MODIFIER_ALIASES[lower]

    if (modifier) {
      modifiers.add(modifier)
      continue
    }

    if (keyToken !== null) {
      return {
        ok: false,
        error: validationError(field, 'invalid-binding', 'Shortcut can only include one non-modifier key.')
      }
    }

    keyToken = normalizedToken
  }

  if (!keyToken) {
    return {
      ok: false,
      error: validationError(field, 'invalid-binding', 'Shortcut binding requires a key.')
    }
  }

  const lowerKey = keyToken.toLowerCase()
  let normalizedKey = SHORTCUT_KEY_ALIASES[lowerKey]

  if (!normalizedKey) {
    if (/^[a-z0-9]$/i.test(keyToken)) {
      normalizedKey = keyToken.toUpperCase()
    } else if (/^f([1-9]|1[0-2])$/i.test(keyToken)) {
      normalizedKey = keyToken.toUpperCase()
    } else if ([',', '.', '/', ';', "'", '[', ']', '-', '=', '`'].includes(keyToken)) {
      normalizedKey = keyToken
    }
  }

  if (!normalizedKey) {
    return {
      ok: false,
      error: validationError(
        field,
        'invalid-binding',
        `Shortcut key "${keyToken}" is not supported.`
      )
    }
  }

  const orderedModifiers = SHORTCUT_MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier))
  const value = orderedModifiers.length > 0 ? `${orderedModifiers.join('+')}+${normalizedKey}` : normalizedKey

  return {
    ok: true,
    value
  }
}

const normalizeShortcutSettings = (
  input: BrowserShortcutSettings,
  options?: { allowMissingCommands?: boolean }
): { ok: true; value: BrowserShortcutSettings } | { ok: false; error: BrowserSettingsValidationError } => {
  const allowMissingCommands = options?.allowMissingCommands ?? false

  if (!input || typeof input !== 'object' || !input.bindings || typeof input.bindings !== 'object') {
    return {
      ok: false,
      error: validationError('shortcuts.bindings', 'required', 'Shortcut bindings are required.')
    }
  }

  const normalizedBindings: BrowserShortcutSettings['bindings'] = {
    ...DEFAULT_SHORTCUT_BINDINGS
  }

  for (const commandId of SETTINGS_SHORTCUT_COMMAND_IDS) {
    const field = `shortcuts.bindings.${commandId}`
    const rawBinding = input.bindings[commandId]

    if ((rawBinding === undefined || rawBinding === null) && allowMissingCommands) {
      continue
    }

    if (rawBinding === undefined || rawBinding === null) {
      return {
        ok: false,
        error: validationError(field, 'required', 'Shortcut binding is required.')
      }
    }

    const normalizedBinding = normalizeShortcutBinding(rawBinding, field)
    if (!normalizedBinding.ok) {
      return normalizedBinding
    }

    normalizedBindings[commandId] = normalizedBinding.value
  }

  const seenBindings = new Map<string, BrowserShortcutCommandId>()
  for (const commandId of SETTINGS_SHORTCUT_COMMAND_IDS) {
    const binding = normalizedBindings[commandId]
    const existingCommandId = seenBindings.get(binding)

    if (existingCommandId) {
      return {
        ok: false,
        error: validationError(
          `shortcuts.bindings.${commandId}`,
          'binding-conflict',
          `Shortcut binding conflicts with ${existingCommandId}.`
        )
      }
    }

    seenBindings.set(binding, commandId)
  }

  return {
    ok: true,
    value: {
      bindings: normalizedBindings
    }
  }
}

const toRepairNotice = (value: unknown): BrowserSettingsRepairNotice | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<BrowserSettingsRepairNotice>

  if (
    (candidate.reason === 'corrupted-file' ||
      candidate.reason === 'invalid-shape' ||
      candidate.reason === 'validation-failed') &&
    typeof candidate.repairedAt === 'string'
  ) {
    return {
      reason: candidate.reason,
      repairedAt: candidate.repairedAt
    }
  }

  return null
}

const normalizeSnapshotCandidate = (
  value: unknown
):
  | { ok: true; value: BrowserSettingsSnapshot; upgraded: boolean }
  | { ok: false; reason: BrowserSettingsRepairNotice['reason'] } => {
  if (!value || typeof value !== 'object') {
    return { ok: false, reason: 'invalid-shape' }
  }

  const candidate = value as Partial<SettingsStoreData>
  const defaults = defaultSnapshot()
  let upgraded = false

  const normalizedGeneral = candidate.general
    ? normalizeGeneralSettings(candidate.general)
    : { ok: true as const, value: defaults.general }
  if (!normalizedGeneral.ok) {
    return { ok: false, reason: 'validation-failed' }
  }
  if (!candidate.general) {
    upgraded = true
  }

  const normalizedPrivacy = candidate.privacy
    ? normalizePrivacySettings(candidate.privacy)
    : { ok: true as const, value: defaults.privacy }
  if (!normalizedPrivacy.ok) {
    return { ok: false, reason: 'validation-failed' }
  }
  if (!candidate.privacy) {
    upgraded = true
  }

  const normalizedAppearance = candidate.appearance
    ? normalizeAppearanceSettings(candidate.appearance)
    : { ok: true as const, value: defaults.appearance }
  if (!normalizedAppearance.ok) {
    return { ok: false, reason: 'validation-failed' }
  }
  if (!candidate.appearance) {
    upgraded = true
  }

  const normalizedShortcuts = candidate.shortcuts
    ? normalizeShortcutSettings(candidate.shortcuts, { allowMissingCommands: true })
    : { ok: true as const, value: defaults.shortcuts }
  if (!normalizedShortcuts.ok) {
    return { ok: false, reason: 'validation-failed' }
  }
  if (!candidate.shortcuts) {
    upgraded = true
  }

  const updatedAt = typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date().toISOString()
  if (typeof candidate.updatedAt !== 'string') {
    upgraded = true
  }

  const repairNotice = toRepairNotice(candidate.repairNotice)
  if (candidate.repairNotice !== undefined && repairNotice === null) {
    upgraded = true
  }

  return {
    ok: true,
    upgraded,
    value: {
      general: normalizedGeneral.value,
      privacy: normalizedPrivacy.value,
      appearance: normalizedAppearance.value,
      shortcuts: normalizedShortcuts.value,
      updatedAt,
      repairNotice
    }
  }
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
  saveAppearance: (request: BrowserSettingsSaveAppearanceRequest) => BrowserSettingsSaveAppearanceResult
  saveShortcuts: (request: BrowserSettingsSaveShortcutsRequest) => BrowserSettingsSaveShortcutsResult
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
      const normalized = normalizeSnapshotCandidate(parsed)

      if (!normalized.ok) {
        return recoverSnapshot(normalized.reason)
      }

      if (normalized.upgraded) {
        return writeSnapshot(normalized.value)
      }

      return normalized.value
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
    saveAppearance: (request) => {
      const snapshot = readSnapshot()
      const normalized = normalizeAppearanceSettings(request.appearance)

      if (!normalized.ok) {
        return {
          ok: false,
          snapshot,
          validationError: normalized.error
        }
      }

      const nextSnapshot = writeSnapshot({
        ...snapshot,
        appearance: normalized.value
      })

      return {
        ok: true,
        snapshot: nextSnapshot
      }
    },
    saveShortcuts: (request) => {
      const snapshot = readSnapshot()
      const normalized = normalizeShortcutSettings(request.shortcuts)

      if (!normalized.ok) {
        return {
          ok: false,
          snapshot,
          validationError: normalized.error
        }
      }

      const nextSnapshot = writeSnapshot({
        ...snapshot,
        shortcuts: normalized.value
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

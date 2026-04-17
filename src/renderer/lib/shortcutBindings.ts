import type { BrowserShortcutBindings, BrowserShortcutCommandId } from '../../shared/browser'

interface ParsedShortcutBinding {
  ctrl: boolean
  shift: boolean
  alt: boolean
  meta: boolean
  key: string
}

const MODIFIER_ORDER = ['Ctrl', 'Shift', 'Alt', 'Meta'] as const

const MODIFIER_ALIAS: Record<string, (typeof MODIFIER_ORDER)[number]> = {
  ctrl: 'Ctrl',
  control: 'Ctrl',
  shift: 'Shift',
  alt: 'Alt',
  option: 'Alt',
  meta: 'Meta',
  command: 'Meta',
  cmd: 'Meta',
  win: 'Meta',
  windows: 'Meta',
  super: 'Meta'
}

const KEY_ALIAS: Record<string, string> = {
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

const isSupportedSingleKey = (value: string): boolean => {
  return [',', '.', '/', ';', "'", '[', ']', '-', '=', '`'].includes(value)
}

const normalizeKeyToken = (token: string): string | null => {
  const lower = token.toLowerCase()
  const aliased = KEY_ALIAS[lower]
  if (aliased) {
    return aliased
  }

  if (/^[a-z0-9]$/i.test(token)) {
    return token.toUpperCase()
  }

  if (/^f([1-9]|1[0-2])$/i.test(token)) {
    return token.toUpperCase()
  }

  if (isSupportedSingleKey(token)) {
    return token
  }

  return null
}

const parseBinding = (binding: string): ParsedShortcutBinding | null => {
  const tokens = binding
    .trim()
    .split('+')
    .map((token) => token.trim())
    .filter(Boolean)

  if (tokens.length === 0) {
    return null
  }

  let keyToken: string | null = null
  const modifiers = new Set<(typeof MODIFIER_ORDER)[number]>()

  for (const rawToken of tokens) {
    const token = rawToken.replace(/\s+/g, '')
    const modifier = MODIFIER_ALIAS[token.toLowerCase()]

    if (modifier) {
      modifiers.add(modifier)
      continue
    }

    if (keyToken !== null) {
      return null
    }

    keyToken = token
  }

  if (!keyToken) {
    return null
  }

  const normalizedKey = normalizeKeyToken(keyToken)
  if (!normalizedKey) {
    return null
  }

  return {
    ctrl: modifiers.has('Ctrl'),
    shift: modifiers.has('Shift'),
    alt: modifiers.has('Alt'),
    meta: modifiers.has('Meta'),
    key: normalizedKey
  }
}

const stringifyBinding = (parsed: ParsedShortcutBinding): string => {
  const modifiers = MODIFIER_ORDER.filter((modifier) => {
    if (modifier === 'Ctrl') {
      return parsed.ctrl
    }

    if (modifier === 'Shift') {
      return parsed.shift
    }

    if (modifier === 'Alt') {
      return parsed.alt
    }

    return parsed.meta
  })

  return modifiers.length > 0 ? `${modifiers.join('+')}+${parsed.key}` : parsed.key
}

export const normalizeShortcutBinding = (binding: string): string | null => {
  const parsed = parseBinding(binding)
  return parsed ? stringifyBinding(parsed) : null
}

export const normalizeShortcutBindings = (
  bindings: BrowserShortcutBindings
): {
  normalized: BrowserShortcutBindings
  errors: Partial<Record<BrowserShortcutCommandId, string>>
} => {
  const normalized = { ...bindings }
  const errors: Partial<Record<BrowserShortcutCommandId, string>> = {}

  const commandIds = Object.keys(bindings) as BrowserShortcutCommandId[]
  for (const commandId of commandIds) {
    const normalizedBinding = normalizeShortcutBinding(bindings[commandId])
    if (!normalizedBinding) {
      errors[commandId] = 'Shortcut binding format is invalid.'
      continue
    }

    normalized[commandId] = normalizedBinding
  }

  return {
    normalized,
    errors
  }
}

export const findShortcutConflicts = (
  bindings: BrowserShortcutBindings
): Partial<Record<BrowserShortcutCommandId, string>> => {
  const commandIds = Object.keys(bindings) as BrowserShortcutCommandId[]
  const byBinding = new Map<string, BrowserShortcutCommandId[]>()

  for (const commandId of commandIds) {
    const normalizedBinding = normalizeShortcutBinding(bindings[commandId])
    if (!normalizedBinding) {
      continue
    }

    const existing = byBinding.get(normalizedBinding)
    if (existing) {
      existing.push(commandId)
    } else {
      byBinding.set(normalizedBinding, [commandId])
    }
  }

  const conflicts: Partial<Record<BrowserShortcutCommandId, string>> = {}
  for (const [binding, commands] of byBinding.entries()) {
    if (commands.length < 2) {
      continue
    }

    const conflictMessage = `Binding ${formatShortcutBinding(binding)} conflicts with ${commands.join(', ')}.`
    for (const commandId of commands) {
      conflicts[commandId] = conflictMessage
    }
  }

  return conflicts
}

const normalizeEventKey = (rawKey: string): string => {
  if (!rawKey) {
    return ''
  }

  if (rawKey.length === 1) {
    if (isSupportedSingleKey(rawKey)) {
      return rawKey
    }

    return rawKey.toUpperCase()
  }

  const lower = rawKey.toLowerCase()
  return KEY_ALIAS[lower] ?? rawKey
}

export const matchesKeyboardEvent = (event: KeyboardEvent, binding: string): boolean => {
  const parsed = parseBinding(binding)
  if (!parsed) {
    return false
  }

  return (
    event.ctrlKey === parsed.ctrl &&
    event.shiftKey === parsed.shift &&
    event.altKey === parsed.alt &&
    event.metaKey === parsed.meta &&
    normalizeEventKey(event.key) === parsed.key
  )
}

export const formatShortcutBinding = (binding: string): string => {
  const normalized = normalizeShortcutBinding(binding)
  if (!normalized) {
    return binding
  }

  return normalized.replace(/\+/g, ' + ')
}

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  LLMProviderCapability,
  LLMProviderConfig,
  LLMProviderConfigPatch,
  LLMProviderId
} from '../../shared/browser'
import {
  clampLlmTimeout,
  DEFAULT_LLM_TIMEOUT_MS,
  type LLMProviderConfigSnapshot
} from './adapterTypes'

interface ProviderScopedConfig {
  model: string
  endpoint?: string
  timeoutMs: number
  capabilities?: Partial<LLMProviderCapability>
}

interface ProviderConfigStoreData {
  selectedProvider: LLMProviderId
  providers: Record<LLMProviderId, ProviderScopedConfig>
  updatedAt: string
}

const PROVIDER_CONFIG_FILE_NAME = 'llm-provider-config.json'

const defaultCapabilities = (): LLMProviderCapability => ({
  streaming: false,
  jsonMode: false,
  toolCalls: false,
  systemRole: true
})

const defaultProviderConfig = (provider: LLMProviderId): ProviderScopedConfig => ({
  model: provider === 'openai' ? 'gpt-4o-mini' : 'llama3.2',
  ...(provider === 'ollama' ? { endpoint: 'http://127.0.0.1:11434' } : {}),
  timeoutMs: DEFAULT_LLM_TIMEOUT_MS,
  capabilities: defaultCapabilities()
})

const defaultData = (): ProviderConfigStoreData => ({
  selectedProvider: 'openai',
  providers: {
    openai: defaultProviderConfig('openai'),
    ollama: defaultProviderConfig('ollama')
  },
  updatedAt: new Date().toISOString()
})

const isProviderId = (value: unknown): value is LLMProviderId => {
  return value === 'openai' || value === 'ollama'
}

const normalizeEndpoint = (value: string | null | undefined): string | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return undefined
    }

    return parsed.toString().replace(/\/$/, '')
  } catch {
    return undefined
  }
}

const normalizeCapabilities = (
  incoming: Partial<LLMProviderCapability> | undefined,
  fallback: Partial<LLMProviderCapability> | undefined
): Partial<LLMProviderCapability> => {
  const base = fallback ?? {}
  const next: Partial<LLMProviderCapability> = {}

  const streaming =
    typeof incoming?.streaming === 'boolean' ? incoming.streaming : base.streaming
  if (typeof streaming === 'boolean') {
    next.streaming = streaming
  }

  const jsonMode = typeof incoming?.jsonMode === 'boolean' ? incoming.jsonMode : base.jsonMode
  if (typeof jsonMode === 'boolean') {
    next.jsonMode = jsonMode
  }

  const toolCalls =
    typeof incoming?.toolCalls === 'boolean' ? incoming.toolCalls : base.toolCalls
  if (typeof toolCalls === 'boolean') {
    next.toolCalls = toolCalls
  }

  const systemRole =
    typeof incoming?.systemRole === 'boolean' ? incoming.systemRole : base.systemRole
  if (typeof systemRole === 'boolean') {
    next.systemRole = systemRole
  }

  return next
}

const normalizeScopedConfig = (
  provider: LLMProviderId,
  value: Partial<ProviderScopedConfig> | undefined
): ProviderScopedConfig => {
  const fallback = defaultProviderConfig(provider)
  const model = typeof value?.model === 'string' && value.model.trim() ? value.model.trim() : fallback.model
  const endpoint = normalizeEndpoint(value?.endpoint)
  const timeoutMs = clampLlmTimeout(value?.timeoutMs)

  return {
    model,
    timeoutMs,
    ...(endpoint ? { endpoint } : {}),
    capabilities: normalizeCapabilities(value?.capabilities, fallback.capabilities)
  }
}

const isStoreData = (value: unknown): value is ProviderConfigStoreData => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<ProviderConfigStoreData>
  return (
    isProviderId(candidate.selectedProvider) &&
    typeof candidate.providers === 'object' &&
    candidate.providers !== null &&
    typeof candidate.updatedAt === 'string'
  )
}

const toSharedSnapshot = (
  data: ProviderConfigStoreData,
  provider: LLMProviderId
): LLMProviderConfigSnapshot => {
  const scoped = normalizeScopedConfig(provider, data.providers[provider])
  const capabilities = normalizeCapabilities(scoped.capabilities, undefined)
  const config: LLMProviderConfig = {
    provider,
    model: scoped.model,
    timeoutMs: scoped.timeoutMs,
    ...(scoped.endpoint ? { endpoint: scoped.endpoint } : {}),
    ...(Object.keys(capabilities).length > 0 ? { capabilities } : {})
  }

  return {
    config,
    updatedAt: data.updatedAt
  }
}

const applyPatchToScopedConfig = (
  provider: LLMProviderId,
  current: ProviderScopedConfig,
  patch: LLMProviderConfigPatch
): ProviderScopedConfig => {
  const model = typeof patch.model === 'string' && patch.model.trim() ? patch.model.trim() : current.model
  const timeoutMs = clampLlmTimeout(
    typeof patch.timeoutMs === 'number' ? patch.timeoutMs : current.timeoutMs
  )

  const endpoint =
    patch.endpoint === null
      ? undefined
      : normalizeEndpoint(
          typeof patch.endpoint === 'string' ? patch.endpoint : current.endpoint
        )

  return {
    model,
    timeoutMs,
    ...(endpoint ? { endpoint } : {}),
    capabilities: normalizeCapabilities(patch.capabilities, current.capabilities)
  }
}

export interface ProviderConfigStore {
  getConfig: () => LLMProviderConfigSnapshot
  getProviderConfig: (provider: LLMProviderId) => LLMProviderConfigSnapshot
  saveConfig: (patch: LLMProviderConfigPatch) => LLMProviderConfigSnapshot
}

export const createProviderConfigStore = (userDataPath: string): ProviderConfigStore => {
  const storePath = join(userDataPath, PROVIDER_CONFIG_FILE_NAME)

  const write = (data: ProviderConfigStoreData): void => {
    writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf8')
  }

  const read = (): ProviderConfigStoreData => {
    if (!existsSync(storePath)) {
      const defaults = defaultData()
      write(defaults)
      return defaults
    }

    try {
      const parsed = JSON.parse(readFileSync(storePath, 'utf8')) as unknown
      if (!isStoreData(parsed)) {
        throw new Error('Invalid provider config data')
      }

      const normalized: ProviderConfigStoreData = {
        selectedProvider: parsed.selectedProvider,
        providers: {
          openai: normalizeScopedConfig('openai', parsed.providers.openai),
          ollama: normalizeScopedConfig('ollama', parsed.providers.ollama)
        },
        updatedAt: parsed.updatedAt
      }

      write(normalized)
      return normalized
    } catch {
      const fallback = defaultData()
      write(fallback)
      return fallback
    }
  }

  return {
    getConfig: () => {
      const state = read()
      return toSharedSnapshot(state, state.selectedProvider)
    },
    getProviderConfig: (provider) => {
      const state = read()
      return toSharedSnapshot(state, provider)
    },
    saveConfig: (patch) => {
      const state = read()
      const provider = isProviderId(patch.provider) ? patch.provider : state.selectedProvider
      const currentScoped = normalizeScopedConfig(provider, state.providers[provider])
      const nextScoped = applyPatchToScopedConfig(provider, currentScoped, patch)

      const nextState: ProviderConfigStoreData = {
        selectedProvider: provider,
        providers: {
          ...state.providers,
          [provider]: nextScoped
        },
        updatedAt: new Date().toISOString()
      }

      write(nextState)
      return toSharedSnapshot(nextState, provider)
    }
  }
}

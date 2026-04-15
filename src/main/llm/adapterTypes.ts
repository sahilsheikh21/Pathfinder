import type {
  LLMGenerateError,
  LLMGenerateRequest,
  LLMGenerateResult,
  LLMProviderCapability,
  LLMProviderConfig,
  LLMProviderId,
  LLMValidateConfigResult
} from '../../shared/browser'

export const DEFAULT_LLM_TIMEOUT_MS = 30000
export const MIN_LLM_TIMEOUT_MS = 1000
export const MAX_LLM_TIMEOUT_MS = 120000

export const clampLlmTimeout = (value: number | undefined): number => {
  if (!Number.isFinite(value)) {
    return DEFAULT_LLM_TIMEOUT_MS
  }

  const timeout = Math.floor(value as number)
  return Math.min(MAX_LLM_TIMEOUT_MS, Math.max(MIN_LLM_TIMEOUT_MS, timeout))
}

export const sanitizeLlmMessage = (message: string): string => {
  return message
    .replace(/bearer\s+[a-z0-9._-]+/gi, 'bearer [redacted]')
    .replace(/sk-[a-z0-9]+/gi, 'sk-[redacted]')
}

export const normalizeLlmError = (
  provider: LLMProviderId,
  reason: LLMGenerateError['reason'],
  message: string,
  retryable = false
): LLMGenerateError => {
  return {
    provider,
    reason,
    retryable,
    message: sanitizeLlmMessage(message).trim() || 'Provider request failed.'
  }
}

export interface LLMProviderAdapter {
  provider: LLMProviderId
  capabilities: LLMProviderCapability
  validateConfig: (input: {
    config: LLMProviderConfig
    secret: string | null
  }) => Promise<LLMValidateConfigResult>
  generate: (input: {
    config: LLMProviderConfig
    request: LLMGenerateRequest
    secret: string | null
  }) => Promise<LLMGenerateResult>
}

export interface LLMProviderConfigSnapshot {
  config: LLMProviderConfig
  updatedAt: string
}

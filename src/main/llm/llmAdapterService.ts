import type {
  LLMAdapterConfigState,
  LLMGenerateRequest,
  LLMGenerateResult,
  LLMProviderCapability,
  LLMProviderConfigPatch,
  LLMProviderId,
  LLMValidateConfigRequest,
  LLMValidateConfigResult
} from '../../shared/browser'
import { normalizeLlmError, type LLMProviderAdapter } from './adapterTypes'
import { type ProviderConfigStore } from './providerConfigStore'
import { type SecretStore } from './secretStore'
import { createOpenAIAdapter } from './providers/openaiAdapter'
import { createOllamaAdapter } from './providers/ollamaAdapter'

export interface LLMAdapterService {
  getConfig: () => LLMAdapterConfigState
  saveConfig: (patch: LLMProviderConfigPatch) => LLMAdapterConfigState
  validateConfig: (request?: LLMValidateConfigRequest) => Promise<LLMValidateConfigResult>
  generate: (request: LLMGenerateRequest) => Promise<LLMGenerateResult>
  getCapabilityMatrix: () => Record<LLMProviderId, LLMProviderCapability>
}

interface LLMAdapterServiceOptions {
  configStore: ProviderConfigStore
  secretStore: SecretStore
}

const mergeCapabilities = (
  base: LLMProviderCapability,
  override: Partial<LLMProviderCapability> | undefined
): LLMProviderCapability => {
  return {
    streaming: typeof override?.streaming === 'boolean' ? override.streaming : base.streaming,
    jsonMode: typeof override?.jsonMode === 'boolean' ? override.jsonMode : base.jsonMode,
    toolCalls: typeof override?.toolCalls === 'boolean' ? override.toolCalls : base.toolCalls,
    systemRole: typeof override?.systemRole === 'boolean' ? override.systemRole : base.systemRole
  }
}

export const createLLMAdapterService = (options: LLMAdapterServiceOptions): LLMAdapterService => {
  const providers: Record<LLMProviderId, LLMProviderAdapter> = {
    openai: createOpenAIAdapter(),
    ollama: createOllamaAdapter()
  }

  const getConfig = (): LLMAdapterConfigState => {
    const snapshot = options.configStore.getConfig()
    const secretPresent = options.secretStore.hasSecret(snapshot.config.provider)
    return {
      config: snapshot.config,
      secretPresent,
      updatedAt: snapshot.updatedAt
    }
  }

  const saveConfig = (patch: LLMProviderConfigPatch): LLMAdapterConfigState => {
    const snapshot = options.configStore.saveConfig(patch)
    options.secretStore.applySecretPatch(snapshot.config.provider, patch.secret)

    return {
      config: snapshot.config,
      secretPresent: options.secretStore.hasSecret(snapshot.config.provider),
      updatedAt: snapshot.updatedAt
    }
  }

  return {
    getConfig,
    saveConfig,
    validateConfig: async (request) => {
      const providerId = request?.provider ?? options.configStore.getConfig().config.provider
      const snapshot = options.configStore.getProviderConfig(providerId)
      const adapter = providers[providerId]

      if (!adapter) {
        return {
          ok: false,
          provider: providerId,
          model: snapshot.config.model,
          checkedAt: new Date().toISOString(),
          error: normalizeLlmError(providerId, 'invalid-config', 'Provider is not configured.', false)
        }
      }

      return adapter.validateConfig({
        config: snapshot.config,
        secret: options.secretStore.getSecret(providerId)
      })
    },
    generate: async (request) => {
      const providerId = request.provider
      const adapter = providers[providerId]
      if (!adapter) {
        return {
          ok: false,
          provider: providerId,
          model: request.model ?? '',
          text: '',
          finishReason: 'unknown',
          error: normalizeLlmError(providerId, 'invalid-config', 'Provider is not configured.', false)
        }
      }

      const snapshot = options.configStore.getProviderConfig(providerId)
      const capabilities = mergeCapabilities(adapter.capabilities, snapshot.config.capabilities)
      if (request.systemPrompt && !capabilities.systemRole) {
        return {
          ok: false,
          provider: providerId,
          model: request.model ?? snapshot.config.model,
          text: '',
          finishReason: 'unknown',
          error: normalizeLlmError(
            providerId,
            'unsupported-capability',
            'This provider does not support system prompts.',
            false
          )
        }
      }

      return adapter.generate({
        config: {
          ...snapshot.config,
          ...(request.model ? { model: request.model } : {})
        },
        request,
        secret: options.secretStore.getSecret(providerId)
      })
    },
    getCapabilityMatrix: () => ({
      openai: providers.openai.capabilities,
      ollama: providers.ollama.capabilities
    })
  }
}

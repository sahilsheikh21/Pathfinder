import { Ollama } from 'ollama'
import type {
  LLMGenerateError,
  LLMGenerateResult,
  LLMProviderConfig,
  LLMValidateConfigResult
} from '../../../shared/browser'
import { normalizeLlmError, sanitizeLlmMessage, type LLMProviderAdapter } from '../adapterTypes'

const provider = 'ollama' as const
const DEFAULT_OLLAMA_ENDPOINT = 'http://127.0.0.1:11434'

const createClient = (config: LLMProviderConfig, token: string | null): Ollama => {
  return new Ollama({
    host: config.endpoint ?? DEFAULT_OLLAMA_ENDPOINT,
    ...(token?.trim()
      ? { headers: { Authorization: `Bearer ${token.trim()}` } }
      : {})
  })
}

const mapOllamaError = (error: unknown): LLMGenerateError => {
  const message =
    error instanceof Error && error.message.trim()
      ? error.message
      : 'Ollama request failed.'
  const lower = message.toLowerCase()

  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('forbidden')) {
    return normalizeLlmError(provider, 'auth', message, false)
  }

  if (lower.includes('timed out') || lower.includes('timeout')) {
    return normalizeLlmError(provider, 'timeout', message, true)
  }

  if (lower.includes('connect') || lower.includes('network') || lower.includes('econnrefused')) {
    return normalizeLlmError(provider, 'network', message, true)
  }

  if (lower.includes('not found') || lower.includes('model')) {
    return normalizeLlmError(provider, 'invalid-config', message, false)
  }

  return normalizeLlmError(provider, 'provider-error', message, false)
}

const mapFinishReason = (value: string | undefined): LLMGenerateResult['finishReason'] => {
  if (value === 'stop') {
    return 'stop'
  }

  if (value === 'length') {
    return 'length'
  }

  return 'unknown'
}

export const createOllamaAdapter = (): LLMProviderAdapter => {
  return {
    provider,
    capabilities: {
      streaming: true,
      jsonMode: false,
      toolCalls: false,
      systemRole: true
    },
    validateConfig: async ({ config, secret }): Promise<LLMValidateConfigResult> => {
      const start = Date.now()

      try {
        const client = createClient(config, secret)
        const listed = await client.list()
        const modelExists = listed.models.some((item) => item.name === config.model)

        if (!modelExists) {
          return {
            ok: false,
            provider,
            model: config.model,
            checkedAt: new Date().toISOString(),
            latencyMs: Date.now() - start,
            error: normalizeLlmError(
              provider,
              'invalid-config',
              `Model "${config.model}" is not available in local Ollama runtime.`,
              false
            )
          }
        }

        return {
          ok: true,
          provider,
          model: config.model,
          checkedAt: new Date().toISOString(),
          latencyMs: Date.now() - start
        }
      } catch (error) {
        return {
          ok: false,
          provider,
          model: config.model,
          checkedAt: new Date().toISOString(),
          latencyMs: Date.now() - start,
          error: mapOllamaError(error)
        }
      }
    },
    generate: async ({ config, request, secret }) => {
      const start = Date.now()

      try {
        const client = createClient(config, secret)
        const response = await client.generate({
          model: request.model ?? config.model,
          prompt: request.prompt,
          ...(request.systemPrompt ? { system: request.systemPrompt } : {}),
          stream: false
        })

        const text = typeof response.response === 'string' ? response.response : ''
        if (!text.trim()) {
          return {
            ok: false,
            provider,
            model: request.model ?? config.model,
            text: '',
            finishReason: mapFinishReason(response.done_reason),
            latencyMs: Date.now() - start,
            error: normalizeLlmError(provider, 'provider-error', 'Ollama returned no text content.', false)
          }
        }

        return {
          ok: true,
          provider,
          model: response.model,
          text: sanitizeLlmMessage(text),
          finishReason: mapFinishReason(response.done_reason),
          latencyMs: Date.now() - start,
          tokenUsage: {
            input: response.prompt_eval_count,
            output: response.eval_count,
            total: response.prompt_eval_count + response.eval_count
          }
        }
      } catch (error) {
        return {
          ok: false,
          provider,
          model: request.model ?? config.model,
          text: '',
          finishReason: 'unknown',
          latencyMs: Date.now() - start,
          error: mapOllamaError(error)
        }
      }
    }
  }
}

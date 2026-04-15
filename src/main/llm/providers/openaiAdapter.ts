import OpenAI, {
  APIConnectionError,
  APIConnectionTimeoutError,
  AuthenticationError,
  BadRequestError,
  RateLimitError
} from 'openai'
import type {
  LLMGenerateError,
  LLMGenerateResult,
  LLMProviderConfig,
  LLMValidateConfigResult
} from '../../../shared/browser'
import { normalizeLlmError, sanitizeLlmMessage, type LLMProviderAdapter } from '../adapterTypes'

const provider = 'openai' as const

const createClient = (config: LLMProviderConfig, secret: string): OpenAI => {
  return new OpenAI({
    apiKey: secret,
    ...(config.endpoint ? { baseURL: config.endpoint } : {}),
    timeout: config.timeoutMs
  })
}

const mapOpenAiError = (error: unknown): LLMGenerateError => {
  if (error instanceof AuthenticationError) {
    return normalizeLlmError(provider, 'auth', error.message, false)
  }

  if (error instanceof RateLimitError) {
    return normalizeLlmError(provider, 'quota', error.message, true)
  }

  if (error instanceof APIConnectionTimeoutError) {
    return normalizeLlmError(provider, 'timeout', error.message, true)
  }

  if (error instanceof APIConnectionError) {
    return normalizeLlmError(provider, 'network', error.message, true)
  }

  if (error instanceof BadRequestError) {
    return normalizeLlmError(provider, 'invalid-config', error.message, false)
  }

  if (error instanceof Error) {
    return normalizeLlmError(provider, 'provider-error', error.message, false)
  }

  return normalizeLlmError(provider, 'provider-error', 'OpenAI request failed.', false)
}

const mapFinishReason = (value: string | null | undefined): LLMGenerateResult['finishReason'] => {
  if (value === 'stop') {
    return 'stop'
  }

  if (value === 'length') {
    return 'length'
  }

  if (value === 'content_filter') {
    return 'content-filter'
  }

  return 'unknown'
}

export const createOpenAIAdapter = (): LLMProviderAdapter => {
  return {
    provider,
    capabilities: {
      streaming: true,
      jsonMode: true,
      toolCalls: true,
      systemRole: true
    },
    validateConfig: async ({ config, secret }): Promise<LLMValidateConfigResult> => {
      if (!secret?.trim()) {
        return {
          ok: false,
          provider,
          model: config.model,
          checkedAt: new Date().toISOString(),
          error: normalizeLlmError(provider, 'invalid-config', 'OpenAI API key is missing.', false)
        }
      }

      const start = Date.now()

      try {
        const client = createClient(config, secret)
        await client.models.list()

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
          error: mapOpenAiError(error)
        }
      }
    },
    generate: async ({ config, request, secret }) => {
      if (!secret?.trim()) {
        return {
          ok: false,
          provider,
          model: request.model ?? config.model,
          text: '',
          finishReason: 'unknown',
          error: normalizeLlmError(provider, 'invalid-config', 'OpenAI API key is missing.', false)
        }
      }

      const start = Date.now()

      try {
        const client = createClient(config, secret)
        const completion = await client.chat.completions.create({
          model: request.model ?? config.model,
          messages: [
            ...(request.systemPrompt
              ? [{ role: 'system' as const, content: request.systemPrompt }]
              : []),
            { role: 'user' as const, content: request.prompt }
          ]
        })

        const firstChoice = completion.choices[0]
        const content = firstChoice?.message?.content
        const text = typeof content === 'string' ? content : ''

        if (!text.trim()) {
          return {
            ok: false,
            provider,
            model: request.model ?? config.model,
            text: '',
            finishReason: mapFinishReason(firstChoice?.finish_reason),
            latencyMs: Date.now() - start,
            error: normalizeLlmError(provider, 'provider-error', 'OpenAI returned no text content.', false)
          }
        }

        return {
          ok: true,
          provider,
          model: completion.model,
          text: sanitizeLlmMessage(text),
          finishReason: mapFinishReason(firstChoice?.finish_reason),
          latencyMs: Date.now() - start,
          ...(completion.usage
            ? {
                tokenUsage: {
                  input: completion.usage.prompt_tokens,
                  output: completion.usage.completion_tokens,
                  total: completion.usage.total_tokens
                }
              }
            : {})
        }
      } catch (error) {
        return {
          ok: false,
          provider,
          model: request.model ?? config.model,
          text: '',
          finishReason: 'unknown',
          latencyMs: Date.now() - start,
          error: mapOpenAiError(error)
        }
      }
    }
  }
}

import { webContents } from 'electron'
import { randomUUID } from 'node:crypto'
import type {
  LLMGenerateError,
  PageAnalysisAskRequest,
  PageAnalysisCancelRequest,
  PageAnalysisCancelResult,
  PageAnalysisCitation,
  PageAnalysisClearContextRequest,
  PageAnalysisClearContextResult,
  PageAnalysisConfidence,
  PageAnalysisFailure,
  PageAnalysisRefreshContextRequest,
  PageAnalysisRefreshContextResult,
  PageAnalysisResult,
  PageAnalysisSnapshotMetadata,
  PageAnalysisStatusRequest,
  PageAnalysisStatusResult,
  PageAnalysisSummarizeRequest
} from '../../shared/browser'
import type { LLMAdapterService } from './llmAdapterService'

interface PageAnalysisTarget {
  tabId: string
  url: string
  webContentsId: number
}

interface PageContextCacheEntry {
  snapshot: PageAnalysisSnapshotMetadata
  normalizedText: string
  redactedText: string
  snippets: string[]
}

interface PageExtractionPayload {
  title: string
  url: string
  selectedText: string
  mainText: string
  fallbackText: string
}

interface StructuredModelOutput {
  answer: string
  sections: Array<{
    title: string
    bullets: string[]
  }>
  confidence: PageAnalysisConfidence
  usedNonPageContext: boolean
}

interface PageAnalysisServiceOptions {
  resolveTarget: (tabId?: string) => PageAnalysisTarget | null
  llmAdapterService: LLMAdapterService
  staleTtlMs?: number
}

export interface PageAnalysisService {
  summarize: (request?: PageAnalysisSummarizeRequest) => Promise<PageAnalysisResult>
  ask: (request: PageAnalysisAskRequest) => Promise<PageAnalysisResult>
  cancel: (request?: PageAnalysisCancelRequest) => PageAnalysisCancelResult
  refreshContext: (request?: PageAnalysisRefreshContextRequest) => Promise<PageAnalysisRefreshContextResult>
  clearContext: (request?: PageAnalysisClearContextRequest) => PageAnalysisClearContextResult
  getStatus: (request?: PageAnalysisStatusRequest) => PageAnalysisStatusResult
  invalidateTabContext: (tabId: string) => void
  invalidateForNavigation: (tabId: string, nextUrl: string) => void
}

const DEFAULT_STALE_TTL_MS = 90_000

const normalizeWhitespace = (value: string): string => {
  return value
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const redactSensitiveText = (value: string): string => {
  return value
    .replace(/bearer\s+[a-z0-9._-]+/gi, 'bearer [redacted]')
    .replace(/sk-[a-z0-9]+/gi, 'sk-[redacted]')
    .replace(/api[_-]?key\s*[:=]\s*[a-z0-9._-]+/gi, 'api_key=[redacted]')
    .replace(/password\s*[:=]\s*[^\s]+/gi, 'password=[redacted]')
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '[redacted-email]')
}

const chunkSnippets = (value: string): string[] => {
  const lines = value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 40)

  if (lines.length > 0) {
    return lines.slice(0, 80)
  }

  const sentences = value
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 30)

  if (sentences.length > 0) {
    return sentences.slice(0, 80)
  }

  return value.length > 0 ? [value.slice(0, 400)] : []
}

const toWordSet = (value: string): Set<string> => {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4)
  )
}

const buildCitations = (
  answer: string,
  snippets: string[],
  snapshot: PageAnalysisSnapshotMetadata
): PageAnalysisCitation[] => {
  const answerTokens = toWordSet(answer)

  const scored = snippets
    .map((snippet, index) => {
      const snippetTokens = toWordSet(snippet)
      let overlap = 0
      for (const token of snippetTokens) {
        if (answerTokens.has(token)) {
          overlap += 1
        }
      }

      return {
        snippet,
        index,
        overlap
      }
    })
    .filter((item) => item.overlap > 0)
    .sort((left, right) => {
      if (right.overlap !== left.overlap) {
        return right.overlap - left.overlap
      }

      return left.index - right.index
    })
    .slice(0, 5)

  return scored.map((item, index) => {
    const marker = String(index + 1)
    return {
      id: `citation-${marker}`,
      marker,
      snippet: item.snippet,
      snippetIndex: item.index,
      extractedAt: snapshot.extractedAt,
      source: {
        title: snapshot.title,
        url: snapshot.url
      }
    }
  })
}

const attachCitationMarkers = (answer: string, citations: PageAnalysisCitation[]): string => {
  if (citations.length === 0) {
    return answer
  }

  const markers = citations.map((citation) => `[${citation.marker}]`).join(' ')
  return `${answer.trim()} ${markers}`.trim()
}

const toFailure = (
  reason: PageAnalysisFailure['reason'],
  message: string,
  userAction: PageAnalysisFailure['userAction'],
  retryable: boolean
): PageAnalysisFailure => {
  return {
    reason,
    message: message.trim() || 'Page analysis failed.',
    userAction,
    retryable
  }
}

const mapLlmFailure = (error: LLMGenerateError): PageAnalysisFailure => {
  switch (error.reason) {
    case 'invalid-config':
    case 'unsupported-capability':
      return toFailure('invalid-config', error.message, 'check-llm-config', false)
    case 'auth':
      return toFailure('auth', error.message, 'check-llm-config', false)
    case 'network':
      return toFailure('network', error.message, 'retry', true)
    case 'timeout':
      return toFailure('timeout', error.message, 'retry', true)
    case 'quota':
      return toFailure('quota', error.message, 'retry', true)
    case 'provider-error':
    default:
      return toFailure('provider-error', error.message, 'retry', error.retryable)
  }
}

const toExtractionPayload = (value: unknown): PageExtractionPayload | null => {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as Partial<PageExtractionPayload>
  if (
    typeof candidate.title !== 'string' ||
    typeof candidate.url !== 'string' ||
    typeof candidate.selectedText !== 'string' ||
    typeof candidate.mainText !== 'string' ||
    typeof candidate.fallbackText !== 'string'
  ) {
    return null
  }

  return {
    title: candidate.title,
    url: candidate.url,
    selectedText: candidate.selectedText,
    mainText: candidate.mainText,
    fallbackText: candidate.fallbackText
  }
}

const parseStructuredModelOutput = (rawText: string, summarizeMode: boolean): StructuredModelOutput => {
  const text = rawText.trim()
  const jsonMatch = text.match(/\{[\s\S]*\}/)

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Partial<StructuredModelOutput>
      if (typeof parsed.answer === 'string') {
        return {
          answer: parsed.answer.trim(),
          sections: Array.isArray(parsed.sections)
            ? parsed.sections
                .map((section) => ({
                  title: typeof section?.title === 'string' ? section.title : 'Key Points',
                  bullets: Array.isArray(section?.bullets)
                    ? section.bullets.filter((bullet): bullet is string => typeof bullet === 'string')
                    : []
                }))
                .filter((section) => section.bullets.length > 0)
            : [],
          confidence:
            parsed.confidence === 'high' ||
            parsed.confidence === 'medium' ||
            parsed.confidence === 'low' ||
            parsed.confidence === 'uncertain'
              ? parsed.confidence
              : 'medium',
          usedNonPageContext: Boolean(parsed.usedNonPageContext)
        }
      }
    } catch {
      // Fall back to plain-text parsing below.
    }
  }

  const fallbackBullets = text
    .split(/\n+/)
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter((line) => line.length > 0)
    .slice(0, 8)

  return {
    answer: text,
    sections: summarizeMode
      ? [
          {
            title: 'Key Points',
            bullets: fallbackBullets
          }
        ]
      : [],
    confidence: 'medium',
    usedNonPageContext: false
  }
}

const buildSystemPrompt = (summarizeMode: boolean): string => {
  if (summarizeMode) {
    return [
      'You summarize webpage content with grounded, concise language.',
      'Return JSON with keys: answer, sections, confidence, usedNonPageContext.',
      'For sections, use titles: Key Points, Risks/Gaps, Next Actions when possible.',
      'Do not invent facts that are unsupported by the supplied page context.'
    ].join(' ')
  }

  return [
    'You answer user questions using only supplied page context by default.',
    'Return JSON with keys: answer, sections, confidence, usedNonPageContext.',
    'If evidence is weak, be explicit about uncertainty and missing context.',
    'Do not invent unsupported claims.'
  ].join(' ')
}

const buildUserPrompt = (input: {
  summarizeMode: boolean
  question: string | null
  title: string
  url: string
  text: string
  snippets: string[]
  includeNonPageContext: boolean
}): string => {
  const header = [
    `Page title: ${input.title}`,
    `Page url: ${input.url}`,
    `Mode: ${input.summarizeMode ? 'summarize' : 'ask'}`,
    `Include non-page context: ${input.includeNonPageContext ? 'yes' : 'no'}`,
    input.question ? `Question: ${input.question}` : null,
    '',
    'Context:',
    input.text,
    '',
    'Snippet candidates:',
    input.snippets.map((snippet, index) => `${index + 1}. ${snippet}`).join('\n')
  ]

  return header.filter((line): line is string => typeof line === 'string').join('\n')
}

const extractPageContent = async (target: PageAnalysisTarget): Promise<PageExtractionPayload | null> => {
  const targetContents = webContents.fromId(target.webContentsId)
  if (!targetContents || targetContents.isDestroyed()) {
    return null
  }

  const payload = await targetContents.executeJavaScript(
    `(() => {
      const removeUnsafeNodes = (root) => {
        root.querySelectorAll('script, style, noscript, input, textarea, select, option, button').forEach((node) => {
          node.remove()
        })
      }

      const cleanText = (element) => {
        if (!element) {
          return ''
        }

        const clone = element.cloneNode(true)
        removeUnsafeNodes(clone)
        return (clone.innerText || clone.textContent || '').trim()
      }

      const selectedText = (window.getSelection && window.getSelection())
        ? window.getSelection().toString()
        : ''

      const mainCandidate = document.querySelector('article, main, [role="main"]')
      const bodyCandidate = document.body

      return {
        title: document.title || '',
        url: window.location.href || '',
        selectedText,
        mainText: cleanText(mainCandidate),
        fallbackText: cleanText(bodyCandidate)
      }
    })()`,
    true
  )

  return toExtractionPayload(payload)
}

export const createPageAnalysisService = (options: PageAnalysisServiceOptions): PageAnalysisService => {
  const staleTtlMs = options.staleTtlMs ?? DEFAULT_STALE_TTL_MS
  const contextByTab = new Map<string, PageContextCacheEntry>()

  let activeOperationId: string | null = null
  let activeTabId: string | null = null
  let state: PageAnalysisStatusResult['state'] = 'idle'
  const cancelledOperationIds = new Set<string>()

  const clearOperationState = (): void => {
    activeOperationId = null
    activeTabId = null
    state = 'idle'
  }

  const beginOperation = (tabId: string): string => {
    const operationId = randomUUID()
    activeOperationId = operationId
    activeTabId = tabId
    state = 'running'
    cancelledOperationIds.delete(operationId)
    return operationId
  }

  const isCancelled = (operationId: string): boolean => {
    return cancelledOperationIds.has(operationId)
  }

  const finalizeOperation = (operationId: string): void => {
    cancelledOperationIds.delete(operationId)
    if (activeOperationId === operationId) {
      clearOperationState()
    }
  }

  const buildSnapshot = (
    tabId: string,
    url: string,
    title: string,
    extractedAt: string
  ): PageAnalysisSnapshotMetadata => {
    const stale = Date.now() - new Date(extractedAt).getTime() > staleTtlMs
    return {
      tabId,
      url,
      title,
      extractedAt,
      ttlMs: staleTtlMs,
      stale
    }
  }

  const extractContext = async (
    target: PageAnalysisTarget,
    allowOneTimeUnredacted: boolean
  ): Promise<PageContextCacheEntry | null> => {
    const payload = await extractPageContent(target)
    if (!payload) {
      return null
    }

    const sourceText =
      normalizeWhitespace(payload.selectedText) ||
      normalizeWhitespace(payload.mainText) ||
      normalizeWhitespace(payload.fallbackText)

    if (!sourceText) {
      return null
    }

    const extractedAt = new Date().toISOString()
    const normalizedText = sourceText
    const redactedText = allowOneTimeUnredacted ? normalizedText : redactSensitiveText(normalizedText)
    const snippets = chunkSnippets(redactedText)
    const snapshot = buildSnapshot(target.tabId, payload.url || target.url, payload.title, extractedAt)

    return {
      snapshot,
      normalizedText,
      redactedText,
      snippets
    }
  }

  const getOrCreateContext = async (input: {
    tabId: string
    forceRefresh: boolean
    allowOneTimeUnredacted: boolean
  }): Promise<PageContextCacheEntry | null> => {
    const target = options.resolveTarget(input.tabId)
    if (!target) {
      return null
    }

    const existing = contextByTab.get(target.tabId)
    const shouldReuse =
      Boolean(existing) &&
      !input.forceRefresh &&
      existing?.snapshot.url === target.url

    if (shouldReuse && existing) {
      existing.snapshot = buildSnapshot(
        existing.snapshot.tabId,
        existing.snapshot.url,
        existing.snapshot.title,
        existing.snapshot.extractedAt
      )
      return existing
    }

    const extracted = await extractContext(target, input.allowOneTimeUnredacted)
    if (!extracted) {
      return null
    }

    contextByTab.set(target.tabId, extracted)
    return extracted
  }

  const runAnalysis = async (input: {
    summarizeMode: boolean
    question: string | null
    request: PageAnalysisSummarizeRequest | PageAnalysisAskRequest | undefined
  }): Promise<PageAnalysisResult> => {
    const target = options.resolveTarget(input.request?.tabId)
    if (!target) {
      return {
        ok: false,
        mode: input.summarizeMode ? 'summarize' : 'ask',
        answer: '',
        sections: [],
        confidence: 'uncertain',
        snapshot: null,
        citations: [],
        usedNonPageContext: false,
        error: toFailure('missing-target', 'Active tab is not available for page analysis.', 'retry', true)
      }
    }

    const operationId = beginOperation(target.tabId)

    try {
      const context = await getOrCreateContext({
        tabId: target.tabId,
        forceRefresh: Boolean(input.request?.forceRefresh),
        allowOneTimeUnredacted: Boolean(input.request?.allowOneTimeUnredacted)
      })

      if (isCancelled(operationId)) {
        return {
          ok: false,
          mode: input.summarizeMode ? 'summarize' : 'ask',
          answer: '',
          sections: [],
          confidence: 'uncertain',
          snapshot: context?.snapshot ?? null,
          citations: [],
          usedNonPageContext: false,
          error: toFailure('cancelled', 'Analysis request was cancelled.', 'none', false)
        }
      }

      if (!context) {
        return {
          ok: false,
          mode: input.summarizeMode ? 'summarize' : 'ask',
          answer: '',
          sections: [],
          confidence: 'uncertain',
          snapshot: null,
          citations: [],
          usedNonPageContext: false,
          error: toFailure(
            'no-content',
            'No extractable page content was found. Try selecting text or refreshing context.',
            'refresh-context',
            true
          )
        }
      }

      const llmConfig = options.llmAdapterService.getConfig().config
      const generateResult = await options.llmAdapterService.generate({
        provider: llmConfig.provider,
        model: llmConfig.model,
        prompt: buildUserPrompt({
          summarizeMode: input.summarizeMode,
          question: input.question,
          title: context.snapshot.title,
          url: context.snapshot.url,
          text: context.redactedText,
          snippets: context.snippets,
          includeNonPageContext: Boolean(input.request?.includeNonPageContext)
        }),
        systemPrompt: buildSystemPrompt(input.summarizeMode)
      })

      if (isCancelled(operationId)) {
        return {
          ok: false,
          mode: input.summarizeMode ? 'summarize' : 'ask',
          answer: '',
          sections: [],
          confidence: 'uncertain',
          snapshot: context.snapshot,
          citations: [],
          usedNonPageContext: false,
          error: toFailure('cancelled', 'Analysis request was cancelled.', 'none', false)
        }
      }

      if (!generateResult.ok || !generateResult.text.trim()) {
        const failure = generateResult.error
          ? mapLlmFailure(generateResult.error)
          : toFailure('provider-error', 'Model response was empty.', 'retry', true)

        return {
          ok: false,
          mode: input.summarizeMode ? 'summarize' : 'ask',
          answer: '',
          sections: [],
          confidence: 'uncertain',
          snapshot: context.snapshot,
          citations: [],
          usedNonPageContext: false,
          error: failure
        }
      }

      const structured = parseStructuredModelOutput(generateResult.text, input.summarizeMode)
      const citations = buildCitations(structured.answer, context.snippets, context.snapshot)

      if (!input.summarizeMode && citations.length === 0) {
        return {
          ok: false,
          mode: 'ask',
          answer: '',
          sections: [],
          confidence: 'uncertain',
          snapshot: context.snapshot,
          citations: [],
          usedNonPageContext: false,
          error: toFailure(
            'unsupported-claim',
            'Insufficient grounded evidence for a reliable answer. Try refreshing context or narrowing the question.',
            'refresh-context',
            true
          )
        }
      }

      const answer = attachCitationMarkers(structured.answer, citations)

      return {
        ok: true,
        mode: input.summarizeMode ? 'summarize' : 'ask',
        answer,
        sections: structured.sections,
        confidence: structured.confidence,
        snapshot: context.snapshot,
        citations,
        ...(context.snapshot.stale
          ? {
              staleWarning: 'Page context may be stale. Refresh context to update extracted content.'
            }
          : {}),
        usedNonPageContext: structured.usedNonPageContext
      }
    } finally {
      finalizeOperation(operationId)
    }
  }

  return {
    summarize: async (request) => {
      return runAnalysis({
        summarizeMode: true,
        question: null,
        request
      })
    },
    ask: async (request) => {
      return runAnalysis({
        summarizeMode: false,
        question: request.question,
        request
      })
    },
    cancel: (request) => {
      const operationId = request?.operationId ?? activeOperationId
      if (!operationId) {
        return {
          ok: false,
          operationId: null,
          cancelled: false
        }
      }

      cancelledOperationIds.add(operationId)
      if (activeOperationId === operationId) {
        state = 'cancelling'
      }

      return {
        ok: true,
        operationId,
        cancelled: true
      }
    },
    refreshContext: async (request) => {
      const target = options.resolveTarget(request?.tabId)
      if (!target) {
        return {
          ok: false,
          snapshot: null,
          error: toFailure('missing-target', 'Active tab is not available for context refresh.', 'retry', true)
        }
      }

      const refreshed = await extractContext(target, false)
      if (!refreshed) {
        return {
          ok: false,
          snapshot: null,
          error: toFailure('no-content', 'No extractable content found during refresh.', 'review-page-selection', true)
        }
      }

      contextByTab.set(target.tabId, refreshed)
      return {
        ok: true,
        snapshot: refreshed.snapshot
      }
    },
    clearContext: (request) => {
      const target = options.resolveTarget(request?.tabId)
      const tabId = target?.tabId ?? request?.tabId ?? null
      if (tabId) {
        contextByTab.delete(tabId)
      }

      return {
        ok: true,
        tabId
      }
    },
    getStatus: (request) => {
      const target = options.resolveTarget(request?.tabId)
      const tabId = target?.tabId ?? request?.tabId ?? activeTabId
      const context = tabId ? contextByTab.get(tabId) : undefined

      return {
        state,
        operationId: activeOperationId,
        tabId: tabId ?? null,
        hasContext: Boolean(context),
        snapshot: context?.snapshot ?? null
      }
    },
    invalidateTabContext: (tabId) => {
      contextByTab.delete(tabId)
    },
    invalidateForNavigation: (tabId, nextUrl) => {
      const current = contextByTab.get(tabId)
      if (!current) {
        return
      }

      if (current.snapshot.url !== nextUrl) {
        contextByTab.delete(tabId)
      }
    }
  }
}

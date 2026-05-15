import type { LiveAgentRiskTier, LiveAgentStepSummary } from '../shared/browser'

const HIGH_IMPACT_PATTERNS = [
  'submit',
  'delete',
  'remove',
  'purchase',
  'checkout',
  'pay',
  'send',
  'transfer',
  'upload',
  'password',
  'credential',
  'token',
  'security',
  '2fa',
  'mfa',
  'account',
  'settings'
]

const LOW_IMPACT_PATTERNS = [
  'read',
  'inspect',
  'analyze',
  'summarize',
  'observe',
  'check'
]

export interface LiveAgentRiskPolicy {
  classifyStep: (step: LiveAgentStepSummary) => LiveAgentRiskTier
  isHighImpactStep: (step: LiveAgentStepSummary) => boolean
}

const includesAny = (value: string, patterns: string[]): boolean =>
  patterns.some((pattern) => value.includes(pattern))

const getStepSearchSpace = (step: LiveAgentStepSummary): string => {
  return [
    step.action,
    step.target ?? '',
    step.expectedSideEffect,
    step.rationale
  ]
    .join(' ')
    .toLowerCase()
}

export const createLiveAgentRiskPolicy = (): LiveAgentRiskPolicy => {
  const classifyStep = (step: LiveAgentStepSummary): LiveAgentRiskTier => {
    const searchSpace = getStepSearchSpace(step)

    if (includesAny(searchSpace, HIGH_IMPACT_PATTERNS)) {
      return 'high'
    }

    if (step.action === 'wait' || step.action === 'navigate') {
      return 'low'
    }

    if (includesAny(searchSpace, LOW_IMPACT_PATTERNS)) {
      return 'low'
    }

    return step.action === 'type' || step.action === 'click' ? 'high' : 'low'
  }

  return {
    classifyStep,
    isHighImpactStep: (step) => classifyStep(step) === 'high'
  }
}

import type { OmniboxResolution } from '../../shared/browser'

const HOSTNAME_INPUT_PATTERN = /^[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i

export const resolveOmniboxInput = (
  input: string,
  defaultSearchTemplate: string
): OmniboxResolution => {
  const trimmedInput = input.trim()

  if (trimmedInput.startsWith('http://') || trimmedInput.startsWith('https://')) {
    return {
      kind: 'url',
      target: trimmedInput
    }
  }

  if (HOSTNAME_INPUT_PATTERN.test(trimmedInput)) {
    return {
      kind: 'url',
      target: `https://${trimmedInput}`
    }
  }

  return {
    kind: 'search',
    target: defaultSearchTemplate.replace('{query}', encodeURIComponent(trimmedInput))
  }
}

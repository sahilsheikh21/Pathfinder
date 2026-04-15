import { resolveOmniboxInput } from './omnibox'

export interface QuickSearchResult {
  id: string
  title: string
  description: string
  target: string
}

export const buildQuickSearchResults = (
  query: string,
  searchTemplate: string
): QuickSearchResult[] => {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) {
    return []
  }

  const resolution = resolveOmniboxInput(trimmedQuery, searchTemplate)
  const searchTarget = searchTemplate.replace('{query}', encodeURIComponent(trimmedQuery))

  if (resolution.kind === 'url') {
    return [
      {
        id: 'open-url',
        title: 'Open URL',
        description: resolution.target,
        target: resolution.target
      },
      {
        id: 'search-query',
        title: 'Search the web',
        description: `Search for "${trimmedQuery}"`,
        target: searchTarget
      }
    ]
  }

  return [
    {
      id: 'search-query',
      title: 'Search the web',
      description: `Search for "${trimmedQuery}"`,
      target: resolution.target
    }
  ]
}

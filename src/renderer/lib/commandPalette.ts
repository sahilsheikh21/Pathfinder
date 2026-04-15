import { resolveOmniboxInput } from './omnibox'

const DEFAULT_SEARCH_TEMPLATE = 'https://duckduckgo.com/?q={query}'

export interface CommandPaletteCommand {
  id: string
  title: string
  description: string
  argumentHint?: string
  keywords: string[]
  run: (input: string) => Promise<void>
}

export interface CommandPaletteMatch {
  command: CommandPaletteCommand
  score: 0 | 1 | 2
}

export interface BrowserCommandDeps {
  createTab: () => Promise<void>
  closeActiveTab: (tabId: string) => Promise<void>
  navigateTarget: (target: string) => Promise<void>
  back: () => Promise<void>
  forward: () => Promise<void>
  reload: () => Promise<void>
  stop: () => Promise<void>
  startRecording: () => Promise<void>
  stopRecording: () => Promise<void>
  activeTabId: string | null
}

interface ScoredMatch extends CommandPaletteMatch {
  originalIndex: number
}

const normalize = (value: string): string => value.trim().toLowerCase()

const tokenize = (value: string): string[] =>
  normalize(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

const getScore = (command: CommandPaletteCommand, normalizedQuery: string): 0 | 1 | 2 | null => {
  const title = normalize(command.title)
  const id = normalize(command.id)
  const keywordValues = command.keywords.map((keyword) => normalize(keyword)).filter(Boolean)

  if (title.startsWith(normalizedQuery) || id.startsWith(normalizedQuery)) {
    return 0
  }

  const titleTokens = tokenize(command.title)
  const keywordTokens = keywordValues.flatMap((keyword) => tokenize(keyword))

  if (
    titleTokens.some((token) => token.startsWith(normalizedQuery)) ||
    keywordTokens.some((token) => token.startsWith(normalizedQuery))
  ) {
    return 1
  }

  if (
    title.includes(normalizedQuery) ||
    id.includes(normalizedQuery) ||
    keywordValues.some((keyword) => keyword.includes(normalizedQuery))
  ) {
    return 2
  }

  return null
}

export const rankCommands = (commands: CommandPaletteCommand[], query: string): CommandPaletteMatch[] => {
  const normalizedQuery = normalize(query)

  if (!normalizedQuery) {
    return commands.map((command) => ({
      command,
      score: 0
    }))
  }

  const matches: ScoredMatch[] = commands
    .map((command, originalIndex) => {
      const score = getScore(command, normalizedQuery)
      if (score === null) {
        return null
      }

      return {
        command,
        score,
        originalIndex
      }
    })
    .filter((match): match is ScoredMatch => match !== null)

  matches.sort((left, right) => {
    if (left.score !== right.score) {
      return left.score - right.score
    }

    const titleCompare = left.command.title.localeCompare(right.command.title)
    if (titleCompare !== 0) {
      return titleCompare
    }

    return left.originalIndex - right.originalIndex
  })

  return matches.map((match) => ({
    command: match.command,
    score: match.score
  }))
}

const requireActiveTabId = (activeTabId: string | null): string => {
  if (!activeTabId) {
    throw new Error('No active tab available.')
  }

  return activeTabId
}

const requireInput = (input: string, message: string): string => {
  const value = input.trim()
  if (!value) {
    throw new Error(message)
  }

  return value
}

export const createBrowserCommands = (deps: BrowserCommandDeps): CommandPaletteCommand[] => {
  return [
    {
      id: 'tab.new',
      title: 'Tab: New Tab',
      description: 'Create a new browser tab and focus it.',
      keywords: ['tab', 'new', 'create', 'open'],
      run: async () => {
        await deps.createTab()
      }
    },
    {
      id: 'tab.close',
      title: 'Tab: Close Active Tab',
      description: 'Close the currently active browser tab.',
      keywords: ['tab', 'close', 'remove'],
      run: async () => {
        const tabId = requireActiveTabId(deps.activeTabId)
        await deps.closeActiveTab(tabId)
      }
    },
    {
      id: 'nav.back',
      title: 'Navigation: Back',
      description: 'Navigate back in active tab history.',
      keywords: ['back', 'history', 'previous', 'navigate'],
      run: async () => {
        requireActiveTabId(deps.activeTabId)
        await deps.back()
      }
    },
    {
      id: 'nav.forward',
      title: 'Navigation: Forward',
      description: 'Navigate forward in active tab history.',
      keywords: ['forward', 'history', 'next', 'navigate'],
      run: async () => {
        requireActiveTabId(deps.activeTabId)
        await deps.forward()
      }
    },
    {
      id: 'nav.reload',
      title: 'Navigation: Reload',
      description: 'Reload the current active tab.',
      keywords: ['reload', 'refresh', 'navigation'],
      run: async () => {
        requireActiveTabId(deps.activeTabId)
        await deps.reload()
      }
    },
    {
      id: 'nav.stop',
      title: 'Navigation: Stop Loading',
      description: 'Stop loading in the active tab.',
      keywords: ['stop', 'cancel', 'loading', 'navigation'],
      run: async () => {
        requireActiveTabId(deps.activeTabId)
        await deps.stop()
      }
    },
    {
      id: 'nav.goto',
      title: 'Navigation: Go to URL or Search',
      description: 'Navigate the active tab using URL or query input.',
      argumentHint: '<target>',
      keywords: ['goto', 'go', 'url', 'navigate', 'open'],
      run: async (input: string) => {
        requireActiveTabId(deps.activeTabId)
        const value = requireInput(input, 'Provide a URL or query.')
        const resolution = resolveOmniboxInput(value, DEFAULT_SEARCH_TEMPLATE)
        await deps.navigateTarget(resolution.target)
      }
    },
    {
      id: 'nav.search',
      title: 'Navigation: Search Query',
      description: 'Search from the active tab using the default template.',
      argumentHint: '<query>',
      keywords: ['search', 'query', 'find', 'lookup'],
      run: async (input: string) => {
        requireActiveTabId(deps.activeTabId)
        const value = requireInput(input, 'Provide a search query.')
        const resolution = resolveOmniboxInput(value, DEFAULT_SEARCH_TEMPLATE)
        await deps.navigateTarget(resolution.target)
      }
    },
    {
      id: 'automation.record',
      title: 'Automation: Start Recording',
      description: 'Start recording actions in the active tab.',
      keywords: ['automation', 'record', 'start', 'workflow'],
      run: async () => {
        await deps.startRecording()
      }
    },
    {
      id: 'automation.stop',
      title: 'Automation: Stop Recording',
      description: 'Stop the active recording session.',
      keywords: ['automation', 'record', 'stop', 'workflow'],
      run: async () => {
        await deps.stopRecording()
      }
    }
  ]
}

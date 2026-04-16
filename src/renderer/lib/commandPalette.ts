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
  startPlayback?: (workflowPath: string) => Promise<void>
  cancelPlayback?: () => Promise<void>
  toggleSidebar?: () => Promise<void>
  openSidebarLibrary?: () => Promise<void>
  openSidebarHistory?: () => Promise<void>
  openAiConfig?: () => Promise<void>
  summarizeActivePage?: () => Promise<void>
  askActivePage?: (input: string) => Promise<void>
  refreshPageAnalysisContext?: () => Promise<void>
  clearPageAnalysisContext?: () => Promise<void>
  validateAiConfig?: () => Promise<void>
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
      id: 'sidebar.toggle',
      title: 'Sidebar: Toggle',
      description: 'Toggle sidebar open/collapsed state.',
      keywords: ['sidebar', 'toggle', 'panel', 'automation'],
      run: async () => {
        if (!deps.toggleSidebar) {
          throw new Error('Sidebar controls are unavailable.')
        }

        await deps.toggleSidebar()
      }
    },
    {
      id: 'sidebar.open.library',
      title: 'Sidebar: Open Saved Automations',
      description: 'Open sidebar and focus Saved Automations section.',
      keywords: ['sidebar', 'library', 'automations', 'saved', 'open'],
      run: async () => {
        if (!deps.openSidebarLibrary) {
          throw new Error('Sidebar controls are unavailable.')
        }

        await deps.openSidebarLibrary()
      }
    },
    {
      id: 'sidebar.open.history',
      title: 'Sidebar: Open History',
      description: 'Open sidebar and focus run history section.',
      keywords: ['sidebar', 'history', 'runs', 'open'],
      run: async () => {
        if (!deps.openSidebarHistory) {
          throw new Error('Sidebar controls are unavailable.')
        }

        await deps.openSidebarHistory()
      }
    },
    {
      id: 'ai.config.open',
      title: 'AI: Open Provider Configuration',
      description: 'Open sidebar and focus AI provider configuration controls.',
      keywords: ['ai', 'provider', 'config', 'settings', 'sidebar'],
      run: async () => {
        if (!deps.openAiConfig) {
          throw new Error('AI configuration is unavailable.')
        }

        await deps.openAiConfig()
      }
    },
    {
      id: 'ai.analysis.summarize',
      title: 'AI: Summarize Active Page',
      description: 'Summarize active page content with grounded citation snippets.',
      keywords: ['ai', 'summary', 'summarize', 'page', 'analysis'],
      run: async () => {
        if (!deps.summarizeActivePage) {
          throw new Error('AI page summary is unavailable.')
        }

        requireActiveTabId(deps.activeTabId)
        await deps.summarizeActivePage()
      }
    },
    {
      id: 'ai.analysis.ask',
      title: 'AI: Ask About Active Page',
      description: 'Ask a question about the active page with grounded citations.',
      argumentHint: '[question]',
      keywords: ['ai', 'ask', 'question', 'page', 'analysis'],
      run: async (input: string) => {
        if (!deps.askActivePage) {
          throw new Error('AI page Q&A is unavailable.')
        }

        requireActiveTabId(deps.activeTabId)
        await deps.askActivePage(input)
      }
    },
    {
      id: 'ai.analysis.refresh',
      title: 'AI: Refresh Page Context',
      description: 'Re-extract active page context for follow-up analysis.',
      keywords: ['ai', 'refresh', 'context', 'page', 'analysis'],
      run: async () => {
        if (!deps.refreshPageAnalysisContext) {
          throw new Error('AI context refresh is unavailable.')
        }

        requireActiveTabId(deps.activeTabId)
        await deps.refreshPageAnalysisContext()
      }
    },
    {
      id: 'ai.analysis.clear',
      title: 'AI: Clear Analysis Context',
      description: 'Clear active-tab AI analysis context and cached result state.',
      keywords: ['ai', 'clear', 'context', 'reset', 'analysis'],
      run: async () => {
        if (!deps.clearPageAnalysisContext) {
          throw new Error('AI context clear is unavailable.')
        }

        requireActiveTabId(deps.activeTabId)
        await deps.clearPageAnalysisContext()
      }
    },
    {
      id: 'ai.config.validate',
      title: 'AI: Validate Provider Connection',
      description: 'Run AI provider validation for the selected adapter settings.',
      keywords: ['ai', 'validate', 'provider', 'connection', 'health'],
      run: async () => {
        if (!deps.validateAiConfig) {
          throw new Error('AI validation is unavailable.')
        }

        await deps.validateAiConfig()
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
    },
    {
      id: 'automation.playback.run',
      title: 'Automation: Run Playback Workflow',
      description: 'Run a workflow JSON file in the active tab context.',
      argumentHint: '<workflow-json-path>',
      keywords: ['automation', 'playback', 'run', 'workflow', 'json'],
      run: async (input: string) => {
        const workflowPath = requireInput(input, 'Provide a workflow JSON path.')
        if (!deps.startPlayback) {
          throw new Error('Playback run is unavailable.')
        }

        await deps.startPlayback(workflowPath)
      }
    },
    {
      id: 'automation.playback.cancel',
      title: 'Automation: Cancel Playback',
      description: 'Cancel the active playback run.',
      keywords: ['automation', 'playback', 'cancel', 'stop'],
      run: async () => {
        if (!deps.cancelPlayback) {
          throw new Error('Playback cancel is unavailable.')
        }

        await deps.cancelPlayback()
      }
    }
  ]
}

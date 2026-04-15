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

  return matches.map(({ originalIndex: _originalIndex, ...match }) => match)
}

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { rankCommands, type CommandPaletteCommand } from '../lib/commandPalette'

interface CommandPaletteProps {
  isOpen: boolean
  commands: CommandPaletteCommand[]
  query: string
  onQueryChange: (value: string) => void
  onRequestClose: () => void
  onExecute: (command: CommandPaletteCommand, query: string) => Promise<void>
  errorMessage?: string
}

export function CommandPalette({
  isOpen,
  commands,
  query,
  onQueryChange,
  onRequestClose,
  onExecute,
  errorMessage
}: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const matches = useMemo(() => rankCommands(commands, query), [commands, query])
  const maxIndex = Math.max(matches.length - 1, 0)
  const activeIndex = Math.min(selectedIndex, maxIndex)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    inputRef.current?.focus()
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  const handleQueryChange = (value: string): void => {
    setSelectedIndex(0)
    onQueryChange(value)
  }

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault()
        if (matches.length === 0) {
          return
        }
        setSelectedIndex((current) => Math.min(current + 1, maxIndex))
        return
      }
      case 'ArrowUp': {
        event.preventDefault()
        if (matches.length === 0) {
          return
        }
        setSelectedIndex((current) => Math.max(current - 1, 0))
        return
      }
      case 'Enter': {
        event.preventDefault()
        const selectedMatch = matches[activeIndex]
        if (!selectedMatch) {
          return
        }
        void onExecute(selectedMatch.command, query)
        return
      }
      case 'Escape': {
        event.preventDefault()
        onRequestClose()
      }
    }
  }

  return (
    <div className="command-palette__backdrop" role="presentation" onClick={onRequestClose}>
      <section className="command-palette__panel" role="dialog" aria-label="Command palette" onClick={(event) => event.stopPropagation()}>
        <input
          ref={inputRef}
          className="command-palette__input"
          placeholder="Type a command"
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          onKeyDown={handleInputKeyDown}
          aria-label="Command palette input"
        />

        {errorMessage ? <p className="command-palette__error">{errorMessage}</p> : null}

        {matches.length === 0 ? (
          <p className="command-palette__hint">No matching commands.</p>
        ) : (
          <ul className="command-palette__results" role="listbox" aria-label="Command palette results">
            {matches.map((match, index) => (
              <li key={match.command.id}>
                <button
                  type="button"
                    className={`command-palette__item ${index === activeIndex ? 'command-palette__item--active' : ''}`}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => {
                    void onExecute(match.command, query)
                  }}
                >
                  <span className="command-palette__title">{match.command.title}</span>
                  <span className="command-palette__description">{match.command.description}</span>
                  {match.command.argumentHint ? (
                    <span className="command-palette__hint">{match.command.argumentHint}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default CommandPalette

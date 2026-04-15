import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { DEFAULT_HOME_SEARCH_TEMPLATE } from '../../shared/browser'
import { buildQuickSearchResults, type QuickSearchResult } from '../lib/quickSearch'

export function QuickSearchPopup() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [query, setQuery] = useState('')
  const [searchTemplate, setSearchTemplate] = useState(DEFAULT_HOME_SEARCH_TEMPLATE)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')

  const results = useMemo(
    () => buildQuickSearchResults(query, searchTemplate),
    [query, searchTemplate]
  )

  const maxIndex = Math.max(results.length - 1, 0)
  const activeIndex = Math.min(selectedIndex, maxIndex)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadPreferences = async (): Promise<void> => {
      try {
        const preferences = await window.pathfinder.getHomePreferences()
        if (!isMounted) {
          return
        }

        setSearchTemplate(preferences.searchTemplate || DEFAULT_HOME_SEARCH_TEMPLATE)
      } catch {
        if (!isMounted) {
          return
        }

        setSearchTemplate(DEFAULT_HOME_SEARCH_TEMPLATE)
      }
    }

    void loadPreferences()

    return () => {
      isMounted = false
    }
  }, [])

  const closePopup = async (): Promise<void> => {
    await window.pathfinder.quickSearchClose()
  }

  const submitResult = async (result: QuickSearchResult): Promise<void> => {
    try {
      await window.pathfinder.quickSearchSubmit({
        query: query.trim(),
        target: result.target
      })
      await closePopup()
    } catch {
      setErrorMessage('Unable to submit quick search. Try again.')
    }
  }

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault()
        if (results.length === 0) {
          return
        }
        setSelectedIndex((current) => Math.min(current + 1, maxIndex))
        return
      }
      case 'ArrowUp': {
        event.preventDefault()
        if (results.length === 0) {
          return
        }
        setSelectedIndex((current) => Math.max(current - 1, 0))
        return
      }
      case 'Enter': {
        event.preventDefault()
        const selectedResult = results[activeIndex]
        if (!selectedResult) {
          return
        }
        void submitResult(selectedResult)
        return
      }
      case 'Escape': {
        event.preventDefault()
        void closePopup()
      }
    }
  }

  return (
    <div className="quick-search__container" role="presentation">
      <section className="quick-search__panel" role="dialog" aria-label="Quick search popup">
        <div className="quick-search__header">
          <h1>Quick Search</h1>
          <button
            type="button"
            className="quick-search__close"
            onClick={() => {
              void closePopup()
            }}
          >
            Close
          </button>
        </div>

        <input
          ref={inputRef}
          className="quick-search__input"
          placeholder="Search or enter a URL"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setSelectedIndex(0)
            setErrorMessage('')
          }}
          onKeyDown={handleInputKeyDown}
          aria-label="Quick search input"
        />

        {errorMessage ? <p className="quick-search__error">{errorMessage}</p> : null}

        {results.length === 0 ? (
          <p className="quick-search__hint">Type to search the web or open a URL.</p>
        ) : (
          <ul className="quick-search__results" role="listbox" aria-label="Quick search results">
            {results.map((result, index) => (
              <li key={result.id}>
                <button
                  type="button"
                  className={`quick-search__item ${index === activeIndex ? 'quick-search__item--active' : ''}`}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => {
                    void submitResult(result)
                  }}
                >
                  <span className="quick-search__title">{result.title}</span>
                  <span className="quick-search__description">{result.description}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default QuickSearchPopup

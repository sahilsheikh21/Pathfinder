import type { FormEvent } from 'react'
import type { BrowserTabState } from '../../shared/browser'
import { resolveOmniboxInput } from '../lib/omnibox'

interface NavigationBarProps {
  activeTab: BrowserTabState | null
  onBack: () => void
  onForward: () => void
  onReload: () => void
  onStop: () => void
  onNavigate: (target: string) => void
}

const DEFAULT_SEARCH_TEMPLATE = 'https://duckduckgo.com/?q={query}'

function NavigationBar({ activeTab, onBack, onForward, onReload, onStop, onNavigate }: NavigationBarProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const inputValue = String(formData.get('omnibox') ?? '')

    const resolution = resolveOmniboxInput(inputValue, DEFAULT_SEARCH_TEMPLATE)
    onNavigate(resolution.target)
  }

  return (
    <form className="navigation-bar" onSubmit={handleSubmit}>
      <div className="navigation-bar__controls">
        <button
          type="button"
          className="navigation-bar__button"
          onClick={onBack}
          disabled={!activeTab?.canGoBack}
          aria-label="Go back"
        >
          <span aria-hidden="true">←</span>
        </button>
        <button
          type="button"
          className="navigation-bar__button"
          onClick={onForward}
          disabled={!activeTab?.canGoForward}
          aria-label="Go forward"
        >
          <span aria-hidden="true">→</span>
        </button>
        <button
          type="button"
          className="navigation-bar__button"
          onClick={onReload}
          disabled={!activeTab}
          aria-label="Reload"
        >
          <span aria-hidden="true">↻</span>
        </button>
        <button
          type="button"
          className="navigation-bar__button"
          onClick={onStop}
          disabled={!activeTab}
          aria-label="Stop loading"
        >
          <span aria-hidden="true">■</span>
        </button>
      </div>

      <input
        key={activeTab?.id ?? 'no-active-tab'}
        className={`navigation-bar__omnibox ${activeTab?.isLoading ? 'navigation-bar__omnibox--loading' : ''}`}
        name="omnibox"
        type="text"
        defaultValue={activeTab?.url ?? ''}
        placeholder="Search or enter address"
      />

      <span className={`navigation-bar__status ${activeTab?.isLoading ? 'is-loading' : ''}`} aria-live="polite">
        {activeTab?.isLoading ? 'Loading' : 'Ready'}
      </span>
    </form>
  )
}

export default NavigationBar
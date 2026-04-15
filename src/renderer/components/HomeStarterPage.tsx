import { useState, type FormEvent } from 'react'
import {
  DEFAULT_HOME_SEARCH_TEMPLATE,
  type QuickLink,
  type RecentAutomationPreview
} from '../../shared/browser'

interface HomeStarterPageProps {
  activeTabId: string | null
  draftQueryValue: string
  onDraftQueryChange: (value: string) => void
  quickLinks: QuickLink[]
  recentAutomations: RecentAutomationPreview[]
}

function HomeStarterPage({
  activeTabId,
  draftQueryValue,
  onDraftQueryChange,
  quickLinks,
  recentAutomations
}: HomeStarterPageProps) {
  const [hint, setHint] = useState('')
  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'
  const formattedDate = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()

    const trimmedQuery = draftQueryValue.trim()
    if (!trimmedQuery) {
      setHint('Type a search query to continue.')
      return
    }

    let searchTemplate = DEFAULT_HOME_SEARCH_TEMPLATE
    try {
      const preferences = await window.pathfinder.getHomePreferences()
      if (typeof preferences.searchTemplate === 'string' && preferences.searchTemplate.includes('{query}')) {
        searchTemplate = preferences.searchTemplate
      }
    } catch {
      searchTemplate = DEFAULT_HOME_SEARCH_TEMPLATE
    }

    const target = searchTemplate.replace('{query}', encodeURIComponent(trimmedQuery))
    await window.pathfinder.createTab(target)
    setHint('')
  }

  return (
    <div className="home-starter" data-tab-id={activeTabId ?? undefined}>
      <header className="home-starter__header">
        <p className="home-starter__greeting">{greeting}</p>
        <p className="home-starter__date">{formattedDate}</p>
      </header>

      <form className="home-starter__search" onSubmit={handleSubmit}>
        <input
          value={draftQueryValue}
          onChange={(event) => onDraftQueryChange(event.target.value)}
          placeholder="Search the web"
          aria-label="Home search"
        />
        <button type="submit">Search</button>
      </form>
      <p className="home-starter__hint" role="status">
        {hint}
      </p>

      <section className="home-starter__quick-links" aria-label="Quick links">
        {quickLinks.slice(0, 6).map((quickLink) => (
          <article key={quickLink.id} className="home-starter__card">
            <h3>{quickLink.title}</h3>
            <p>{quickLink.url}</p>
          </article>
        ))}
      </section>

      <section className="home-starter__recent-automations" aria-label="Recent automations">
        {recentAutomations.slice(0, 3).map((automation) => (
          <article key={automation.id} className="home-starter__card">
            <h3>{automation.name}</h3>
            <p>{automation.lastRunAt ?? 'Never run'}</p>
          </article>
        ))}
      </section>
    </div>
  )
}

export default HomeStarterPage

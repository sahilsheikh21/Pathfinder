import type { FormEvent } from 'react'
import type { QuickLink, RecentAutomationPreview } from '../../shared/browser'

interface HomeStarterPageProps {
  activeTabId: string | null
  draftQueryValue: string
  onDraftQueryChange: (value: string) => void
  onSearchSubmit: (query: string) => void
  quickLinks: QuickLink[]
  recentAutomations: RecentAutomationPreview[]
}

function HomeStarterPage({
  activeTabId,
  draftQueryValue,
  onDraftQueryChange,
  onSearchSubmit,
  quickLinks,
  recentAutomations
}: HomeStarterPageProps) {
  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'
  const formattedDate = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    onSearchSubmit(draftQueryValue)
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

import { useEffect, useState, type FormEvent } from 'react'
import {
  DEFAULT_HOME_SEARCH_TEMPLATE,
  type QuickLink,
  type RecentAutomationPreview
} from '../../shared/browser'

interface HomeStarterPageProps {
  activeTabId: string | null
  draftQueryValue: string
  onDraftQueryChange: (value: string) => void
  onNavigate: (target: string) => void
  recentRefreshToken: number
  onRunRecentAutomation: (recentAutomation: RecentAutomationPreview) => Promise<void>
}

function HomeStarterPage({
  activeTabId,
  draftQueryValue,
  onDraftQueryChange,
  onNavigate,
  recentRefreshToken,
  onRunRecentAutomation
}: HomeStarterPageProps) {
  const [quickLinks, setQuickLinks] = useState<QuickLink[]>([])
  const [recentAutomations, setRecentAutomations] = useState<RecentAutomationPreview[]>([])
  const [linkTitle, setLinkTitle] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
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

  useEffect(() => {
    if (!activeTabId) {
      return
    }

    window.pathfinder
      .listQuickLinks()
      .then((listedQuickLinks) => {
        setQuickLinks(listedQuickLinks.slice(0, 6))
      })
      .catch(() => {
        setQuickLinks([])
      })

    window.pathfinder
      .listRecentAutomations()
      .then(setRecentAutomations)
      .catch(() => {
        setRecentAutomations([])
      })
  }, [activeTabId, recentRefreshToken])

  const handleAddLink = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()

    const title = linkTitle.trim()
    const url = linkUrl.trim()
    if (!title || !url) {
      setHint('Provide both title and URL to add a quick link.')
      return
    }

    try {
      const updated = await window.pathfinder.upsertQuickLink({
        id: `quick-link-${Date.now()}`,
        title,
        url,
        pinned: false,
        order: quickLinks.length
      })
      setQuickLinks(updated.slice(0, 6))
      setLinkTitle('')
      setLinkUrl('')
      setHint('')
    } catch {
      setHint('Quick link must use an http:// or https:// URL.')
    }
  }

  const handleTogglePin = async (quickLink: QuickLink): Promise<void> => {
    const updated = await window.pathfinder.upsertQuickLink({
      ...quickLink,
      pinned: !quickLink.pinned
    })
    setQuickLinks(updated.slice(0, 6))
  }

  const handleRemoveLink = async (quickLinkId: string): Promise<void> => {
    const updated = await window.pathfinder.removeQuickLink(quickLinkId)
    setQuickLinks(updated.slice(0, 6))
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

      <form className="home-starter__quick-link-form" onSubmit={handleAddLink}>
        <input
          value={linkTitle}
          onChange={(event) => setLinkTitle(event.target.value)}
          placeholder="Link title"
          aria-label="Quick link title"
        />
        <input
          value={linkUrl}
          onChange={(event) => setLinkUrl(event.target.value)}
          placeholder="https://example.com"
          aria-label="Quick link URL"
        />
        <button type="submit">Add Link</button>
      </form>

      <section className="home-starter__quick-links" aria-label="Quick links">
        {quickLinks.slice(0, 6).map((quickLink) => (
          <article key={quickLink.id} className="home-starter__card">
            <h3>{quickLink.title}</h3>
            <p>{quickLink.url}</p>
            <div className="home-starter__card-actions">
              <button type="button" onClick={() => onNavigate(quickLink.url)}>
                Open
              </button>
              <button type="button" onClick={() => handleTogglePin(quickLink)}>
                {quickLink.pinned ? 'Unpin' : 'Pin'}
              </button>
              <button type="button" onClick={() => handleRemoveLink(quickLink.id)}>
                Remove
              </button>
            </div>
          </article>
        ))}
      </section>

      <section className="home-starter__recent-automations" aria-label="Recent automations">
        {recentAutomations.length === 0 ? <p className="home-starter__recent-empty">No recent automations yet.</p> : null}
        {recentAutomations.slice(0, 3).map((recentAutomation) => (
          <article
            key={recentAutomation.id}
            className={`home-starter__recent-slot ${
              recentAutomation.workflowDeleted ? 'home-starter__recent-slot--deleted' : ''
            }`}
            aria-disabled={recentAutomation.workflowDeleted ? 'true' : undefined}
          >
            <h3>{recentAutomation.name}</h3>
            <p>
              <span className={`home-starter__recent-status home-starter__recent-status--${recentAutomation.status}`}>
                {recentAutomation.status}
              </span>
              <span>
                {recentAutomation.lastRunAt
                  ? new Date(recentAutomation.lastRunAt).toLocaleString()
                  : 'Never run'}
              </span>
            </p>
            <p className="home-starter__recent-duration">
              {recentAutomation.durationMs !== null && recentAutomation.durationMs !== undefined
                ? `Duration: ${Math.max(0, Math.floor(recentAutomation.durationMs))} ms`
                : 'Duration: n/a'}
            </p>
            <button
              type="button"
              disabled={recentAutomation.workflowDeleted === true || !recentAutomation.canRun}
              onClick={async () => {
                await onRunRecentAutomation(recentAutomation)
              }}
            >
              {recentAutomation.workflowDeleted ? 'Deleted' : 'Run'}
            </button>
          </article>
        ))}
      </section>
    </div>
  )
}

export default HomeStarterPage

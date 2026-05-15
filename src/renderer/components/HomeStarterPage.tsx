import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  DEFAULT_HOME_SEARCH_TEMPLATE,
  type QuickLink,
  type RecentAutomationPreview
} from '../../shared/browser'
import { resolveOmniboxInput } from '../lib/omnibox'

const getQuickLinkMonogram = (title: string): string => {
  const trimmed = title.trim()
  if (!trimmed) {
    return '•'
  }

  return trimmed.slice(0, 1).toUpperCase()
}

const getQuickLinkLogoUrl = (rawUrl: string): string | null => {
  try {
    const parsed = new URL(rawUrl)
    if (!parsed.hostname) {
      return null
    }

    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=64`
  } catch {
    return null
  }
}

const getQuickLinkDisplayUrl = (rawUrl: string): string => {
  try {
    const parsed = new URL(rawUrl)
    const hostname = parsed.hostname.replace(/^www\./i, '')
    return hostname || rawUrl
  } catch {
    return rawUrl
  }
}

function PathfinderBrandLogo() {
  return (
    <svg className="home-starter__brand-logo" viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="pathfinder-brand-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff8f67" />
          <stop offset="100%" stopColor="#ff5b3a" />
        </linearGradient>
      </defs>
      <circle cx="14" cy="14" r="9" fill="none" stroke="url(#pathfinder-brand-ring)" strokeWidth="3" />
      <circle cx="14" cy="14" r="4" fill="#ff6e4a" opacity="0.92" />
    </svg>
  )
}

interface QuickLinkLogoProps {
  title: string
  url: string
}

function QuickLinkLogo({ title, url }: QuickLinkLogoProps) {
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null)
  const monogram = getQuickLinkMonogram(title)
  const logoUrl = useMemo(() => getQuickLinkLogoUrl(url), [url])
  const shouldUseImage = Boolean(logoUrl) && failedLogoUrl !== logoUrl

  return (
    <span className="home-starter__card-icon" aria-hidden="true">
      {shouldUseImage ? (
        <img
          className="home-starter__card-icon-image"
          src={logoUrl ?? undefined}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedLogoUrl(logoUrl)}
        />
      ) : (
        <svg
          className="home-starter__card-icon-fallback"
          viewBox="0 0 64 64"
          role="img"
          aria-label={`${title} logo`}
        >
          <defs>
            <linearGradient id="quick-link-fallback-fill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#5f769a" />
              <stop offset="100%" stopColor="#425471" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="60" height="60" rx="18" fill="url(#quick-link-fallback-fill)" />
          <text
            x="32"
            y="37"
            textAnchor="middle"
            fontSize="26"
            fill="#f2f7ff"
            fontWeight="700"
            fontFamily="Segoe UI, Arial, sans-serif"
          >
            {monogram}
          </text>
        </svg>
      )}
    </span>
  )
}

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

    const { target } = resolveOmniboxInput(trimmedQuery, searchTemplate)
    await window.pathfinder.createTab(target)
    setHint('')
  }

  useEffect(() => {
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
      <div className="home-starter__backdrop" aria-hidden="true" />

      <header className="home-starter__hero">
        <p className="home-starter__greeting">
          {greeting} · {formattedDate}
        </p>
        <h1 className="home-starter__brand">
          <PathfinderBrandLogo />
          Pathfinder
        </h1>

        <form className="home-starter__search" onSubmit={handleSubmit}>
          <input
            value={draftQueryValue}
            onChange={(event) => onDraftQueryChange(event.target.value)}
            placeholder="Search the web or enter address"
            aria-label="Home search"
          />
          <button type="submit">
            <span className="home-starter__button-icon" aria-hidden="true">
              {'>'}
            </span>
            <span>Go</span>
          </button>
        </form>

        <p className="home-starter__hint" role="status">
          {hint}
        </p>
      </header>

      <section className="home-starter__section-block" aria-label="Quick links section">
        <header className="home-starter__section-header">
          <h2>Quick Links</h2>
          <p>Organized shortcuts for your most-used sites.</p>
        </header>

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
          <button type="submit">
            <span className="home-starter__button-icon" aria-hidden="true">
              +
            </span>
            <span>Add Link</span>
          </button>
        </form>

        <div className="home-starter__quick-links-grid" aria-label="Quick links">
          {quickLinks.length === 0 ? (
            <p className="home-starter__section-empty">No quick links yet. Add one above to start your dashboard.</p>
          ) : null}

          {quickLinks.slice(0, 6).map((quickLink) => (
            <article key={quickLink.id} className="home-starter__card">
              <button
                type="button"
                className="home-starter__card-open"
                onClick={() => onNavigate(quickLink.url)}
                title={quickLink.url}
              >
                <QuickLinkLogo title={quickLink.title} url={quickLink.url} />
                <span className="home-starter__card-title">{quickLink.title}</span>
                <span className="home-starter__card-url">{getQuickLinkDisplayUrl(quickLink.url)}</span>
              </button>
              <div className="home-starter__card-actions">
                <button
                  type="button"
                  className={quickLink.pinned ? 'is-pinned' : undefined}
                  onClick={() => handleTogglePin(quickLink)}
                >
                  <span className="home-starter__button-icon" aria-hidden="true">
                    {quickLink.pinned ? '*' : '^'}
                  </span>
                  <span>{quickLink.pinned ? 'Pinned' : 'Pin'}</span>
                </button>
                <button type="button" onClick={() => handleRemoveLink(quickLink.id)}>
                  <span className="home-starter__button-icon" aria-hidden="true">
                    -
                  </span>
                  <span>Remove</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="home-starter__section-block" aria-label="Recent automations section">
        <header className="home-starter__section-header">
          <h2>Recent Automations</h2>
          <p>Resume recently executed workflows in one click.</p>
        </header>

        <div className="home-starter__recent-grid" aria-label="Recent automations">
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
                <span className="home-starter__button-icon" aria-hidden="true">
                  {recentAutomation.workflowDeleted ? 'x' : '>'}
                </span>
                <span>{recentAutomation.workflowDeleted ? 'Deleted' : 'Run'}</span>
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

export default HomeStarterPage

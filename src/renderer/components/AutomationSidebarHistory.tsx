import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  AutomationHistoryEntry,
  AutomationHistoryListRequest,
  AutomationHistoryStatus
} from '../../shared/browser'

interface AutomationSidebarHistoryProps {
  entries: AutomationHistoryEntry[]
  query: string
  status: AutomationHistoryListRequest['status']
  scrollTop: number
  onQueryChange: (value: string) => void
  onStatusChange: (value: AutomationHistoryListRequest['status']) => void
  onScrollChange: (scrollTop: number) => void
  onRerun: (entry: AutomationHistoryEntry) => Promise<void>
  onRemove: (entry: AutomationHistoryEntry) => Promise<void>
  onClear: () => Promise<void>
}

const STATUS_OPTIONS: Array<{ value: AutomationHistoryListRequest['status']; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'running', label: 'Running' },
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' }
]

const toRelativeTime = (iso: string | null): string => {
  if (!iso) {
    return 'Pending'
  }

  const timestamp = Date.parse(iso)
  if (!Number.isFinite(timestamp)) {
    return 'Unknown'
  }

  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) {
    return 'Just now'
  }
  if (minutes < 60) {
    return `${minutes}m ago`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours}h ago`
  }

  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const toDurationText = (durationMs: number | null): string => {
  if (durationMs === null || !Number.isFinite(durationMs)) {
    return 'In progress'
  }

  if (durationMs < 1000) {
    return `${Math.max(0, Math.floor(durationMs))} ms`
  }

  const seconds = durationMs / 1000
  if (seconds < 60) {
    return `${seconds.toFixed(1)} s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}m ${remainingSeconds}s`
}

const toStatusLabel = (status: AutomationHistoryStatus): string => {
  if (status === 'success') {
    return 'Success'
  }

  if (status === 'failed') {
    return 'Failed'
  }

  if (status === 'cancelled') {
    return 'Cancelled'
  }

  return 'Running'
}

function AutomationSidebarHistory({
  entries,
  query,
  status,
  scrollTop,
  onQueryChange,
  onStatusChange,
  onScrollChange,
  onRerun,
  onRemove,
  onClear
}: AutomationSidebarHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [viewportHeight, setViewportHeight] = useState(420)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const rowHeight = 96

  useEffect(() => {
    if (!viewportRef.current) {
      return
    }

    if (Math.abs(viewportRef.current.scrollTop - scrollTop) > 4) {
      viewportRef.current.scrollTop = scrollTop
    }
  }, [scrollTop])

  useEffect(() => {
    if (!viewportRef.current) {
      return
    }

    const update = (): void => {
      if (!viewportRef.current) {
        return
      }

      setViewportHeight(viewportRef.current.clientHeight || 420)
    }

    update()
    const observer = new ResizeObserver(() => update())
    observer.observe(viewportRef.current)

    return () => {
      observer.disconnect()
    }
  }, [])

  const { startIndex, visibleEntries } = useMemo(() => {
    const firstVisible = Math.max(0, Math.floor(scrollTop / rowHeight) - 3)
    const visibleCount = Math.ceil(viewportHeight / rowHeight) + 8
    const lastVisible = Math.min(entries.length, firstVisible + visibleCount)

    return {
      startIndex: firstVisible,
      visibleEntries: entries.slice(firstVisible, lastVisible)
    }
  }, [entries, rowHeight, scrollTop, viewportHeight])

  return (
    <section className="automation-sidebar-history" aria-label="Automation run history">
      <header className="automation-sidebar-history__header">
        <div className="automation-sidebar-history__filters">
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search history"
            aria-label="Search history"
          />
          <select
            value={status ?? 'all'}
            onChange={(event) => onStatusChange(event.target.value as AutomationHistoryListRequest['status'])}
            aria-label="Filter status"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="is-danger"
          onClick={async () => {
            const approved = window.confirm('Clear all completed history entries? Running entries will be preserved.')
            if (!approved) {
              return
            }

            await onClear()
          }}
        >
          Clear Completed
        </button>
      </header>

      <div
        className="automation-sidebar-history__viewport"
        ref={viewportRef}
        onScroll={(event) => onScrollChange((event.currentTarget as HTMLDivElement).scrollTop)}
      >
        {entries.length === 0 ? (
          <article className="automation-sidebar-empty-card">
            <h3>No run history yet</h3>
            <p>Runs started from sidebar or command palette will appear here.</p>
          </article>
        ) : null}

        <div className="automation-sidebar-history__spacer" style={{ height: entries.length * rowHeight }}>
          {visibleEntries.map((entry, index) => {
            const absoluteIndex = startIndex + index
            const top = absoluteIndex * rowHeight
            const isExpanded = expandedId === entry.id

            return (
              <article
                key={entry.id}
                className={`automation-history-item automation-history-item--${entry.status}`}
                style={{ top }}
              >
                <header className="automation-history-item__header">
                  <h3>{entry.workflowNameSnapshot}</h3>
                  <span className={`automation-history-item__badge automation-history-item__badge--${entry.status}`}>
                    {toStatusLabel(entry.status)}
                  </span>
                </header>
                <p className="automation-history-item__meta">
                  <span>{toDurationText(entry.durationMs)}</span>
                  <span>{toRelativeTime(entry.finishedAt ?? entry.startedAt)}</span>
                </p>
                <p className="automation-history-item__snippet" title={entry.failureSnippet ?? undefined}>
                  {entry.failureSnippet ?? 'No failure details'}
                </p>
                <div className="automation-history-item__actions">
                  <button
                    type="button"
                    onClick={() => setExpandedId((current) => (current === entry.id ? null : entry.id))}
                  >
                    {isExpanded ? 'Hide Details' : 'Details'}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === entry.id || entry.workflowDeleted === true}
                    onClick={async () => {
                      setBusyId(entry.id)
                      try {
                        await onRerun(entry)
                      } finally {
                        setBusyId((current) => (current === entry.id ? null : current))
                      }
                    }}
                  >
                    Re-run
                  </button>
                  <button
                    type="button"
                    className="is-danger"
                    disabled={busyId === entry.id}
                    onClick={async () => {
                      const approved = window.confirm('Remove this history entry?')
                      if (!approved) {
                        return
                      }

                      setBusyId(entry.id)
                      try {
                        await onRemove(entry)
                      } finally {
                        setBusyId((current) => (current === entry.id ? null : current))
                      }
                    }}
                  >
                    Remove
                  </button>
                </div>
                {isExpanded ? (
                  <div className="automation-history-item__details">
                    <p>
                      <strong>Exact time:</strong>{' '}
                      {entry.finishedAt ? new Date(entry.finishedAt).toLocaleString() : 'Not finished'}
                    </p>
                    <p>
                      <strong>Duration (ms):</strong> {entry.durationMs ?? 'Pending'}
                    </p>
                    <p>
                      <strong>Source:</strong> {entry.sourceLabel}
                    </p>
                    <p>
                      <strong>Workflow:</strong>{' '}
                      {entry.workflowDeleted ? `${entry.workflowNameSnapshot} (workflow deleted)` : entry.workflowNameSnapshot}
                    </p>
                    <p>
                      <strong>Failure detail:</strong> {entry.failureDetail ?? 'None'}
                    </p>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default AutomationSidebarHistory

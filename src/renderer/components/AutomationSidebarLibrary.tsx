import { useEffect, useMemo, useRef, useState } from 'react'
import type { AutomationLibraryItem, AutomationLibraryUpsertRequest } from '../../shared/browser'

interface AutomationSidebarLibraryProps {
  items: AutomationLibraryItem[]
  query: string
  tagFilter: string[]
  scrollTop: number
  onQueryChange: (value: string) => void
  onTagFilterChange: (tags: string[]) => void
  onUpsert: (request: AutomationLibraryUpsertRequest) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onRun: (item: AutomationLibraryItem) => Promise<void>
  onScrollChange: (scrollTop: number) => void
}

const parseTagInput = (value: string): string[] => {
  return value
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
}

function AutomationSidebarLibrary({
  items,
  query,
  tagFilter,
  scrollTop,
  onQueryChange,
  onTagFilterChange,
  onUpsert,
  onDelete,
  onRun,
  onScrollChange
}: AutomationSidebarLibraryProps) {
  const [tagDraftByItemId, setTagDraftByItemId] = useState<Record<string, string>>({})
  const [busyItemId, setBusyItemId] = useState<string | null>(null)
  const [filterTagInput, setFilterTagInput] = useState(tagFilter.join(', '))
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setFilterTagInput(tagFilter.join(', '))
  }, [tagFilter])

  useEffect(() => {
    if (!listRef.current) {
      return
    }

    if (Math.abs(listRef.current.scrollTop - scrollTop) > 4) {
      listRef.current.scrollTop = scrollTop
    }
  }, [scrollTop])

  const handleCreate = async (origin: AutomationLibraryItem['origin']): Promise<void> => {
    const name = window.prompt(
      origin === 'recorded'
        ? 'Save latest recording as automation name:'
        : 'Import workflow JSON name:'
    )
    if (!name) {
      return
    }

    const workflowPath = window.prompt('Workflow JSON file path:')
    if (!workflowPath) {
      return
    }

    const description = window.prompt('Optional description:') ?? ''

    await onUpsert({
      item: {
        id: crypto.randomUUID(),
        name,
        description,
        tags: [],
        workflowPath,
        origin
      }
    })
  }

  const handleRename = async (item: AutomationLibraryItem): Promise<void> => {
    const name = window.prompt('Rename automation:', item.name)
    if (!name) {
      return
    }

    await onUpsert({
      item: {
        ...item,
        name
      }
    })
  }

  const handleAddTag = async (item: AutomationLibraryItem): Promise<void> => {
    const draft = tagDraftByItemId[item.id]?.trim().toLowerCase() ?? ''
    if (!draft) {
      return
    }

    const nextTags = [...new Set([...item.tags, draft])]
    await onUpsert({
      item: {
        ...item,
        tags: nextTags
      }
    })
    setTagDraftByItemId((current) => ({
      ...current,
      [item.id]: ''
    }))
  }

  const handleRemoveTag = async (item: AutomationLibraryItem, tag: string): Promise<void> => {
    await onUpsert({
      item: {
        ...item,
        tags: item.tags.filter((entry) => entry !== tag)
      }
    })
  }

  const handleDelete = async (item: AutomationLibraryItem): Promise<void> => {
    const approved = window.confirm(`Delete automation "${item.name}"? This cannot be undone.`)
    if (!approved) {
      return
    }

    await onDelete(item.id)
  }

  const sortedItems = useMemo(() => {
    return [...items].sort((left, right) => {
      const leftRun = left.lastRunAt ? Date.parse(left.lastRunAt) : Number.NEGATIVE_INFINITY
      const rightRun = right.lastRunAt ? Date.parse(right.lastRunAt) : Number.NEGATIVE_INFINITY
      if (leftRun !== rightRun) {
        return rightRun - leftRun
      }

      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
    })
  }, [items])

  return (
    <section className="automation-sidebar-library" aria-label="Saved automations">
      <header className="automation-sidebar-library__header">
        <div className="automation-sidebar-library__actions">
          <button type="button" onClick={() => void handleCreate('recorded')}>
            Save Latest Recording
          </button>
          <button type="button" onClick={() => void handleCreate('imported')}>
            Import Workflow JSON
          </button>
        </div>
        <div className="automation-sidebar-library__filters">
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search automations"
            aria-label="Search saved automations"
          />
          <input
            type="text"
            value={filterTagInput}
            onChange={(event) => setFilterTagInput(event.target.value)}
            onBlur={() => onTagFilterChange(parseTagInput(filterTagInput))}
            placeholder="Filter tags (comma separated)"
            aria-label="Filter by tags"
          />
        </div>
      </header>

      <div
        className="automation-sidebar-library__list"
        ref={listRef}
        onScroll={(event) => onScrollChange((event.currentTarget as HTMLDivElement).scrollTop)}
      >
        {sortedItems.length === 0 ? (
          <article className="automation-sidebar-empty-card">
            <h3>Saved automations are empty</h3>
            <p>Create from your latest recording or import a workflow JSON file.</p>
          </article>
        ) : null}

        {sortedItems.map((item) => (
          <article key={item.id} className="automation-library-item">
            <header className="automation-library-item__header">
              <h3>{item.name}</h3>
              <span className={`automation-library-item__origin automation-library-item__origin--${item.origin}`}>
                {item.origin}
              </span>
            </header>
            <p className="automation-library-item__description">{item.description ?? 'No description'}</p>
            <div className="automation-library-item__tags">
              {item.tags.length === 0 ? <span className="automation-library-item__tag-empty">No tags</span> : null}
              {item.tags.map((tag) => (
                <button
                  key={`${item.id}-${tag}`}
                  type="button"
                  className="automation-library-item__tag"
                  onClick={() => void handleRemoveTag(item, tag)}
                  aria-label={`Remove tag ${tag}`}
                >
                  #{tag}
                </button>
              ))}
            </div>
            <div className="automation-library-item__tag-editor">
              <input
                type="text"
                value={tagDraftByItemId[item.id] ?? ''}
                onChange={(event) => {
                  const value = event.target.value
                  setTagDraftByItemId((current) => ({
                    ...current,
                    [item.id]: value
                  }))
                }}
                placeholder="Add tag"
                aria-label={`Add tag for ${item.name}`}
              />
              <button type="button" onClick={() => void handleAddTag(item)}>
                Add Tag
              </button>
            </div>
            <div className="automation-library-item__meta">
              <span>Updated {new Date(item.updatedAt).toLocaleString()}</span>
              <span>{item.lastRunAt ? `Last run ${new Date(item.lastRunAt).toLocaleString()}` : 'Never run'}</span>
            </div>
            <div className="automation-library-item__actions">
              <button
                type="button"
                disabled={busyItemId === item.id}
                onClick={async () => {
                  setBusyItemId(item.id)
                  try {
                    await onRun(item)
                  } finally {
                    setBusyItemId((current) => (current === item.id ? null : current))
                  }
                }}
              >
                Run
              </button>
              <button type="button" onClick={() => void handleRename(item)}>
                Rename
              </button>
              <button type="button" className="is-danger" onClick={() => void handleDelete(item)}>
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default AutomationSidebarLibrary

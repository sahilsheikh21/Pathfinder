import type { BrowserTabState } from '../../shared/browser'

interface BrowserTabStripProps {
  tabs: BrowserTabState[]
  activeTabId: string | null
  commandPaletteShortcutHint: string
  onCreateTab: () => void
  onActivateTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
}

const getTabLabel = (tab: BrowserTabState): string => {
  if (tab.title && tab.title.trim().length > 0) {
    return tab.title
  }

  if (tab.url && tab.url.trim().length > 0) {
    return tab.url
  }

  return 'New Tab'
}

function BrowserTabStrip({
  tabs,
  activeTabId,
  commandPaletteShortcutHint,
  onCreateTab,
  onActivateTab,
  onCloseTab
}: BrowserTabStripProps) {
  return (
    <aside className="browser-tab-strip" aria-label="Sidebar tabs">
      <header className="browser-tab-strip__header">
        <p className="browser-tab-strip__eyebrow">Workspace</p>
        <h2 className="browser-tab-strip__title">Pathfinder</h2>
      </header>

      <button type="button" className="browser-tab-strip__new" onClick={onCreateTab}>
        <span className="browser-tab-strip__new-icon" aria-hidden="true">
          +
        </span>
        <span>New Tab</span>
      </button>

      <div className="browser-tab-strip__tabs" role="tablist" aria-label="Browser tabs">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId

          return (
            <div key={tab.id} className={`browser-tab ${isActive ? 'browser-tab--active' : ''}`}>
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                className="browser-tab__button"
                onClick={() => onActivateTab(tab.id)}
                title={tab.url}
              >
                {getTabLabel(tab)}
              </button>
              <button
                type="button"
                className="browser-tab__close"
                onClick={(event) => {
                  event.stopPropagation()
                  onCloseTab(tab.id)
                }}
                aria-label={`Close ${getTabLabel(tab)}`}
              >
                <span aria-hidden="true">x</span>
              </button>
            </div>
          )
        })}
      </div>

      <p className="browser-tab-strip__hint">{commandPaletteShortcutHint} for command palette</p>
    </aside>
  )
}

export default BrowserTabStrip
import type { BrowserTabState } from '../../shared/browser'

interface BrowserTabStripProps {
  tabs: BrowserTabState[]
  activeTabId: string | null
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

function BrowserTabStrip({ tabs, activeTabId, onCreateTab, onActivateTab, onCloseTab }: BrowserTabStripProps) {
  return (
    <div className="browser-tab-strip" role="tablist" aria-label="Browser tabs">
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
              x
            </button>
          </div>
        )
      })}

      <button type="button" className="browser-tab-strip__new" onClick={onCreateTab}>
        New Tab
      </button>
    </div>
  )
}

export default BrowserTabStrip
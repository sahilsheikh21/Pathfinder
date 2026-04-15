import { useMemo, useRef } from 'react'
import type { AutomationSidebarPreferences, AutomationSidebarSection } from '../../shared/browser'

interface AutomationSidebarProps {
  preferences: AutomationSidebarPreferences
  overlayMode: boolean
  overlayOpen: boolean
  badges: Partial<Record<AutomationSidebarSection, number>>
  onOverlayToggle: () => void
  onOverlayClose: () => void
  onToggleCollapse: () => void
  onSetActiveSection: (section: AutomationSidebarSection) => void
  onResizeWidth: (width: number) => void
  libraryContent: React.ReactNode
  historyContent: React.ReactNode
}

const SECTION_ORDER: AutomationSidebarSection[] = ['library', 'history', 'ai-chat']

const SECTION_LABELS: Record<AutomationSidebarSection, string> = {
  library: 'Saved Automations',
  history: 'History',
  'ai-chat': 'AI Chat'
}

const SECTION_ICONS: Record<AutomationSidebarSection, string> = {
  library: 'L',
  history: 'H',
  'ai-chat': 'AI'
}

function AutomationSidebar({
  preferences,
  overlayMode,
  overlayOpen,
  badges,
  onOverlayToggle,
  onOverlayClose,
  onToggleCollapse,
  onSetActiveSection,
  onResizeWidth,
  libraryContent,
  historyContent
}: AutomationSidebarProps) {
  const navButtonRefs = useRef<Array<HTMLButtonElement | null>>([])

  const isCollapsed = preferences.collapsed && !overlayMode
  const shouldShowOverlay = overlayMode && overlayOpen

  const panelClasses = useMemo(() => {
    return [
      'automation-sidebar',
      isCollapsed ? 'automation-sidebar--collapsed' : '',
      overlayMode ? 'automation-sidebar--overlay' : '',
      shouldShowOverlay ? 'automation-sidebar--overlay-open' : ''
    ]
      .filter(Boolean)
      .join(' ')
  }, [isCollapsed, overlayMode, shouldShowOverlay])

  const renderContent = (): React.ReactNode => {
    if (preferences.activeSection === 'library') {
      return libraryContent
    }

    if (preferences.activeSection === 'history') {
      return historyContent
    }

    return (
      <article className="automation-sidebar-empty-card automation-sidebar-ai-placeholder">
        <h3>AI Chat is coming soon</h3>
        <p>
          The section is reserved in phase 9. Chat actions are intentionally disabled while
          sidebar library and history workflows are finalized.
        </p>
      </article>
    )
  }

  return (
    <>
      {overlayMode ? (
        <button
          type="button"
          className="automation-sidebar-overlay-toggle"
          onClick={onOverlayToggle}
          aria-expanded={overlayOpen}
          aria-controls="automation-sidebar-panel"
        >
          {overlayOpen ? 'Close Sidebar' : 'Open Sidebar'}
        </button>
      ) : null}

      {overlayMode && overlayOpen ? (
        <button type="button" className="automation-sidebar-backdrop" onClick={onOverlayClose} aria-label="Close sidebar" />
      ) : null}

      <aside
        id="automation-sidebar-panel"
        className={panelClasses}
        style={{ width: isCollapsed ? 72 : preferences.width }}
        aria-label="Automation sidebar"
      >
        <header className="automation-sidebar__header">
          <button type="button" onClick={onToggleCollapse} className="automation-sidebar__collapse-toggle">
            {isCollapsed ? 'Expand' : 'Collapse'}
          </button>
        </header>

        <nav
          className="automation-sidebar__sections"
          aria-label="Automation sidebar sections"
          onKeyDown={(event) => {
            const currentIndex = SECTION_ORDER.indexOf(preferences.activeSection)
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
              return
            }

            event.preventDefault()
            const direction = event.key === 'ArrowDown' ? 1 : -1
            const nextIndex = (currentIndex + direction + SECTION_ORDER.length) % SECTION_ORDER.length
            const nextSection = SECTION_ORDER[nextIndex] ?? 'library'
            onSetActiveSection(nextSection)
            navButtonRefs.current[nextIndex]?.focus()
          }}
        >
          {SECTION_ORDER.map((section, index) => {
            const isActive = preferences.activeSection === section
            const badgeCount = badges[section] ?? 0

            return (
              <button
                key={section}
                type="button"
                ref={(element) => {
                  navButtonRefs.current[index] = element
                }}
                className={`automation-sidebar__section-button ${isActive ? 'is-active' : ''}`}
                onClick={() => onSetActiveSection(section)}
                aria-label={SECTION_LABELS[section]}
              >
                <span className="automation-sidebar__section-icon">{SECTION_ICONS[section]}</span>
                {!isCollapsed ? <span className="automation-sidebar__section-label">{SECTION_LABELS[section]}</span> : null}
                {badgeCount > 0 ? <span className="automation-sidebar__badge">{badgeCount}</span> : null}
              </button>
            )
          })}
        </nav>

        <div className="automation-sidebar__content">{renderContent()}</div>

        {!overlayMode && !isCollapsed ? (
          <button
            type="button"
            className="automation-sidebar__resizer"
            aria-label="Resize sidebar"
            onPointerDown={(event) => {
              const startX = event.clientX
              const startWidth = preferences.width
              const onMove = (moveEvent: PointerEvent): void => {
                const delta = moveEvent.clientX - startX
                onResizeWidth(startWidth + delta)
              }

              const onUp = (): void => {
                window.removeEventListener('pointermove', onMove)
                window.removeEventListener('pointerup', onUp)
              }

              window.addEventListener('pointermove', onMove)
              window.addEventListener('pointerup', onUp)
            }}
          />
        ) : null}
      </aside>
    </>
  )
}

export default AutomationSidebar

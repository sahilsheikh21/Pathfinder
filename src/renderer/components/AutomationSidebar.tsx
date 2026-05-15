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
  aiContent: React.ReactNode
}

const SECTION_ORDER: AutomationSidebarSection[] = ['library', 'history', 'ai-chat']

const SECTION_LABELS: Record<AutomationSidebarSection, string> = {
  library: 'Saved Automations',
  history: 'History',
  'ai-chat': 'AI Assistant, Live Agent & Generation'
}

const renderSectionIcon = (section: AutomationSidebarSection): React.ReactNode => {
  if (section === 'library') {
    return (
      <svg viewBox="0 0 20 20" focusable="false" aria-hidden="true">
        <path
          d="M4 4.5C4 3.67 4.67 3 5.5 3h9A1.5 1.5 0 0 1 16 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 15.5v-11Zm2 .5v10h8V5H6Zm-1 0h0Z"
          fill="currentColor"
        />
      </svg>
    )
  }

  if (section === 'history') {
    return (
      <svg viewBox="0 0 20 20" focusable="false" aria-hidden="true">
        <path
          d="M10 3a7 7 0 1 1-5.98 10.64.75.75 0 1 1 1.28-.78A5.5 5.5 0 1 0 4.5 10H2.75a.75.75 0 0 1 0-1.5H5A.75.75 0 0 1 5.75 9v2.25a.75.75 0 0 1-1.5 0v-.7A7 7 0 0 1 10 3Zm-.75 3.5a.75.75 0 0 1 1.5 0v3.19l2 1.16a.75.75 0 1 1-.75 1.3l-2.38-1.37a.75.75 0 0 1-.37-.65V6.5Z"
          fill="currentColor"
        />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 20 20" focusable="false" aria-hidden="true">
      <path
        d="M10 2.75a.75.75 0 0 1 .71.52l1.02 3.14h3.3a.75.75 0 0 1 .44 1.36l-2.67 1.94 1.02 3.14a.75.75 0 0 1-1.15.84L10 11.76l-2.67 1.93a.75.75 0 0 1-1.15-.84L7.2 9.7 4.53 7.77a.75.75 0 0 1 .44-1.36h3.3l1.02-3.14a.75.75 0 0 1 .71-.52Z"
        fill="currentColor"
      />
    </svg>
  )
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
  historyContent,
  aiContent
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

    return aiContent
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
                <span className="automation-sidebar__section-icon">{renderSectionIcon(section)}</span>
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

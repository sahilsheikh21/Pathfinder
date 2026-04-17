import { useEffect, useMemo, useState } from 'react'
import type {
  BrowserClearDataBucket,
  BrowserGeneralSettings,
  BrowserPrivacySettings,
  BrowserSettingsSnapshot,
  ClearDataBucketResult
} from '../../shared/browser'

type SettingsPanelSection = 'general' | 'privacy' | 'ai' | 'advanced'

interface SettingsPanelProps {
  isOpen: boolean
  snapshot: BrowserSettingsSnapshot | null
  loading: boolean
  busyState: 'idle' | 'saving-general' | 'saving-privacy' | 'clearing-data'
  statusMessage: string
  statusTone: 'neutral' | 'success' | 'error'
  validationErrors: Partial<Record<string, string>>
  clearDataResults: ClearDataBucketResult[]
  onRequestClose: () => void
  onSaveGeneral: (general: BrowserGeneralSettings) => Promise<void>
  onSavePrivacy: (privacy: BrowserPrivacySettings) => Promise<void>
  onClearData: (buckets: BrowserClearDataBucket[]) => Promise<void>
}

const CLEAR_DATA_BUCKET_OPTIONS: Array<{ value: BrowserClearDataBucket; label: string; detail: string }> = [
  {
    value: 'history-downloads',
    label: 'History and Downloads Metadata',
    detail: 'Clears recorded browsing history and local download history metadata.'
  },
  {
    value: 'cookies-site-data',
    label: 'Cookies and Site Data',
    detail: 'Clears cookies, local storage, and site persisted data.'
  },
  {
    value: 'cache-storage',
    label: 'Cache and Storage Cache',
    detail: 'Clears HTTP cache and cache-storage entries.'
  },
  {
    value: 'app-settings-subset',
    label: 'App Settings Subset',
    detail: 'Resets selected local app settings to safe defaults.'
  }
]

const SECTION_LABELS: Record<SettingsPanelSection, string> = {
  general: 'General',
  privacy: 'Privacy',
  ai: 'AI',
  advanced: 'Advanced'
}

const parseStartupUrls = (value: string): string[] => {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function SettingsPanel({
  isOpen,
  snapshot,
  loading,
  busyState,
  statusMessage,
  statusTone,
  validationErrors,
  clearDataResults,
  onRequestClose,
  onSaveGeneral,
  onSavePrivacy,
  onClearData
}: SettingsPanelProps) {
  const [activeSection, setActiveSection] = useState<SettingsPanelSection>('general')
  const [generalDraft, setGeneralDraft] = useState<BrowserGeneralSettings | null>(
    () => snapshot?.general ?? null
  )
  const [privacyDraft, setPrivacyDraft] = useState<BrowserPrivacySettings | null>(
    () => snapshot?.privacy ?? null
  )
  const [startupUrlsDraft, setStartupUrlsDraft] = useState(
    () => snapshot?.general.startupUrls.join('\n') ?? ''
  )
  const [selectedBuckets, setSelectedBuckets] = useState<BrowserClearDataBucket[]>([])
  const [clearConfirmChecked, setClearConfirmChecked] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') {
        return
      }

      event.preventDefault()
      onRequestClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, onRequestClose])

  const clearButtonDisabled =
    busyState !== 'idle' || selectedBuckets.length === 0 || !clearConfirmChecked

  const statusClassName = useMemo(() => {
    return `settings-panel__status settings-panel__status--${statusTone}`
  }, [statusTone])

  if (!isOpen) {
    return null
  }

  return (
    <aside className="settings-panel" aria-label="Settings panel">
      <header className="settings-panel__header">
        <div>
          <h2>Settings</h2>
          <p>Configure startup behavior, privacy controls, and runtime defaults.</p>
        </div>
        <button type="button" className="settings-panel__close" onClick={onRequestClose}>
          Close
        </button>
      </header>

      <nav className="settings-panel__sections" aria-label="Settings sections">
        {(Object.keys(SECTION_LABELS) as SettingsPanelSection[]).map((section) => (
          <button
            key={section}
            type="button"
            className={`settings-panel__section-button ${activeSection === section ? 'is-active' : ''}`}
            onClick={() => setActiveSection(section)}
          >
            {SECTION_LABELS[section]}
          </button>
        ))}
      </nav>

      {loading ? <p className="settings-panel__loading">Loading settings snapshot...</p> : null}

      {!loading && !snapshot ? (
        <p className="settings-panel__loading">Settings snapshot is unavailable. Try reopening the panel.</p>
      ) : null}

      {activeSection === 'general' && generalDraft ? (
        <section className="settings-panel__section" aria-label="General settings">
          <label className="settings-panel__field">
            <span>Startup Mode</span>
            <select
              value={generalDraft.startupMode}
              onChange={(event) => {
                const startupMode = event.target.value as BrowserGeneralSettings['startupMode']
                setGeneralDraft((current) =>
                  current
                    ? {
                        ...current,
                        startupMode
                      }
                    : current
                )
              }}
            >
              <option value="restore-last-session">Restore Last Session</option>
              <option value="open-home">Open Home</option>
              <option value="open-urls">Open Startup URLs</option>
            </select>
            {validationErrors['general.startupMode'] ? (
              <small>{validationErrors['general.startupMode']}</small>
            ) : null}
          </label>

          {generalDraft.startupMode === 'open-urls' ? (
            <label className="settings-panel__field">
              <span>Startup URLs (one per line)</span>
              <textarea
                rows={4}
                value={startupUrlsDraft}
                onChange={(event) => setStartupUrlsDraft(event.target.value)}
                placeholder="https://example.com\nhttps://docs.example.com"
              />
              {validationErrors['general.startupUrls'] ? (
                <small>{validationErrors['general.startupUrls']}</small>
              ) : null}
            </label>
          ) : null}

          <label className="settings-panel__field">
            <span>Homepage Mode</span>
            <select
              value={generalDraft.homepageMode}
              onChange={(event) => {
                const homepageMode = event.target.value as BrowserGeneralSettings['homepageMode']
                setGeneralDraft((current) =>
                  current
                    ? {
                        ...current,
                        homepageMode
                      }
                    : current
                )
              }}
            >
              <option value="home-starter">Home Starter</option>
              <option value="custom-url">Custom URL</option>
            </select>
            {validationErrors['general.homepageMode'] ? (
              <small>{validationErrors['general.homepageMode']}</small>
            ) : null}
          </label>

          {generalDraft.homepageMode === 'custom-url' ? (
            <label className="settings-panel__field">
              <span>Homepage URL</span>
              <input
                type="text"
                value={generalDraft.homepageUrl}
                onChange={(event) => {
                  const homepageUrl = event.target.value
                  setGeneralDraft((current) =>
                    current
                      ? {
                          ...current,
                          homepageUrl
                        }
                      : current
                  )
                }}
                placeholder="https://example.com"
              />
              {validationErrors['general.homepageUrl'] ? (
                <small>{validationErrors['general.homepageUrl']}</small>
              ) : null}
            </label>
          ) : null}

          <label className="settings-panel__field">
            <span>Downloads Mode</span>
            <select
              value={generalDraft.downloadsMode}
              onChange={(event) => {
                const downloadsMode = event.target.value as BrowserGeneralSettings['downloadsMode']
                setGeneralDraft((current) =>
                  current
                    ? {
                        ...current,
                        downloadsMode
                      }
                    : current
                )
              }}
            >
              <option value="ask-every-time">Ask Every Time</option>
              <option value="fixed-path">Fixed Path</option>
            </select>
            {validationErrors['general.downloadsMode'] ? (
              <small>{validationErrors['general.downloadsMode']}</small>
            ) : null}
          </label>

          {generalDraft.downloadsMode === 'fixed-path' ? (
            <label className="settings-panel__field">
              <span>Downloads Path</span>
              <input
                type="text"
                value={generalDraft.downloadsPath}
                onChange={(event) => {
                  const downloadsPath = event.target.value
                  setGeneralDraft((current) =>
                    current
                      ? {
                          ...current,
                          downloadsPath
                        }
                      : current
                  )
                }}
                placeholder="C:/Users/you/Downloads"
              />
              {validationErrors['general.downloadsPath'] ? (
                <small>{validationErrors['general.downloadsPath']}</small>
              ) : null}
            </label>
          ) : null}

          <div className="settings-panel__actions">
            <button
              type="button"
              disabled={busyState !== 'idle'}
              onClick={() => {
                const nextGeneral: BrowserGeneralSettings = {
                  ...generalDraft,
                  startupUrls: parseStartupUrls(startupUrlsDraft)
                }

                void onSaveGeneral(nextGeneral)
              }}
            >
              {busyState === 'saving-general' ? 'Saving...' : 'Save General Settings'}
            </button>
          </div>
        </section>
      ) : null}

      {activeSection === 'privacy' && privacyDraft ? (
        <section className="settings-panel__section" aria-label="Privacy settings">
          <label className="settings-panel__field">
            <span>Cookie Mode</span>
            <select
              value={privacyDraft.cookieMode}
              onChange={(event) => {
                const cookieMode = event.target.value as BrowserPrivacySettings['cookieMode']
                setPrivacyDraft((current) =>
                  current
                    ? {
                        ...current,
                        cookieMode
                      }
                    : current
                )
              }}
            >
              <option value="allow-all">Allow All</option>
              <option value="block-third-party">Block Third-Party (Best Effort)</option>
              <option value="block-all">Block All</option>
            </select>
            {privacyDraft.cookieMode === 'block-third-party' ? (
              <small>
                Third-party blocking is saved as policy intent; some embedded flows may still set
                cookies depending on site and Electron limitations.
              </small>
            ) : null}
            {validationErrors['privacy.cookieMode'] ? (
              <small>{validationErrors['privacy.cookieMode']}</small>
            ) : null}
          </label>

          <div className="settings-panel__actions">
            <button
              type="button"
              disabled={busyState !== 'idle'}
              onClick={() => {
                void onSavePrivacy(privacyDraft)
              }}
            >
              {busyState === 'saving-privacy' ? 'Saving...' : 'Save Privacy Settings'}
            </button>
          </div>

          <section className="settings-panel__danger-zone" aria-label="Clear data controls">
            <h3>Clear Data</h3>
            <p>Select one or more data buckets and confirm before clearing.</p>

            <ul className="settings-panel__bucket-list">
              {CLEAR_DATA_BUCKET_OPTIONS.map((option) => {
                const checked = selectedBuckets.includes(option.value)
                return (
                  <li key={option.value}>
                    <label>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          const nextChecked = event.target.checked
                          setSelectedBuckets((current) => {
                            if (nextChecked) {
                              return current.includes(option.value) ? current : [...current, option.value]
                            }

                            return current.filter((bucket) => bucket !== option.value)
                          })
                        }}
                      />
                      <span>
                        <strong>{option.label}</strong>
                        <small>{option.detail}</small>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>

            <label className="settings-panel__confirm">
              <input
                type="checkbox"
                checked={clearConfirmChecked}
                onChange={(event) => setClearConfirmChecked(event.target.checked)}
              />
              <span>I understand this action may remove local browser data.</span>
            </label>

            {validationErrors['privacy.clearData.buckets'] ? (
              <small>{validationErrors['privacy.clearData.buckets']}</small>
            ) : null}

            <div className="settings-panel__actions">
              <button
                type="button"
                className="is-danger"
                disabled={clearButtonDisabled}
                onClick={() => {
                  void onClearData(selectedBuckets)
                }}
              >
                {busyState === 'clearing-data' ? 'Clearing...' : 'Clear Selected Data'}
              </button>
            </div>

            {clearDataResults.length > 0 ? (
              <ul className="settings-panel__clear-results">
                {clearDataResults.map((result) => (
                  <li key={`${result.bucket}:${result.message}`} className={result.ok ? 'is-ok' : 'is-failed'}>
                    <strong>{result.bucket}</strong>
                    <span>{result.message}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </section>
      ) : null}

      {activeSection === 'ai' ? (
        <section className="settings-panel__section" aria-label="AI settings placeholder">
          <h3>AI Settings</h3>
          <p>
            AI provider controls remain available in the sidebar today and will be consolidated
            into this section in a future phase.
          </p>
        </section>
      ) : null}

      {activeSection === 'advanced' ? (
        <section className="settings-panel__section" aria-label="Advanced settings placeholder">
          <h3>Advanced Settings</h3>
          <p>
            Advanced controls are reserved for future iterations. Core settings are available in
            General and Privacy.
          </p>
        </section>
      ) : null}

      <footer className="settings-panel__footer">
        <p className={statusClassName}>{statusMessage}</p>
        {snapshot?.repairNotice ? (
          <p className="settings-panel__repair-notice">
            Settings were auto-repaired ({snapshot.repairNotice.reason}) at{' '}
            {new Date(snapshot.repairNotice.repairedAt).toLocaleString()}.
          </p>
        ) : null}
      </footer>
    </aside>
  )
}

export default SettingsPanel

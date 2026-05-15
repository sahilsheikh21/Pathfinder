import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import QuickSearchPopup from './components/QuickSearchPopup'

const RootComponent = window.location.hash === '#quick-search' ? QuickSearchPopup : App
const pathfinderBridge = (window as Window & { pathfinder?: unknown }).pathfinder
const hasPathfinderBridge = Boolean(pathfinderBridge)

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {hasPathfinderBridge ? (
      <RootComponent />
    ) : (
      <main
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '2rem',
          background: '#edf1f8',
          color: '#142033',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif'
        }}
      >
        <section
          style={{
            width: 'min(680px, 100%)',
            border: '1px solid #c7d3e6',
            borderRadius: '14px',
            background: 'rgba(255, 255, 255, 0.92)',
            boxShadow: '0 10px 28px rgba(23, 44, 84, 0.12)',
            padding: '1.25rem 1.5rem'
          }}
        >
          <h1 style={{ margin: 0, fontSize: '1.1rem' }}>Pathfinder failed to initialize its desktop bridge.</h1>
          <p style={{ margin: '0.75rem 0 0', lineHeight: 1.5 }}>
            The preload script did not expose <strong>window.pathfinder</strong>, so the app cannot boot.
          </p>
          <p style={{ margin: '0.5rem 0 0', lineHeight: 1.5 }}>
            Restart the app after rebuilding. If this persists, check main-process logs for
            <strong> preload-error</strong> or <strong>did-fail-load</strong>.
          </p>
        </section>
      </main>
    )}
  </React.StrictMode>
)

import { useEffect, useState } from 'react'
import FrostedSurface from './components/FrostedSurface'
import './styles/global.css'
import { applyTheme, getInitialTheme, persistTheme, type ThemeMode } from './theme'

function App() {
  const [version, setVersion] = useState('loading')
  const [platform, setPlatform] = useState('loading')
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getInitialTheme())

  useEffect(() => {
    applyTheme(themeMode)
    persistTheme(themeMode)
  }, [themeMode])

  useEffect(() => {
    let active = true

    async function loadMetadata(): Promise<void> {
      const appVersion = await window.pathfinder.getVersion()
      const appPlatform = await window.pathfinder.getPlatform()

      if (!active) {
        return
      }

      setVersion(appVersion.version)
      setPlatform(appPlatform.platform)
    }

    loadMetadata().catch(() => {
      if (active) {
        setVersion('unavailable')
        setPlatform('unavailable')
      }
    })

    return () => {
      active = false
    }
  }, [])

  return (
    <main style={{ padding: 'var(--pf-space-24)' }}>
      <FrostedSurface title="Pathfinder Scaffold">
        <p>Project scaffold initialized.</p>
        <p>App version: {version}</p>
        <p>Platform: {platform}</p>
        <label htmlFor="theme-mode" style={{ display: 'inline-block', marginTop: 'var(--pf-space-16)' }}>
          Theme mode
        </label>
        <br />
        <select
          id="theme-mode"
          value={themeMode}
          onChange={(event) => setThemeMode(event.target.value as ThemeMode)}
          style={{
            marginTop: 'var(--pf-space-8)',
            padding: 'var(--pf-space-8) var(--pf-space-12)',
            borderRadius: 'var(--pf-radius-pill)',
            border: '1px solid var(--pf-border-subtle)',
            background: 'var(--pf-bg-elevated)',
            color: 'var(--pf-text-primary)'
          }}
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </FrostedSurface>
    </main>
  )
}

export default App

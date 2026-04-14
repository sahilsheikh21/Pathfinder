import { useEffect, useState } from 'react'

function App() {
  const [version, setVersion] = useState('loading')
  const [platform, setPlatform] = useState('loading')

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
    <main>
      <h1>Pathfinder</h1>
      <p>Project scaffold initialized.</p>
      <p>App version: {version}</p>
      <p>Platform: {platform}</p>
    </main>
  )
}

export default App

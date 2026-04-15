import { BrowserWindow, type Rectangle } from 'electron'

interface QuickSearchWindowManagerOptions {
  preloadPath: string
  rendererIndexPath: string
  devServerUrl?: string
}

export interface QuickSearchWindowManager {
  open: (request?: { query?: string }) => Promise<void>
  close: () => void
  toggle: (request?: { query?: string }) => Promise<void>
  isVisible: () => boolean
  destroy: () => void
}

const DEFAULT_BOUNDS = {
  width: 520,
  height: 420
}

export const createQuickSearchWindowManager = (
  options: QuickSearchWindowManagerOptions
): QuickSearchWindowManager => {
  let quickSearchWindow: BrowserWindow | null = null
  let lastBounds: Rectangle | null = null
  let allowClose = false

  const createWindow = async (): Promise<BrowserWindow> => {
    if (quickSearchWindow && !quickSearchWindow.isDestroyed()) {
      return quickSearchWindow
    }

    quickSearchWindow = new BrowserWindow({
      ...(lastBounds ?? DEFAULT_BOUNDS),
      show: false,
      alwaysOnTop: true,
      resizable: true,
      movable: true,
      frame: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        preload: options.preloadPath
      }
    })

    quickSearchWindow.on('close', (event) => {
      if (allowClose || !quickSearchWindow) {
        return
      }

      event.preventDefault()
      lastBounds = quickSearchWindow.getBounds()
      quickSearchWindow.hide()
    })

    const captureBounds = (): void => {
      if (!quickSearchWindow || quickSearchWindow.isDestroyed()) {
        return
      }
      lastBounds = quickSearchWindow.getBounds()
    }

    quickSearchWindow.on('move', captureBounds)
    quickSearchWindow.on('resize', captureBounds)

    if (options.devServerUrl) {
      await quickSearchWindow.loadURL(`${options.devServerUrl}#quick-search`)
    } else {
      await quickSearchWindow.loadFile(options.rendererIndexPath, {
        hash: 'quick-search'
      })
    }

    return quickSearchWindow
  }

  const open = async (request?: { query?: string }): Promise<void> => {
    const window = await createWindow()

    if (request?.query) {
      window.webContents.send('quick-search:open', {
        query: request.query
      })
    }

    if (!window.isVisible()) {
      window.show()
    }

    window.focus()
  }

  const close = (): void => {
    if (!quickSearchWindow || quickSearchWindow.isDestroyed()) {
      return
    }

    lastBounds = quickSearchWindow.getBounds()
    quickSearchWindow.hide()
  }

  const toggle = async (request?: { query?: string }): Promise<void> => {
    if (quickSearchWindow && !quickSearchWindow.isDestroyed() && quickSearchWindow.isVisible()) {
      close()
      return
    }

    await open(request)
  }

  const isVisible = (): boolean => {
    if (!quickSearchWindow || quickSearchWindow.isDestroyed()) {
      return false
    }

    return quickSearchWindow.isVisible()
  }

  const destroy = (): void => {
    if (!quickSearchWindow || quickSearchWindow.isDestroyed()) {
      quickSearchWindow = null
      return
    }

    allowClose = true
    quickSearchWindow.close()
    quickSearchWindow = null
    allowClose = false
  }

  return {
    open,
    close,
    toggle,
    isVisible,
    destroy
  }
}
import type { BrowserThemeMode } from '../shared/browser'

const THEME_TRANSITION_CLASS = 'theme-transitioning'
const THEME_TRANSITION_MS = 150
const SYSTEM_THEME_QUERY = '(prefers-color-scheme: dark)'

let transitionTimerId: number | null = null

function getSystemTheme(): Exclude<BrowserThemeMode, 'system'> {
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }

  return 'light'
}

const beginThemeTransition = (): void => {
  const root = document.documentElement
  root.classList.add(THEME_TRANSITION_CLASS)

  if (transitionTimerId !== null) {
    window.clearTimeout(transitionTimerId)
  }

  transitionTimerId = window.setTimeout(() => {
    root.classList.remove(THEME_TRANSITION_CLASS)
    transitionTimerId = null
  }, THEME_TRANSITION_MS)
}

export function applyTheme(mode: BrowserThemeMode): void {
  const effectiveTheme = mode === 'system' ? getSystemTheme() : mode
  const root = document.documentElement

  beginThemeTransition()

  root.classList.toggle('theme-dark', effectiveTheme === 'dark')
  root.classList.toggle('theme-light', effectiveTheme === 'light')
}

export function subscribeToSystemThemeChanges(onChange: () => void): () => void {
  const mediaQuery = window.matchMedia(SYSTEM_THEME_QUERY)

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', onChange)

    return (): void => {
      mediaQuery.removeEventListener('change', onChange)
    }
  }

  mediaQuery.addListener(onChange)

  return (): void => {
    mediaQuery.removeListener(onChange)
  }
}

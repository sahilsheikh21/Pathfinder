export type ThemeMode = 'light' | 'dark' | 'system'

const THEME_STORAGE_KEY = 'pathfinder.themeMode'

function getSystemTheme(): Exclude<ThemeMode, 'system'> {
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }

  return 'light'
}

export function applyTheme(mode: ThemeMode): void {
  const effectiveTheme = mode === 'system' ? getSystemTheme() : mode
  const root = document.documentElement

  root.classList.toggle('theme-dark', effectiveTheme === 'dark')
  root.classList.toggle('theme-light', effectiveTheme === 'light')
}

export function getInitialTheme(): ThemeMode {
  const storedValue = window.localStorage.getItem(THEME_STORAGE_KEY)

  if (storedValue === 'light' || storedValue === 'dark' || storedValue === 'system') {
    return storedValue
  }

  return 'system'
}

export function persistTheme(mode: ThemeMode): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, mode)
}

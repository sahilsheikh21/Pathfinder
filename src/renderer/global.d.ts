import type { PathfinderApi } from '../shared/ipc'

declare global {
  interface Window {
    pathfinder: PathfinderApi
  }
}

export {}

import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type AppPlatformResponse, type AppVersionResponse, type PathfinderApi } from '../shared/ipc'

const api: PathfinderApi = {
  getVersion: async (): Promise<AppVersionResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.appGetVersion),
  getPlatform: async (): Promise<AppPlatformResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.appGetPlatform)
}

contextBridge.exposeInMainWorld('pathfinder', api)

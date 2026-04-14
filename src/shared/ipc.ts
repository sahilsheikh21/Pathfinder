export const IPC_CHANNELS = {
  appGetVersion: 'app:getVersion',
  appGetPlatform: 'app:getPlatform'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

export interface AppVersionResponse {
  version: string
}

export interface AppPlatformResponse {
  platform: string
}

export interface PathfinderApi {
  getVersion: () => Promise<AppVersionResponse>
  getPlatform: () => Promise<AppPlatformResponse>
}

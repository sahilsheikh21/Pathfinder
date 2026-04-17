import type { Session } from 'electron'
import type {
  BrowserClearDataBucket,
  BrowserClearDataRequest,
  ClearDataBucketResult
} from '../shared/browser'

interface PrivacyDataServiceDependencies {
  session: Session
  clearHistoryDownloads?: () => void
  clearAppSettingsSubset?: () => void
}

export interface PrivacyDataService {
  clearSelectedBuckets: (request: BrowserClearDataRequest) => Promise<ClearDataBucketResult[]>
}

const toSafeMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message
      .replace(/bearer\s+[^\s'"`]+/gi, 'bearer [redacted]')
      .replace(/\bsk-[^\s'"`]+/gi, 'sk-[redacted]')
      .trim()
  }

  if (typeof error === 'string' && error.trim()) {
    return error
      .replace(/bearer\s+[^\s'"`]+/gi, 'bearer [redacted]')
      .replace(/\bsk-[^\s'"`]+/gi, 'sk-[redacted]')
      .trim()
  }

  return fallback
}

const dedupeBuckets = (buckets: BrowserClearDataBucket[]): BrowserClearDataBucket[] => {
  return Array.from(new Set(buckets))
}

export const createPrivacyDataService = (
  dependencies: PrivacyDataServiceDependencies
): PrivacyDataService => {
  const executeBucket = async (bucket: BrowserClearDataBucket): Promise<ClearDataBucketResult> => {
    try {
      switch (bucket) {
        case 'history-downloads': {
          dependencies.clearHistoryDownloads?.()
          await dependencies.session.clearStorageData({
            storages: ['serviceworkers']
          })

          return {
            bucket,
            ok: true,
            message: 'Browsing history metadata and download history were cleared.'
          }
        }
        case 'cookies-site-data': {
          await dependencies.session.clearStorageData({
            storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers', 'websql']
          })

          return {
            bucket,
            ok: true,
            message: 'Cookies and site data were cleared.'
          }
        }
        case 'cache-storage': {
          await dependencies.session.clearCache()
          await dependencies.session.clearStorageData({
            storages: ['cachestorage']
          })

          return {
            bucket,
            ok: true,
            message: 'Cache and cache storage were cleared.'
          }
        }
        case 'app-settings-subset': {
          dependencies.clearAppSettingsSubset?.()
          return {
            bucket,
            ok: true,
            message: 'Application settings subset was reset to safe defaults.'
          }
        }
        default: {
          return {
            bucket,
            ok: false,
            message: 'Unsupported clear-data bucket.'
          }
        }
      }
    } catch (error) {
      return {
        bucket,
        ok: false,
        message: toSafeMessage(error, 'Unable to clear selected bucket.')
      }
    }
  }

  return {
    clearSelectedBuckets: async (request) => {
      const selectedBuckets = dedupeBuckets(Array.isArray(request?.buckets) ? request.buckets : [])
      const results: ClearDataBucketResult[] = []

      for (const bucket of selectedBuckets) {
        results.push(await executeBucket(bucket))
      }

      return results
    }
  }
}
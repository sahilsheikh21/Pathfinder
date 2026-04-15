import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { safeStorage } from 'electron'
import type { LLMProviderId, LLMSecretPatch } from '../../shared/browser'

interface SecretStoreData {
  secrets: Partial<Record<LLMProviderId, string>>
}

const SECRET_STORE_FILE_NAME = 'llm-secrets.json'

const defaultData = (): SecretStoreData => ({
  secrets: {}
})

const isSecretStoreData = (value: unknown): value is SecretStoreData => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<SecretStoreData>
  return !!candidate.secrets && typeof candidate.secrets === 'object'
}

const assertEncryptionAvailable = (): void => {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS encryption is not available for secret storage.')
  }
}

const encodeSecret = (plainText: string): string => {
  assertEncryptionAvailable()
  return safeStorage.encryptString(plainText).toString('base64')
}

const decodeSecret = (cipherText: string): string => {
  assertEncryptionAvailable()
  return safeStorage.decryptString(Buffer.from(cipherText, 'base64'))
}

export interface SecretStore {
  hasSecret: (provider: LLMProviderId) => boolean
  getSecret: (provider: LLMProviderId) => string | null
  applySecretPatch: (provider: LLMProviderId, patch?: LLMSecretPatch) => { present: boolean }
  clearSecret: (provider: LLMProviderId) => { present: boolean }
}

export const createSecretStore = (userDataPath: string): SecretStore => {
  const storePath = join(userDataPath, SECRET_STORE_FILE_NAME)

  const readStore = (): SecretStoreData => {
    if (!existsSync(storePath)) {
      const defaults = defaultData()
      writeFileSync(storePath, JSON.stringify(defaults, null, 2), 'utf8')
      return defaults
    }

    try {
      const parsed = JSON.parse(readFileSync(storePath, 'utf8')) as unknown
      if (!isSecretStoreData(parsed)) {
        throw new Error('Invalid secret store data')
      }
      return parsed
    } catch {
      const defaults = defaultData()
      writeFileSync(storePath, JSON.stringify(defaults, null, 2), 'utf8')
      return defaults
    }
  }

  const writeStore = (value: SecretStoreData): void => {
    writeFileSync(storePath, JSON.stringify(value, null, 2), 'utf8')
  }

  const setSecret = (provider: LLMProviderId, value: string): { present: boolean } => {
    const trimmed = value.trim()
    if (!trimmed) {
      return { present: false }
    }

    const current = readStore()
    const next: SecretStoreData = {
      secrets: {
        ...current.secrets,
        [provider]: encodeSecret(trimmed)
      }
    }
    writeStore(next)
    return { present: true }
  }

  const clearSecret = (provider: LLMProviderId): { present: boolean } => {
    const current = readStore()
    const nextSecrets = { ...current.secrets }
    delete nextSecrets[provider]
    writeStore({ secrets: nextSecrets })
    return { present: false }
  }

  return {
    hasSecret: (provider) => {
      const data = readStore()
      return typeof data.secrets[provider] === 'string' && data.secrets[provider]!.length > 0
    },
    getSecret: (provider) => {
      const data = readStore()
      const encrypted = data.secrets[provider]
      if (!encrypted) {
        return null
      }

      try {
        return decodeSecret(encrypted)
      } catch {
        return null
      }
    },
    applySecretPatch: (provider, patch) => {
      if (!patch || patch.mode === 'unchanged') {
        return { present: readStore().secrets[provider] !== undefined }
      }

      if (patch.mode === 'clear') {
        return clearSecret(provider)
      }

      return setSecret(provider, patch.value ?? '')
    },
    clearSecret
  }
}

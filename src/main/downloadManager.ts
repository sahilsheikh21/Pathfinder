import { DownloadItem, session } from 'electron'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import type { DownloadState, DownloadStatePayload } from '../shared/browser'

export class DownloadManager {
  private readonly downloads = new Map<string, DownloadState>()

  private attached = false

  constructor(
    private readonly onUpdate: (payload: DownloadStatePayload) => void,
    private readonly defaultDownloadPath?: string
  ) {}

  start(): void {
    if (this.attached) {
      return
    }

    this.attached = true
    session.defaultSession.on('will-download', (_event, item) => {
      this.handleDownload(item)
    })
  }

  listDownloads(): DownloadState[] {
    return Array.from(this.downloads.values())
  }

  private handleDownload(item: DownloadItem): void {
    const downloadId = randomUUID()
    const fileName = item.getFilename()

    if (this.defaultDownloadPath && this.defaultDownloadPath.trim().length > 0) {
      item.setSavePath(join(this.defaultDownloadPath, fileName))
    } else {
      item.setSaveDialogOptions({
        defaultPath: fileName
      })
    }

    this.downloads.set(downloadId, {
      id: downloadId,
      fileName,
      state: 'pending',
      receivedBytes: 0,
      totalBytes: item.getTotalBytes(),
      savePath: item.getSavePath() || null
    })
    this.emit()

    item.on('updated', (_event, updateState) => {
      const current = this.downloads.get(downloadId)
      if (!current) {
        return
      }

      current.receivedBytes = item.getReceivedBytes()
      current.totalBytes = item.getTotalBytes()
      current.savePath = item.getSavePath() || null
      current.state = updateState === 'progressing' ? 'in_progress' : current.state

      this.downloads.set(downloadId, current)
      this.emit()
    })

    item.once('done', (_event, doneState) => {
      const current = this.downloads.get(downloadId)
      if (!current) {
        return
      }

      current.receivedBytes = item.getReceivedBytes()
      current.totalBytes = item.getTotalBytes()
      current.savePath = item.getSavePath() || null

      if (doneState === 'completed') {
        current.state = 'completed'
      } else if (doneState === 'cancelled') {
        current.state = 'cancelled'
      } else {
        current.state = 'failed'
      }

      this.downloads.set(downloadId, current)
      this.emit()
    })
  }

  private emit(): void {
    this.onUpdate({
      downloads: this.listDownloads()
    })
  }
}
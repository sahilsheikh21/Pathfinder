import type { DownloadState } from '../../shared/browser'

interface DownloadShelfProps {
  downloads: DownloadState[]
}

const formatStatus = (state: DownloadState['state']): string => {
  if (state === 'in_progress') {
    return 'In Progress'
  }

  if (state === 'completed') {
    return 'Completed'
  }

  if (state === 'failed') {
    return 'Failed'
  }

  if (state === 'cancelled') {
    return 'Cancelled'
  }

  return 'Pending'
}

const getPercent = (download: DownloadState): number => {
  if (download.totalBytes <= 0) {
    return download.state === 'completed' ? 100 : 0
  }

  return Math.min(100, Math.round((download.receivedBytes / download.totalBytes) * 100))
}

function DownloadShelf({ downloads }: DownloadShelfProps) {
  if (downloads.length === 0) {
    return null
  }

  return (
    <aside className="download-shelf" aria-label="Downloads">
      {downloads.map((download) => {
        const percent = getPercent(download)

        return (
          <div key={download.id} className="download-shelf__item">
            <div className="download-shelf__meta">
              <strong>{download.fileName}</strong>
              <span>{percent}%</span>
            </div>
            <div className="download-shelf__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
              <span style={{ width: `${percent}%` }} />
            </div>
            <p className="download-shelf__status">{formatStatus(download.state)}</p>
          </div>
        )
      })}
    </aside>
  )
}

export default DownloadShelf
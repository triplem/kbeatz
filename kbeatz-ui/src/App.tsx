import { useEffect, useState } from 'react'
import { AlbumPage } from './api/generated'
import { AlbumsService } from './api/generated'
import { AlbumGrid } from './features/albums/album-grid'
import { ScanProgress } from './features/library/scan-progress'

export function App() {
  const [albumPage, setAlbumPage] = useState<AlbumPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetchAlbums = async () => {
      try {
        const page = await AlbumsService.listAlbums({ size: 5000 })
        if (!cancelled) {
          setAlbumPage(page)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load albums')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void fetchAlbums()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>kbeatz</h1>
      </header>
      <main>
        <ScanProgress />
        {loading && <p>Loading albums...</p>}
        {error && <p role="alert">Error: {error}</p>}
        {albumPage && <AlbumGrid albums={albumPage.content} />}
      </main>
    </div>
  )
}

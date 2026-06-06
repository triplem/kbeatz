import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Album, AlbumsService } from '../../api/generated'
import { SyncPanel } from '../sync/sync-panel'

/**
 * AlbumDetail — shows all Vorbis Comment tag fields for a single album
 * and provides the "Sync from Discogs" panel when a discogsId is present.
 */
export function AlbumDetail() {
  const { albumId } = useParams<{ albumId: string }>()
  const navigate = useNavigate()
  const [album, setAlbum] = useState<Album | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!albumId) return

    let cancelled = false

    const fetchAlbum = async () => {
      try {
        const data = await AlbumsService.getAlbum({ albumId })
        if (!cancelled) setAlbum(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load album')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void fetchAlbum()
    return () => { cancelled = true }
  }, [albumId])

  const handleSyncComplete = useCallback((updated: Album) => {
    setAlbum(updated)
  }, [])

  if (loading) return <p>Loading album…</p>
  if (error) return <p role="alert">Error: {error}</p>
  if (!album) return <p role="alert">Album not found.</p>

  return (
    <article className="album-detail" aria-label="Album detail">
      <button
        type="button"
        onClick={() => { navigate(-1) }}
        className="back-button"
      >
        ← Back
      </button>

      <h2 data-testid="album-title">{album.album}</h2>
      <h3 data-testid="album-artist">{album.albumArtist}</h3>

      <dl className="album-tags">
        {album.date && (
          <>
            <dt>Date</dt>
            <dd data-testid="album-date">{album.date}</dd>
          </>
        )}
        {album.genre && (
          <>
            <dt>Genre</dt>
            <dd data-testid="album-genre">{album.genre}</dd>
          </>
        )}
        {album.label && (
          <>
            <dt>Label</dt>
            <dd data-testid="album-label">{album.label}</dd>
          </>
        )}
        {album.catalogNumber && (
          <>
            <dt>Catalog #</dt>
            <dd data-testid="album-catalog-number">{album.catalogNumber}</dd>
          </>
        )}
        {album.composer && (
          <>
            <dt>Composer</dt>
            <dd data-testid="album-composer">{album.composer}</dd>
          </>
        )}
        {album.conductor && (
          <>
            <dt>Conductor</dt>
            <dd data-testid="album-conductor">{album.conductor}</dd>
          </>
        )}
        {album.ensemble && (
          <>
            <dt>Ensemble</dt>
            <dd data-testid="album-ensemble">{album.ensemble}</dd>
          </>
        )}
        {album.discogsId && (
          <>
            <dt>Discogs ID</dt>
            <dd data-testid="album-discogs-id">{album.discogsId}</dd>
          </>
        )}
      </dl>

      {album.hasCoverArt && (
        <img
          src={`/api/v1/albums/${album.id}/cover`}
          alt={`Cover art for ${album.album}`}
          className="album-cover"
          data-testid="album-cover"
        />
      )}

      <SyncPanel album={album} onSyncComplete={handleSyncComplete} />
    </article>
  )
}

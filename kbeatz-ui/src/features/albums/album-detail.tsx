import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlbumDetail as AlbumDetailModel, AlbumsService, Track } from '../../api/generated'
import { EditableField } from './editable-field'

/**
 * AlbumDetail — shows all Vorbis Comment tag fields for a single album with inline editing.
 *
 * ## Album-level editable fields
 * ALBUM, ALBUMARTIST, DATE, GENRE, LABEL, CATALOGNUMBER, COMPOSER, CONDUCTOR, ENSEMBLE
 *
 * ## Track-level editable fields (per row)
 * TITLE, TRACKNUMBER, ARTIST
 *
 * ## Edit flow
 * - Click on any field value → inline input pre-filled with current value
 * - Enter or blur → PATCH API call; optimistic update; rollback + error toast on failure
 * - Escape → cancel, restore original value; no API call
 */
export function AlbumDetail() {
  const { albumId } = useParams<{ albumId: string }>()
  const navigate = useNavigate()
  const [album, setAlbum] = useState<AlbumDetailModel | null>(null)
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
    return () => {
      cancelled = true
    }
  }, [albumId])

  const handleAlbumTagSave = useCallback(
    async (field: string, value: string) => {
      if (!albumId) return
      const updated = await AlbumsService.updateAlbumTags({
        albumId,
        requestBody: { field, value },
      })
      setAlbum(updated)
    },
    [albumId],
  )

  const handleTrackTagSave = useCallback(
    (trackId: string) =>
      async (field: string, value: string) => {
        if (!albumId) return
        const updated = await AlbumsService.updateTrackTags({
          albumId,
          trackId,
          requestBody: { field, value },
        })
        setAlbum(updated)
      },
    [albumId],
  )

  if (loading) return <p>Loading album…</p>
  if (error) return <p role="alert">Error: {error}</p>
  if (!album) return <p role="alert">Album not found.</p>

  return (
    <article className="album-detail" aria-label="Album detail">
      <button
        type="button"
        onClick={() => { navigate(-1) }}
        className="back-button"
        data-testid="back-button"
      >
        ← Back
      </button>

      {album.hasCoverArt && (
        <img
          src={`/api/v1/albums/${album.id}/cover`}
          alt={`Cover art for ${album.album}`}
          className="album-cover"
          data-testid="album-cover"
        />
      )}

      <section aria-label="Album tags">
        <h2 className="album-detail__section-title">Album Tags</h2>
        <dl className="album-tags">
          <EditableField
            label="Album"
            value={album.album}
            fieldName="ALBUM"
            onSave={handleAlbumTagSave}
            testIdPrefix="album"
          />
          <EditableField
            label="Album Artist"
            value={album.albumArtist}
            fieldName="ALBUMARTIST"
            onSave={handleAlbumTagSave}
            testIdPrefix="album"
          />
          <EditableField
            label="Date"
            value={album.date}
            fieldName="DATE"
            onSave={handleAlbumTagSave}
            testIdPrefix="album"
          />
          <EditableField
            label="Genre"
            value={album.genre}
            fieldName="GENRE"
            onSave={handleAlbumTagSave}
            testIdPrefix="album"
          />
          <EditableField
            label="Label"
            value={album.label}
            fieldName="LABEL"
            onSave={handleAlbumTagSave}
            testIdPrefix="album"
          />
          <EditableField
            label="Catalog #"
            value={album.catalogNumber}
            fieldName="CATALOGNUMBER"
            onSave={handleAlbumTagSave}
            testIdPrefix="album"
          />
          <EditableField
            label="Composer"
            value={album.composer}
            fieldName="COMPOSER"
            onSave={handleAlbumTagSave}
            testIdPrefix="album"
          />
          <EditableField
            label="Conductor"
            value={album.conductor}
            fieldName="CONDUCTOR"
            onSave={handleAlbumTagSave}
            testIdPrefix="album"
          />
          <EditableField
            label="Ensemble"
            value={album.ensemble}
            fieldName="ENSEMBLE"
            onSave={handleAlbumTagSave}
            testIdPrefix="album"
          />
        </dl>
      </section>

      {album.tracks.length > 0 && (
        <section aria-label="Tracks">
          <h2 className="album-detail__section-title">Tracks</h2>
          <table className="tracks-table" role="grid">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Title</th>
                <th scope="col">Artist</th>
                <th scope="col">Duration</th>
              </tr>
            </thead>
            <tbody>
              {album.tracks.map((track) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  onSave={handleTrackTagSave(track.id)}
                />
              ))}
            </tbody>
          </table>
        </section>
      )}

      {album.discogsId && (
        <p className="album-detail__discogs-id" data-testid="album-discogs-id">
          Discogs ID: {album.discogsId}
        </p>
      )}
    </article>
  )
}

interface TrackRowProps {
  readonly track: Track
  readonly onSave: (field: string, value: string) => Promise<void>
}

function TrackRow({ track, onSave }: TrackRowProps) {
  const durationDisplay = track.durationSeconds !== undefined
    ? formatDuration(track.durationSeconds)
    : '—'

  return (
    <tr data-testid={`track-row-${track.id}`}>
      <td>
        <EditableField
          label="Track number"
          value={track.trackNumber}
          fieldName="TRACKNUMBER"
          onSave={onSave}
          testIdPrefix={`track-${track.id}`}
        />
      </td>
      <td>
        <EditableField
          label="Title"
          value={track.title}
          fieldName="TITLE"
          onSave={onSave}
          testIdPrefix={`track-${track.id}`}
        />
      </td>
      <td>
        <EditableField
          label="Artist"
          value={track.artist}
          fieldName="ARTIST"
          onSave={onSave}
          testIdPrefix={`track-${track.id}`}
        />
      </td>
      <td>{durationDisplay}</td>
    </tr>
  )
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString()}:${secs.toString().padStart(2, '0')}`
}

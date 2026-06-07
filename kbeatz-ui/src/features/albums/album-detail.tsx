import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlbumDetail as AlbumDetailModel, Album, AlbumsService, Track } from '../../api/generated'
import { CancelledByUserError } from './cancelled-by-user-error'
import { ConfirmWriteDialog } from './confirm-write-dialog'
import { EditableField } from './editable-field'
import { SyncPanel } from '../sync/sync-panel'

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
 * - Click on any album-level field value → inline input pre-filled with current value
 * - Enter or blur → confirmation dialog appears before the PATCH is fired
 * - Confirm → PATCH /albums/{albumId}; optimistic update; rollback + error toast on failure
 * - Cancel / Escape on dialog → abort, keep the form in its edited state
 * - Escape on input → cancel edit, restore original value; no dialog shown; no API call
 *
 * ## Discogs sync
 * - SyncPanel is rendered below the tag fields when the album has a discogsId
 * - On sync complete the album state is updated with the returned Album
 */

/**
 * Pending album-level tag save that is awaiting user confirmation.
 *
 * When an EditableField triggers onSave we do NOT fire the PATCH immediately.
 * Instead we capture the intent here, show the confirmation dialog, and only
 * call the API once the user clicks "Write tags".
 */
interface PendingSave {
  readonly field: string
  readonly value: string
  /** resolve/reject from the Promise returned to EditableField so it can
   *  show errors or exit edit mode correctly */
  readonly resolve: () => void
  readonly reject: (err: unknown) => void
}

export function AlbumDetail() {
  const { albumId } = useParams<{ albumId: string }>()
  const navigate = useNavigate()
  const [album, setAlbum] = useState<AlbumDetailModel | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const pendingSaveRef = useRef<PendingSave | null>(null)

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

  /**
   * Called by EditableField when the user commits an album-level field edit.
   *
   * Instead of firing the PATCH immediately, we capture the pending save and
   * open the confirmation dialog. The returned Promise resolves/rejects only
   * after the user has confirmed (or cancelled).
   */
  const handleAlbumTagSave = useCallback(
    (field: string, value: string): Promise<void> =>
      new Promise((resolve, reject) => {
        pendingSaveRef.current = { field, value, resolve, reject }
        setConfirmOpen(true)
      }),
    [],
  )

  /**
   * User clicked "Write tags" in the confirmation dialog.
   * Fire the actual PATCH call, then resolve/reject the pending promise so
   * EditableField exits edit mode (or shows an error).
   */
  const handleConfirm = useCallback(async () => {
    const pending = pendingSaveRef.current
    if (!pending || !albumId) return

    setConfirmOpen(false)
    pendingSaveRef.current = null

    try {
      const updated = await AlbumsService.updateAlbumTags({
        albumId,
        requestBody: { field: pending.field, value: pending.value },
      })
      setAlbum(updated)
      pending.resolve()
    } catch (err) {
      pending.reject(err)
    }
  }, [albumId])

  /**
   * User clicked "Cancel" or pressed Escape.
   * Reject the pending promise so EditableField keeps its edited state
   * (the user's changes remain in the input — they are NOT reset).
   */
  const handleCancel = useCallback(() => {
    const pending = pendingSaveRef.current
    setConfirmOpen(false)
    pendingSaveRef.current = null
    // Reject with a sentinel so EditableField rolls back to original value
    // and shows no error (the user deliberately cancelled).
    pending?.reject(new CancelledByUserError())
  }, [])

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

  const handleSyncComplete = useCallback((updated: Album) => {
    // Merge the sync result into the current album detail
    // The sync API returns Album (not AlbumDetail), so we patch only the
    // fields that Album carries; tracks and hasCoverArt are preserved.
    setAlbum((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        albumArtist: updated.albumArtist,
        album: updated.album,
        date: updated.date,
        genre: updated.genre,
        label: updated.label,
        catalogNumber: updated.catalogNumber,
        composer: updated.composer,
        conductor: updated.conductor,
        ensemble: updated.ensemble,
        discogsId: updated.discogsId,
        hasCoverArt: updated.hasCoverArt,
      }
    })
  }, [])

  if (loading) return <p>Loading album…</p>
  if (error) return <p role="alert">Error: {error}</p>
  if (!album) return <p role="alert">Album not found.</p>

  return (
    <>
      <ConfirmWriteDialog
        open={confirmOpen}
        albumTitle={album.album}
        trackCount={album.tracks.length}
        onConfirm={() => { void handleConfirm() }}
        onCancel={handleCancel}
      />
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

      {album.discogsId !== undefined && (
        <section aria-label="Discogs sync">
          <SyncPanel album={album} onSyncComplete={handleSyncComplete} />
        </section>
      )}

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
    </article>
    </>
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

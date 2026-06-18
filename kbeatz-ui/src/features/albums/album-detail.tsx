import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import Typography from '@mui/material/Typography'
import { type Album } from '../../api/generated'
import { useAlbum } from './useAlbum'
import { AlbumDetailView } from './album-detail-view'
import { AlbumDetailEdit } from './album-detail-edit'

/**
 * AlbumDetail - wrapper component that owns the view/edit mode toggle.
 *
 * Owns:
 * - useAlbum query (single source of truth for album data)
 * - isEditMode: boolean state (default: false = view mode)
 * - syncedAlbum: optimistic sync-complete state
 * - displayAlbum: syncedAlbum ?? album
 * - editButtonRef / cancelButtonRef: focus management on mode toggle
 * - hasLocalEdits: tracks whether unsaved local edits exist (for sync warning)
 *
 * The router navigation guard (useUnsavedChangesBlocker) and the NavigationGuardDialog
 * are owned by AlbumDetailEdit, which has the dirty state.
 *
 * Renders:
 * - Loading / error / not-found states
 * - AlbumDetailView when !isEditMode
 * - AlbumDetailEdit when isEditMode
 */
export function AlbumDetail() {
  const { albumId } = useParams<{ albumId: string }>()
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  // Data fetching via custom hook
  const { data: album, isPending: loading, error: fetchError } = useAlbum(albumId)

  /** Controls view/edit mode. Default: view mode (false). */
  const [isEditMode, setIsEditMode] = useState(false)

  /** True after any album-level tag has been successfully saved since the last sync. */
  const [hasLocalEdits, setHasLocalEdits] = useState(false)

  /**
   * A local copy of the album used for optimistic sync-complete updates.
   * When set, this overrides `album` from the query for rendering purposes.
   */
  const [syncedAlbum, setSyncedAlbum] = useState<typeof album>(undefined)

  // Derive the displayed album - prefer synced state over query state
  const displayAlbum = syncedAlbum ?? album

  /** Ref for the Edit button - receives focus when returning to view mode. */
  const editButtonRef = useRef<HTMLButtonElement>(null)
  /** Ref for the Cancel button - receives focus when entering edit mode. */
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  /**
   * Focus management: focus the appropriate button after mode toggle.
   * The useEffect fires after the render that changed isEditMode, so the
   * target button is guaranteed to be in the DOM.
   */
  useEffect(() => {
    if (isEditMode) {
      cancelButtonRef.current?.focus()
    } else {
      editButtonRef.current?.focus()
    }
  }, [isEditMode])

  const handleEnterEditMode = useCallback(() => {
    setIsEditMode(true)
  }, [])

  const handleExitEditMode = useCallback(() => {
    setIsEditMode(false)
  }, [])

  const handleSyncComplete = useCallback((updated: Album) => {
    // Merge the sync result into the current album detail.
    // The sync API returns Album (not AlbumDetail), so we patch only the
    // fields that Album carries; tracks and hasCoverArt are preserved.
    setSyncedAlbum((prev) => {
      const base = prev ?? album
      if (!base) return base
      return {
        ...base,
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
    // Also invalidate the album list so the grid reflects the updated metadata
    void queryClient.invalidateQueries({ queryKey: ['albums'] })
    // Sync completed - Discogs data overwrites any local edits; mark no local edits.
    setHasLocalEdits(false)
  }, [album, queryClient])

  if (loading) {
    return (
      <Typography component="p" role="status" aria-live="polite">
        {t('albumDetail.loading')}
      </Typography>
    )
  }
  if (fetchError) {
    return (
      <Typography component="p" role="alert" color="error">
        {t('albumDetail.errorPrefix')}{fetchError.message}
      </Typography>
    )
  }
  if (!displayAlbum) {
    return (
      <Typography component="p" role="alert">
        {t('albumDetail.notFound')}
      </Typography>
    )
  }

  if (isEditMode) {
    return (
      <AlbumDetailEdit
        album={displayAlbum}
        onExitEditMode={handleExitEditMode}
        onSyncComplete={handleSyncComplete}
        onSaveComplete={() => { setHasLocalEdits(true) }}
        hasLocalEdits={hasLocalEdits}
        cancelButtonRef={cancelButtonRef}
      />
    )
  }

  return (
    <AlbumDetailView
      album={displayAlbum}
      onEnterEditMode={handleEnterEditMode}
      editButtonRef={editButtonRef}
    />
  )
}

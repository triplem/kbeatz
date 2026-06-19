import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditIcon from '@mui/icons-material/Edit'
import { visuallyHidden } from '@mui/utils'
import { type Album, type AlbumDetail as AlbumDetailModel } from '../../api/generated'
import { AlbumHeroHeader } from './album-hero-header'
import { AlbumTrackListView } from './album-tracklist-view'
import { AlbumCreditsSection } from './album-credits-section'
import { SyncPanel } from '../sync/sync-panel'

export interface AlbumDetailViewProps {
  /** Album data to display in read-only mode. */
  readonly album: AlbumDetailModel
  /** Called when the user clicks the Edit button to enter edit mode. */
  readonly onEnterEditMode: () => void
  /** Ref attached to the Edit button for focus management. */
  readonly editButtonRef: React.RefObject<HTMLButtonElement | null>
  /** Called when Discogs sync completes successfully; updates the displayed album. */
  readonly onSyncComplete: (updated: Album) => void
}

/**
 * AlbumDetailView - read-only presentation of album metadata.
 *
 * Renders:
 * - Back button
 * - Visually-hidden h1 (album title)
 * - AlbumHeroHeader (cover art + metadata summary)
 * - Edit button (near hero header, per AD-FR-06)
 * - AlbumTrackListView (read-only tracklist with optional "Composed By" sub-lines)
 * - AlbumCreditsSection (album-level composer/conductor/ensemble; hidden when all absent)
 *
 * This component contains no input fields, no edit icons, and no hover affordances.
 *
 * A "Hide/Show credits" toggle is rendered in the tracklist section heading when at
 * least one track has a composer tag. The toggle collapses or restores the "Composed By"
 * sub-lines without leaving the view mode. Default state: credits visible.
 */
export function AlbumDetailView({ album, onEnterEditMode, editButtonRef, onSyncComplete }: AlbumDetailViewProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  /**
   * Whether "Composed By" sub-lines are currently visible.
   * Default: true (credits shown on first render).
   */
  const [showCredits, setShowCredits] = useState(true)

  /**
   * The toggle is only rendered when at least one track has a non-empty composer.
   * When no composer exists there is nothing to hide so the button is omitted entirely.
   */
  const hasAnyComposer = album.tracks.some(
    (track) => track.composer !== undefined && track.composer !== null && track.composer !== '',
  )

  return (
    <Box
      component="article"
      aria-label={t('albumDetail.albumTagsSection')}
      sx={{
        maxWidth: 1200,
        mx: 'auto',
        p: { xs: 2, md: 3 },
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}
    >
      {/*
        Visually-hidden page heading: the album is the subject of this route,
        so it is exposed as the single <h1> to anchor the heading outline
        (WCAG 1.3.1 / 2.4.6). Section titles below render as <h2>/<h3>.
      */}
      <Typography variant="h1" component="h1" sx={visuallyHidden}>
        {album.album}
      </Typography>

      <Button
        type="button"
        variant="outlined"
        startIcon={<ArrowBackIcon />}
        onClick={() => { navigate(-1) }}
        data-testid="back-button"
        sx={{ alignSelf: 'flex-start', minHeight: 44 }}
      >
        {t('common.back')}
      </Button>

      <AlbumHeroHeader album={album} />

      <Button
        ref={editButtonRef}
        type="button"
        variant="contained"
        startIcon={<EditIcon />}
        onClick={onEnterEditMode}
        data-testid="edit-button"
        sx={{ alignSelf: 'flex-start', minHeight: 44 }}
      >
        {t('albumDetail.editButton')}
      </Button>

      <Box
        component="section"
        aria-label={t('albumDetail.tracksSection')}
        data-testid="tracklist-section"
        sx={{ py: 2 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
          <Typography variant="h6" component="h2">
            {t('albumDetail.tracksSectionTitle')}
          </Typography>
          {hasAnyComposer && (
            <IconButton
              size="small"
              onClick={() => { setShowCredits((prev) => !prev) }}
              aria-expanded={showCredits}
              aria-controls="composer-credits-region"
              aria-label={showCredits ? t('albumDetail.hideCredits') : t('albumDetail.showCredits')}
              data-testid="credits-toggle"
            >
              {/* Visual label inside the button for sighted users */}
              <Typography variant="caption" component="span">
                {showCredits ? t('albumDetail.hideCredits') : t('albumDetail.showCredits')}
              </Typography>
            </IconButton>
          )}
        </Box>
        <AlbumTrackListView tracks={album.tracks} showCredits={showCredits} />
      </Box>

      <AlbumCreditsSection
        composer={album.composer}
        conductor={album.conductor}
        ensemble={album.ensemble}
      />

      {album.discogsId !== undefined && (
        <Box component="section" aria-label={t('albumDetail.discogsSection')}>
          <SyncPanel album={album} onSyncComplete={onSyncComplete} hasLocalEdits={false} />
        </Box>
      )}

    </Box>
  )
}

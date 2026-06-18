import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditIcon from '@mui/icons-material/Edit'
import { visuallyHidden } from '@mui/utils'
import { type AlbumDetail as AlbumDetailModel } from '../../api/generated'
import { AlbumHeroHeader } from './album-hero-header'
import { AlbumTrackListView } from './album-tracklist-view'
import { AlbumCreditsSection } from './album-credits-section'

export interface AlbumDetailViewProps {
  /** Album data to display in read-only mode. */
  readonly album: AlbumDetailModel
  /** Called when the user clicks the Edit button to enter edit mode. */
  readonly onEnterEditMode: () => void
  /** Ref attached to the Edit button for focus management. */
  readonly editButtonRef: React.RefObject<HTMLButtonElement | null>
}

/**
 * AlbumDetailView - read-only presentation of album metadata.
 *
 * Renders:
 * - Back button
 * - Visually-hidden h1 (album title)
 * - AlbumHeroHeader (cover art + metadata summary)
 * - AlbumTrackListView (read-only tracklist with optional "Composed By" sub-lines)
 * - AlbumCreditsSection (album-level composer/conductor/ensemble; hidden when all absent)
 * - Edit button to switch to edit mode
 *
 * This component contains no input fields, no edit icons, and no hover affordances.
 */
export function AlbumDetailView({ album, onEnterEditMode, editButtonRef }: AlbumDetailViewProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()

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

      <Box
        component="section"
        aria-label={t('albumDetail.tracksSection')}
        data-testid="tracklist-section"
        sx={{ py: 2 }}
      >
        <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
          {t('albumDetail.tracksSectionTitle')}
        </Typography>
        <AlbumTrackListView tracks={album.tracks} />
      </Box>

      <AlbumCreditsSection
        composer={album.composer}
        conductor={album.conductor}
        ensemble={album.ensemble}
      />

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
    </Box>
  )
}

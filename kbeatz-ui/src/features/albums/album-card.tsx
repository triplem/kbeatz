import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Checkbox from '@mui/material/Checkbox'
import MusicNoteIcon from '@mui/icons-material/MusicNote'
import { Album } from '../../api/generated'
import { formatDate } from '../../lib/i18n'
import { formatAlbumDuration } from '../../lib/format-duration'

interface AlbumCardProps {
  readonly album: Album
  /**
   * When true, a selection checkbox is shown in the card corner so the album
   * can be added to a bulk action. Defaults to false so the default browse
   * card is unchanged.
   */
  readonly selectable?: boolean
  /** Whether this card is currently selected. Only meaningful when selectable. */
  readonly selected?: boolean
  /** Called with the album id when the selection checkbox is toggled. */
  readonly onToggleSelect?: (albumId: string) => void
}

/**
 * MUI album card.
 *
 * Shows cover art (from `/api/v1/albums/{id}/cover`), title, primary
 * attribution (composer if set, else albumArtist), date, genre, and a track
 * summary. A placeholder icon is shown when no cover art exists or the image
 * fails to load.
 *
 * Accessibility (WCAG 2.1 AA):
 * - The whole card is a single MUI CardActionArea (a button) so it is one Tab
 *   stop, keyboard activatable (Enter/Space), and shows a visible focus ring.
 * - The action area is labelled with title + artist.
 * - The cover image has descriptive alt text; the placeholder is decorative
 *   and hidden from assistive tech (the card label already conveys the album).
 */
export function AlbumCard({
  album,
  selectable = false,
  selected = false,
  onToggleSelect,
}: AlbumCardProps) {
  const [coverError, setCoverError] = useState(false)
  const navigate = useNavigate()
  const { t } = useTranslation()

  const albumTitle = album.album ?? t('albumCard.unknownAlbum')

  const handleToggleSelect = (): void => {
    onToggleSelect?.(album.id)
  }
  const primaryAttribution = album.composer ?? album.albumArtist ?? t('albumCard.unknownArtist')
  const showCover = album.hasCoverArt && !coverError

  const handleNavigate = (): void => {
    navigate(`/albums/${album.id}`)
  }

  const trackCount = album.trackCount ?? 0
  const durationSeconds = album.totalDurationSeconds ?? 0
  const hasTrackSummary = trackCount > 0 || durationSeconds > 0

  return (
    <Card
      variant="outlined"
      data-testid="album-card"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        ...(selectable ? { position: 'relative' } : {}),
        ...(selectable && selected
          ? { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 }
          : {}),
      }}
    >
      {selectable && (
        <Box
          sx={{
            position: 'absolute',
            top: 4,
            left: 4,
            zIndex: 1,
            bgcolor: 'background.paper',
            borderRadius: 1,
          }}
        >
          <Checkbox
            checked={selected}
            onChange={handleToggleSelect}
            data-testid={`album-select-${album.id}`}
            slotProps={{
              input: {
                'aria-label': t('albumSelection.selectAlbum', { album: albumTitle }),
                'data-testid': `album-select-checkbox-${album.id}`,
              } as React.InputHTMLAttributes<HTMLInputElement>,
            }}
          />
        </Box>
      )}
      <CardActionArea
        onClick={handleNavigate}
        aria-label={t('albumCard.viewDetails', { album: albumTitle, artist: primaryAttribution })}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
        }}
      >
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1 / 1',
            bgcolor: 'action.hover',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {showCover ? (
            <Box
              component="img"
              src={`/api/v1/albums/${album.id}/cover`}
              alt={t('albumCard.coverAlt', { album: albumTitle })}
              loading="lazy"
              onError={() => setCoverError(true)}
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <MusicNoteIcon
              aria-hidden="true"
              data-testid="album-card-placeholder"
              sx={{ fontSize: 64, color: 'text.disabled' }}
            />
          )}
        </Box>
        <CardContent sx={{ flexGrow: 1, width: '100%', textAlign: 'left' }}>
          <Typography
            variant="subtitle1"
            component="h2"
            title={albumTitle}
            sx={{
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {albumTitle}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            title={primaryAttribution}
            sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {primaryAttribution}
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', flexWrap: 'wrap', mt: 1 }}
          >
            {album.date && (
              <Typography variant="caption" color="text.secondary">
                {formatDate(album.date)}
              </Typography>
            )}
            {album.genre && <Chip label={album.genre} size="small" variant="outlined" />}
          </Stack>
          {hasTrackSummary && (
            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
              {trackCount > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {t('albumCard.trackCount', { count: trackCount })}
                </Typography>
              )}
              {durationSeconds > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {formatAlbumDuration(durationSeconds)}
                </Typography>
              )}
            </Stack>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  )
}

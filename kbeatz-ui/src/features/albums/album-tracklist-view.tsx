import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { type Track } from '../../api/generated'
import { formatTrackDuration } from '../../lib/format-duration'
import { groupByDisc } from './trackListUtils'

interface AlbumTrackListViewProps {
  readonly tracks: Track[]
  /**
   * When false, "Composed By" sub-lines are omitted from the DOM entirely.
   * Defaults to true (credits visible).
   */
  readonly showCredits?: boolean
}

/**
 * AlbumTrackListView - read-only tracklist for view mode.
 *
 * Renders:
 * - Empty-state message when there are no tracks
 * - A table with track number, title (+ optional "Composed By" sub-line), and duration columns
 * - "Disc N" separator rows for multi-disc albums
 *
 * No input fields, no edit icons, no hover affordances.
 *
 * The `showCredits` prop (default true) controls whether "Composed By" sub-lines
 * are rendered. When false, sub-lines are omitted from the DOM (not hidden with CSS).
 */
export function AlbumTrackListView({ tracks, showCredits = true }: AlbumTrackListViewProps) {
  const { t } = useTranslation()

  if (tracks.length === 0) {
    return (
      <Typography component="p" variant="body2" color="text.secondary" data-testid="tracklist-empty-state">
        {t('albumDetail.noTracks')}
      </Typography>
    )
  }

  const { groups, isMultiDisc } = groupByDisc(tracks)

  return (
    <TableContainer data-testid="tracklist-view">
      <Table size="small" aria-label={t('albumDetail.tracksSectionTitle')}>
        <TableHead>
          <TableRow>
            <TableCell scope="col" sx={{ width: 48 }}>
              {t('albumDetail.trackColumns.position')}
            </TableCell>
            <TableCell scope="col">{t('albumDetail.trackColumns.title')}</TableCell>
            <TableCell scope="col" sx={{ width: 72, textAlign: 'right' }}>
              {t('albumDetail.trackColumns.duration')}
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {groups.map((group, groupIndex) => (
            <Fragment key={`${group.discLabel ?? 'no-disc'}-${groupIndex}`}>
              {isMultiDisc && group.discLabel !== null && (
                <TableRow data-testid={`disc-header-${group.discLabel}`}>
                  <TableCell
                    colSpan={3}
                    sx={{ fontWeight: 600, color: 'text.secondary', bgcolor: 'action.hover' }}
                  >
                    {t('albumDetail.discHeader', { number: group.discLabel })}
                  </TableCell>
                </TableRow>
              )}
              {group.tracks.map((track, trackIndex) => (
                <TrackViewRow key={`${track.filePath}-${trackIndex}`} track={track} showCredits={showCredits} />
              ))}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

interface TrackViewRowProps {
  readonly track: Track
  readonly showCredits: boolean
}

/**
 * A single read-only track row.
 *
 * The "Composed By" sub-line is placed in the same TableCell as the title so
 * screen readers announce both together (per the AC for associated markup).
 * The sub-line also carries an aria-label including the track title so
 * assistive technology users can identify which track it belongs to when
 * navigating by landmark or focus.
 *
 * When `showCredits` is false the sub-line element is not rendered at all
 * (omitted from the DOM, not hidden with CSS).
 */
function TrackViewRow({ track, showCredits }: TrackViewRowProps) {
  const { t } = useTranslation()

  const durationDisplay = track.durationSeconds !== undefined
    ? formatTrackDuration(track.durationSeconds)
    : '-'

  return (
    <TableRow data-testid={`track-view-row-${track.id}`}>
      <TableCell sx={{ verticalAlign: 'top', width: 48 }}>
        <Typography variant="body2">{track.trackNumber ?? '-'}</Typography>
      </TableCell>
      <TableCell sx={{ verticalAlign: 'top' }}>
        <Box>
          <Typography variant="body2" data-testid={`track-view-title-${track.id}`}>
            {track.title ?? '-'}
          </Typography>
          {showCredits && track.composer !== undefined && track.composer !== null && track.composer !== '' && (
            <Typography
              variant="caption"
              color="text.secondary"
              component="p"
              data-testid={`track-view-composer-${track.id}`}
              aria-label={`${t('albumDetail.composedByPrefix')}: ${track.composer} (${track.title ?? ''})`}
              sx={{ mt: 0.25 }}
            >
              {t('albumDetail.composedByPrefix')} - {track.composer}
            </Typography>
          )}
        </Box>
      </TableCell>
      <TableCell sx={{ verticalAlign: 'top', width: 72, textAlign: 'right' }}>
        <Typography variant="body2">{durationDisplay}</Typography>
      </TableCell>
    </TableRow>
  )
}

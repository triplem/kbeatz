import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Text } from '@astryxdesign/core/Text'
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

const cellStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '4px 8px',
  borderBottom: '1px solid var(--color-border)',
  verticalAlign: 'top',
}

/**
 * AlbumTrackListView - read-only tracklist for view mode.
 *
 * Renders an empty-state message when there are no tracks, otherwise a table
 * with track number, title (+ optional "Composed By" sub-line), and duration
 * columns, plus "Disc N" separator rows for multi-disc albums.
 *
 * The `showCredits` prop (default true) controls whether "Composed By" sub-lines
 * are rendered. When false, sub-lines are omitted from the DOM (not hidden with CSS).
 */
export function AlbumTrackListView({ tracks, showCredits = true }: AlbumTrackListViewProps) {
  const { t } = useTranslation()

  if (tracks.length === 0) {
    return (
      <p data-testid="tracklist-empty-state" style={{ margin: 0 }}>
        <Text type="supporting">{t('albumDetail.noTracks')}</Text>
      </p>
    )
  }

  const { groups, isMultiDisc } = groupByDisc(tracks)

  return (
    <div id="composer-credits-region" data-testid="tracklist-view" style={{ overflowX: 'auto' }}>
      <table
        aria-label={t('albumDetail.tracksSectionTitle')}
        style={{ borderCollapse: 'collapse', width: '100%' }}
      >
        <thead>
          <tr>
            <th scope="col" style={{ ...cellStyle, width: 48 }}>
              <Text type="label">{t('albumDetail.trackColumns.position')}</Text>
            </th>
            <th scope="col" style={cellStyle}>
              <Text type="label">{t('albumDetail.trackColumns.title')}</Text>
            </th>
            <th scope="col" style={{ ...cellStyle, width: 72, textAlign: 'right' }}>
              <Text type="label">{t('albumDetail.trackColumns.duration')}</Text>
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group, groupIndex) => (
            <Fragment key={`${group.discLabel ?? 'no-disc'}-${groupIndex}`}>
              {isMultiDisc && group.discLabel !== null && (
                <tr data-testid={`disc-header-${group.discLabel}`}>
                  <td
                    colSpan={3}
                    style={{
                      ...cellStyle,
                      fontWeight: 600,
                      background: 'var(--color-muted, rgba(128,128,128,0.1))',
                    }}
                  >
                    <Text type="supporting" weight="semibold">
                      {t('albumDetail.discHeader', { number: group.discLabel })}
                    </Text>
                  </td>
                </tr>
              )}
              {group.tracks.map((track, trackIndex) => (
                <TrackViewRow key={`${track.filePath}-${trackIndex}`} track={track} showCredits={showCredits} />
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface TrackViewRowProps {
  readonly track: Track
  readonly showCredits: boolean
}

/**
 * A single read-only track row.
 *
 * The "Composed By" sub-line is placed in the same cell as the title so screen
 * readers announce both together. The sub-line carries an aria-label including
 * the track title so assistive technology users can identify which track it
 * belongs to. When `showCredits` is false the sub-line is omitted from the DOM.
 */
function TrackViewRow({ track, showCredits }: TrackViewRowProps) {
  const { t } = useTranslation()

  const durationDisplay = track.durationSeconds !== undefined
    ? formatTrackDuration(track.durationSeconds)
    : '-'

  return (
    <tr data-testid={`track-view-row-${track.id}`}>
      <td style={{ ...cellStyle, width: 48 }}>
        <Text type="supporting">{track.trackNumber ?? '-'}</Text>
      </td>
      <td style={cellStyle}>
        <div>
          <div data-testid={`track-view-title-${track.id}`}>
            <Text type="supporting">{track.title ?? '-'}</Text>
          </div>
          {showCredits && track.composer !== undefined && track.composer !== null && track.composer !== '' && (
            <p
              data-testid={`track-view-composer-${track.id}`}
              aria-label={`${t('albumDetail.composedByPrefix')}: ${track.composer} (${track.title ?? ''})`}
              style={{ margin: '2px 0 0' }}
            >
              <Text type="supporting">
                {t('albumDetail.composedByPrefix')} - {track.composer}
              </Text>
            </p>
          )}
        </div>
      </td>
      <td style={{ ...cellStyle, width: 72, textAlign: 'right' }}>
        <Text type="supporting">{durationDisplay}</Text>
      </td>
    </tr>
  )
}

import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ClickableCard } from '@astryxdesign/core/ClickableCard'
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput'
import { Token } from '@astryxdesign/core/Token'
import { Text } from '@astryxdesign/core/Text'
import { Heading } from '@astryxdesign/core/Heading'
import { Icon } from '@astryxdesign/core/Icon'
import { Music } from 'lucide-react'
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
 * Album card.
 *
 * Shows cover art (from `/api/v1/albums/{id}/cover`), title, primary
 * attribution (composer if set, else albumArtist), date, genre, and a track
 * summary. A placeholder icon is shown when no cover art exists or the image
 * fails to load.
 *
 * Accessibility (WCAG 2.1 AA):
 * - The whole card is a single Astryx ClickableCard (a button) so it is one Tab
 *   stop, keyboard activatable, and shows a visible focus ring. The optional
 *   selection checkbox sits outside the clickable surface to avoid nesting
 *   interactive controls.
 * - The card is labelled with title + artist.
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

  const wrapperStyle: CSSProperties = {
    position: 'relative',
    height: '100%',
    ...(selectable && selected
      ? {
          outline: '2px solid var(--color-accent, #6a4de8)',
          outlineOffset: -2,
          borderRadius: 'var(--radius-container, 12px)',
        }
      : {}),
  }

  return (
    <div data-testid="album-card" style={wrapperStyle}>
      {selectable && (
        <div
          data-testid={`album-select-${album.id}`}
          style={{
            position: 'absolute',
            top: 4,
            left: 4,
            zIndex: 1,
            background: 'var(--color-background-primary, #fff)',
            borderRadius: 'var(--radius-element, 8px)',
            padding: 2,
          }}
        >
          <CheckboxInput
            label={t('albumSelection.selectAlbum', { album: albumTitle })}
            isLabelHidden
            value={selected}
            onChange={handleToggleSelect}
            data-testid={`album-select-checkbox-${album.id}`}
          />
        </div>
      )}
      <ClickableCard
        label={t('albumCard.viewDetails', { album: albumTitle, artist: primaryAttribution })}
        onClick={handleNavigate}
        padding={0}
        height="100%"
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', textAlign: 'left' }}>
          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '1 / 1',
              background: 'var(--color-muted, rgba(128, 128, 128, 0.1))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {showCover ? (
              <img
                src={`/api/v1/albums/${album.id}/cover`}
                alt={t('albumCard.coverAlt', { album: albumTitle })}
                loading="lazy"
                onError={() => setCoverError(true)}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span
                aria-hidden="true"
                data-testid="album-card-placeholder"
                style={{ color: 'var(--color-text-disabled)' }}
              >
                <Icon icon={Music} size="lg" color="disabled" />
              </span>
            )}
          </div>
          <div
            style={{
              flexGrow: 1,
              width: '100%',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <Heading level={2} maxLines={1}>
              {albumTitle}
            </Heading>
            <Text type="supporting" maxLines={1}>
              {primaryAttribution}
            </Text>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              {album.date && <Text type="supporting">{formatDate(album.date)}</Text>}
              {album.genre && <Token label={album.genre} size="sm" color="gray" />}
            </div>
            {hasTrackSummary && (
              <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                {trackCount > 0 && (
                  <Text type="supporting">{t('albumCard.trackCount', { count: trackCount })}</Text>
                )}
                {durationSeconds > 0 && (
                  <Text type="supporting">{formatAlbumDuration(durationSeconds)}</Text>
                )}
              </div>
            )}
          </div>
        </div>
      </ClickableCard>
    </div>
  )
}

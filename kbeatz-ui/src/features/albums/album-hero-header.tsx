import { useTranslation } from 'react-i18next'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { type AlbumDetail } from '../../api/generated'
import { formatDate } from '../../lib/i18n'
import { CommaSeparatedChips } from './comma-separated-chips'

interface AlbumHeroHeaderProps {
  /** Full album detail object from the API. */
  readonly album: AlbumDetail
}

interface MetaRowProps {
  /** Short label shown before the value (e.g. "Country:"). */
  readonly label: string
  /** Value to display. Row is omitted when this is absent or empty. */
  readonly value: string | undefined
  readonly testId?: string
}

/** A single labelled metadata row. Renders nothing when value is absent/empty. */
function MetaRow({ label, value, testId }: MetaRowProps) {
  if (!value) return null
  return (
    <div
      style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}
      data-testid={testId}
    >
      <Text type="supporting">{label}</Text>
      <Text type="supporting">{value}</Text>
    </div>
  )
}

/**
 * AlbumHeroHeader - read-only summary banner rendered above the editable tag form.
 *
 * Layout: two-column on wider viewports (cover art left, metadata right),
 * single-column when narrow.
 *
 * Fields omitted when null/undefined: cover art, label + catalog number,
 * release date, genre/style chips, country, media format.
 */
export function AlbumHeroHeader({ album }: AlbumHeroHeaderProps) {
  const { t } = useTranslation()

  const labelLine = [album.label, album.catalogNumber].filter(Boolean).join(' - ')

  return (
    <section
      aria-labelledby="hero-album-title"
      data-testid="album-hero-header"
      style={{
        display: 'grid',
        gridTemplateColumns: album.hasCoverArt ? 'minmax(0, 200px) 1fr' : '1fr',
        gap: 24,
        alignItems: 'start',
      }}
    >
      {/* Cover art - visible only when hasCoverArt is true */}
      {album.hasCoverArt && (
        <img
          src={`/api/v1/albums/${album.id}/cover`}
          alt={t('albumDetail.coverAlt', { album: album.album })}
          loading="lazy"
          data-testid="hero-cover-art"
          style={{
            width: '100%',
            maxWidth: 200,
            aspectRatio: '1 / 1',
            objectFit: 'cover',
            borderRadius: 'var(--radius-container, 12px)',
            boxShadow: 'var(--shadow-med, 0 4px 12px rgba(0,0,0,0.15))',
          }}
        />
      )}

      {/* Metadata summary column */}
      <div data-testid="hero-metadata" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Artist name - rendered as plain text; not a structural heading */}
        <p data-testid="hero-artist" style={{ margin: 0 }}>
          <Text type="large" weight="bold">
            {album.albumArtist}
          </Text>
        </p>

        {/* Album title - h2 to match other section headings; the accessible name
            for the section via aria-labelledby="hero-album-title" */}
        <Heading level={2} id="hero-album-title" data-testid="hero-album-title">
          {album.album}
        </Heading>

        {/* Label + catalog number */}
        {labelLine && (
          <Text type="supporting" data-testid="hero-label-catalog">
            {labelLine}
          </Text>
        )}

        {/* Release date */}
        {album.date && (
          <Text type="supporting" data-testid="hero-release-date">
            {formatDate(album.date)}
          </Text>
        )}

        {/* Genre/style chips (comma-separated GENRE tag) */}
        <CommaSeparatedChips
          value={album.genre}
          ariaLabel={t('albumDetail.genreChipsLabel')}
          testId="hero-genre-chips"
        />

        {/* Country */}
        <MetaRow
          label={t('albumDetail.hero.countryLabel')}
          value={album.country}
          testId="hero-country"
        />

        {/* Media format */}
        <MetaRow
          label={t('albumDetail.hero.formatLabel')}
          value={album.mediaFormat}
          testId="hero-media-format"
        />
      </div>
    </section>
  )
}

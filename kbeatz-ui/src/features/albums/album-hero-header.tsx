import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
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
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'baseline' }} data-testid={testId}>
      <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Box>
  )
}

/**
 * AlbumHeroHeader - read-only summary banner rendered above the editable tag form.
 *
 * Layout: two-column on sm+ (cover art left, metadata right), single-column on xs.
 *
 * Fields omitted when null/undefined:
 * - cover art (only shown when hasCoverArt is true)
 * - label + catalog number
 * - release date
 * - genre/style chips (comma-separated GENRE tag values)
 * - country
 * - media format
 */
export function AlbumHeroHeader({ album }: AlbumHeroHeaderProps) {
  const { t } = useTranslation()

  const labelLine = [album.label, album.catalogNumber].filter(Boolean).join(' - ')

  return (
    <Box
      component="section"
      aria-labelledby="hero-album-title"
      data-testid="album-hero-header"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '200px 1fr' },
        gap: { xs: 2, sm: 3 },
        alignItems: 'start',
      }}
    >
      {/* Cover art - visible only when hasCoverArt is true */}
      {album.hasCoverArt && (
        <Box
          component="img"
          src={`/api/v1/albums/${album.id}/cover`}
          alt={t('albumDetail.coverAlt', { album: album.album })}
          loading="lazy"
          data-testid="hero-cover-art"
          sx={{
            width: '100%',
            maxWidth: 200,
            aspectRatio: '1 / 1',
            objectFit: 'cover',
            borderRadius: 2,
            boxShadow: 3,
          }}
        />
      )}

      {/* When no cover art, placeholder so the metadata column still fills the right slot */}
      {!album.hasCoverArt && (
        <Box
          aria-hidden="true"
          data-testid="hero-cover-placeholder"
          sx={{ display: { xs: 'none', sm: 'block' }, width: 200 }}
        />
      )}

      {/* Metadata summary column */}
      <Box
        data-testid="hero-metadata"
        sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
      >
        {/* Artist name - rendered as h2 for correct heading outline */}
        <Typography
          variant="h5"
          component="h2"
          data-testid="hero-artist"
          sx={{ fontWeight: 700, lineHeight: 1.2 }}
        >
          {album.albumArtist}
        </Typography>

        {/* Album title - rendered as h3; also the accessible name for the section via aria-labelledby */}
        <Typography
          id="hero-album-title"
          variant="h4"
          component="h3"
          data-testid="hero-album-title"
          sx={{ fontWeight: 700, lineHeight: 1.2 }}
        >
          {album.album}
        </Typography>

        {/* Label + catalog number */}
        {labelLine && (
          <Typography variant="body1" color="text.secondary" data-testid="hero-label-catalog">
            {labelLine}
          </Typography>
        )}

        {/* Release date */}
        {album.date && (
          <Typography variant="body2" color="text.secondary" data-testid="hero-release-date">
            {formatDate(album.date)}
          </Typography>
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
      </Box>
    </Box>
  )
}

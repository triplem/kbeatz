import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Album } from '../../api/generated'

interface AlbumCardProps {
  readonly album: Album
}

/** Inline SVG placeholder shown when no cover art is available. */
const CoverPlaceholder = () => {
  const { t } = useTranslation()
  return (
    <svg
      role="img"
      aria-label={t('albumCard.noCoverAria')}
      width="200"
      height="200"
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      className="album-card__cover-placeholder"
    >
      <rect width="200" height="200" fill="#2a2a2a" />
      {/* eslint-disable-next-line i18next/no-literal-string */}
      <text x="100" y="90" textAnchor="middle" fill="#666" fontSize="40">♪</text>
      <text x="100" y="130" textAnchor="middle" fill="#555" fontSize="12">{t('albumCard.noCoverLabel')}</text>
    </svg>
  )
}

/**
 * Album card component.
 *
 * Displays cover art (from `/api/v1/albums/{id}/cover`), album title,
 * primary attribution (composer if set, else albumArtist), year, and genre.
 *
 * When cover art returns a 404 or any network error, a placeholder SVG is shown.
 *
 * Keyboard accessible: tabIndex=0, role="button", Enter/Space triggers navigation.
 */
export function AlbumCard({ album }: AlbumCardProps) {
  const [coverError, setCoverError] = useState(false)
  const navigate = useNavigate()
  const { t } = useTranslation()

  // Use fallbacks for missing tag values so the card never shows blank content
  const albumTitle = album.album ?? t('albumCard.unknownAlbum')
  const primaryAttribution = album.composer ?? album.albumArtist ?? t('albumCard.unknownArtist')
  const showCover = album.hasCoverArt && !coverError

  const handleNavigate = () => {
    navigate(`/albums/${album.id}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      navigate(`/albums/${album.id}`)
    }
  }

  return (
    <article
      className="album-card"
      tabIndex={0}
      role="button"
      aria-label={t('albumCard.viewDetails', { album: albumTitle, artist: primaryAttribution })}
      onClick={handleNavigate}
      onKeyDown={handleKeyDown}
      style={{ cursor: 'pointer' }}
    >
      <div className="album-card__cover">
        {showCover ? (
          <img
            src={`/api/v1/albums/${album.id}/cover`}
            alt={t('albumCard.coverAlt', { album: albumTitle })}
            width={200}
            height={200}
            onError={() => setCoverError(true)}
            className="album-card__cover-img"
          />
        ) : (
          <CoverPlaceholder />
        )}
      </div>
      <div className="album-card__info">
        <h2 className="album-card__title" title={albumTitle}>
          {albumTitle}
        </h2>
        <p className="album-card__attribution" title={primaryAttribution}>
          {primaryAttribution}
        </p>
        <div className="album-card__meta">
          {album.date && (
            <span className="album-card__year">{album.date}</span>
          )}
          {album.genre && (
            <span className="album-card__genre">{album.genre}</span>
          )}
        </div>
      </div>
    </article>
  )
}

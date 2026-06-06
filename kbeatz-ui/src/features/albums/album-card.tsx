import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Album } from '../../api/generated'

interface AlbumCardProps {
  readonly album: Album
}

/** Inline SVG placeholder shown when no cover art is available. */
const CoverPlaceholder = () => (
  <svg
    role="img"
    aria-label="No cover art"
    width="200"
    height="200"
    viewBox="0 0 200 200"
    xmlns="http://www.w3.org/2000/svg"
    className="album-card__cover-placeholder"
  >
    <rect width="200" height="200" fill="#2a2a2a" />
    <text x="100" y="90" textAnchor="middle" fill="#666" fontSize="40">♪</text>
    <text x="100" y="130" textAnchor="middle" fill="#555" fontSize="12">No cover</text>
  </svg>
)

/**
 * Album card component.
 *
 * Displays cover art (from `/api/v1/albums/{id}/cover`), album title,
 * primary attribution (composer if set, else albumArtist), year, and genre.
 *
 * When cover art returns a 404 or any network error, a placeholder SVG is shown.
 */
export function AlbumCard({ album }: AlbumCardProps) {
  const [coverError, setCoverError] = useState(false)
  const navigate = useNavigate()

  const primaryAttribution = album.composer ?? album.albumArtist
  const showCover = album.hasCoverArt && !coverError

  return (
    <article
      className="album-card"
      aria-label={`${album.album} by ${primaryAttribution}`}
      onClick={() => { navigate(`/albums/${album.id}`) }}
      style={{ cursor: 'pointer' }}
    >
      <div className="album-card__cover">
        {showCover ? (
          <img
            src={`/api/v1/albums/${album.id}/cover`}
            alt={`Cover art for ${album.album}`}
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
        <h2 className="album-card__title" title={album.album}>
          {album.album}
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

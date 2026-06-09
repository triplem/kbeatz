import { useTranslation } from 'react-i18next'
import { Album } from '../../api/generated'
import { AlbumCard } from './album-card'

interface AlbumGridProps {
  readonly albums: Album[]
}

/**
 * Responsive album grid.
 *
 * Uses CSS Grid with `auto-fill / minmax(200px, 1fr)` so cards wrap
 * naturally from 1 to N columns based on viewport width.
 */
export function AlbumGrid({ albums }: AlbumGridProps) {
  const { t } = useTranslation()

  if (albums.length === 0) {
    return (
      <p className="album-grid__empty">
        {t('albumGrid.noResults')}
      </p>
    )
  }

  return (
    <section
      className="album-grid"
      aria-label={t('albumGrid.collectionLabel', { count: albums.length })}
    >
      {albums.map((album) => (
        <AlbumCard key={album.id} album={album} />
      ))}
    </section>
  )
}

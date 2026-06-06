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
  if (albums.length === 0) {
    return (
      <p className="album-grid__empty">
        No albums found. Trigger a library scan to index your collection.
      </p>
    )
  }

  return (
    <section
      className="album-grid"
      aria-label={`Album collection — ${albums.length} albums`}
    >
      {albums.map((album) => (
        <AlbumCard key={album.id} album={album} />
      ))}
    </section>
  )
}

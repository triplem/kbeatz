import { useTranslation } from 'react-i18next'
import { Album } from '../../api/generated'
import { AlbumCard } from './album-card'
import styles from './album-grid.module.css'

interface AlbumGridProps {
  readonly albums: Album[]
  /** Total count before filtering - used to announce "Showing N of total" to screen readers.
   *  When undefined or equal to albums.length, the announcement says "Showing all N albums". */
  readonly totalCount?: number
}

/**
 * Responsive album grid using CSS auto-fill grid layout.
 *
 * Column count is handled natively by CSS Grid (auto-fill + minmax),
 * so no JavaScript column calculation or ResizeObserver is needed.
 * Pagination keeps each page to ~20 albums, so virtualisation is not required.
 *
 * Accessibility (WCAG AA):
 * - The section has role="region" (via <section>) with an aria-label stating the count.
 * - A live region announces the visible count when filters change.
 * - Album cards have role="button", aria-label with title and artist.
 * - Cover art SVG placeholder has role="img" and descriptive aria-label.
 * - Keyboard navigation: Tab moves to each card, Enter/Space activates it.
 */
export function AlbumGrid({ albums, totalCount }: AlbumGridProps) {
  const { t } = useTranslation()

  const isFiltered = totalCount !== undefined && totalCount !== albums.length

  // Screen-reader announcement text for the result count
  const resultCountText = isFiltered
    ? t('albumGrid.showingFiltered', { visible: albums.length, total: totalCount })
    : t('albumGrid.showingAll', { count: albums.length })

  if (albums.length === 0) {
    return (
      <p className={styles.empty}>
        {t('albumGrid.noResults')}
      </p>
    )
  }

  return (
    <>
      {/* Live region: announced by screen readers when the album count changes */}
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={styles.resultCount}
        data-testid="album-grid-result-count"
      >
        {resultCountText}
      </p>
      <section
        className={styles.albumGrid}
        aria-label={t('albumGrid.collectionLabel', { count: albums.length })}
        data-testid="album-grid-section"
      >
        {albums.map((album) => (
          <AlbumCard key={album.id} album={album} />
        ))}
      </section>
    </>
  )
}

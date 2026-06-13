import { useRef, useEffect, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
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

/** Minimum card width in px - matches the CSS minmax(240px, 1fr) grid definition. */
const MIN_CARD_WIDTH_PX = 240
/** Estimated row height in px for initial virtualizer estimate. */
const ESTIMATED_ROW_HEIGHT_PX = 340
/** Number of extra rows to render above/below the visible area. */
const OVERSCAN_ROWS = 3

/**
 * Calculate how many columns fit in the available width.
 * Returns at least 1 to avoid division by zero.
 */
function calcColumns(containerWidth: number): number {
  return Math.max(1, Math.floor(containerWidth / MIN_CARD_WIDTH_PX))
}

/**
 * Responsive virtualised album grid.
 *
 * Uses TanStack Virtual to render only the visible rows + overscan buffer,
 * keeping the DOM node count low even with 5,000+ albums.
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
  const containerRef = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState(1)

  // Observe container width to recalculate column count on resize
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const measure = () => {
      setColumns(calcColumns(el.offsetWidth))
    }

    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => { observer.disconnect() }
  }, [])

  const rowCount = Math.ceil(albums.length / columns)

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => document.documentElement,
    estimateSize: () => ESTIMATED_ROW_HEIGHT_PX,
    overscan: OVERSCAN_ROWS,
  })

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

  const virtualRows = virtualizer.getVirtualItems()
  const totalHeight = virtualizer.getTotalSize()

  // When the scroll container has no height (jsdom / pre-layout), fall back
  // to rendering all rows so the content is accessible.
  const shouldFallback = totalHeight === 0 || virtualRows.length === 0

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
        ref={containerRef}
        data-testid="album-grid-section"
      >
        {shouldFallback ? (
          // Fallback: render all albums without virtualisation
          albums.map((album) => (
            <AlbumCard key={album.id} album={album} />
          ))
        ) : (
          // Virtualised rendering: only visible rows + overscan
          <div
            style={{ height: `${totalHeight}px`, width: '100%', position: 'relative' }}
            data-testid="album-grid-virtual-container"
          >
            {virtualRows.map((virtualRow) => {
              const startIndex = virtualRow.index * columns
              const rowAlbums = albums.slice(startIndex, startIndex + columns)

              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div
                    className={styles.albumGridRow}
                    style={{ '--grid-columns': columns } as React.CSSProperties}
                  >
                    {rowAlbums.map((album) => (
                      <AlbumCard key={album.id} album={album} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}

import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { Album } from '../../api/generated'
import { AlbumCard } from './album-card'

/**
 * Selection wiring for the grid. When provided, each card shows a selection
 * checkbox; when omitted the grid renders plain (non-selectable) cards so the
 * default browse experience is unchanged.
 */
export interface AlbumGridSelection {
  /** Returns true when the given album id is selected. */
  readonly isSelected: (albumId: string) => boolean
  /** Toggle the selection state of an album id. */
  readonly onToggle: (albumId: string) => void
}

interface AlbumGridProps {
  /** The single page of albums to render. */
  readonly albums: ReadonlyArray<Album>
  /**
   * Total number of albums in the filtered result set (across all pages).
   * Announced to screen readers as "Showing N of total". When undefined or
   * equal to the visible count, the announcement says "Showing all N albums".
   */
  readonly totalCount?: number
  /**
   * Optional multi-select wiring. When present each card becomes selectable;
   * when absent cards render in plain browse mode.
   */
  readonly selection?: AlbumGridSelection
}

/**
 * Responsive MUI album grid.
 *
 * Columns reflow with the viewport via a CSS Grid `repeat(auto-fill, minmax())`
 * template, so no JavaScript column maths or ResizeObserver is needed and the
 * grid stays fluid across xs/sm/md/lg/xl with no horizontal scroll (AC8).
 * Only one page of cards is mounted at a time (the parent slices the list), so
 * the DOM stays small regardless of collection size (Performance AC).
 *
 * Accessibility (WCAG 2.1 AA):
 * - A polite live region announces the visible/total count when it changes.
 * - The grid is a labelled region.
 */
export function AlbumGrid({ albums, totalCount, selection }: AlbumGridProps) {
  const { t } = useTranslation()

  const isFiltered = totalCount !== undefined && totalCount !== albums.length
  const resultCountText = isFiltered
    ? t('albumGrid.showingFiltered', { visible: albums.length, total: totalCount })
    : t('albumGrid.showingAll', { count: albums.length })

  if (albums.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ p: 2 }} data-testid="album-grid-empty">
        {t('albumGrid.noResults')}
      </Typography>
    )
  }

  return (
    <Box>
      <Typography
        role="status"
        aria-live="polite"
        aria-atomic="true"
        variant="body2"
        color="text.secondary"
        sx={{ mb: 1 }}
        data-testid="album-grid-result-count"
      >
        {resultCountText}
      </Typography>
      <Box
        component="section"
        aria-label={t('albumGrid.collectionLabel', { count: albums.length })}
        data-testid="album-grid-section"
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        }}
      >
        {albums.map((album) =>
          selection ? (
            <AlbumCard
              key={album.id}
              album={album}
              selectable
              selected={selection.isSelected(album.id)}
              onToggleSelect={selection.onToggle}
            />
          ) : (
            <AlbumCard key={album.id} album={album} />
          ),
        )}
      </Box>
    </Box>
  )
}

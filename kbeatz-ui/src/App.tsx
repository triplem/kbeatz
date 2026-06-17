import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import { visuallyHidden } from '@mui/utils'
import { AlbumGrid } from './features/albums/album-grid'
import { AlbumPagination } from './features/albums/album-pagination'
import { FilterPanel } from './features/albums/filter-panel'
import { PageSizeSelect } from './features/albums/page-size-select'
import { SearchBox } from './features/albums/search-box'
import { SortPreference } from './features/albums/sort-preference'
import { useAlbumList } from './features/albums/useAlbumList'
import { useAlbumFilters } from './features/albums/useAlbumFilters'
import { usePageParams } from './features/albums/usePageParams'
import { usePagination } from './features/albums/usePagination'
import { useScrollRestoration } from './features/albums/useScrollRestoration'
import {
  loadSortDirection,
  loadSortPreference,
  saveSortDirection,
  saveSortPreference,
  type SortDirection,
  type SortField,
} from './features/albums/album-filters'

/**
 * Album list landing page.
 *
 * Dual-mode (story #853): the data hook (`useAlbumList`) picks client-side or
 * server-side mode from the collection size. In client-side mode the full set
 * is loaded once and filter/sort/pagination run in-memory (decision D9); in
 * server-side mode each page is fetched from the server with the active filters
 * mapped to server params, so a 10 000-album library is never truncated
 * (NFR-11 / NFR-12). Either way the component renders only the current page of
 * cards via an MUI Pagination control.
 *
 * Page number + page size live in the URL so the view is deep-linkable and
 * survives reload + back/forward; returning from album detail restores the
 * page, the active filters (URL), and the scroll position (AC5/AC6).
 *
 * This component is a thin renderer: all data/mode logic lives in
 * `useAlbumList`, all pagination logic in `usePagination`, all filter/sort
 * logic in `album-filters`, per react-patterns.md.
 */
export function AlbumListPage() {
  const { t } = useTranslation()

  const { filters, setFilters } = useAlbumFilters()
  const [sortBy, setSortBy] = useState<SortField>(() => loadSortPreference())
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => loadSortDirection())

  // Stable key describing the active filter/sort so pagination resets to page 1
  // whenever any of them change (AC4). Drives both modes.
  const resetKey = `${filters.query}|${filters.genres.join(',')}|${filters.artists.join(',')}|${filters.composers.join(',')}|${sortBy}|${sortDirection}`

  // Read raw page/size from the URL first (independent of the total) so the
  // data hook can fetch the right server page. The total only becomes known
  // after that fetch, so the pager (which clamps against the total) is resolved
  // afterwards. This breaks the page <-> total cycle without storing derived
  // state - the URL stays the source of truth for the page.
  const { page, pageSize } = usePageParams()

  const { mode, isPending, isError, refetch, albums, totalCount, filterOptions } = useAlbumList({
    page,
    pageSize,
    filters,
    sortBy,
    sortDirection,
  })

  // Pagination owns the displayed page + URL writes, clamped against the real
  // total reported by the data hook. setPageSize resets to page 1 and persists.
  const { page: displayPage, totalPages, setPage, setPageSize } = usePagination({
    itemCount: totalCount,
    resetKey,
  })

  // Restore scroll once albums have rendered so returning from detail lands
  // the user where they were (AC6). Applies in both modes.
  useScrollRestoration('albums', !isPending && !isError && albums.length > 0)

  const handleSortChange = useCallback((next: SortField) => {
    setSortBy(next)
    saveSortPreference(next)
  }, [])

  const handleDirectionChange = useCallback((next: SortDirection) => {
    setSortDirection(next)
    saveSortDirection(next)
  }, [])

  const handleRetry = useCallback(() => {
    refetch()
  }, [refetch])

  // Server mode has no sort param; the control is hidden so the user is not
  // offered a sort that only reorders the current page (documented limitation).
  const showSort = mode === 'client'
  // The filter panel enumerates values from the full set, which only exists in
  // client mode; in server mode users filter via the search box and typed terms.
  const showFilterPanel = mode === 'client' && !isPending && !isError

  return (
    <Box>
      {/*
        Visually-hidden page heading anchors the document outline (WCAG 1.3.1 /
        2.4.6). The album cards render as <h2>, so the page needs a single <h1>
        ancestor; the toolbar above is not a heading.
      */}
      <Typography variant="h1" sx={visuallyHidden}>
        {t('albumList.pageHeading')}
      </Typography>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{
          alignItems: { xs: 'stretch', md: 'center' },
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <SearchBox filters={filters} onFiltersChange={setFilters} />
        <Box sx={{ flexGrow: 1 }} />
        {showSort && (
          <SortPreference
            value={sortBy}
            onChange={handleSortChange}
            direction={sortDirection}
            onDirectionChange={handleDirectionChange}
          />
        )}
        <PageSizeSelect value={pageSize} onChange={setPageSize} />
      </Stack>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: 'flex-start',
          gap: 2,
          p: 2,
          maxWidth: 1600,
          mx: 'auto',
          width: '100%',
        }}
      >
        {showFilterPanel && (
          <FilterPanel options={filterOptions} filters={filters} onFiltersChange={setFilters} />
        )}

        <Box sx={{ flexGrow: 1, minWidth: 0, width: '100%' }}>
          {isPending && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress aria-label={t('albumGrid.loading')} />
            </Box>
          )}

          {isError && (
            <Box
              role="alert"
              data-testid="albums-error"
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 1,
                p: 2,
              }}
            >
              <Typography color="error">{t('albumGrid.fetchError')}</Typography>
              <Button
                variant="contained"
                onClick={handleRetry}
                data-testid="albums-retry-button"
              >
                {t('albumGrid.retryButton')}
              </Button>
            </Box>
          )}

          {!isPending && !isError && (
            <>
              <AlbumGrid albums={albums} totalCount={totalCount} />
              <AlbumPagination page={displayPage} totalPages={totalPages} onPageChange={setPage} />
            </>
          )}
        </Box>
      </Box>
    </Box>
  )
}

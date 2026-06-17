import { useCallback, useMemo, useState } from 'react'
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
import { useAllAlbums } from './features/albums/useAllAlbums'
import { useAlbumFilters } from './features/albums/useAlbumFilters'
import { usePagination } from './features/albums/usePagination'
import { useScrollRestoration } from './features/albums/useScrollRestoration'
import { pageSlice } from './features/albums/pagination'
import {
  applyFiltersAndSort,
  deriveFilterOptions,
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
 * Loads the full album-summary set once (TanStack Query), then applies the
 * client-side filter + sort over that set and renders a single page of cards
 * via an MUI Pagination control (client-side pagination, decision D9). Page
 * number + page size live in the URL so the view is deep-linkable and survives
 * reload + back/forward; returning from album detail restores the page, the
 * active filters (URL), and the scroll position (AC5/AC6).
 *
 * This component is a thin renderer: all pagination logic lives in
 * `usePagination`, all filter/sort logic in `album-filters`, per
 * react-patterns.md (no business logic in JSX, no derived state stored).
 */
export function AlbumListPage() {
  const { t } = useTranslation()

  const { filters, setFilters } = useAlbumFilters()
  const [sortBy, setSortBy] = useState<SortField>(() => loadSortPreference())
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => loadSortDirection())

  const { data, isPending, isError, refetch } = useAllAlbums()
  const albums = useMemo(() => data ?? [], [data])

  // Filter options derived from the full set so the filter panel can offer
  // every value present in the collection (client-side, no extra request).
  const filterOptions = useMemo(() => deriveFilterOptions(albums), [albums])

  // Full filtered + sorted result set (over ALL albums, not just one page).
  const filteredAlbums = useMemo(
    () => applyFiltersAndSort(albums, filters, sortBy, sortDirection),
    [albums, filters, sortBy, sortDirection],
  )

  // Stable key describing the active filter/sort so pagination resets to page 1
  // whenever any of them change (AC4).
  const resetKey = `${filters.query}|${filters.genres.join(',')}|${filters.artists.join(',')}|${filters.composers.join(',')}|${sortBy}|${sortDirection}`

  const { page, pageSize, totalPages, setPage, setPageSize } = usePagination({
    itemCount: filteredAlbums.length,
    resetKey,
  })

  // The single page of cards actually mounted in the DOM (Performance AC).
  const visibleAlbums = useMemo(
    () => pageSlice(filteredAlbums, page, pageSize),
    [filteredAlbums, page, pageSize],
  )

  // Restore scroll once albums have rendered so returning from detail lands
  // the user where they were (AC6).
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
    void refetch()
  }, [refetch])

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
        <SortPreference
          value={sortBy}
          onChange={handleSortChange}
          direction={sortDirection}
          onDirectionChange={handleDirectionChange}
        />
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
        {!isPending && !isError && (
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
              <AlbumGrid albums={visibleAlbums} totalCount={filteredAlbums.length} />
              <AlbumPagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </>
          )}
        </Box>
      </Box>
    </Box>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import styles from './App.module.css'
import { AlbumGrid } from './features/albums/album-grid'
import { AlbumDetail } from './features/albums/album-detail'
import { FilterPanel } from './features/albums/filter-panel'
import { SearchBox } from './features/albums/search-box'
import { SortPreference } from './features/albums/sort-preference'
import { useAlbumPage } from './features/albums/use-album-page'
import { ScanProgress } from './features/library/scan-progress'
import { ScanButton } from './features/library/scan-button'
import { NotFoundPage } from './features/not-found/not-found-page'
import { ErrorBoundary } from './lib/error-boundary'
import { LanguageToggle } from './features/language/language-toggle'
import { useAlbumFilters } from './features/albums/useAlbumFilters'
import {
  applyFiltersAndSort,
  loadSortPreference,
  saveSortPreference,
  type SortField,
} from './features/albums/album-filters'

function AlbumListPage() {
  const { t } = useTranslation()

  const [page, setPage] = useState(0)

  // Filter state synced to URL search params via react-router
  const { filters, setFilters } = useAlbumFilters()
  const [sortBy, setSortBy] = useState<SortField>(() => loadSortPreference())

  // Reset to page 0 whenever filters change
  useEffect(() => {
    setPage(0)
  }, [filters])

  const { data, isPending, isError, refetch } = useAlbumPage(page, filters)

  const albums = useMemo(() => data?.content ?? [], [data?.content])
  const totalElements = data?.totalElements ?? 0
  const totalPages = data?.totalPages ?? 0

  // Persist sort preference to localStorage
  const handleSortChange = useCallback((next: SortField) => {
    setSortBy(next)
    saveSortPreference(next)
  }, [])

  const handleRetry = useCallback(() => {
    void refetch()
  }, [refetch])

  // Client-side sort only (no client-side filter - filtering is server-side)
  const visibleAlbums = useMemo(
    () => applyFiltersAndSort(albums, { ...filters, genres: [], artists: [], composers: [], query: '' }, sortBy),
    [albums, filters, sortBy],
  )

  // Multi-select filters with more than 1 value are applied client-side on the current page
  // as a fallback until a future epic adds multi-value server-side filter support.
  const clientFilteredAlbums = useMemo(() => {
    if (
      filters.genres.length > 1 ||
      filters.artists.length > 1 ||
      filters.composers.length > 1
    ) {
      return applyFiltersAndSort(albums, filters, sortBy)
    }
    return visibleAlbums
  }, [albums, filters, sortBy, visibleAlbums])

  return (
    <div className={styles.app}>
      <header className={styles.appHeader}>
        <h1>{t('app.title')}</h1>
        <SearchBox filters={filters} onFiltersChange={setFilters} />
        <ScanButton />
        <LanguageToggle />
      </header>
      <main className={styles.appMain}>
        <ScanProgress />
        <div className={styles.appContent}>
          {!isPending && !isError && (
            // TODO(#515-follow-up): FilterPanel dropdown options are empty because
            // server-side options derivation is not yet implemented. A dedicated
            // GET /api/v1/albums/filter-options endpoint is tracked as a follow-up
            // story. Until then the dropdowns are visible but unpopulated; free-text
            // search (q=) and single-value artist/genre/composer filters still work
            // via the server-side query params sent by useAlbumPage.
            <FilterPanel
              options={{ genres: [], artists: [], composers: [] }}
              filters={filters}
              onFiltersChange={setFilters}
            />
          )}
          <div className={styles.appGridArea}>
            <div className={styles.appToolbar}>
              <SortPreference value={sortBy} onChange={handleSortChange} />
            </div>
            {isPending && <p className={styles.loadingText}>{t('albumGrid.loading')}</p>}
            {isError && (
              <div role="alert" data-testid="albums-error" className={styles.errorBlock}>
                <p>{t('albumGrid.fetchError')}</p>
                <button
                  type="button"
                  onClick={handleRetry}
                  data-testid="albums-retry-button"
                  className={styles.retryButton}
                >
                  {t('albumGrid.retryButton')}
                </button>
              </div>
            )}
            {!isPending && !isError && (
              <>
                <AlbumGrid albums={clientFilteredAlbums} totalCount={totalElements} />
                {totalPages > 1 && (
                  <div className="app-pagination" data-testid="album-pagination">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      data-testid="pagination-prev"
                    >
                      {t('pagination.previous')}
                    </button>
                    <span data-testid="pagination-info">
                      {t('pagination.pageOf', { current: page + 1, total: totalPages })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      data-testid="pagination-next"
                    >
                      {t('pagination.next')}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<AlbumListPage />} />
        <Route
          path="/albums/:albumId"
          element={
            <ErrorBoundary>
              <AlbumDetail />
            </ErrorBoundary>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  )
}

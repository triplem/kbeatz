import { useCallback, useEffect, useMemo, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Album } from './api/generated'
import { AlbumsService } from './api/generated'
import styles from './App.module.css'
import { AlbumGrid } from './features/albums/album-grid'
import { AlbumDetail } from './features/albums/album-detail'
import { FilterPanel } from './features/albums/filter-panel'
import { SearchBox } from './features/albums/search-box'
import { SortPreference } from './features/albums/sort-preference'
import { ScanProgress } from './features/library/scan-progress'
import { NotFoundPage } from './features/not-found/not-found-page'
import { ErrorBoundary } from './lib/error-boundary'
import { LanguageToggle } from './features/language/language-toggle'
import {
  applyFiltersAndSort,
  deriveFilterOptions,
  filtersFromParams,
  filtersToParams,
  loadSortPreference,
  saveSortPreference,
  type AlbumFilters,
  type SortField,
} from './features/albums/album-filters'

/** Fetch all pages sequentially until the last page is reached. */
async function fetchAllAlbums(): Promise<Album[]> {
  const all: Album[] = []
  let page = 0
  let totalPages = 1
  do {
    const response = await AlbumsService.listAlbums({ page, size: 100 })
    all.push(...response.content)
    totalPages = response.totalPages
    page++
  } while (page < totalPages)
  return all
}

function AlbumListPage() {
  const { t } = useTranslation()

  // Filter and sort state - initialised from URL query params and localStorage
  const [filters, setFilters] = useState<AlbumFilters>(() =>
    filtersFromParams(new URLSearchParams(window.location.search)),
  )
  const [sortBy, setSortBy] = useState<SortField>(() => loadSortPreference())

  // Sync filters to URL whenever they change
  useEffect(() => {
    const params = filtersToParams(filters)
    const search = params.toString()
    const newUrl = search ? `${window.location.pathname}?${search}` : window.location.pathname
    window.history.replaceState(null, '', newUrl)
  }, [filters])

  // Persist sort preference to localStorage
  const handleSortChange = useCallback((next: SortField) => {
    setSortBy(next)
    saveSortPreference(next)
  }, [])

  const { data: albums = [], isPending, isError, refetch } = useQuery({
    queryKey: ['albums'],
    queryFn: fetchAllAlbums,
  })

  const filterOptions = useMemo(() => deriveFilterOptions(albums), [albums])

  const visibleAlbums = useMemo(
    () => applyFiltersAndSort(albums, filters, sortBy),
    [albums, filters, sortBy],
  )

  return (
    <div className={styles.app}>
      <header className={styles.appHeader}>
        <h1>{t('app.title')}</h1>
        <SearchBox filters={filters} onFiltersChange={setFilters} />
        <LanguageToggle />
      </header>
      <main className={styles.appMain}>
        <ScanProgress />
        <div className={styles.appContent}>
          {!isPending && !isError && (
            <FilterPanel
              options={filterOptions}
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
                  onClick={() => { void refetch() }}
                  data-testid="albums-retry-button"
                  className={styles.retryButton}
                >
                  {t('albumGrid.retryButton')}
                </button>
              </div>
            )}
            {!isPending && !isError && <AlbumGrid albums={visibleAlbums} totalCount={albums.length} />}
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

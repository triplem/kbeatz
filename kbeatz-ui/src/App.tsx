import { useCallback, useEffect, useMemo, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
  const [albums, setAlbums] = useState<Album[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Incrementing this triggers a re-fetch when the user clicks Retry
  const [retryCount, setRetryCount] = useState(0)

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

  const handleRetry = useCallback(() => {
    setLoading(true)
    setError(null)
    setRetryCount((n) => n + 1)
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadAlbums = async () => {
      try {
        const all = await fetchAllAlbums()
        if (!cancelled) {
          setAlbums(all)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('albumGrid.fetchError'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadAlbums()
    return () => {
      cancelled = true
    }
  }, [retryCount, t])

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
      </header>
      <main className={styles.appMain}>
        <ScanProgress />
        <div className={styles.appContent}>
          {!loading && !error && (
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
            {loading && <p className={styles.loadingText}>{t('albumGrid.loading')}</p>}
            {error && (
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
            {!loading && !error && <AlbumGrid albums={visibleAlbums} totalCount={albums.length} />}
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

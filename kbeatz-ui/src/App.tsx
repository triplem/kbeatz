import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import styles from './App.module.css'
import logoFull from './assets/kbeatz-logo-transparent.svg'
import logoFullDark from './assets/kbeatz-logo-dark.svg'
import logoIcon from './assets/kbeatz-icon.svg'
import { AlbumGrid } from './features/albums/album-grid'
import { FilterPanel } from './features/albums/filter-panel'
import { SearchBox } from './features/albums/search-box'
import { SortPreference } from './features/albums/sort-preference'
import { useAlbumPage } from './features/albums/use-album-page'
import { ScanProgress } from './features/library/scan-progress'
import { ScanButton } from './features/library/scan-button'
import { LanguageToggle } from './features/language/language-toggle'
import { useAlbumFilters } from './features/albums/useAlbumFilters'
import {
  applyFiltersAndSort,
  loadSortDirection,
  loadSortPreference,
  saveSortDirection,
  saveSortPreference,
  type SortDirection,
  type SortField,
} from './features/albums/album-filters'

export function AppLayout() {
  const { t } = useTranslation()

  return (
    <div className={styles.app}>
      <header className={styles.appHeader}>
        <Link to="/" className={styles.appLogoLink} aria-label={t('app.title')}>
          <picture className={styles.appLogoFull}>
            <source srcSet={logoFullDark} media="(prefers-color-scheme: dark)" />
            <img src={logoFull} alt="" />
          </picture>
          <img
            src={logoIcon}
            alt=""
            className={styles.appLogoIcon}
            aria-hidden="true"
          />
        </Link>
        <ScanButton />
        <LanguageToggle />
      </header>
      <main className={styles.appMain}>
        <ScanProgress />
        <Outlet />
      </main>
    </div>
  )
}

export function AlbumListPage() {
  const { t } = useTranslation()

  const [page, setPage] = useState(0)

  // Filter state synced to URL search params via react-router
  const { filters, setFilters } = useAlbumFilters()
  const [sortBy, setSortBy] = useState<SortField>(() => loadSortPreference())
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => loadSortDirection())

  // Reset to page 0 whenever filters change
  useEffect(() => {
    setPage(0)
  }, [filters])

  const { data, isPending, isError, refetch } = useAlbumPage(page, filters)

  const albums = useMemo(() => data?.content ?? [], [data?.content])
  const totalElements = data?.totalElements ?? 0
  const totalPages = data?.totalPages ?? 0

  // Persist sort preference to localStorage and reset pagination to page 0
  const handleSortChange = useCallback((next: SortField) => {
    setSortBy(next)
    saveSortPreference(next)
    setPage(0)
  }, [])

  // Persist sort direction to localStorage and reset pagination to page 0
  const handleDirectionChange = useCallback((next: SortDirection) => {
    setSortDirection(next)
    saveSortDirection(next)
    setPage(0)
  }, [])

  const handleRetry = useCallback(() => {
    void refetch()
  }, [refetch])

  // Ref for the pagination info span - used to restore focus after page navigation
  // so keyboard users do not lose their position when a button disappears (WCAG 2.1 SC 2.4.3).
  const paginationInfoRef = useRef<HTMLSpanElement>(null)

  // Skip the first render so we do not steal focus on mount.
  const didMountRef = useRef(false)

  // Move focus to the pagination info span after every page navigation.
  // When a button (Next or Prev) is removed from the DOM after page change,
  // the browser silently drops focus to <body>, losing the keyboard user's position.
  // Focusing the info span (tabIndex={-1}) restores focus after every transition
  // without adding a tab stop to the normal Tab sequence (WCAG 2.1 SC 2.4.3).
  // The optional-chain ensures this is a no-op when the pagination nav is hidden.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    paginationInfoRef.current?.focus()
  }, [page])

  // Client-side sort only (no client-side filter - filtering is server-side)
  const visibleAlbums = useMemo(
    () => applyFiltersAndSort(albums, { ...filters, genres: [], artists: [], composers: [], query: '' }, sortBy, sortDirection),
    [albums, filters, sortBy, sortDirection],
  )

  // Multi-select filters with more than 1 value are applied client-side on the current page
  // as a fallback until a future epic adds multi-value server-side filter support.
  const clientFilteredAlbums = useMemo(() => {
    if (
      filters.genres.length > 1 ||
      filters.artists.length > 1 ||
      filters.composers.length > 1
    ) {
      return applyFiltersAndSort(albums, filters, sortBy, sortDirection)
    }
    return visibleAlbums
  }, [albums, filters, sortBy, sortDirection, visibleAlbums])

  return (
    <>
      <div className={styles.appSearchBar}>
        <SearchBox filters={filters} onFiltersChange={setFilters} />
        <SortPreference
          value={sortBy}
          onChange={handleSortChange}
          direction={sortDirection}
          onDirectionChange={handleDirectionChange}
        />
      </div>
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
                <p
                  className={styles.pageIndicator}
                  data-testid="page-indicator"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {t('pagination.pageIndicator', { current: page + 1, total: totalPages })}
                </p>
              )}
              {totalPages > 1 && (
                <nav aria-label={t('pagination.ariaLabel')} className={styles.appPagination} data-testid="album-pagination">
                  {page > 0 && (
                    <button
                      type="button"
                      onClick={() => setPage((p) => p - 1)}
                      data-testid="pagination-prev"
                      className={styles.paginationButton}
                    >
                      {t('pagination.previous')}
                    </button>
                  )}
                  <span
                    ref={paginationInfoRef}
                    tabIndex={-1}
                    aria-live="polite"
                    aria-atomic="true"
                    data-testid="pagination-info"
                  >
                    {t('pagination.pageOf', { current: page + 1, total: totalPages })}
                  </span>
                  {page < totalPages - 1 && (
                    <button
                      type="button"
                      onClick={() => setPage((p) => p + 1)}
                      data-testid="pagination-next"
                      className={styles.paginationButton}
                    >
                      {t('pagination.next')}
                    </button>
                  )}
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}


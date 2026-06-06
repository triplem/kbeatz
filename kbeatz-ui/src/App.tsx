import { useCallback, useEffect, useMemo, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AlbumPage } from './api/generated'
import { AlbumsService } from './api/generated'
import { AlbumGrid } from './features/albums/album-grid'
import { AlbumDetail } from './features/albums/album-detail'
import { FilterPanel } from './features/albums/filter-panel'
import { SearchBox } from './features/albums/search-box'
import { SortPreference } from './features/albums/sort-preference'
import { ScanProgress } from './features/library/scan-progress'
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

function AlbumListPage() {
  const [albumPage, setAlbumPage] = useState<AlbumPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter and sort state — initialised from URL query params and localStorage
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

  useEffect(() => {
    let cancelled = false

    const fetchAlbums = async () => {
      try {
        const page = await AlbumsService.listAlbums({ size: 5000 })
        if (!cancelled) {
          setAlbumPage(page)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load albums')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void fetchAlbums()
    return () => {
      cancelled = true
    }
  }, [])

  const allAlbums = useMemo(() => albumPage?.content ?? [], [albumPage])

  const filterOptions = useMemo(() => deriveFilterOptions(allAlbums), [allAlbums])

  const visibleAlbums = useMemo(
    () => applyFiltersAndSort(allAlbums, filters, sortBy),
    [allAlbums, filters, sortBy],
  )

  return (
    <div className="app">
      <header className="app-header">
        <h1>kbeatz</h1>
        <SearchBox filters={filters} onFiltersChange={setFilters} />
      </header>
      <main className="app-main">
        <ScanProgress />
        <div className="app-content">
          {!loading && !error && (
            <FilterPanel
              options={filterOptions}
              filters={filters}
              onFiltersChange={setFilters}
            />
          )}
          <div className="app-grid-area">
            <div className="app-toolbar">
              <SortPreference value={sortBy} onChange={handleSortChange} />
            </div>
            {loading && <p>Loading albums...</p>}
            {error && <p role="alert">Error: {error}</p>}
            {!loading && !error && <AlbumGrid albums={visibleAlbums} />}
          </div>
        </div>
      </main>
    </div>
  )
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<AlbumListPage />} />
      <Route path="/albums/:albumId" element={<AlbumDetail />} />
    </Routes>
  )
}

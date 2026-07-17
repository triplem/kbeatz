import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@astryxdesign/core/Button'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Text } from '@astryxdesign/core/Text'
import { VisuallyHidden } from '@astryxdesign/core/VisuallyHidden'
import { AlbumGrid } from './features/albums/album-grid'
import { AlbumPagination } from './features/albums/album-pagination'
import { BulkActionToolbar } from './features/albums/bulk-action-toolbar'
import { PageSizeSelect } from './features/albums/page-size-select'
import { SearchBox } from './features/albums/search-box'
import { SortPreference } from './features/albums/sort-preference'
import { useAlbumList } from './features/albums/useAlbumList'
import { useAlbumSelection } from './features/albums/useAlbumSelection'
import { ChangePlanWorkflow } from './features/change-plan'
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

  // Local multi-select state and the active bulk-reorganize workflow ids.
  // Both are ephemeral page-level UI state (react-patterns.md: no global store).
  const selection = useAlbumSelection()
  const [workflowAlbumIds, setWorkflowAlbumIds] = useState<readonly string[] | null>(null)

  const handleReorganize = useCallback(() => {
    setWorkflowAlbumIds(selection.selectedIds)
  }, [selection.selectedIds])

  const handleWorkflowClose = useCallback((applied: boolean) => {
    setWorkflowAlbumIds(null)
    if (applied) {
      selection.clear()
    }
  }, [selection])

  // Stable key describing the active filter/sort so pagination resets to page 1
  // whenever any of them change (AC4). Drives both modes.
  const resetKey = `${filters.query}|${filters.genres.join(',')}|${filters.artists.join(',')}|${filters.composers.join(',')}|${sortBy}|${sortDirection}`

  // Read raw page/size from the URL first (independent of the total) so the
  // data hook can fetch the right server page. The total only becomes known
  // after that fetch, so the pager (which clamps against the total) is resolved
  // afterwards. This breaks the page <-> total cycle without storing derived
  // state - the URL stays the source of truth for the page.
  const { page, pageSize } = usePageParams()

  const { mode, isPending, isError, refetch, albums, totalCount } = useAlbumList({
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

  return (
    <div>
      {/*
        Visually-hidden page heading anchors the document outline (WCAG 1.3.1 /
        2.4.6). The album cards render as <h2>, so the page needs a single <h1>
        ancestor; the toolbar above is not a heading.
      */}
      <VisuallyHidden>
        <h1>{t('albumList.pageHeading')}</h1>
      </VisuallyHidden>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 16,
          padding: 16,
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <SearchBox filters={filters} onFiltersChange={setFilters} />
        <div style={{ flexGrow: 1 }} />
        {showSort && (
          <SortPreference
            value={sortBy}
            onChange={handleSortChange}
            direction={sortDirection}
            onDirectionChange={handleDirectionChange}
          />
        )}
        <PageSizeSelect value={pageSize} onChange={setPageSize} />
      </div>

      <div style={{ padding: 16, maxWidth: 1600, margin: '0 auto', width: '100%' }}>
        <div style={{ minWidth: 0, width: '100%' }}>
          {isPending && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <Spinner aria-label={t('albumGrid.loading')} />
            </div>
          )}

          {isError && (
            <div
              role="alert"
              data-testid="albums-error"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 8,
                padding: 16,
              }}
            >
              <span style={{ color: 'var(--color-text-error, #d6336c)' }}>
                <Text>{t('albumGrid.fetchError')}</Text>
              </span>
              <Button
                variant="primary"
                onClick={handleRetry}
                data-testid="albums-retry-button"
                label={t('albumGrid.retryButton')}
              />
            </div>
          )}

          {!isPending && !isError && (
            <>
              {workflowAlbumIds !== null && workflowAlbumIds.length > 0 && (
                <section
                  aria-label={t('albumSelection.workflowLabel')}
                  data-testid="bulk-relayout-workflow"
                  style={{
                    marginBottom: 16,
                    padding: 16,
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-element, 8px)',
                  }}
                >
                  <ChangePlanWorkflow
                    operation="RELAYOUT"
                    albumIds={workflowAlbumIds}
                    onClose={handleWorkflowClose}
                  />
                </section>
              )}
              {selection.hasSelection && workflowAlbumIds === null && (
                <BulkActionToolbar
                  selectedCount={selection.selectedCount}
                  onReorganize={handleReorganize}
                  onClear={selection.clear}
                />
              )}
              <AlbumGrid
                albums={albums}
                totalCount={totalCount}
                selection={{ isSelected: selection.isSelected, onToggle: selection.toggle }}
              />
              <AlbumPagination page={displayPage} totalPages={totalPages} onPageChange={setPage} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

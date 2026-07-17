import { useTranslation } from 'react-i18next'
import { Pagination } from '@astryxdesign/core/Pagination'
import { Text } from '@astryxdesign/core/Text'

interface AlbumPaginationProps {
  /** Current 1-based page. */
  readonly page: number
  /** Total number of pages (>= 1). */
  readonly totalPages: number
  /** Called with the new 1-based page when the user navigates. */
  readonly onPageChange: (page: number) => void
}

/**
 * Pagination control for the album grid.
 *
 * Renders nothing when there is a single page (nothing to paginate). The Astryx
 * Pagination component is the labelled <nav> landmark and is fully keyboard
 * reachable; a polite live region above it announces the current page so
 * screen-reader users hear the change (WCAG 2.1 AA, AC8).
 */
export function AlbumPagination({ page, totalPages, onPageChange }: AlbumPaginationProps) {
  const { t } = useTranslation()

  if (totalPages <= 1) return null

  return (
    <div
      data-testid="album-pagination"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        marginTop: 24,
      }}
    >
      <p
        aria-live="polite"
        aria-atomic="true"
        data-testid="pagination-info"
        style={{ margin: 0 }}
      >
        <Text type="supporting">
          {t('pagination.pageOf', { current: page, total: totalPages })}
        </Text>
      </p>
      <Pagination
        page={page}
        totalPages={totalPages}
        onChange={onPageChange}
        label={t('pagination.ariaLabel')}
      />
    </div>
  )
}

import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Pagination from '@mui/material/Pagination'
import Typography from '@mui/material/Typography'

interface AlbumPaginationProps {
  /** Current 1-based page. */
  readonly page: number
  /** Total number of pages (>= 1). */
  readonly totalPages: number
  /** Called with the new 1-based page when the user navigates. */
  readonly onPageChange: (page: number) => void
}

/**
 * MUI pagination control for the album grid.
 *
 * Renders nothing when there is a single page (nothing to paginate). The MUI
 * Pagination component is fully keyboard reachable and labelled; we wrap it in
 * a labelled <nav> landmark and add a polite live region announcing the
 * current page so screen-reader users hear the change (WCAG 2.1 AA, AC8).
 */
export function AlbumPagination({ page, totalPages, onPageChange }: AlbumPaginationProps) {
  const { t } = useTranslation()

  if (totalPages <= 1) return null

  return (
    <Box
      component="nav"
      aria-label={t('pagination.ariaLabel')}
      data-testid="album-pagination"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        mt: 3,
      }}
    >
      <Typography
        variant="body2"
        color="text.secondary"
        aria-live="polite"
        aria-atomic="true"
        data-testid="pagination-info"
      >
        {t('pagination.pageOf', { current: page, total: totalPages })}
      </Typography>
      <Pagination
        page={page}
        count={totalPages}
        onChange={(_e, value) => onPageChange(value)}
        color="primary"
        showFirstButton
        showLastButton
        // Enforce >=44px touch targets (WCAG 2.5.5 / AC8) on every page item.
        sx={{ '& .MuiPaginationItem-root': { minWidth: 44, height: 44 } }}
        getItemAriaLabel={(type, pageNumber, selected) => {
          if (type === 'page') {
            return selected
              ? t('pagination.currentPageAria', { page: pageNumber })
              : t('pagination.goToPageAria', { page: pageNumber })
          }
          if (type === 'previous') return t('pagination.previous')
          if (type === 'next') return t('pagination.next')
          if (type === 'first') return t('pagination.first')
          if (type === 'last') return t('pagination.last')
          return ''
        }}
      />
    </Box>
  )
}

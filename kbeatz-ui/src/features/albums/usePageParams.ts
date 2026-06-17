import { useSearchParams } from 'react-router-dom'
import {
  PAGE_PARAM,
  SIZE_PARAM,
  loadPageSize,
  parseSizeParam,
  type PageSize,
} from './pagination'

export interface PageParams {
  /**
   * Current 1-based page from the URL, lower-bounded at 1 but NOT upper-clamped
   * (the total is not known here). The pager (`usePagination`) clamps the
   * displayed page against the real total; the data layer issues the request
   * for this page and tolerates an out-of-range page (server returns an empty
   * page, client slice is empty), after which the URL is reconciled.
   */
  readonly page: number
  /** Active page size: URL param takes precedence, else the persisted default. */
  readonly pageSize: PageSize
}

/**
 * Read the current page + page size from the URL, independently of the total
 * item count.
 *
 * The dual-mode data hook (`useAlbumList`) needs the page/size to fetch the
 * right server page, but the total (which `usePagination` needs to clamp the
 * page) only becomes known after that fetch. Reading the raw page/size here
 * breaks that cycle: the data hook uses these values, then `usePagination`
 * clamps for display once the total is known. The URL stays the single source
 * of truth for the page (no derived state stored), per react-patterns.md.
 */
export function usePageParams(): PageParams {
  const [searchParams] = useSearchParams()
  const pageSize = parseSizeParam(searchParams.get(SIZE_PARAM), loadPageSize())
  const raw = searchParams.get(PAGE_PARAM)
  const parsed = raw === null ? 1 : Number.parseInt(raw, 10)
  const page = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1
  return { page, pageSize }
}

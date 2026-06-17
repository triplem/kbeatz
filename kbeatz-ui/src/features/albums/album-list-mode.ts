/**
 * Dual-mode album-list configuration (story #853).
 *
 * The album grid runs in one of two modes, selected by the collection size
 * reported on the first page fetch (`totalElements`):
 *
 * - **Client-side** (<= {@link CLIENT_SIDE_THRESHOLD}): the full album set is
 *   loaded once and filter / search / sort / pagination all run client-side
 *   over the in-memory set (decision D9). Fast at the expected ~2 000-album
 *   library and gives instant, full-collection sort.
 *
 * - **Server-side** (> {@link CLIENT_SIDE_THRESHOLD}): the grid queries the
 *   `listAlbums` endpoint one page at a time with the active filters mapped to
 *   the server query params, and renders only the returned page. The full set
 *   is never loaded, so a 10 000-album library (NFR-11) is never silently
 *   truncated the way the old `MAX_PAGES = 50` cap truncated it at 5 000.
 *
 * This single named constant replaces the previous implicit
 * `MAX_PAGES (50) * 100 = 5 000` truncation point.
 */
export const CLIENT_SIDE_THRESHOLD = 5000

/** The two list strategies the collection size selects. */
export type AlbumListMode = 'client' | 'server'

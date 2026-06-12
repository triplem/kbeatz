import type { Album } from '../../api/generated'

/** Active filter state for the album collection. */
export interface AlbumFilters {
  readonly genres: ReadonlyArray<string>
  readonly artists: ReadonlyArray<string>
  readonly composers: ReadonlyArray<string>
  readonly yearMin: number | null
  readonly yearMax: number | null
  readonly query: string
}

/** Empty (no-op) filter state. */
export const EMPTY_FILTERS: AlbumFilters = {
  genres: [],
  artists: [],
  composers: [],
  yearMin: null,
  yearMax: null,
  query: '',
}

export type SortField = 'albumArtist' | 'composer'

export type SortDirection = 'asc' | 'desc'

const SORT_STORAGE_KEY = 'kbeatz.sortBy'
const SORT_DIR_STORAGE_KEY = 'kbeatz.sortDir'

/** Load the user's sort preference from localStorage. Defaults to 'albumArtist'. */
export function loadSortPreference(): SortField {
  try {
    const stored = localStorage.getItem(SORT_STORAGE_KEY)
    if (stored === 'composer' || stored === 'albumArtist') return stored
  } catch {
    // localStorage unavailable (SSR, private mode) — use default
  }
  return 'albumArtist'
}

/** Persist the sort preference to localStorage. */
export function saveSortPreference(sort: SortField): void {
  try {
    localStorage.setItem(SORT_STORAGE_KEY, sort)
  } catch {
    // Silently ignore write failures
  }
}

/** Load the user's sort direction preference from localStorage. Defaults to 'asc'. */
export function loadSortDirection(): SortDirection {
  try {
    const stored = localStorage.getItem(SORT_DIR_STORAGE_KEY)
    if (stored === 'asc' || stored === 'desc') return stored
  } catch {
    // localStorage unavailable (SSR, private mode) - use default
  }
  return 'asc'
}

/** Persist the sort direction preference to localStorage. */
export function saveSortDirection(dir: SortDirection): void {
  try {
    localStorage.setItem(SORT_DIR_STORAGE_KEY, dir)
  } catch {
    // Silently ignore write failures
  }
}

/**
 * Filter and sort the album list.
 *
 * Filter rules:
 * - Multi-select fields (genre, artist, composer) use OR within the field.
 * - All active filter axes must match (AND across axes).
 * - Year range is inclusive on both ends.
 * - Free-text query matches any of albumArtist, album, composer, label (case-insensitive).
 *
 * Sort rules:
 * - 'albumArtist': alphabetical by albumArtist; direction controls order.
 * - 'composer': alphabetical by composer; albums with null composer appear last regardless of direction.
 */
export function applyFiltersAndSort(
  albums: ReadonlyArray<Album>,
  filters: AlbumFilters,
  sort: SortField,
  direction: SortDirection = 'asc',
): Album[] {
  const filtered = albums.filter((album) => filterAlbum(album, filters))
  return sortAlbums(filtered, sort, direction)
}

function filterAlbum(album: Album, filters: AlbumFilters): boolean {
  if (filters.genres.length > 0 && !filters.genres.includes(album.genre ?? '')) return false

  if (
    filters.artists.length > 0 &&
    !filters.artists.includes(album.albumArtist)
  )
    return false

  if (
    filters.composers.length > 0 &&
    !filters.composers.includes(album.composer ?? '')
  )
    return false

  if (filters.yearMin !== null) {
    const year = parseYear(album.date)
    if (year === null || year < filters.yearMin) return false
  }

  if (filters.yearMax !== null) {
    const year = parseYear(album.date)
    if (year === null || year > filters.yearMax) return false
  }

  if (filters.query.trim() !== '') {
    const q = filters.query.toLowerCase()
    const matches =
      album.albumArtist.toLowerCase().includes(q) ||
      album.album.toLowerCase().includes(q) ||
      (album.composer?.toLowerCase().includes(q) ?? false) ||
      (album.label?.toLowerCase().includes(q) ?? false)
    if (!matches) return false
  }

  return true
}

function parseYear(date: string | undefined): number | null {
  if (!date) return null
  const year = parseInt(date.slice(0, 4), 10)
  return isNaN(year) ? null : year
}

function sortAlbums(albums: Album[], sort: SortField, direction: SortDirection): Album[] {
  const multiplier = direction === 'desc' ? -1 : 1
  return [...albums].sort((a, b) => {
    if (sort === 'composer') {
      const ca = a.composer ?? null
      const cb = b.composer ?? null
      // Null-composer albums always appear last, regardless of direction
      if (ca === null && cb === null) return multiplier * a.albumArtist.localeCompare(b.albumArtist)
      if (ca === null) return 1
      if (cb === null) return -1
      return multiplier * ca.localeCompare(cb)
    }
    return multiplier * a.albumArtist.localeCompare(b.albumArtist)
  })
}

/** Parse filter state from URL search params. */
export function filtersFromParams(params: URLSearchParams): AlbumFilters {
  const yearMinRaw = params.get('yearMin')
  const yearMaxRaw = params.get('yearMax')
  return {
    genres: params.getAll('genre'),
    artists: params.getAll('artist'),
    composers: params.getAll('composer'),
    yearMin: yearMinRaw ? parseInt(yearMinRaw, 10) || null : null,
    yearMax: yearMaxRaw ? parseInt(yearMaxRaw, 10) || null : null,
    query: params.get('q') ?? '',
  }
}

/** Serialise filter state into URL search params. */
export function filtersToParams(filters: AlbumFilters): URLSearchParams {
  const params = new URLSearchParams()
  for (const g of filters.genres) params.append('genre', g)
  for (const a of filters.artists) params.append('artist', a)
  for (const c of filters.composers) params.append('composer', c)
  if (filters.yearMin !== null) params.set('yearMin', String(filters.yearMin))
  if (filters.yearMax !== null) params.set('yearMax', String(filters.yearMax))
  if (filters.query.trim() !== '') params.set('q', filters.query)
  return params
}

/** Derive the unique values for each filter dimension from the full album list. */
export interface FilterOptions {
  readonly genres: ReadonlyArray<string>
  readonly artists: ReadonlyArray<string>
  readonly composers: ReadonlyArray<string>
}

export function deriveFilterOptions(albums: ReadonlyArray<Album>): FilterOptions {
  const genres = new Set<string>()
  const artists = new Set<string>()
  const composers = new Set<string>()

  for (const album of albums) {
    if (album.genre) genres.add(album.genre)
    artists.add(album.albumArtist)
    if (album.composer) composers.add(album.composer)
  }

  return {
    genres: [...genres].sort(),
    artists: [...artists].sort(),
    composers: [...composers].sort(),
  }
}

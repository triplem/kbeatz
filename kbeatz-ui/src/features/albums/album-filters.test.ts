import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  applyFiltersAndSort,
  EMPTY_FILTERS,
  filtersFromParams,
  filtersToParams,
  loadSortDirection,
  loadSortPreference,
  saveSortDirection,
  saveSortPreference,
  deriveFilterOptions,
  type AlbumFilters,
} from './album-filters'
import type { Album } from '../../api/generated'

function makeAlbum(overrides: Partial<Album> = {}): Album {
  return {
    id: overrides.id ?? 'album-1',
    albumArtist: 'Miles Davis',
    album: 'Kind of Blue',
    date: '1959',
    genre: 'Jazz',
    albumPath: 'Jazz/Miles Davis/Kind of Blue',
    hasCoverArt: false,
    ...overrides,
  }
}

const ALL_ALBUMS: Album[] = [
  makeAlbum({ id: '1', albumArtist: 'Miles Davis', album: 'Kind of Blue', genre: 'Jazz', date: '1959', composer: undefined }),
  makeAlbum({ id: '2', albumArtist: 'John Coltrane', album: 'A Love Supreme', genre: 'Jazz', date: '1965' }),
  makeAlbum({ id: '3', albumArtist: 'Led Zeppelin', album: 'Led Zeppelin IV', genre: 'Rock', date: '1971' }),
  makeAlbum({ id: '4', albumArtist: 'Berlin Philharmoniker', album: 'Symphony No. 9', genre: 'Classical', date: '1962', composer: 'Ludwig van Beethoven' }),
  makeAlbum({ id: '5', albumArtist: 'Vienna Philharmoniker', album: 'The Well-Tempered Clavier', genre: 'Classical', date: '1985', composer: 'Johann Sebastian Bach', label: 'Deutsche Grammophon' }),
]

describe('applyFiltersAndSort', () => {
  describe('no filters', () => {
    it('returns all albums sorted by albumArtist', () => {
      const result = applyFiltersAndSort(ALL_ALBUMS, EMPTY_FILTERS, 'albumArtist')
      expect(result.map((a) => a.albumArtist)).toEqual([
        'Berlin Philharmoniker',
        'John Coltrane',
        'Led Zeppelin',
        'Miles Davis',
        'Vienna Philharmoniker',
      ])
    })
  })

  describe('genre filter', () => {
    it('filters to single genre', () => {
      const result = applyFiltersAndSort(ALL_ALBUMS, { ...EMPTY_FILTERS, genres: ['Jazz'] }, 'albumArtist')
      expect(result).toHaveLength(2)
      expect(result.every((a) => a.genre === 'Jazz')).toBe(true)
    })

    it('OR logic for multiple genres', () => {
      const result = applyFiltersAndSort(ALL_ALBUMS, { ...EMPTY_FILTERS, genres: ['Jazz', 'Rock'] }, 'albumArtist')
      expect(result).toHaveLength(3)
    })

    it('shows all albums when genre filter is empty', () => {
      const result = applyFiltersAndSort(ALL_ALBUMS, { ...EMPTY_FILTERS, genres: [] }, 'albumArtist')
      expect(result).toHaveLength(ALL_ALBUMS.length)
    })
  })

  describe('query filter', () => {
    it('matches album title case-insensitively', () => {
      const result = applyFiltersAndSort(ALL_ALBUMS, { ...EMPTY_FILTERS, query: 'kind' }, 'albumArtist')
      expect(result).toHaveLength(1)
      expect(result[0]?.album).toBe('Kind of Blue')
    })

    it('matches albumArtist', () => {
      const result = applyFiltersAndSort(ALL_ALBUMS, { ...EMPTY_FILTERS, query: 'coltrane' }, 'albumArtist')
      expect(result).toHaveLength(1)
    })

    it('matches composer', () => {
      const result = applyFiltersAndSort(ALL_ALBUMS, { ...EMPTY_FILTERS, query: 'beethoven' }, 'albumArtist')
      expect(result).toHaveLength(1)
      expect(result[0]?.composer).toBe('Ludwig van Beethoven')
    })

    it('matches label', () => {
      const result = applyFiltersAndSort(ALL_ALBUMS, { ...EMPTY_FILTERS, query: 'grammophon' }, 'albumArtist')
      expect(result).toHaveLength(1)
      expect(result[0]?.label).toBe('Deutsche Grammophon')
    })

    it('returns empty when no match', () => {
      const result = applyFiltersAndSort(ALL_ALBUMS, { ...EMPTY_FILTERS, query: 'zzznotfound' }, 'albumArtist')
      expect(result).toHaveLength(0)
    })
  })

  describe('AND logic across filter axes', () => {
    it('genre AND query must both match', () => {
      const result = applyFiltersAndSort(
        ALL_ALBUMS,
        { ...EMPTY_FILTERS, genres: ['Jazz'], query: 'miles' },
        'albumArtist',
      )
      expect(result).toHaveLength(1)
      expect(result[0]?.albumArtist).toBe('Miles Davis')
    })
  })

  describe('sort by composer', () => {
    it('sorts albums with composer alphabetically, null-last', () => {
      const result = applyFiltersAndSort(ALL_ALBUMS, EMPTY_FILTERS, 'composer')
      const withComposer = result.filter((a) => a.composer)
      const withoutComposer = result.filter((a) => !a.composer)
      // All with-composer entries appear before without-composer
      const lastWithComposerIdx = result.findLastIndex((a) => a.composer)
      const firstWithoutComposerIdx = result.findIndex((a) => !a.composer)
      expect(lastWithComposerIdx).toBeLessThan(firstWithoutComposerIdx)
      // With-composer entries are sorted alphabetically
      expect(withComposer.map((a) => a.composer)).toEqual(
        [...withComposer.map((a) => a.composer)].sort(),
      )
      expect(withoutComposer.length).toBeGreaterThan(0)
    })
  })

  describe('sort direction', () => {
    it('sorts by albumArtist ascending by default', () => {
      const result = applyFiltersAndSort(ALL_ALBUMS, EMPTY_FILTERS, 'albumArtist', 'asc')
      expect(result.map((a) => a.albumArtist)).toEqual([
        'Berlin Philharmoniker',
        'John Coltrane',
        'Led Zeppelin',
        'Miles Davis',
        'Vienna Philharmoniker',
      ])
    })

    it('sorts by albumArtist descending when direction is desc', () => {
      const result = applyFiltersAndSort(ALL_ALBUMS, EMPTY_FILTERS, 'albumArtist', 'desc')
      expect(result.map((a) => a.albumArtist)).toEqual([
        'Vienna Philharmoniker',
        'Miles Davis',
        'Led Zeppelin',
        'John Coltrane',
        'Berlin Philharmoniker',
      ])
    })

    it('sorts by composer descending, null-last regardless of direction', () => {
      const result = applyFiltersAndSort(ALL_ALBUMS, EMPTY_FILTERS, 'composer', 'desc')
      const withComposer = result.filter((a) => a.composer)
      const withoutComposer = result.filter((a) => !a.composer)
      // Null-composer albums still appear last even in desc mode
      const lastWithComposerIdx = result.findLastIndex((a) => a.composer)
      const firstWithoutComposerIdx = result.findIndex((a) => !a.composer)
      expect(lastWithComposerIdx).toBeLessThan(firstWithoutComposerIdx)
      // With-composer entries are sorted in reverse alphabetical order
      expect(withComposer.map((a) => a.composer)).toEqual(
        [...withComposer.map((a) => a.composer)].sort().reverse(),
      )
      expect(withoutComposer.length).toBeGreaterThan(0)
    })

    it('defaults to ascending when direction is omitted', () => {
      const withDir = applyFiltersAndSort(ALL_ALBUMS, EMPTY_FILTERS, 'albumArtist', 'asc')
      const withoutDir = applyFiltersAndSort(ALL_ALBUMS, EMPTY_FILTERS, 'albumArtist')
      expect(withoutDir).toEqual(withDir)
    })
  })

  describe('performance', () => {
    it('filters 2000 albums in under 200ms', () => {
      const large: Album[] = Array.from({ length: 2000 }, (_, i) =>
        makeAlbum({
          id: String(i),
          genre: i % 2 === 0 ? 'Jazz' : 'Rock',
          albumArtist: `Artist ${i}`,
          date: String(1960 + (i % 50)),
        }),
      )
      const start = performance.now()
      applyFiltersAndSort(large, { ...EMPTY_FILTERS, genres: ['Jazz'] }, 'albumArtist')
      const elapsed = performance.now() - start
      expect(elapsed).toBeLessThan(200)
    })
  })
})

describe('filtersFromParams / filtersToParams round-trip', () => {
  it('serialises and deserialises filters correctly', () => {
    const original: AlbumFilters = {
      genres: ['Jazz', 'Blues'],
      artists: [],
      composers: [],
      query: 'miles',
    }
    const params = filtersToParams(original)
    const restored = filtersFromParams(params)
    expect(restored).toEqual(original)
  })

  it('handles empty filters', () => {
    const params = filtersToParams(EMPTY_FILTERS)
    expect(params.toString()).toBe('')
    const restored = filtersFromParams(params)
    expect(restored).toEqual(EMPTY_FILTERS)
  })
})

describe('loadSortPreference / saveSortPreference', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns albumArtist by default', () => {
    vi.mocked(localStorage.getItem).mockReturnValue(null)
    expect(loadSortPreference()).toBe('albumArtist')
  })

  it('returns stored composer preference', () => {
    vi.mocked(localStorage.getItem).mockReturnValue('composer')
    expect(loadSortPreference()).toBe('composer')
  })

  it('saves preference to localStorage', () => {
    saveSortPreference('composer')
    expect(localStorage.setItem).toHaveBeenCalledWith('kbeatz.sortBy', 'composer')
  })
})

describe('loadSortDirection / saveSortDirection', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns asc by default', () => {
    vi.mocked(localStorage.getItem).mockReturnValue(null)
    expect(loadSortDirection()).toBe('asc')
  })

  it('returns stored desc preference', () => {
    vi.mocked(localStorage.getItem).mockReturnValue('desc')
    expect(loadSortDirection()).toBe('desc')
  })

  it('returns asc for an unrecognised stored value', () => {
    vi.mocked(localStorage.getItem).mockReturnValue('invalid')
    expect(loadSortDirection()).toBe('asc')
  })

  it('saves direction to localStorage', () => {
    saveSortDirection('desc')
    expect(localStorage.setItem).toHaveBeenCalledWith('kbeatz.sortDir', 'desc')
  })
})

describe('deriveFilterOptions', () => {
  it('derives unique sorted genres, artists, composers', () => {
    const options = deriveFilterOptions(ALL_ALBUMS)
    expect(options.genres).toEqual(['Classical', 'Jazz', 'Rock'])
    expect(options.artists).toEqual([
      'Berlin Philharmoniker',
      'John Coltrane',
      'Led Zeppelin',
      'Miles Davis',
      'Vienna Philharmoniker',
    ])
    expect(options.composers).toEqual(['Johann Sebastian Bach', 'Ludwig van Beethoven'])
  })
})

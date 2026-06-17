import type { Album, AlbumDetail, Track } from '../api/generated'

/**
 * Deterministic test data for the visual-regression and responsive suites.
 *
 * Snapshots must be byte-stable across runs and machines, so every value here
 * is a fixed literal: no Math.random, no Date.now, no incrementing UUIDs whose
 * order depends on scheduling. IDs are content-derived and stable. Use these
 * fixtures (not ad-hoc literals) anywhere a stable serialized DOM is asserted.
 */

/** Three fixed tracks for an album-detail snapshot. */
export const FIXTURE_TRACKS: readonly Track[] = [
  {
    id: 'track-0001',
    albumId: 'album-0001',
    title: 'So What',
    trackNumber: '1',
    artist: undefined,
    path: '01 So What.flac',
    filePath: 'Jazz/Miles Davis/Kind of Blue/01 So What.flac',
    durationSeconds: 565,
  },
  {
    id: 'track-0002',
    albumId: 'album-0001',
    title: 'Freddie Freeloader',
    trackNumber: '2',
    artist: undefined,
    path: '02 Freddie Freeloader.flac',
    filePath: 'Jazz/Miles Davis/Kind of Blue/02 Freddie Freeloader.flac',
    durationSeconds: 586,
  },
  {
    id: 'track-0003',
    albumId: 'album-0001',
    title: 'Blue in Green',
    trackNumber: '3',
    artist: undefined,
    path: '03 Blue in Green.flac',
    filePath: 'Jazz/Miles Davis/Kind of Blue/03 Blue in Green.flac',
    durationSeconds: 337,
  },
]

/** A fully-populated album detail with a fixed Discogs id and tracks. */
export const FIXTURE_ALBUM_DETAIL: AlbumDetail = {
  id: 'album-0001',
  albumArtist: 'Miles Davis',
  album: 'Kind of Blue',
  date: '1959',
  genre: 'Jazz',
  label: 'Columbia',
  catalogNumber: 'CL 1355',
  composer: 'Miles Davis',
  conductor: undefined,
  ensemble: 'Miles Davis Sextet',
  albumPath: 'Jazz/Miles Davis/Kind of Blue',
  hasCoverArt: false,
  discogsId: '1372704',
  tracks: [...FIXTURE_TRACKS],
}

/**
 * A small, fixed set of album summaries for the grid snapshot. Kept short so
 * the serialized grid snapshot stays compact (performance: snapshots should
 * not balloon the repo) while still exercising multiple cards.
 */
export const FIXTURE_ALBUMS: readonly Album[] = [
  {
    id: 'album-0001',
    albumArtist: 'Miles Davis',
    album: 'Kind of Blue',
    date: '1959',
    genre: 'Jazz',
    hasCoverArt: false,
    albumPath: 'Jazz/Miles Davis/Kind of Blue',
  },
  {
    id: 'album-0002',
    albumArtist: 'John Coltrane',
    album: 'A Love Supreme',
    date: '1965',
    genre: 'Jazz',
    hasCoverArt: false,
    albumPath: 'Jazz/John Coltrane/A Love Supreme',
  },
  {
    id: 'album-0003',
    albumArtist: 'Bill Evans',
    album: 'Sunday at the Village Vanguard',
    date: '1961',
    genre: 'Jazz',
    hasCoverArt: false,
    albumPath: 'Jazz/Bill Evans/Sunday at the Village Vanguard',
  },
]

/** Build a stable array of `count` album summaries (for pagination-shaped tests). */
export function makeFixtureAlbums(count: number): Album[] {
  return Array.from({ length: count }, (_, i) => {
    const n = String(i).padStart(4, '0')
    return {
      id: `album-${n}`,
      albumArtist: `Artist ${n}`,
      album: `Album ${n}`,
      hasCoverArt: false,
      albumPath: `/music/album-${n}`,
    }
  })
}

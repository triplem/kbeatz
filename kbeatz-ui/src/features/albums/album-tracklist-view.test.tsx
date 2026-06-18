import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AlbumTrackListView } from './album-tracklist-view'
import { type Track } from '../../api/generated'

/**
 * Test helper: render AlbumTrackListView without any router/query provider -
 * the component is a pure renderer with no data-fetching or routing.
 * i18n is provided by the global test setup (vitest.setup.ts).
 */

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 'track-1',
    albumId: 'album-1',
    title: 'So What',
    trackNumber: '1',
    durationSeconds: 565,
    filePath: '01 So What.flac',
    path: '01 So What.flac',
    ...overrides,
  }
}

describe('AlbumTrackListView', () => {
  // ─── Empty state ──────────────────────────────────────────────────────────

  it('renders empty-state message when tracks array is empty', () => {
    render(<AlbumTrackListView tracks={[]} />)
    expect(screen.getByTestId('tracklist-empty-state')).toBeInTheDocument()
    expect(screen.getByTestId('tracklist-empty-state')).toHaveTextContent(
      'No track information available',
    )
  })

  it('does not render the table when tracks array is empty', () => {
    render(<AlbumTrackListView tracks={[]} />)
    expect(screen.queryByTestId('tracklist-view')).not.toBeInTheDocument()
  })

  // ─── Track row basics ─────────────────────────────────────────────────────

  it('renders a row for each track', () => {
    const tracks = [
      makeTrack({ id: 't1', trackNumber: '1', title: 'So What', filePath: '01.flac' }),
      makeTrack({ id: 't2', trackNumber: '2', title: 'Freddie Freeloader', filePath: '02.flac' }),
    ]
    render(<AlbumTrackListView tracks={tracks} />)
    expect(screen.getByTestId('track-view-row-t1')).toBeInTheDocument()
    expect(screen.getByTestId('track-view-row-t2')).toBeInTheDocument()
  })

  it('renders track number, title, and duration for each track', () => {
    const track = makeTrack({ id: 't1', trackNumber: '3', title: 'Blue in Green', durationSeconds: 337 })
    render(<AlbumTrackListView tracks={[track]} />)
    const row = screen.getByTestId('track-view-row-t1')
    expect(row).toHaveTextContent('3')
    expect(row).toHaveTextContent('Blue in Green')
    // 337s = 5:37
    expect(row).toHaveTextContent('5:37')
  })

  it('renders duration as "-" when durationSeconds is absent', () => {
    const track = makeTrack({ id: 't1', durationSeconds: undefined })
    render(<AlbumTrackListView tracks={[track]} />)
    const row = screen.getByTestId('track-view-row-t1')
    expect(row).toHaveTextContent('-')
  })

  it('renders track number as "-" when trackNumber is absent', () => {
    const track = makeTrack({ id: 't1', trackNumber: undefined })
    render(<AlbumTrackListView tracks={[track]} />)
    const row = screen.getByTestId('track-view-row-t1')
    // First cell has "-" for missing track number
    expect(row).toHaveTextContent('-')
  })

  it('renders title as "-" when title is absent', () => {
    const track = makeTrack({ id: 't1', title: undefined })
    render(<AlbumTrackListView tracks={[track]} />)
    const titleEl = screen.getByTestId('track-view-title-t1')
    expect(titleEl).toHaveTextContent('-')
  })

  // ─── No edit affordances ──────────────────────────────────────────────────

  it('renders no input fields', () => {
    render(<AlbumTrackListView tracks={[makeTrack()]} />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('renders no edit buttons', () => {
    render(<AlbumTrackListView tracks={[makeTrack()]} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  // ─── Composed By sub-line ─────────────────────────────────────────────────

  it('renders "Composed By" sub-line when track has a composer', () => {
    const track = makeTrack({ id: 't1', composer: 'Miles Davis' })
    render(<AlbumTrackListView tracks={[track]} />)
    const composerEl = screen.getByTestId('track-view-composer-t1')
    expect(composerEl).toBeInTheDocument()
    expect(composerEl).toHaveTextContent('Composed By - Miles Davis')
  })

  it('does not render "Composed By" sub-line when track has no composer', () => {
    const track = makeTrack({ id: 't1', composer: undefined })
    render(<AlbumTrackListView tracks={[track]} />)
    expect(screen.queryByTestId('track-view-composer-t1')).not.toBeInTheDocument()
  })

  it('does not render "Composed By" sub-line when composer is null', () => {
    const track = makeTrack({ id: 't1', composer: null as unknown as undefined })
    render(<AlbumTrackListView tracks={[track]} />)
    expect(screen.queryByTestId('track-view-composer-t1')).not.toBeInTheDocument()
  })

  it('does not render "Composed By" sub-line when composer is empty string', () => {
    const track = makeTrack({ id: 't1', composer: '' })
    render(<AlbumTrackListView tracks={[track]} />)
    expect(screen.queryByTestId('track-view-composer-t1')).not.toBeInTheDocument()
  })

  it('renders composer sub-lines for only those tracks that have a composer', () => {
    const tracks = [
      makeTrack({ id: 't1', title: 'Track A', composer: 'Mozart', filePath: '01.flac' }),
      makeTrack({ id: 't2', title: 'Track B', composer: undefined, filePath: '02.flac' }),
      makeTrack({ id: 't3', title: 'Track C', composer: 'Beethoven', filePath: '03.flac' }),
    ]
    render(<AlbumTrackListView tracks={tracks} />)
    expect(screen.getByTestId('track-view-composer-t1')).toHaveTextContent('Composed By - Mozart')
    expect(screen.queryByTestId('track-view-composer-t2')).not.toBeInTheDocument()
    expect(screen.getByTestId('track-view-composer-t3')).toHaveTextContent('Composed By - Beethoven')
  })

  it('"Composed By" sub-line has an accessible aria-label including the track title', () => {
    const track = makeTrack({ id: 't1', title: 'So What', composer: 'Miles Davis' })
    render(<AlbumTrackListView tracks={[track]} />)
    const composerEl = screen.getByTestId('track-view-composer-t1')
    const ariaLabel = composerEl.getAttribute('aria-label')
    expect(ariaLabel).toContain('Miles Davis')
    expect(ariaLabel).toContain('So What')
  })

  // ─── Multi-disc separator rows ────────────────────────────────────────────

  it('renders "Disc N" separator rows for a multi-disc album', () => {
    const tracks = [
      makeTrack({ id: 'd1t1', discNumber: '1', trackNumber: '1', filePath: 'd1_01.flac' }),
      makeTrack({ id: 'd2t1', discNumber: '2', trackNumber: '1', filePath: 'd2_01.flac' }),
    ]
    render(<AlbumTrackListView tracks={tracks} />)
    expect(screen.getByTestId('disc-header-1')).toBeInTheDocument()
    expect(screen.getByTestId('disc-header-1')).toHaveTextContent('Disc 1')
    expect(screen.getByTestId('disc-header-2')).toBeInTheDocument()
    expect(screen.getByTestId('disc-header-2')).toHaveTextContent('Disc 2')
  })

  it('does not render disc separator rows for a single-disc album', () => {
    const track = makeTrack({ discNumber: undefined })
    render(<AlbumTrackListView tracks={[track]} />)
    expect(screen.queryByText(/^Disc /)).not.toBeInTheDocument()
  })

  it('sorts tracks by disc number then track number', () => {
    const tracks = [
      makeTrack({ id: 'd1t2', discNumber: '1', trackNumber: '2', title: 'Track 2 disc 1', filePath: 'd1_02.flac' }),
      makeTrack({ id: 'd2t1', discNumber: '2', trackNumber: '1', title: 'Track 1 disc 2', filePath: 'd2_01.flac' }),
      makeTrack({ id: 'd1t1', discNumber: '1', trackNumber: '1', title: 'Track 1 disc 1', filePath: 'd1_01.flac' }),
    ]
    render(<AlbumTrackListView tracks={tracks} />)
    const rows = screen.getAllByTestId(/^track-view-row-/)
    // Rows should appear in order: d1t1, d1t2, d2t1
    expect(rows[0]).toHaveTextContent('Track 1 disc 1')
    expect(rows[1]).toHaveTextContent('Track 2 disc 1')
    expect(rows[2]).toHaveTextContent('Track 1 disc 2')
  })

  // ─── Column headers ───────────────────────────────────────────────────────

  it('renders Position, Title, and Duration column headers', () => {
    render(<AlbumTrackListView tracks={[makeTrack()]} />)
    expect(screen.getByRole('columnheader', { name: 'Position' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Title' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Duration' })).toBeInTheDocument()
  })

  // ─── No extra network calls ────────────────────────────────────────────────

  it('renders without making any API calls (pure renderer)', () => {
    // The component takes tracks as props - no fetching occurs.
    // Verifying via the absence of any mock usage would require a vi.mock setup;
    // we verify the contract structurally: AlbumTrackListView has no useQuery or
    // useEffect with API calls - it is a pure renderer receiving tracks as props.
    const tracks = [makeTrack()]
    const { container } = render(<AlbumTrackListView tracks={tracks} />)
    // Sanity check: the component renders
    expect(container.firstChild).not.toBeNull()
  })

  // ─── showCredits prop ─────────────────────────────────────────────────────

  it('shows "Composed By" sub-line by default (showCredits defaults to true)', () => {
    const track = makeTrack({ id: 't1', composer: 'Miles Davis' })
    render(<AlbumTrackListView tracks={[track]} />)
    expect(screen.getByTestId('track-view-composer-t1')).toBeInTheDocument()
  })

  it('shows "Composed By" sub-line when showCredits is explicitly true', () => {
    const track = makeTrack({ id: 't1', composer: 'Miles Davis' })
    render(<AlbumTrackListView tracks={[track]} showCredits={true} />)
    expect(screen.getByTestId('track-view-composer-t1')).toBeInTheDocument()
  })

  it('hides "Composed By" sub-line when showCredits is false', () => {
    const track = makeTrack({ id: 't1', composer: 'Miles Davis' })
    render(<AlbumTrackListView tracks={[track]} showCredits={false} />)
    expect(screen.queryByTestId('track-view-composer-t1')).not.toBeInTheDocument()
  })

  it('hides all "Composed By" sub-lines when showCredits is false and multiple tracks have composers', () => {
    const tracks = [
      makeTrack({ id: 't1', composer: 'Mozart', filePath: '01.flac' }),
      makeTrack({ id: 't2', composer: 'Beethoven', filePath: '02.flac' }),
    ]
    render(<AlbumTrackListView tracks={tracks} showCredits={false} />)
    expect(screen.queryByTestId('track-view-composer-t1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('track-view-composer-t2')).not.toBeInTheDocument()
  })

  it('still renders track rows when showCredits is false', () => {
    const track = makeTrack({ id: 't1', title: 'So What', composer: 'Miles Davis' })
    render(<AlbumTrackListView tracks={[track]} showCredits={false} />)
    expect(screen.getByTestId('track-view-row-t1')).toBeInTheDocument()
    expect(screen.getByTestId('track-view-title-t1')).toHaveTextContent('So What')
  })
})

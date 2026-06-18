import { describe, it, expect } from 'vitest'
import { parseLeadingInt, groupByDisc } from './trackListUtils'
import { type Track } from '../../api/generated'

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

describe('parseLeadingInt', () => {
  it('parses a plain integer string', () => {
    expect(parseLeadingInt('3')).toBe(3)
  })

  it('parses the leading integer from a fractional string like "1/12"', () => {
    expect(parseLeadingInt('1/12')).toBe(1)
  })

  it('parses the leading integer from an alphanumeric string like "A1"', () => {
    // "A1" has no leading digits - returns Infinity
    expect(parseLeadingInt('A1')).toBe(Infinity)
  })

  it('returns Infinity for null', () => {
    expect(parseLeadingInt(null)).toBe(Infinity)
  })

  it('returns Infinity for undefined', () => {
    expect(parseLeadingInt(undefined)).toBe(Infinity)
  })

  it('returns Infinity for empty string', () => {
    expect(parseLeadingInt('')).toBe(Infinity)
  })

  it('parses "10" correctly', () => {
    expect(parseLeadingInt('10')).toBe(10)
  })
})

describe('groupByDisc', () => {
  it('returns empty groups for an empty track list', () => {
    const result = groupByDisc([])
    expect(result.sorted).toHaveLength(0)
    expect(result.groups).toHaveLength(0)
    expect(result.isMultiDisc).toBe(false)
  })

  it('treats a single-disc album as non-multi-disc', () => {
    const tracks = [makeTrack({ discNumber: undefined })]
    const { isMultiDisc } = groupByDisc(tracks)
    expect(isMultiDisc).toBe(false)
  })

  it('treats tracks with empty discNumber as non-multi-disc', () => {
    const tracks = [makeTrack({ discNumber: '' })]
    const { isMultiDisc } = groupByDisc(tracks)
    expect(isMultiDisc).toBe(false)
  })

  it('detects multi-disc when at least one track has a discNumber', () => {
    const tracks = [
      makeTrack({ id: 't1', discNumber: '1', filePath: 'd1.flac' }),
      makeTrack({ id: 't2', discNumber: '2', filePath: 'd2.flac' }),
    ]
    const { isMultiDisc } = groupByDisc(tracks)
    expect(isMultiDisc).toBe(true)
  })

  it('sorts by disc number then track number', () => {
    const tracks = [
      makeTrack({ id: 'd1t2', discNumber: '1', trackNumber: '2', filePath: '1_02.flac' }),
      makeTrack({ id: 'd2t1', discNumber: '2', trackNumber: '1', filePath: '2_01.flac' }),
      makeTrack({ id: 'd1t1', discNumber: '1', trackNumber: '1', filePath: '1_01.flac' }),
    ]
    const { sorted } = groupByDisc(tracks)
    expect(sorted[0].id).toBe('d1t1')
    expect(sorted[1].id).toBe('d1t2')
    expect(sorted[2].id).toBe('d2t1')
  })

  it('groups tracks by disc label', () => {
    const tracks = [
      makeTrack({ id: 'd1t1', discNumber: '1', trackNumber: '1', filePath: '1_01.flac' }),
      makeTrack({ id: 'd1t2', discNumber: '1', trackNumber: '2', filePath: '1_02.flac' }),
      makeTrack({ id: 'd2t1', discNumber: '2', trackNumber: '1', filePath: '2_01.flac' }),
    ]
    const { groups } = groupByDisc(tracks)
    expect(groups).toHaveLength(2)
    expect(groups[0].discLabel).toBe('1')
    expect(groups[0].tracks).toHaveLength(2)
    expect(groups[1].discLabel).toBe('2')
    expect(groups[1].tracks).toHaveLength(1)
  })

  it('does not mutate the input array', () => {
    const tracks = [
      makeTrack({ id: 't2', trackNumber: '2', filePath: '02.flac' }),
      makeTrack({ id: 't1', trackNumber: '1', filePath: '01.flac' }),
    ]
    const original = [...tracks]
    groupByDisc(tracks)
    expect(tracks[0].id).toBe(original[0].id)
    expect(tracks[1].id).toBe(original[1].id)
  })

  it('places tracks without discNumber (null/undefined) together at the end', () => {
    const tracks = [
      makeTrack({ id: 't2', discNumber: undefined, trackNumber: '2', filePath: '02.flac' }),
      makeTrack({ id: 't1', discNumber: undefined, trackNumber: '1', filePath: '01.flac' }),
    ]
    const { sorted } = groupByDisc(tracks)
    // Both have Infinity disc, so they sort by track number
    expect(sorted[0].id).toBe('t1')
    expect(sorted[1].id).toBe('t2')
  })
})

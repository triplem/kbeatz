import { describe, it, expect } from 'vitest'
import { formatTrackDuration, formatAlbumDuration } from './format-duration'

describe('formatTrackDuration', () => {
  it('formats seconds below one minute', () => {
    expect(formatTrackDuration(45)).toBe('0:45')
  })

  it('pads seconds with leading zero', () => {
    expect(formatTrackDuration(65)).toBe('1:05')
  })

  it('formats typical track duration', () => {
    expect(formatTrackDuration(225)).toBe('3:45')
  })

  it('formats track duration with double-digit minutes', () => {
    expect(formatTrackDuration(602)).toBe('10:02')
  })

  it('formats zero seconds', () => {
    expect(formatTrackDuration(0)).toBe('0:00')
  })

  it('formats exactly one hour', () => {
    expect(formatTrackDuration(3600)).toBe('60:00')
  })
})

describe('formatAlbumDuration', () => {
  it('formats whole minutes under one hour without seconds', () => {
    expect(formatAlbumDuration(3120)).toBe('52m')
  })

  it('formats minutes and leftover seconds under one hour', () => {
    expect(formatAlbumDuration(3270)).toBe('54m 30s')
  })

  it('formats exactly 59 minutes and 59 seconds', () => {
    expect(formatAlbumDuration(3599)).toBe('59m 59s')
  })

  it('formats exactly one hour as hours and zero minutes', () => {
    expect(formatAlbumDuration(3600)).toBe('1h 0m')
  })

  it('formats hours and minutes for typical album duration', () => {
    expect(formatAlbumDuration(4440)).toBe('1h 14m')
  })

  it('formats multi-hour duration', () => {
    expect(formatAlbumDuration(7260)).toBe('2h 1m')
  })

  it('formats zero seconds as 0m', () => {
    expect(formatAlbumDuration(0)).toBe('0m')
  })

  it('formats under one minute', () => {
    expect(formatAlbumDuration(30)).toBe('0m 30s')
  })
})

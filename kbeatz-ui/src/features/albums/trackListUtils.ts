import { type Track } from '../../api/generated'

/**
 * Parse the leading integer from a string like "1", "2", "A1".
 * Returns Infinity for null/empty so tracks without a number sort to the end.
 */
export function parseLeadingInt(value: string | null | undefined): number {
  if (value === undefined || value === null || value === '') return Infinity
  const match = /^(\d+)/.exec(value)
  return match !== null && match[1] !== undefined ? parseInt(match[1], 10) : Infinity
}

export interface DiscGroup {
  readonly discLabel: string | null
  readonly tracks: Track[]
}

/**
 * Sort tracks by disc number (numeric prefix), then by track number (numeric prefix),
 * and group them by disc for rendering.
 *
 * Returns:
 * - sorted: all tracks in playback order
 * - groups: tracks grouped by disc; each group has a discLabel and its tracks
 * - isMultiDisc: true when at least one track has a non-empty discNumber
 */
export function groupByDisc(tracks: Track[]): {
  sorted: Track[]
  groups: DiscGroup[]
  isMultiDisc: boolean
} {
  const sorted = [...tracks].sort((a, b) => {
    const discA = parseLeadingInt(a.discNumber)
    const discB = parseLeadingInt(b.discNumber)
    if (discA !== discB) return discA - discB
    return parseLeadingInt(a.trackNumber) - parseLeadingInt(b.trackNumber)
  })

  const isMultiDisc = sorted.some(
    (tr) => tr.discNumber !== undefined && tr.discNumber !== null && tr.discNumber !== '',
  )

  const groups: DiscGroup[] = []
  for (const track of sorted) {
    const discKey = track.discNumber ?? null
    const last = groups[groups.length - 1]
    if (last !== undefined && last.discLabel === discKey) {
      last.tracks.push(track)
    } else {
      groups.push({ discLabel: discKey, tracks: [track] })
    }
  }

  return { sorted, groups, isMultiDisc }
}

/**
 * Duration formatting utilities.
 *
 * formatTrackDuration formats a per-track duration in mm:ss (e.g. "3:45", "10:02").
 * formatAlbumDuration formats a total album duration in a compact form:
 *   - Less than 60 minutes: "52m" or "52m 30s"
 *   - 60 minutes or more: "1h 14m"
 */

const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 3600

/**
 * Format a per-track duration in mm:ss notation.
 *
 * Examples: 225 -> "3:45", 602 -> "10:02", 0 -> "0:00"
 */
export function formatTrackDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / SECONDS_PER_MINUTE)
  const secs = totalSeconds % SECONDS_PER_MINUTE
  return `${mins.toString()}:${secs.toString().padStart(2, '0')}`
}

/**
 * Format a total album duration in a compact human-readable form.
 *
 * - Under 60 minutes with whole minutes only: "52m"
 * - Under 60 minutes with leftover seconds: "52m 30s"
 * - 60 minutes or more: "1h 14m" (seconds omitted at this scale)
 *
 * Examples: 3120 -> "52m", 3270 -> "52m 30s", 4440 -> "1h 14m"
 */
export function formatAlbumDuration(totalSeconds: number): string {
  if (totalSeconds < SECONDS_PER_HOUR) {
    const mins = Math.floor(totalSeconds / SECONDS_PER_MINUTE)
    const secs = totalSeconds % SECONDS_PER_MINUTE
    return secs === 0 ? `${mins.toString()}m` : `${mins.toString()}m ${secs.toString()}s`
  }
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR)
  const mins = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE)
  return `${hours.toString()}h ${mins.toString()}m`
}

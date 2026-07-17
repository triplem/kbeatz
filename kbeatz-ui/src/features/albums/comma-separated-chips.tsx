import { Token } from '@astryxdesign/core/Token'

interface CommaSeparatedChipsProps {
  /**
   * Comma-separated string of values (e.g. "Hard Bop, Modal Jazz").
   * Each value is trimmed; empty segments are discarded.
   */
  readonly value: string | undefined
  /** Accessible label for the chip list rendered as `aria-label`. */
  readonly ariaLabel: string
  /** Optional `data-testid` applied to the wrapper element. */
  readonly testId?: string
}

/**
 * Renders a comma-separated string as individual Astryx Tokens.
 *
 * - Returns null when `value` is absent, empty, or produces only
 *   empty segments after splitting on commas.
 * - Each segment is trimmed before rendering.
 * - Used for GENRE tags (which can carry both genre and style
 *   values separated by commas).
 */
export function CommaSeparatedChips({ value, ariaLabel, testId }: CommaSeparatedChipsProps) {
  if (!value) return null
  const items = value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
  if (items.length === 0) return null
  return (
    <ul
      role="list"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        padding: 0,
        margin: 0,
        listStyle: 'none',
      }}
      data-testid={testId}
      aria-label={ariaLabel}
    >
      {items.map((item, index) => (
        <li key={`${index}-${item}`} role="listitem">
          <Token label={item} size="sm" color="gray" />
        </li>
      ))}
    </ul>
  )
}

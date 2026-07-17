import { Skeleton } from '@astryxdesign/core/Skeleton'

interface ContentSkeletonProps {
  /** Number of placeholder lines to render. Defaults to 3. */
  readonly lines?: number
  /** Accessible label announced while content loads. */
  readonly ariaLabel: string
  /** Optional test id. */
  readonly testId?: string
}

/**
 * ContentSkeleton - a stack of placeholder lines shown while content loads.
 *
 * The wrapper carries role="status" + aria-busy so assistive tech announces the
 * loading state with the supplied label. The Astryx Skeleton animation is
 * suppressed automatically under prefers-reduced-motion via the global reduced
 * motion rule (the skeleton remains a static placeholder).
 */
export function ContentSkeleton({ lines = 3, ariaLabel, testId }: ContentSkeletonProps) {
  const count = Math.max(1, lines)
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={ariaLabel}
      data-testid={testId}
      style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}
    >
      {Array.from({ length: count }, (_, i) => (
        <Skeleton
          key={i}
          index={i}
          // The last line is shorter to suggest a paragraph end.
          width={i === count - 1 ? '60%' : '100%'}
          height={24}
        />
      ))}
    </div>
  )
}

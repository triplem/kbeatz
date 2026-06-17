import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'

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
 * loading state with the supplied label. The MUI Skeleton pulse animation is
 * suppressed automatically under prefers-reduced-motion via the global
 * CssBaseline override (the skeleton remains a static placeholder).
 */
export function ContentSkeleton({ lines = 3, ariaLabel, testId }: ContentSkeletonProps) {
  const count = Math.max(1, lines)
  return (
    <Box
      role="status"
      aria-busy="true"
      aria-label={ariaLabel}
      data-testid={testId}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1, py: 1 }}
    >
      {Array.from({ length: count }, (_, i) => (
        <Skeleton
          key={i}
          variant="text"
          // The last line is shorter to suggest a paragraph end.
          width={i === count - 1 ? '60%' : '100%'}
          height={24}
        />
      ))}
    </Box>
  )
}

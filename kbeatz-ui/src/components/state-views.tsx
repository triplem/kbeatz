import { type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'

interface LoadingStateProps {
  /** Visible and announced loading message. */
  readonly message: string
  /** Optional test id. */
  readonly testId?: string
}

/**
 * LoadingState - centred spinner with an accessible status message.
 *
 * Uses role="status" + aria-live="polite" so screen readers announce loading
 * without interrupting. The MUI CircularProgress honours reduced-motion via the
 * global CssBaseline override.
 */
export function LoadingState({ message, testId }: LoadingStateProps) {
  return (
    <Box
      role="status"
      aria-live="polite"
      data-testid={testId}
      sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2 }}
    >
      <CircularProgress size={20} aria-hidden="true" />
      <Typography component="p" variant="body2" color="text.secondary" sx={{ m: 0 }}>
        {message}
      </Typography>
    </Box>
  )
}

interface EmptyStateProps {
  /** Primary message explaining the empty state. */
  readonly message: string
  /** Optional secondary hint text. */
  readonly hint?: string
  /** Optional action element (e.g. a button) rendered below the text. */
  readonly action?: ReactNode
  /** Optional test id. */
  readonly testId?: string
}

/**
 * EmptyState - neutral message shown when a list or region has no content.
 */
export function EmptyState({ message, hint, action, testId }: EmptyStateProps) {
  return (
    <Box
      data-testid={testId}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 1,
        py: 4,
        px: 2,
      }}
    >
      <Typography component="p" variant="body1" color="text.secondary" sx={{ m: 0 }}>
        {message}
      </Typography>
      {hint !== undefined && (
        <Typography component="p" variant="body2" color="text.disabled" sx={{ m: 0 }}>
          {hint}
        </Typography>
      )}
      {action}
    </Box>
  )
}

interface ErrorStateProps {
  /** Error message. */
  readonly message: string
  /** Optional retry handler; when provided a retry button is shown. */
  readonly onRetry?: () => void
  /** Label for the retry button. Required when `onRetry` is set. */
  readonly retryLabel?: string
  /** Optional test id. */
  readonly testId?: string
}

/**
 * ErrorState - assertive error message with an optional retry action.
 *
 * Uses role="alert" so the message is announced immediately. The retry button,
 * when shown, meets the 44px minimum target size.
 */
export function ErrorState({ message, onRetry, retryLabel, testId }: ErrorStateProps) {
  return (
    <Box
      role="alert"
      data-testid={testId}
      sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, py: 2 }}
    >
      <Typography component="p" variant="body2" color="error" sx={{ m: 0 }}>
        {message}
      </Typography>
      {onRetry !== undefined && retryLabel !== undefined && (
        <Button
          type="button"
          variant="outlined"
          color="inherit"
          onClick={onRetry}
          data-testid={testId !== undefined ? `${testId}-retry` : undefined}
          sx={{ minHeight: 44 }}
        >
          {retryLabel}
        </Button>
      )}
    </Box>
  )
}

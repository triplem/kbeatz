import { type ReactNode } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Text } from '@astryxdesign/core/Text'

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
 * without interrupting. Reduced-motion is honoured via the global stylesheet.
 */
export function LoadingState({ message, testId }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid={testId}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0' }}
    >
      {/* The outer region is the live status; hide the spinner's own role=status
          so there is a single announcement carrying the message text. */}
      <span aria-hidden="true" style={{ display: 'inline-flex' }}>
        <Spinner size="sm" />
      </span>
      <Text type="supporting">{message}</Text>
    </div>
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
    <div
      data-testid={testId}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 8,
        padding: '32px 16px',
      }}
    >
      <Text color="secondary">{message}</Text>
      {hint !== undefined && (
        <Text type="supporting" color="disabled">
          {hint}
        </Text>
      )}
      {action}
    </div>
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
 * Uses role="alert" so the message is announced immediately.
 */
export function ErrorState({ message, onRetry, retryLabel, testId }: ErrorStateProps) {
  return (
    <div
      role="alert"
      data-testid={testId}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, padding: '16px 0' }}
    >
      <span style={{ color: 'var(--color-error, #d6336c)' }}>
        <Text type="supporting">{message}</Text>
      </span>
      {onRetry !== undefined && retryLabel !== undefined && (
        <Button
          type="button"
          variant="secondary"
          onClick={onRetry}
          data-testid={testId !== undefined ? `${testId}-retry` : undefined}
          label={retryLabel}
        />
      )}
    </div>
  )
}

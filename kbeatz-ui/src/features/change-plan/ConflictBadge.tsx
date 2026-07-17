import { useTranslation } from 'react-i18next'
import { Token } from '@astryxdesign/core/Token'
import type { PlanConflict } from '../../api/generated'

interface ConflictBadgeProps {
  /** The conflict to render as a badge. */
  readonly conflict: PlanConflict
}

/**
 * ConflictBadge - a single conflict rendered as a small error token with its
 * human-readable message. Conflicts cause a release to be skipped on apply.
 *
 * The conflict type is surfaced via a localized label; the message text comes
 * from the server and is applied as the token's accessible description.
 */
export function ConflictBadge({ conflict }: ConflictBadgeProps) {
  const { t } = useTranslation()
  const typeLabel = t(`changePlan.conflictType.${conflict.type}`, {
    defaultValue: conflict.type,
  })

  return (
    <Token
      label={`${typeLabel}: ${conflict.message}`}
      color="red"
      size="sm"
      data-testid={`conflict-badge-${conflict.type}`}
      description={conflict.message}
    />
  )
}
